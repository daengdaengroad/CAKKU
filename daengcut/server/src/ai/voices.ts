import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { workspaceDir } from '../paths.js';
import { AppError } from '../util/errors.js';
import { logger } from '../util/log.js';
import { googleAccessToken, ttsProvider } from './tts.js';
import type { TtsProviderName } from '../store/settings.js';

const log = logger('voices');

export interface Voice {
  id: string;
  /** 화면에 보여줄 이름 */
  label: string;
  /** "여성 · 자연스러움" 같은 부가 설명 */
  note: string;
}

/** 미리듣기에 쓸 문장. 반려견 채널에서 실제로 나올 법한 길이와 말투로. */
export const PREVIEW_TEXT = '오늘도 산책 다녀왔어요. 이 표정 좀 보세요.';

// ── 구글 ───────────────────────────────────────────────────────────
interface GoogleVoice {
  name?: string;
  ssmlGender?: string;
  languageCodes?: string[];
}

const GENDER_LABEL: Record<string, string> = {
  FEMALE: '여성',
  MALE: '남성',
  NEUTRAL: '중성',
};

/** 좋은 순서대로. 뒤로 갈수록 오래된 방식이라 기계음에 가깝다. */
const GOOGLE_TIERS = [
  { match: 'Chirp3-HD', note: '가장 자연스러움' },
  { match: 'Chirp-HD', note: '자연스러움' },
  { match: 'Neural2', note: '무난함' },
  { match: 'Wavenet', note: '무난함' },
  { match: 'Standard', note: '기계음에 가까움' },
];

function googleTier(name: string): { rank: number; note: string } {
  const index = GOOGLE_TIERS.findIndex((tier) => name.includes(tier.match));
  if (index === -1) return { rank: GOOGLE_TIERS.length, note: '' };
  return { rank: index, note: GOOGLE_TIERS[index]?.note ?? '' };
}

async function googleVoices(): Promise<Voice[]> {
  const token = await googleAccessToken();

  const res = await fetch('https://texttospeech.googleapis.com/v1/voices?languageCode=ko-KR', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new AppError('구글 목소리 목록을 불러오지 못했습니다.', 502, `${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { voices?: GoogleVoice[] };

  return (body.voices ?? [])
    .filter((voice) => voice.name && voice.languageCodes?.includes('ko-KR'))
    .map((voice) => {
      const name = voice.name as string;
      const tier = googleTier(name);
      // ko-KR-Chirp3-HD-Leda → Leda
      const shortName = name.split('-').pop() ?? name;
      const gender = GENDER_LABEL[voice.ssmlGender ?? ''] ?? '';

      return {
        id: name,
        label: shortName,
        note: [gender, tier.note].filter(Boolean).join(' · '),
        rank: tier.rank,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .map(({ id, label, note }) => ({ id, label, note }));
}

// ── 일레븐랩스 ─────────────────────────────────────────────────────
interface ElevenVoice {
  voice_id?: string;
  name?: string;
  labels?: Record<string, string>;
}

async function elevenlabsVoices(): Promise<Voice[]> {
  if (!config.tts.elevenlabs.apiKey) {
    throw new AppError('일레븐랩스 API 키가 없습니다.', 400, '설정 화면에서 키를 먼저 저장해 주세요.');
  }

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': config.tts.elevenlabs.apiKey },
  });

  if (!res.ok) {
    throw new AppError(
      '일레븐랩스 목소리 목록을 불러오지 못했습니다.',
      502,
      `${res.status} ${await res.text()}`,
    );
  }

  const body = (await res.json()) as { voices?: ElevenVoice[] };

  return (body.voices ?? [])
    .filter((voice) => voice.voice_id)
    .map((voice) => ({
      id: voice.voice_id as string,
      label: voice.name ?? voice.voice_id as string,
      note: [voice.labels?.gender, voice.labels?.description, voice.labels?.age]
        .filter(Boolean)
        .join(' · '),
    }));
}

// ── OpenAI ─────────────────────────────────────────────────────────
// 목록 API 가 없어 문서에 있는 목소리를 그대로 적어둔다.
const OPENAI_VOICES: Voice[] = [
  { id: 'nova', label: 'Nova', note: '밝고 또렷함' },
  { id: 'shimmer', label: 'Shimmer', note: '부드럽고 차분함' },
  { id: 'coral', label: 'Coral', note: '따뜻함' },
  { id: 'sage', label: 'Sage', note: '차분함' },
  { id: 'alloy', label: 'Alloy', note: '중성적' },
  { id: 'echo', label: 'Echo', note: '낮고 담담함' },
  { id: 'ash', label: 'Ash', note: '단단함' },
  { id: 'ballad', label: 'Ballad', note: '감성적' },
  { id: 'onyx', label: 'Onyx', note: '낮은 남성' },
  { id: 'fable', label: 'Fable', note: '이야기하듯' },
];

/** 지금 설정된 제공자의 한국어 목소리 목록 */
export async function listVoices(): Promise<{ provider: TtsProviderName; voices: Voice[] }> {
  const provider = config.tts.provider;

  switch (provider) {
    case 'google':
      return { provider, voices: await googleVoices() };
    case 'elevenlabs':
      return { provider, voices: await elevenlabsVoices() };
    case 'openai':
      return { provider, voices: OPENAI_VOICES };
    default:
      return { provider, voices: [] };
  }
}

/** 지금 고른 목소리가 무엇인지 (설정에 저장된 값) */
export function currentVoiceId(): string {
  switch (config.tts.provider) {
    case 'google':
      return config.tts.google.voice;
    case 'elevenlabs':
      return config.tts.elevenlabs.voiceId;
    case 'openai':
      return config.tts.openai.voice;
    default:
      return '';
  }
}

/**
 * 목소리 샘플을 만들어 파일 경로를 돌려준다.
 * 같은 목소리를 또 들어볼 때 API 를 다시 부르지 않도록 파일로 남긴다.
 */
export async function previewVoice(voiceId: string): Promise<string> {
  const provider = ttsProvider();
  if (!provider) {
    throw new AppError(
      '목소리 설정이 아직 안 되어 있습니다.',
      400,
      '설정 화면에서 제공자와 키를 먼저 저장해 주세요.',
    );
  }

  const safeName = `${provider.name}_${voiceId.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp3`;
  const outPath = path.join(workspaceDir, 'previews', safeName);

  try {
    await fs.access(outPath);
    return outPath;
  } catch {
    /* 아직 만든 적 없으면 아래에서 만든다 */
  }

  log.info(`목소리 미리듣기 생성: ${provider.name} / ${voiceId}`);
  const result = await provider.synthesize({ text: PREVIEW_TEXT, voice: voiceId, outPath });
  return result.path;
}
