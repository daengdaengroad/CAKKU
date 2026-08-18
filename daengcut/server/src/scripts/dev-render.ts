/** 개발용: 샘플 영상으로 렌더 파이프라인 전체를 돌려본다. */
import path from 'node:path';
import { probe } from '../media/probe.js';
import { analyzeSource, pickHighlights } from '../media/analyze.js';
import { renderTimeline } from '../render/render.js';
import type { RenderSource } from '../render/render.js';
import {
  DEFAULT_CANVAS,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_FRAMING,
  TIMELINE_VERSION,
  clipOffsets,
  clipDuration,
} from '../timeline/types.js';
import type { Timeline } from '../timeline/types.js';

const file = process.argv[2];
const mode = (process.argv[3] as 'cover' | 'blur' | 'contain') ?? 'cover';
if (!file) {
  console.error('사용법: tsx src/scripts/dev-render.ts <영상파일> [cover|blur|contain]');
  process.exit(1);
}

const info = await probe(path.resolve(file));
const analysis = await analyzeSource(info);
const highlights = pickHighlights(analysis, { targetSec: 12, minClipSec: 1.5, maxClipSec: 5 });

const clips = highlights.map((h, i) => ({
  id: `c${i}`,
  sourceId: 'src',
  in: h.start,
  out: h.end,
  speed: 1,
  framing: { ...DEFAULT_FRAMING, mode },
  volume: 1,
}));

const offsets = clipOffsets(clips);
const sampleTexts = [
  '오늘도 산책 나온 우리 강아지가 갑자기 멈춰 섰습니다',
  '이 표정 보이시나요',
  '결국 이렇게 됩니다',
];

const timeline: Timeline = {
  version: TIMELINE_VERSION,
  canvas: { ...DEFAULT_CANVAS },
  clips,
  captions: clips.map((clip, i) => ({
    id: `cap${i}`,
    start: (offsets[i] ?? 0) + 0.2,
    end: (offsets[i] ?? 0) + Math.max(1.2, clipDuration(clip) - 0.3),
    text: sampleTexts[i % sampleTexts.length] as string,
    emphasis: i === 0,
  })),
  narration: [],
  music: null,
  duckRatio: 0.25,
  style: { ...DEFAULT_CAPTION_STYLE },
  meta: { title: '테스트', description: '', tags: [] },
};

const outPath = path.resolve('../workspace/_test/out.mp4');

await renderTimeline({
  timeline,
  sources: new Map<string, RenderSource>([
    ['src', {
      id: 'src',
      path: info.path,
      width: info.width,
      height: info.height,
      hasAudio: info.hasAudio,
      durationSec: info.durationSec,
    }],
  ]),
  outPath,
  workDir: path.resolve('../workspace/_test/work'),
  fontDir: path.resolve('../assets/fonts'),
  assetRoot: path.resolve('../workspace/_test'),
  quality: 'final',
  onProgress: (r) => process.stdout.write(`\r진행률 ${(r * 100).toFixed(0)}%   `),
});

console.log('\n완성:', outPath);
