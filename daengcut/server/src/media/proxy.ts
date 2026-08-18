import path from 'node:path';
import { runFfmpeg } from './ffmpeg.js';
import type { MediaInfo } from './probe.js';

/**
 * 브라우저에서 스크럽(타임라인 드래그)하기 좋은 저화질 사본을 만든다.
 * 원본은 보통 4K/고비트레이트라 그대로 미리보기에 쓰면 버벅인다.
 */
export async function buildProxy(
  info: MediaInfo,
  outDir: string,
  onProgress?: (ratio: number) => void,
): Promise<string> {
  const outPath = path.join(outDir, 'proxy.mp4');

  await runFfmpeg(
    [
      '-i', info.path,
      '-vf', "scale='min(640,iw)':-2",
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '30',
      // 0.5초마다 키프레임 → 타임라인 탐색이 즉각 반응한다.
      '-g', String(Math.max(1, Math.round(info.fps / 2))),
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      '-progress', 'pipe:1',
      '-y', outPath,
    ],
    {
      label: 'proxy',
      totalDurationSec: info.durationSec,
      onProgress: onProgress ? (ratio) => onProgress(ratio) : undefined,
    },
  );

  return outPath;
}

/** 프로젝트 목록에 띄울 대표 썸네일 */
export async function buildThumbnail(info: MediaInfo, outDir: string): Promise<string> {
  const outPath = path.join(outDir, 'thumb.jpg');
  const seek = Math.min(info.durationSec * 0.25, Math.max(0, info.durationSec - 0.2));

  await runFfmpeg([
    '-ss', seek.toFixed(3),
    '-i', info.path,
    '-frames:v', '1',
    '-vf', "scale='min(480,iw)':-2",
    '-q:v', '4',
    '-y', outPath,
  ], { label: 'thumb' });

  return outPath;
}
