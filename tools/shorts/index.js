#!/usr/bin/env node
/**
 * 소상공인 매장 홍보 쇼츠 자동 생성 (검증용 CLI, UI 없음)
 *
 *   입력: 매장 사진 5장 + 매장명 + 메뉴 2개
 *   처리: 대본 생성 -> 문장 분할 -> 문장별 TTS mp3 -> mp3 길이 측정 -> 켄번스 + 자막 합성
 *   출력: 9:16 세로 MP4 + 단계별 소요 시간 리포트
 *
 * 사용법:
 *   node tools/shorts/index.js --input tools/shorts/input.example.json
 *   node tools/shorts/index.js --store "화정동 손칼국수" --menus "바지락 칼국수,들깨 수제비" --photos ./photos
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { checkTools, durationOf } = require('./lib/ffmpeg');
const { generateScript } = require('./lib/script');
const { synthesizeLines, measureClips } = require('./lib/tts');
const { buildAss } = require('./lib/subtitles');
const { renderVideo, pickFont } = require('./lib/render');

const ROOT = __dirname;
const PHOTO_EXT = /\.(jpe?g|png|webp|heic)$/i;
// 문장 사이 숨 쉴 틈 / 마지막 컷을 조금 더 물고 끝내는 여유
const DEFAULT_GAP = 0.25;
const DEFAULT_TAIL = 1.0;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const eq = token.indexOf('=');
    if (eq !== -1) {
      args[token.slice(2, eq)] = token.slice(eq + 1);
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      args[token.slice(2)] = argv[i + 1];
      i += 1;
    } else {
      args[token.slice(2)] = true;
    }
  }
  return args;
}

// dotenv 없이 server/.env 를 읽는다 (키를 한 군데서만 관리하려고).
function loadEnv() {
  const candidates = [
    process.env.SHORTS_ENV_FILE,
    path.join(ROOT, '.env'),
    path.join(ROOT, '../../server/.env'),
    path.join(ROOT, '../../.env'),
  ].filter(Boolean);

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

function collectPhotos(input) {
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (typeof input === 'string') {
    const stat = fs.existsSync(input) ? fs.statSync(input) : null;
    if (stat && stat.isDirectory()) {
      list = fs
        .readdirSync(input)
        .filter((f) => PHOTO_EXT.test(f))
        .sort()
        .map((f) => path.join(input, f));
    } else {
      list = input.split(',');
    }
  }

  const resolved = list.map((p) => path.resolve(String(p).trim())).filter(Boolean);
  const missing = resolved.filter((p) => !fs.existsSync(p));
  if (missing.length) throw new Error(`사진을 찾을 수 없습니다:\n  ${missing.join('\n  ')}`);
  if (!resolved.length) throw new Error('사진이 한 장도 없습니다. --photos 로 폴더나 파일 목록을 주세요.');
  return resolved;
}

function loadConfig(args) {
  let config = {};
  if (args.input) {
    const file = path.resolve(args.input);
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
    // 입력 JSON 안의 상대 경로는 그 JSON 파일 기준으로 푼다.
    if (Array.isArray(config.photos)) {
      config.photos = config.photos.map((p) => path.resolve(path.dirname(file), p));
    } else if (typeof config.photos === 'string') {
      config.photos = path.resolve(path.dirname(file), config.photos);
    }
    if (config.music) config.music = path.resolve(path.dirname(file), config.music);
  }

  if (args.store) config.storeName = args.store;
  if (args.menus) config.menus = String(args.menus).split(',').map((m) => m.trim()).filter(Boolean);
  if (args.photos) config.photos = args.photos;
  if (args.note) config.note = args.note;
  if (args.music) config.music = path.resolve(args.music);

  if (!config.storeName) throw new Error('매장명이 없습니다 (--store 또는 입력 JSON의 storeName).');
  if (!config.menus || config.menus.length < 1) throw new Error('메뉴가 없습니다 (--menus "메뉴1,메뉴2").');

  config.photos = collectPhotos(config.photos);
  if (config.music && !fs.existsSync(config.music)) throw new Error(`배경음악 파일 없음: ${config.music}`);
  return config;
}

function slugify(name) {
  return String(name).replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '').slice(0, 40) || 'shorts';
}

function fmt(seconds) {
  return `${seconds.toFixed(2)}초`;
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnv();

  const started = Date.now();
  const timings = [];
  const timed = async (label, fn) => {
    const t0 = process.hrtime.bigint();
    const result = await fn();
    const seconds = Number(process.hrtime.bigint() - t0) / 1e9;
    timings.push({ label, seconds });
    console.log(`  ✓ ${label}: ${fmt(seconds)}`);
    return result;
  };

  const config = loadConfig(args);
  const gap = args.gap !== undefined ? Number(args.gap) : DEFAULT_GAP;
  const tail = args.tail !== undefined ? Number(args.tail) : DEFAULT_TAIL;
  const preset = args.preset || 'veryfast';
  const crf = Number(args.crf || 20);

  const outDir = path.resolve(args.out || path.join(ROOT, 'out'));
  const workDir = args.keep
    ? path.join(outDir, `work-${Date.now()}`)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'shorts-'));
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(workDir, { recursive: true });

  console.log(`\n■ ${config.storeName} / ${config.menus.join(', ')} / 사진 ${config.photos.length}장\n`);

  await timed('ffmpeg 확인', () => checkTools());

  const script = await timed('대본 생성', () =>
    generateScript({
      storeName: config.storeName,
      menus: config.menus,
      note: config.note,
      lines: config.photos.length,
    })
  );
  console.log(`    (${script.source})`);
  script.lines.forEach((line, i) => console.log(`    ${i + 1}. ${line}`));

  const tts = await timed(`TTS 합성 (${script.lines.length}문장)`, () =>
    synthesizeLines(script.lines, {
      outDir: path.join(workDir, 'audio'),
      mode: args.tts || 'auto',
    })
  );
  if (tts.engine === 'offline') {
    console.log('    ! offline 모드: 무음 mp3입니다. 목소리를 넣으려면 GOOGLE_TTS_API_KEY 를 설정하세요.');
  }

  const clips = await timed('mp3 길이 측정', () => measureClips(tts.clips));
  clips.forEach((c) => console.log(`    ${c.index + 1}. ${fmt(c.seconds)}  ${c.text}`));

  // 사진 노출 시간 = 그 문장 음성 길이 + 숨 쉴 틈. 마지막 컷만 여운을 더 준다.
  const segments = clips.map((clip, i) => ({
    photo: config.photos[i % config.photos.length],
    seconds: clip.seconds + gap + (i === clips.length - 1 ? tail : 0),
  }));

  let cursor = 0;
  const timeline = clips.map((clip, i) => {
    const start = cursor;
    cursor += segments[i].seconds;
    return { ...clip, start, end: start + clip.seconds + gap * 0.8 };
  });
  const totalSeconds = cursor;

  const assFile = buildAss({
    clips: timeline,
    storeName: config.storeName,
    menus: config.menus,
    titleSeconds: Math.min(2.4, Math.max(1.2, segments[0].seconds - 0.3)),
    // 마지막 자막이 사라진 뒤에 마무리 카드가 뜨도록 시작점을 민다.
    endCard:
      tail > 0.6
        ? {
            start: Math.max(totalSeconds - tail - 0.2, timeline[timeline.length - 1].end + 0.05),
            end: totalSeconds,
          }
        : null,
    fontName: pickFont(),
    file: path.join(workDir, 'subtitle.ass'),
  });

  const outFile = path.join(outDir, `${slugify(config.storeName)}-${Date.now()}.mp4`);
  const renderSeconds = await timed(`렌더링 (preset=${preset}, crf=${crf})`, async () => {
    await renderVideo({
      segments,
      audioFiles: clips.map((c) => c.file),
      assFile,
      outFile,
      totalSeconds,
      gap,
      music: config.music || null,
      preset,
      crf,
    });
  }).then(() => timings[timings.length - 1].seconds);

  const actualSeconds = await durationOf(outFile);
  const sizeMb = fs.statSync(outFile).size / 1024 / 1024;
  const wall = (Date.now() - started) / 1000;

  console.log('\n──────── 결과 ────────');
  console.log(`  파일       ${outFile}`);
  console.log(`  영상       ${actualSeconds.toFixed(2)}초 / 1080x1920 / ${sizeMb.toFixed(1)}MB`);
  console.log(`  렌더링     ${fmt(renderSeconds)}  (영상 1초당 ${(renderSeconds / actualSeconds).toFixed(2)}초)`);
  console.log(`  전체       ${fmt(wall)}`);
  console.log('  단계별');
  for (const t of timings) console.log(`    - ${t.label}: ${fmt(t.seconds)}`);
  if (Math.abs(actualSeconds - 25) > 4) {
    console.log(`  ! 목표 25초에서 ${(actualSeconds - 25).toFixed(1)}초 벗어났습니다.`);
    console.log('    TTS_SPEAKING_RATE(기본 1.05)를 조절하거나 대본 길이를 바꿔보세요.');
  }
  console.log('──────────────────────\n');

  const report = {
    storeName: config.storeName,
    menus: config.menus,
    photos: config.photos,
    scriptSource: script.source,
    ttsEngine: tts.engine,
    lines: timeline.map((t) => ({ text: t.text, seconds: t.seconds, start: t.start, end: t.end })),
    output: { file: outFile, seconds: actualSeconds, sizeMb: Number(sizeMb.toFixed(2)), preset, crf },
    timings: Object.fromEntries(timings.map((t) => [t.label, Number(t.seconds.toFixed(2))])),
    totalSeconds: Number(wall.toFixed(2)),
    renderRealtimeFactor: Number((renderSeconds / actualSeconds).toFixed(2)),
    createdAt: new Date().toISOString(),
  };
  const reportFile = `${outFile.replace(/\.mp4$/, '')}.report.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(`리포트: ${reportFile}`);
  if (args.keep) console.log(`작업 파일: ${workDir}`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
