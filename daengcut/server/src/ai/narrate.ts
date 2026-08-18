import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { audioDuration } from '../media/probe.js';
import { timelineDuration } from '../timeline/types.js';
import type { NarrationLine, Timeline } from '../timeline/types.js';
import { logger } from '../util/log.js';
import { ttsProvider } from './tts.js';

const log = logger('narrate');

/** 내레이션 사이에 두는 최소 간격. 이보다 붙으면 말이 겹쳐 들린다. */
const MIN_GAP_SEC = 0.15;

export interface NarrateOptions {
  /** mp3 를 저장할 폴더 (절대경로) */
  audioDir: string;
  /** 타임라인에 기록할 상대경로의 기준 폴더 */
  assetRoot: string;
  onProgress?: (done: number, total: number) => void;
}

/** 같은 문장 + 같은 목소리면 같은 파일명이 나온다. 한 줄만 고쳤을 때 나머지를 다시 만들지 않기 위함. */
function audioFileName(line: NarrationLine, provider: string): string {
  const hash = crypto
    .createHash('sha1')
    .update(`${provider}|${line.voice ?? ''}|${line.text.trim()}`)
    .digest('hex')
    .slice(0, 12);
  return `n_${hash}.mp3`;
}

/**
 * 내레이션 줄을 음성으로 만들고, 실제 길이를 재서 타임라인에 반영한다.
 * TTS 설정이 없으면 타임라인을 그대로 돌려준다 (자막만 있는 영상이 된다).
 */
export async function synthesizeNarration(
  timeline: Timeline,
  opts: NarrateOptions,
): Promise<Timeline> {
  const provider = ttsProvider();
  const lines = timeline.narration.filter((line) => line.text.trim());

  if (!provider || lines.length === 0) {
    if (!provider && lines.length > 0) {
      log.info('TTS 설정이 없어 내레이션을 음성으로 만들지 않습니다.');
    }
    return timeline;
  }

  await fs.mkdir(opts.audioDir, { recursive: true });

  const results: NarrationLine[] = [];
  let done = 0;

  for (const line of lines) {
    const fileName = audioFileName(line, provider.name);
    const absPath = path.join(opts.audioDir, fileName);
    const relPath = path.relative(opts.assetRoot, absPath);

    let durationSec: number;
    try {
      // 이미 같은 문장을 합성해 둔 게 있으면 재사용한다.
      await fs.access(absPath);
      durationSec = await audioDuration(absPath);
      log.debug(`재사용: ${fileName}`);
    } catch {
      const result = await provider.synthesize({
        text: line.text.trim(),
        voice: line.voice,
        outPath: absPath,
      });
      durationSec = result.durationSec;
      log.debug(`합성: ${fileName} (${durationSec.toFixed(2)}초)`);
    }

    results.push({ ...line, audioFile: relPath, durationSec });
    done++;
    opts.onProgress?.(done, lines.length);
  }

  const narration = resolveOverlaps(results);
  warnIfTooLong(narration, timelineDuration(timeline));

  return { ...timeline, narration };
}

/**
 * 합성된 음성이 예상보다 길어 다음 줄과 겹치면 뒤로 밀어 준다.
 * 대본을 쓸 때 길이를 계산해 두지만, 실제 TTS 속도는 문장마다 다르다.
 */
function resolveOverlaps(lines: NarrationLine[]): NarrationLine[] {
  const sorted = [...lines].sort((a, b) => a.start - b.start);
  let cursor = 0;

  return sorted.map((line) => {
    const start = Math.max(line.start, cursor);
    cursor = start + (line.durationSec ?? 0) + MIN_GAP_SEC;
    if (start > line.start + 0.01) {
      log.debug(`내레이션이 겹쳐 ${line.start.toFixed(2)}s → ${start.toFixed(2)}s 로 밀었습니다.`);
    }
    return { ...line, start };
  });
}

function warnIfTooLong(lines: NarrationLine[], videoDuration: number) {
  const last = lines[lines.length - 1];
  if (!last) return;

  const narrationEnd = last.start + (last.durationSec ?? 0);
  if (narrationEnd > videoDuration + 0.3) {
    log.warn(
      `내레이션이 영상보다 ${(narrationEnd - videoDuration).toFixed(1)}초 깁니다. ` +
        '대본을 줄이거나 클립을 늘리세요.',
    );
  }
}
