/** 개발용: 영상 하나를 분석해서 결과를 콘솔에 뿌린다.  npx tsx src/scripts/dev-analyze.ts <파일> */
import { probe } from '../media/probe.js';
import { analyzeSource, pickHighlights } from '../media/analyze.js';
import { chooseFrameTimestamps, extractFrames } from '../media/frames.js';

const file = process.argv[2];
if (!file) {
  console.error('사용법: tsx src/scripts/dev-analyze.ts <영상파일>');
  process.exit(1);
}

const info = await probe(file);
console.log('── 영상 정보 ──');
console.log(info);

const analysis = await analyzeSource(info);
console.log('\n── 장면 전환 ──');
console.log(analysis.sceneCuts.map((c) => `${c.t.toFixed(2)}s (${c.score.toFixed(3)})`).join(', ') || '없음');

console.log('\n── 관심도 곡선 (2초 간격) ──');
for (let t = 0; t < info.durationSec; t += 2) {
  const near = analysis.interest.filter((s) => s.t >= t && s.t < t + 2);
  const avg = near.length ? near.reduce((a, b) => a + b.value, 0) / near.length : 0;
  const bar = '█'.repeat(Math.round(avg * 40));
  console.log(`${t.toFixed(0).padStart(3)}s │${bar.padEnd(40)}│ ${avg.toFixed(3)}`);
}

const highlights = pickHighlights(analysis, { targetSec: 12, minClipSec: 1.5, maxClipSec: 5 });
console.log('\n── 자동 선택된 하이라이트 ──');
for (const h of highlights) {
  console.log(`${h.start.toFixed(2)}s ~ ${h.end.toFixed(2)}s  (${(h.end - h.start).toFixed(2)}초, 점수 ${h.score.toFixed(3)})`);
}
console.log(`합계 ${highlights.reduce((a, h) => a + (h.end - h.start), 0).toFixed(2)}초`);

const stamps = chooseFrameTimestamps(info, analysis, 6);
console.log('\n── 비전 분석용 프레임 시각 ──');
console.log(stamps.map((t) => `${t.toFixed(2)}s`).join(', '));

const frames = await extractFrames(info, stamps, '/tmp/daengcut-frames');
console.log(frames.map((f) => f.path).join('\n'));
