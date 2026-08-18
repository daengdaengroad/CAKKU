import { runFfmpeg } from './ffmpeg.js';
import type { MediaInfo } from './probe.js';
import { logger } from '../util/log.js';

const log = logger('analyze');

export interface Sample {
  t: number;
  value: number;
}

export interface SceneCut {
  t: number;
  score: number;
}

export interface SourceAnalysis {
  durationSec: number;
  /** 화면이 확 바뀌는 지점 (컷 편집의 자연스러운 경계) */
  sceneCuts: SceneCut[];
  /** 움직임 정도 0~1 (~4fps 샘플) */
  motion: Sample[];
  /** 소리 크기 0~1 (0.5초 단위) */
  loudness: Sample[];
  /** 움직임+소리를 합친 "볼 만한 정도" 곡선 0~1 */
  interest: Sample[];
}

/** `metadata=print:file=-` 출력 형식을 파싱한다.
 *   frame:12  pts:1000  pts_time:0.5
 *   lavfi.scene_score=0.0123
 */
function parseMetadataStream(text: string, key: string): Sample[] {
  const out: Sample[] = [];
  let pendingTime: number | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('frame:')) {
      const match = /pts_time:\s*([0-9.]+)/.exec(line);
      pendingTime = match?.[1] !== undefined ? Number(match[1]) : null;
      continue;
    }

    if (line.startsWith(key)) {
      const value = line.slice(line.indexOf('=') + 1).trim();
      const num = value === '-inf' ? Number.NEGATIVE_INFINITY : Number(value);
      if (pendingTime !== null && !Number.isNaN(num)) {
        out.push({ t: pendingTime, value: num });
      }
    }
  }
  return out;
}

/** 화면 전환 지점 찾기. threshold 가 낮을수록 잘게 쪼갠다. */
export async function detectScenes(filePath: string, threshold = 0.28): Promise<SceneCut[]> {
  let stdout = '';
  await runFfmpeg(
    [
      '-i', filePath,
      '-filter_complex', `select='gt(scene,${threshold})',metadata=print:file=-`,
      '-an',
      '-f', 'null',
      '-',
    ],
    { label: 'scene-detect', onStdoutLine: (line) => { stdout += line + '\n'; } },
  );

  return parseMetadataStream(stdout, 'lavfi.scene_score').map((s) => ({ t: s.t, score: s.value }));
}

/** 프레임 간 변화량을 시간축으로 훑는다. 강아지가 뛰는 구간은 높고, 자는 구간은 낮다. */
export async function sampleMotion(filePath: string, fps = 4): Promise<Sample[]> {
  let stdout = '';
  await runFfmpeg(
    [
      '-i', filePath,
      // gte(scene,0) 은 항상 참이라 모든 프레임이 통과하지만, scene 을 참조해야 점수가 계산된다.
      '-filter_complex', `fps=${fps},select='gte(scene\\,0)',metadata=print:file=-`,
      '-an',
      '-f', 'null',
      '-',
    ],
    { label: 'motion', onStdoutLine: (line) => { stdout += line + '\n'; } },
  );

  return parseMetadataStream(stdout, 'lavfi.scene_score');
}

/** 0.5초 단위 소리 크기. 짖거나 사람이 말하는 구간을 찾는 데 쓴다. */
export async function sampleLoudness(filePath: string): Promise<Sample[]> {
  let stdout = '';
  await runFfmpeg(
    [
      '-i', filePath,
      // 8000Hz 로 리샘플 후 4000 샘플(=0.5초)씩 끊어서 구간별 RMS 를 뽑는다.
      '-af',
      'aresample=8000,asetnsamples=n=4000,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
      '-vn',
      '-f', 'null',
      '-',
    ],
    { label: 'loudness', onStdoutLine: (line) => { stdout += line + '\n'; } },
  );

  return parseMetadataStream(stdout, 'lavfi.astats.Overall.RMS_level');
}

function percentile(values: number[], p: number): number {
  const finite = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (finite.length === 0) return 0;
  const idx = Math.min(finite.length - 1, Math.max(0, Math.round((finite.length - 1) * p)));
  return finite[idx] as number;
}

/** 상위 p95 를 1.0 으로 두고 0~1 로 편다. 영상마다 절대값이 제각각이라 상대 정규화가 필요하다. */
function normalizeMotion(samples: Sample[]): Sample[] {
  const top = percentile(samples.map((s) => s.value), 0.95);
  if (top <= 0) return samples.map((s) => ({ t: s.t, value: 0 }));
  return samples.map((s) => ({ t: s.t, value: Math.min(1, Math.max(0, s.value / top)) }));
}

/** dB(-inf ~ 0) 를 0~1 로. -50dB 이하는 사실상 정적으로 본다. */
function normalizeLoudness(samples: Sample[]): Sample[] {
  return samples.map((s) => {
    if (!Number.isFinite(s.value)) return { t: s.t, value: 0 };
    return { t: s.t, value: Math.min(1, Math.max(0, (s.value + 50) / 50)) };
  });
}

function valueAt(samples: Sample[], t: number): number {
  if (samples.length === 0) return 0;
  // 샘플이 시간순이므로 이진 탐색으로 가장 가까운 값을 찾는다.
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((samples[mid] as Sample).t < t) lo = mid + 1;
    else hi = mid;
  }
  return (samples[lo] as Sample).value;
}

function smooth(samples: Sample[], windowSec: number): Sample[] {
  if (samples.length < 2) return samples;
  const step = ((samples[samples.length - 1] as Sample).t - (samples[0] as Sample).t) / (samples.length - 1) || 0.25;
  const half = Math.max(1, Math.round(windowSec / step / 2));

  return samples.map((s, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      const neighbour = samples[j];
      if (!neighbour) continue;
      sum += neighbour.value;
      count++;
    }
    return { t: s.t, value: count ? sum / count : s.value };
  });
}

const MOTION_WEIGHT = 0.65;
const AUDIO_WEIGHT = 0.35;

/** 원본 영상 하나를 분석해 "어디가 볼 만한지" 곡선을 만든다. */
export async function analyzeSource(info: MediaInfo): Promise<SourceAnalysis> {
  const started = Date.now();

  const [sceneCuts, rawMotion] = await Promise.all([
    detectScenes(info.path),
    sampleMotion(info.path),
  ]);

  // 소리가 없는 영상이면 라우드니스 분석은 건너뛴다.
  const rawLoudness = info.hasAudio ? await sampleLoudness(info.path) : [];

  const motion = normalizeMotion(rawMotion);
  const loudness = normalizeLoudness(rawLoudness);

  const interest = smooth(
    motion.map((m) => ({
      t: m.t,
      value: info.hasAudio
        ? MOTION_WEIGHT * m.value + AUDIO_WEIGHT * valueAt(loudness, m.t)
        : m.value,
    })),
    1.0,
  );

  log.info(
    `분석 완료 ${info.path.split('/').pop()} — 장면전환 ${sceneCuts.length}개, 샘플 ${motion.length}개, ${((Date.now() - started) / 1000).toFixed(1)}초`,
  );

  return {
    durationSec: info.durationSec,
    sceneCuts,
    motion,
    loudness,
    interest,
  };
}

export interface HighlightOptions {
  /** 최종 숏츠 목표 길이 (초) */
  targetSec: number;
  minClipSec: number;
  maxClipSec: number;
  /**
   * 제일 좋은 구간 대비 이 비율보다 못한 구간은 목표 길이를 못 채우더라도 버린다.
   * 길이를 억지로 채우려고 지루한 장면을 끼워 넣는 것을 막는다.
   */
  minScoreRatio?: number;
}

export interface Highlight {
  start: number;
  end: number;
  score: number;
}

/** 씬 컷 기준으로 원본을 샷 단위로 쪼갠다. */
function splitIntoShots(analysis: SourceAnalysis, minShotSec: number): { start: number; end: number }[] {
  const boundaries = [0, ...analysis.sceneCuts.map((c) => c.t), analysis.durationSec]
    .filter((t) => t >= 0 && t <= analysis.durationSec)
    .sort((a, b) => a - b);

  const shots: { start: number; end: number }[] = [];
  let start = boundaries[0] ?? 0;

  for (let i = 1; i < boundaries.length; i++) {
    const end = boundaries[i] as number;
    if (end - start < minShotSec && i < boundaries.length - 1) continue; // 너무 짧으면 다음 경계까지 합친다
    if (end > start) shots.push({ start, end });
    start = end;
  }

  if (shots.length === 0) shots.push({ start: 0, end: analysis.durationSec });
  return shots;
}

function meanInterest(analysis: SourceAnalysis, start: number, end: number): number {
  const inRange = analysis.interest.filter((s) => s.t >= start && s.t <= end);
  if (inRange.length === 0) return valueAt(analysis.interest, (start + end) / 2);
  return inRange.reduce((sum, s) => sum + s.value, 0) / inRange.length;
}

/**
 * 지루한 구간을 버리고 볼 만한 구간만 골라낸다.
 * 길이가 목표치에 못 미치면 있는 만큼만 돌려준다 (억지로 늘리지 않는다).
 */
export function pickHighlights(analysis: SourceAnalysis, opts: HighlightOptions): Highlight[] {
  const { targetSec, minClipSec, maxClipSec, minScoreRatio = 0.35 } = opts;

  // 원본이 목표 길이보다 짧으면 통째로 쓴다.
  if (analysis.durationSec <= targetSec) {
    return [{ start: 0, end: analysis.durationSec, score: 1 }];
  }

  const shots = splitIntoShots(analysis, minClipSec);
  const candidates: Highlight[] = [];

  for (const shot of shots) {
    const shotLength = shot.end - shot.start;

    if (shotLength <= maxClipSec) {
      if (shotLength >= minClipSec) {
        candidates.push({ ...shot, score: meanInterest(analysis, shot.start, shot.end) });
      }
      continue;
    }

    // 긴 샷 안에서는 창을 밀어가며 가장 재미있는 구간을 찾는다.
    const step = 0.25;
    for (let start = shot.start; start + maxClipSec <= shot.end; start += step) {
      const end = start + maxClipSec;
      candidates.push({ start, end, score: meanInterest(analysis, start, end) });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0]?.score ?? 0;
  const floor = best * minScoreRatio;

  const picked: Highlight[] = [];
  let total = 0;

  for (const candidate of candidates) {
    if (total >= targetSec) break;
    // 목표 길이보다 "지루한 장면 안 넣기"가 우선이다.
    if (candidate.score < floor && picked.length > 0) continue;
    const overlaps = picked.some((p) => candidate.start < p.end && candidate.end > p.start);
    if (overlaps) continue;
    picked.push(candidate);
    total += candidate.end - candidate.start;
  }

  // 마지막 클립이 목표를 넘기면 잘라서 길이를 맞춘다.
  picked.sort((a, b) => a.start - b.start);
  const overshoot = total - targetSec;
  const last = picked[picked.length - 1];
  if (overshoot > 0 && last && last.end - last.start - overshoot >= minClipSec) {
    last.end -= overshoot;
  }

  return picked;
}
