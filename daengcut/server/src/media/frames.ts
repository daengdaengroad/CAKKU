import path from 'node:path';
import fs from 'node:fs/promises';
import { runFfmpeg } from './ffmpeg.js';
import type { MediaInfo } from './probe.js';
import type { SourceAnalysis } from './analyze.js';

export interface ExtractedFrame {
  t: number;
  path: string;
}

/** 지정한 시각의 정지화면을 JPEG 로 뽑는다. AI 비전 분석에 넣을 재료. */
export async function extractFrames(
  info: MediaInfo,
  timestamps: number[],
  outDir: string,
  opts: { maxWidth?: number; quality?: number } = {},
): Promise<ExtractedFrame[]> {
  const maxWidth = opts.maxWidth ?? 768;
  const quality = opts.quality ?? 4;

  await fs.mkdir(outDir, { recursive: true });

  const frames: ExtractedFrame[] = [];

  for (const [index, t] of timestamps.entries()) {
    // 영상 끝을 살짝 넘기면 빈 파일이 나오므로 안쪽으로 당긴다.
    const seek = Math.min(Math.max(0, t), Math.max(0, info.durationSec - 0.1));
    const outPath = path.join(outDir, `f${String(index).padStart(3, '0')}_${seek.toFixed(2)}.jpg`);

    await runFfmpeg([
      '-ss', seek.toFixed(3),
      '-i', info.path,
      '-frames:v', '1',
      '-vf', `scale='min(${maxWidth},iw)':-2`,
      '-q:v', String(quality),
      '-y', outPath,
    ], { label: `frame@${seek.toFixed(1)}s` });

    frames.push({ t: seek, path: outPath });
  }

  return frames;
}

/**
 * 비전 분석에 쓸 시각들을 고른다.
 * 장면 전환 직후를 우선하되, 전환이 없으면 균등 간격으로 채운다.
 */
export function chooseFrameTimestamps(
  info: MediaInfo,
  analysis: SourceAnalysis,
  count = 8,
): number[] {
  const picked: number[] = [];
  const minGap = Math.max(0.8, info.durationSec / (count * 2));

  const push = (t: number) => {
    const clamped = Math.min(Math.max(0.2, t), Math.max(0.2, info.durationSec - 0.2));
    if (picked.some((existing) => Math.abs(existing - clamped) < minGap)) return;
    picked.push(clamped);
  };

  // 1순위: 장면 전환 점수가 높은 지점 직후 (새 장면의 대표 프레임)
  [...analysis.sceneCuts]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .forEach((cut) => push(cut.t + 0.15));

  // 2순위: 움직임이 가장 활발한 지점
  [...analysis.interest]
    .sort((a, b) => b.value - a.value)
    .slice(0, count * 3)
    .forEach((s) => {
      if (picked.length < count) push(s.t);
    });

  // 3순위: 그래도 모자라면 균등 간격으로 채운다.
  for (let i = 0; picked.length < count && i < count * 2; i++) {
    push(((i + 0.5) / count) * info.durationSec);
  }

  return picked.sort((a, b) => a - b).slice(0, count);
}
