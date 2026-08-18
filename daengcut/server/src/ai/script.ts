import fs from 'node:fs/promises';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, describeAiError } from './anthropic.js';
import { config } from '../config.js';
import { logger } from '../util/log.js';
import { AppError } from '../util/errors.js';

const log = logger('script');

// 한국어 TTS 는 대략 초당 5~6글자를 읽는다. 내레이션 분량 상한을 잡는 데 쓴다.
const CHARS_PER_SECOND = 5.5;

export type Tone = 'cute' | 'funny' | 'emotional' | 'informative';
export type Persona = 'dog' | 'owner' | 'narrator';

export const TONE_LABELS: Record<Tone, string> = {
  cute: '귀엽고 사랑스럽게',
  funny: '웃기고 리듬감 있게',
  emotional: '잔잔하고 감성적으로',
  informative: '정보를 담아 담백하게',
};

export const PERSONA_LABELS: Record<Persona, string> = {
  dog: '강아지가 직접 말하는 1인칭 시점',
  owner: '보호자가 옆에서 말을 거는 시점',
  narrator: '제3자 내레이터 시점',
};

export interface ScriptClipInput {
  /** 클립 순서 (0부터) */
  index: number;
  /** 최종 영상에서 이 클립이 차지하는 길이(초) */
  durationSec: number;
  /** 이 클립을 대표하는 정지화면 파일 경로들 */
  framePaths: string[];
}

export interface ScriptOptions {
  tone: Tone;
  persona: Persona;
  dogName: string;
  dogBreed: string;
  /** "오늘 처음 바다에 갔어요" 처럼 영상만 봐서는 모를 배경 정보 */
  context: string;
  /** 내레이션 대사까지 만들지 여부 (자막만 쓸 거면 false) */
  withNarration: boolean;
}

export const DEFAULT_SCRIPT_OPTIONS: ScriptOptions = {
  tone: 'cute',
  persona: 'dog',
  dogName: '',
  dogBreed: '',
  context: '',
  withNarration: true,
};

const scriptSchema = z.object({
  clips: z.array(
    z.object({
      clipIndex: z.number().int().describe('입력으로 준 클립 번호'),
      whatHappens: z.string().describe('이 클립에서 실제로 보이는 장면을 한 문장으로'),
      captions: z
        .array(
          z.object({
            text: z.string().describe('화면에 뜰 자막 한 덩어리'),
            emphasis: z.boolean().describe('가장 강조하고 싶은 한 덩어리면 true'),
          }),
        )
        .describe('이 클립에 넣을 자막. 보통 1개, 길면 2개'),
      narration: z.string().describe('이 클립에서 읽어줄 내레이션. 필요 없으면 빈 문자열'),
    }),
  ),
  title: z.string().describe('유튜브 제목'),
  description: z.string().describe('유튜브 설명란 문구'),
  tags: z.array(z.string()).describe('유튜브 태그'),
});

export type GeneratedScript = z.infer<typeof scriptSchema>;

function buildSystemPrompt(opts: ScriptOptions): string {
  const subject = opts.dogName
    ? `'${opts.dogName}'${opts.dogBreed ? ` (${opts.dogBreed})` : ''}`
    : '반려견';

  return `당신은 반려동물 채널의 유튜브 숏츠를 만드는 편집자입니다.
주인공은 ${subject}입니다.

말투는 ${TONE_LABELS[opts.tone]}, 화자는 ${PERSONA_LABELS[opts.persona]}으로 씁니다.

자막 규칙
- 한 덩어리는 한국어 12자 내외. 길어도 20자를 넘기지 않습니다.
- 클립 하나에 자막 1개가 기본이고, 클립이 4초를 넘길 때만 2개까지 씁니다.
- 첫 번째 클립의 자막은 손가락을 멈추게 하는 후킹 문장이어야 합니다.
  질문을 던지거나, 결과를 살짝 흘리거나, 상황을 한 방에 요약하세요.
- 가장 임팩트 있는 자막 하나에만 emphasis 를 true 로 둡니다.
- 이모지는 쓰지 않습니다. 자막 폰트에서 깨집니다.

내레이션 규칙
- 자막을 그대로 읽지 말고, 자막이 말하지 않은 쪽을 채웁니다.
- 각 클립의 길이 안에 읽을 수 있어야 합니다. 초당 약 ${CHARS_PER_SECOND}글자로 계산하세요.
- 어색하면 비워 두세요. 억지로 채운 내레이션은 없느니만 못합니다.

가장 중요한 규칙
- 화면에 실제로 보이는 것만 씁니다. 짖는 소리, 냄새, 강아지의 속마음처럼
  프레임에서 확인할 수 없는 것을 사실처럼 단정하지 마세요.
- 장면이 평범하면 평범한 대로 씁니다. 없는 사건을 지어내지 마세요.

제목·설명·태그
- 제목은 40자 이내, 낚시성 과장 없이. 끝에 #Shorts 를 붙입니다.
- 설명은 2~3문장.
- 태그는 8~15개, # 없이 단어만. 한국어 위주로 하되 영어를 조금 섞습니다.`;
}

function buildUserPrompt(clips: ScriptClipInput[], opts: ScriptOptions): string {
  const lines = [
    `클립 ${clips.length}개짜리 숏츠입니다. 각 클립의 대표 장면을 이미지로 함께 보냅니다.`,
    '',
    ...clips.map((clip) => {
      const maxChars = Math.floor(clip.durationSec * CHARS_PER_SECOND);
      return `- 클립 ${clip.index}: ${clip.durationSec.toFixed(1)}초 (내레이션은 ${maxChars}자 이내)`;
    }),
  ];

  if (opts.context.trim()) {
    lines.push('', `영상 배경 설명: ${opts.context.trim()}`);
  }
  if (!opts.withNarration) {
    lines.push('', '이번에는 내레이션 없이 자막만 씁니다. narration 은 전부 빈 문자열로 두세요.');
  }

  lines.push(
    '',
    '클립마다 whatHappens(실제로 보이는 장면), captions, narration 을 채우고,',
    '마지막에 유튜브 제목·설명·태그를 만들어 주세요.',
  );

  return lines.join('\n');
}

async function imageBlock(framePath: string): Promise<Anthropic.ImageBlockParam> {
  const data = await fs.readFile(framePath);
  return {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: data.toString('base64') },
  };
}

/**
 * 클립별 대표 프레임을 Claude 에 보여주고 숏츠 대본을 받아온다.
 * 이미지가 앞, 지시문이 뒤에 오도록 배치한다.
 */
export async function generateScript(
  clips: ScriptClipInput[],
  options: Partial<ScriptOptions> = {},
): Promise<GeneratedScript> {
  const opts = { ...DEFAULT_SCRIPT_OPTIONS, ...options };

  if (clips.length === 0) {
    throw new AppError('대본을 쓸 클립이 없습니다.', 400);
  }

  const content: Anthropic.ContentBlockParam[] = [];

  for (const clip of clips) {
    content.push({ type: 'text', text: `[클립 ${clip.index}]` });
    for (const framePath of clip.framePaths) {
      content.push(await imageBlock(framePath));
    }
  }

  content.push({ type: 'text', text: buildUserPrompt(clips, opts) });

  const started = Date.now();

  try {
    const response = await anthropic().messages.parse({
      model: config.anthropic.model,
      max_tokens: 8000,
      system: buildSystemPrompt(opts),
      messages: [{ role: 'user', content }],
      output_config: { format: zodOutputFormat(scriptSchema) },
    });

    if (response.stop_reason === 'refusal') {
      throw new AppError(
        'AI가 이 영상에 대한 대본 작성을 거절했습니다.',
        400,
        response.stop_details?.explanation ?? undefined,
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new AppError('AI 응답을 해석하지 못했습니다.', 502, '잠시 후 다시 시도해 주세요.');
    }

    log.info(
      `대본 생성 완료 — 클립 ${parsed.clips.length}개, ` +
        `토큰 ${response.usage.input_tokens}/${response.usage.output_tokens}, ` +
        `${((Date.now() - started) / 1000).toFixed(1)}초`,
    );

    return normalize(parsed, clips, opts);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw describeAiError(err);
  }
}

/**
 * 모델이 클립을 빠뜨리거나 순서를 섞어 보내도 타임라인을 만들 수 있게 정리한다.
 * 자막이 너무 길면 잘라내는 대신 그대로 두고, 줄바꿈은 렌더러가 처리한다.
 */
function normalize(
  script: GeneratedScript,
  clips: ScriptClipInput[],
  opts: ScriptOptions,
): GeneratedScript {
  const byIndex = new Map(script.clips.map((c) => [c.clipIndex, c]));

  const normalizedClips = clips.map((clip) => {
    const found = byIndex.get(clip.index);
    if (!found) {
      log.warn(`클립 ${clip.index}의 대본이 비어 있어 빈 값으로 채웁니다.`);
      return { clipIndex: clip.index, whatHappens: '', captions: [], narration: '' };
    }
    return {
      ...found,
      clipIndex: clip.index,
      captions: found.captions.filter((c) => c.text.trim()),
      narration: opts.withNarration ? found.narration.trim() : '',
    };
  });

  // emphasis 는 영상 전체에서 하나만 남긴다. 여기저기 강조하면 아무것도 강조되지 않는다.
  let emphasisUsed = false;
  for (const clip of normalizedClips) {
    for (const caption of clip.captions) {
      if (caption.emphasis && emphasisUsed) caption.emphasis = false;
      else if (caption.emphasis) emphasisUsed = true;
    }
  }

  return {
    clips: normalizedClips,
    title: script.title.trim(),
    description: script.description.trim(),
    tags: script.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean),
  };
}
