import fs from 'node:fs/promises';
import path from 'node:path';
import { runFfmpeg } from '../media/ffmpeg.js';
import { AppError } from '../util/errors.js';
import { logger } from '../util/log.js';
import { buildAss } from './ass.js';
import { atempoChain, blurFramingParts, framingFilters } from './framing.js';
import { resolveFont } from './fonts.js';
import { clipDuration, clipOffsets, timelineDuration } from '../timeline/types.js';
import type { Timeline } from '../timeline/types.js';

const log = logger('render');

export interface RenderSource {
  id: string;
  path: string;
  width: number;
  height: number;
  hasAudio: boolean;
  durationSec: number;
}

export interface RenderOptions {
  timeline: Timeline;
  /** sourceId → 원본 정보 */
  sources: Map<string, RenderSource>;
  outPath: string;
  /** 자막/폰트를 모아두는 임시 폴더. ffmpeg 는 이 폴더에서 실행된다. */
  workDir: string;
  /** assets/fonts 경로 */
  fontDir: string;
  /** 내레이션·배경음 상대경로의 기준 폴더 */
  assetRoot: string;
  /** preview 는 540x960 저화질로 빠르게, final 은 1080x1920 고화질로 */
  quality?: 'preview' | 'final';
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}

export interface RenderResult {
  outPath: string;
  durationSec: number;
  elapsedMs: number;
}

const AUDIO_NORM = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';

/** 배속을 감안한 setpts 표현식 */
function videoSpeedFilter(speed: number): string {
  return Math.abs(speed - 1) < 0.001 ? 'setpts=PTS-STARTPTS' : `setpts=(PTS-STARTPTS)/${speed}`;
}

export async function renderTimeline(opts: RenderOptions): Promise<RenderResult> {
  const started = Date.now();
  const { timeline, sources, quality = 'final' } = opts;

  if (timeline.clips.length === 0) {
    throw new AppError('클립이 하나도 없어 렌더링할 수 없습니다.', 400);
  }

  const total = timelineDuration(timeline);
  if (total <= 0) {
    throw new AppError('타임라인 길이가 0입니다.', 400);
  }

  const canvas = timeline.canvas;
  await fs.mkdir(opts.workDir, { recursive: true });
  await fs.mkdir(path.dirname(opts.outPath), { recursive: true });

  // ── 자막 파일과 폰트를 작업 폴더에 모은다 ──────────────────────────
  // ffmpeg 를 이 폴더에서 실행하고 상대경로로 넘기면 경로 이스케이프 문제가 사라진다.
  const font = resolveFont(opts.fontDir, timeline.style.fontFamily);
  const fontsDir = path.join(opts.workDir, 'fonts');
  await fs.mkdir(fontsDir, { recursive: true });
  if (font) {
    await fs.copyFile(font.file, path.join(fontsDir, path.basename(font.file)));
  }

  const hasCaptions = timeline.captions.some((c) => c.text.trim() && c.end > c.start);
  if (hasCaptions) {
    const ass = buildAss(timeline.captions, timeline.style, {
      width: canvas.width,
      height: canvas.height,
      fontFamily: font?.family ?? 'Sans',
    });
    await fs.writeFile(path.join(opts.workDir, 'subs.ass'), ass, 'utf8');
  }

  // ── 입력 구성 ─────────────────────────────────────────────────────
  const inputs: string[] = [];
  const filters: string[] = [];
  const concatLabels: string[] = [];
  let inputIndex = 0;

  timeline.clips.forEach((clip, i) => {
    const source = sources.get(clip.sourceId);
    if (!source) {
      throw new AppError(`클립 ${i + 1}의 원본 영상을 찾을 수 없습니다.`, 400);
    }

    const rawDuration = Math.max(0.05, clip.out - clip.in);
    const outDuration = clipDuration(clip);

    const videoInput = inputIndex++;
    inputs.push('-ss', clip.in.toFixed(3), '-t', rawDuration.toFixed(3), '-i', source.path);

    // 원본에 소리가 없으면 무음 트랙을 따로 만들어 붙인다 (concat 은 스트림 수가 맞아야 한다).
    let audioInput = videoInput;
    if (!source.hasAudio) {
      audioInput = inputIndex++;
      inputs.push('-f', 'lavfi', '-t', outDuration.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
    }

    const chain: string[] = [videoSpeedFilter(clip.speed), `fps=${canvas.fps}`];

    if (clip.framing.mode === 'blur') {
      const parts = blurFramingParts(clip, source, canvas);
      filters.push(`[${videoInput}:v]${chain.join(',')},split=2[c${i}bg][c${i}fg]`);
      filters.push(`[c${i}bg]${parts.background.join(',')}[c${i}bgo]`);
      filters.push(`[c${i}fg]${parts.foreground.join(',')}[c${i}fgo]`);
      filters.push(
        `[c${i}bgo][c${i}fgo]overlay=x=${parts.overlayX}:y=${parts.overlayY},` +
          `trim=end=${outDuration.toFixed(3)},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v${i}]`,
      );
    } else {
      chain.push(...framingFilters(clip, source, canvas));
      chain.push(`trim=end=${outDuration.toFixed(3)}`, 'setpts=PTS-STARTPTS', 'setsar=1', 'format=yuv420p');
      filters.push(`[${videoInput}:v]${chain.join(',')}[v${i}]`);
    }

    const audioChain: string[] = ['asetpts=PTS-STARTPTS'];
    if (source.hasAudio) {
      audioChain.push(...atempoChain(clip.speed));
      audioChain.push(`volume=${clip.volume.toFixed(3)}`);
    }
    audioChain.push(
      AUDIO_NORM,
      // 영상 길이에 오디오를 정확히 맞춘다. 안 맞추면 클립을 이어 붙일 때 조금씩 밀린다.
      'apad',
      `atrim=end=${outDuration.toFixed(3)}`,
      'asetpts=PTS-STARTPTS',
    );
    filters.push(`[${audioInput}:a]${audioChain.join(',')}[a${i}]`);

    concatLabels.push(`[v${i}][a${i}]`);
  });

  // ── 클립 이어붙이기 ───────────────────────────────────────────────
  filters.push(
    `${concatLabels.join('')}concat=n=${timeline.clips.length}:v=1:a=1[vcat][acat]`,
  );

  // ── 자막 굽기 ─────────────────────────────────────────────────────
  let videoLabel = '[vcat]';
  if (hasCaptions) {
    filters.push(`[vcat]subtitles=subs.ass:fontsdir=fonts[vsub]`);
    videoLabel = '[vsub]';
  }

  const previewScale = quality === 'preview' ? Math.round(canvas.width / 2 / 2) * 2 : 0;
  if (previewScale) {
    filters.push(
      `${videoLabel}scale=${previewScale}:${Math.round(canvas.height / 2 / 2) * 2}[vout]`,
    );
    videoLabel = '[vout]';
  }

  // ── 오디오 믹싱: 원본 + 배경음 + 내레이션 ──────────────────────────
  let bedLabel = '[acat]';

  if (timeline.music) {
    const musicPath = path.resolve(opts.assetRoot, timeline.music.file);
    const musicInput = inputIndex++;
    // 배경음이 영상보다 짧으면 반복 재생하고, amix 의 duration=first 로 영상 길이에 맞춰 자른다.
    inputs.push('-stream_loop', '-1', '-i', musicPath);

    const fadeOutStart = Math.max(0, total - timeline.music.fadeOutSec);
    filters.push(
      `[${musicInput}:a]volume=${timeline.music.gain.toFixed(3)},` +
        `afade=t=in:st=0:d=${timeline.music.fadeInSec.toFixed(2)},` +
        `afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${timeline.music.fadeOutSec.toFixed(2)},` +
        `${AUDIO_NORM}[music]`,
    );
    filters.push(
      `[acat][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[bed]`,
    );
    bedLabel = '[bed]';
  }

  const narrationLines = timeline.narration.filter(
    (line) => line.audioFile && line.durationSec && line.text.trim(),
  );

  if (narrationLines.length > 0) {
    // 내레이션이 나오는 동안 원본/배경음 볼륨을 낮춘다 (더킹).
    const duckFilters = narrationLines.map((line) => {
      const end = line.start + (line.durationSec ?? 0) + 0.15;
      // 필터 옵션 값 안의 콤마는 ffmpeg 파서를 위해 이스케이프해야 한다.
      return `volume=enable='between(t\\,${line.start.toFixed(2)}\\,${end.toFixed(2)})':volume=${timeline.duckRatio.toFixed(2)}`;
    });
    filters.push(`${bedLabel}${duckFilters.join(',')}[bedduck]`);

    const narrationLabels: string[] = [];
    narrationLines.forEach((line, k) => {
      const audioPath = path.resolve(opts.assetRoot, line.audioFile as string);
      const narrationInput = inputIndex++;
      inputs.push('-i', audioPath);
      const delayMs = Math.round(line.start * 1000);
      filters.push(
        `[${narrationInput}:a]${AUDIO_NORM},adelay=delays=${delayMs}:all=1[n${k}]`,
      );
      narrationLabels.push(`[n${k}]`);
    });

    if (narrationLabels.length === 1) {
      filters.push(
        `[bedduck]${narrationLabels[0]}amix=inputs=2:duration=first:dropout_transition=0:normalize=0[amixed]`,
      );
    } else {
      filters.push(
        `${narrationLabels.join('')}amix=inputs=${narrationLabels.length}:duration=longest:dropout_transition=0:normalize=0[narr]`,
      );
      filters.push(
        `[bedduck][narr]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[amixed]`,
      );
    }
    bedLabel = '[amixed]';
  }

  // 마지막에 리미터를 걸어 소리가 찢어지는 걸 막는다.
  filters.push(`${bedLabel}alimiter=limit=0.95:level=disabled[aout]`);

  // ── 인코딩 ────────────────────────────────────────────────────────
  const args = [
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', videoLabel,
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', quality === 'preview' ? 'veryfast' : 'medium',
    '-crf', quality === 'preview' ? '30' : '20',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'high',
    '-r', String(canvas.fps),
    '-g', String(canvas.fps * 2),
    '-c:a', 'aac',
    '-b:a', quality === 'preview' ? '128k' : '192k',
    '-ar', '48000',
    '-ac', '2',
    '-movflags', '+faststart',
    '-t', total.toFixed(3),
    '-progress', 'pipe:1',
    '-y', opts.outPath,
  ];

  log.info(
    `렌더 시작 — 클립 ${timeline.clips.length}개, 자막 ${timeline.captions.length}개, ` +
      `내레이션 ${narrationLines.length}개, 길이 ${total.toFixed(1)}초 (${quality})`,
  );

  await runFfmpeg(args, {
    label: 'render',
    cwd: opts.workDir,
    totalDurationSec: total,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });

  const elapsedMs = Date.now() - started;
  log.info(`렌더 완료 — ${(elapsedMs / 1000).toFixed(1)}초 걸림 → ${opts.outPath}`);

  return { outPath: opts.outPath, durationSec: total, elapsedMs };
}

/** UI 가 클립 목록을 그릴 때 필요한, 각 클립의 최종 타임라인상 시작 위치 */
export function clipTimelinePositions(timeline: Timeline) {
  const offsets = clipOffsets(timeline.clips);
  return timeline.clips.map((clip, i) => ({
    id: clip.id,
    start: offsets[i] ?? 0,
    duration: clipDuration(clip),
  }));
}
