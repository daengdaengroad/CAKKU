import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import { config } from '../config.js';
import { AppError } from '../util/errors.js';
import { logger } from '../util/log.js';
import { audioDuration } from '../media/probe.js';

const log = logger('tts');

export interface TtsRequest {
  text: string;
  /** 이 줄만 다른 목소리를 쓰고 싶을 때. 비우면 .env 의 기본 목소리 */
  voice?: string | null;
  /** 저장할 mp3 경로 */
  outPath: string;
}

export interface TtsResult {
  path: string;
  durationSec: number;
}

export interface TtsProvider {
  readonly name: string;
  /** 이 제공자를 쓸 수 있는 상태인지 (키가 채워져 있는지) */
  readonly ready: boolean;
  synthesize(req: TtsRequest): Promise<TtsResult>;
}

async function writeAndMeasure(outPath: string, audio: Buffer): Promise<TtsResult> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, audio);
  return { path: outPath, durationSec: await audioDuration(outPath) };
}

// ── Google Cloud Text-to-Speech ────────────────────────────────────
// 유튜브 업로드와 같은 GCP 프로젝트를 쓸 수 있어서 설정이 한 번에 끝난다.
class GoogleTts implements TtsProvider {
  readonly name = 'google';
  private auth: GoogleAuth | null = null;

  get ready(): boolean {
    // GOOGLE_APPLICATION_CREDENTIALS 는 라이브러리가 환경변수로도 읽으므로
    // 값이 비어 있어도 머신에 기본 인증이 잡혀 있으면 동작할 수 있다.
    return true;
  }

  private client(): GoogleAuth {
    if (!this.auth) {
      this.auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        ...(config.tts.google.credentials ? { keyFile: config.tts.google.credentials } : {}),
      });
    }
    return this.auth;
  }

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const voiceName = req.voice || config.tts.google.voice;
    const languageCode = voiceName.split('-').slice(0, 2).join('-') || 'ko-KR';

    let token: string | null | undefined;
    try {
      token = await this.client().getAccessToken();
    } catch (err) {
      throw new AppError(
        '구글 TTS 인증에 실패했습니다.',
        401,
        '.env 의 GOOGLE_APPLICATION_CREDENTIALS 에 서비스 계정 JSON 경로가 맞는지 확인하세요. ' +
          `(${String(err)})`,
      );
    }

    const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: req.text },
        voice: { languageCode, name: voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, sampleRateHertz: 24000 },
      }),
    });

    if (!res.ok) {
      throw new AppError('구글 TTS 요청이 실패했습니다.', 502, `${res.status} ${await res.text()}`);
    }

    const body = (await res.json()) as { audioContent?: string };
    if (!body.audioContent) {
      throw new AppError('구글 TTS 응답에 음성 데이터가 없습니다.', 502);
    }

    return writeAndMeasure(req.outPath, Buffer.from(body.audioContent, 'base64'));
  }
}

// ── ElevenLabs ─────────────────────────────────────────────────────
class ElevenLabsTts implements TtsProvider {
  readonly name = 'elevenlabs';

  get ready(): boolean {
    return Boolean(config.tts.elevenlabs.apiKey && config.tts.elevenlabs.voiceId);
  }

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const voiceId = req.voice || config.tts.elevenlabs.voiceId;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': config.tts.elevenlabs.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: req.text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      throw new AppError('ElevenLabs TTS 요청이 실패했습니다.', 502, `${res.status} ${await res.text()}`);
    }

    return writeAndMeasure(req.outPath, Buffer.from(await res.arrayBuffer()));
  }
}

// ── OpenAI ─────────────────────────────────────────────────────────
class OpenAiTts implements TtsProvider {
  readonly name = 'openai';

  get ready(): boolean {
    return Boolean(config.tts.openai.apiKey);
  }

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.tts.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: req.voice || config.tts.openai.voice,
        input: req.text,
        response_format: 'mp3',
      }),
    });

    if (!res.ok) {
      throw new AppError('OpenAI TTS 요청이 실패했습니다.', 502, `${res.status} ${await res.text()}`);
    }

    return writeAndMeasure(req.outPath, Buffer.from(await res.arrayBuffer()));
  }
}

const PROVIDERS: Record<string, () => TtsProvider> = {
  google: () => new GoogleTts(),
  elevenlabs: () => new ElevenLabsTts(),
  openai: () => new OpenAiTts(),
};

let cached: TtsProvider | null | undefined;

/** .env 설정에 맞는 TTS 제공자. 설정이 없으면 null (내레이션 없이 자막만 나간다). */
export function ttsProvider(): TtsProvider | null {
  if (cached !== undefined) return cached;

  const factory = PROVIDERS[config.tts.provider];
  if (!factory) {
    cached = null;
    return cached;
  }

  const provider = factory();
  if (!provider.ready) {
    log.warn(`TTS_PROVIDER=${config.tts.provider} 인데 필요한 키가 비어 있어 내레이션을 건너뜁니다.`);
    cached = null;
    return cached;
  }

  log.info(`TTS 제공자: ${provider.name}`);
  cached = provider;
  return cached;
}

export function isTtsConfigured(): boolean {
  return ttsProvider() !== null;
}

/** 테스트나 설정 변경 후 다시 읽게 한다. */
export function resetTtsProvider() {
  cached = undefined;
}
