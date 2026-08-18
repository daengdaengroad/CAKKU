import { pickHighlights } from '../media/analyze.js';
import type { SourceAnalysis } from '../media/analyze.js';
import type { MediaInfo } from '../media/probe.js';
import { newShortId } from '../util/ids.js';
import type { GeneratedScript } from '../ai/script.js';
import {
  DEFAULT_CANVAS,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_FRAMING,
  TIMELINE_VERSION,
  clipDuration,
  clipOffsets,
} from './types.js';
import type { Clip, FramingMode, Timeline } from './types.js';

export interface AnalyzedSource {
  id: string;
  info: MediaInfo;
  analysis: SourceAnalysis;
}

export interface BuildOptions {
  /** 목표 길이(초). 유튜브 숏츠는 60초 이하 */
  targetSec: number;
  minClipSec: number;
  maxClipSec: number;
  framingMode: FramingMode;
}

export const DEFAULT_BUILD_OPTIONS: BuildOptions = {
  targetSec: 25,
  minClipSec: 1.2,
  maxClipSec: 4.5,
  framingMode: 'cover',
};

/**
 * 분석 결과에서 쓸 만한 구간만 골라 클립 목록을 만든다.
 * 원본이 여러 개면 목표 길이를 원본 길이 비율대로 나눠 갖는다.
 */
export function buildClips(sources: AnalyzedSource[], opts: BuildOptions): Clip[] {
  const totalDuration = sources.reduce((sum, s) => sum + s.info.durationSec, 0) || 1;
  const clips: Clip[] = [];

  for (const source of sources) {
    const share = (source.info.durationSec / totalDuration) * opts.targetSec;

    const highlights = pickHighlights(source.analysis, {
      targetSec: Math.max(opts.minClipSec, share),
      minClipSec: opts.minClipSec,
      maxClipSec: opts.maxClipSec,
    });

    for (const highlight of highlights) {
      clips.push({
        id: newShortId(),
        sourceId: source.id,
        in: highlight.start,
        out: highlight.end,
        speed: 1,
        framing: {
          ...DEFAULT_FRAMING,
          // 세로 영상은 잘라도 되지만, 가로 영상은 잘리면 강아지가 화면 밖으로 나간다.
          mode: source.info.isPortrait ? opts.framingMode : 'blur',
        },
        volume: 1,
      });
    }
  }

  return clips;
}

/** 아직 대본이 없는, 컷만 잡힌 타임라인 */
export function buildBaseTimeline(sources: AnalyzedSource[], opts: BuildOptions): Timeline {
  return {
    version: TIMELINE_VERSION,
    canvas: { ...DEFAULT_CANVAS },
    clips: buildClips(sources, opts),
    captions: [],
    narration: [],
    music: null,
    duckRatio: 0.25,
    style: { ...DEFAULT_CAPTION_STYLE },
    meta: { title: '', description: '', tags: [] },
  };
}

/** 클립 하나 안에 자막 N개를 고르게 배치한다. */
function layoutCaptions(
  clipStart: number,
  duration: number,
  texts: { text: string; emphasis: boolean }[],
) {
  if (texts.length === 0) return [];

  const padStart = Math.min(0.15, duration * 0.1);
  const padEnd = Math.min(0.1, duration * 0.08);
  const usable = Math.max(0.4, duration - padStart - padEnd);
  const slot = usable / texts.length;
  // 자막 사이에 아주 잠깐 틈을 둬야 바뀌는 게 눈에 보인다.
  const gap = texts.length > 1 ? Math.min(0.08, slot * 0.1) : 0;

  return texts.map((caption, i) => ({
    id: newShortId(),
    start: clipStart + padStart + slot * i,
    end: clipStart + padStart + slot * (i + 1) - gap,
    text: caption.text.trim(),
    emphasis: caption.emphasis,
  }));
}

/**
 * AI 대본을 타임라인에 얹는다.
 * 자막은 해당 클립이 화면에 떠 있는 동안에만 보이도록 클립 구간 안에 가둔다.
 */
export function applyScript(timeline: Timeline, script: GeneratedScript): Timeline {
  const offsets = clipOffsets(timeline.clips);

  const captions = timeline.clips.flatMap((clip, i) => {
    const clipScript = script.clips.find((c) => c.clipIndex === i);
    if (!clipScript) return [];
    return layoutCaptions(offsets[i] ?? 0, clipDuration(clip), clipScript.captions);
  });

  const narration = timeline.clips.flatMap((clip, i) => {
    const clipScript = script.clips.find((c) => c.clipIndex === i);
    const text = clipScript?.narration.trim();
    if (!text) return [];
    return [
      {
        id: newShortId(),
        // 클립이 바뀌자마자 말이 시작되면 급하게 들린다. 살짝 늦춘다.
        start: (offsets[i] ?? 0) + 0.12,
        text,
        audioFile: null,
        durationSec: null,
        voice: null,
      },
    ];
  });

  return {
    ...timeline,
    captions,
    narration,
    meta: {
      title: script.title,
      description: script.description,
      tags: script.tags,
    },
  };
}
