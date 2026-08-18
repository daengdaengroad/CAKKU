#!/usr/bin/env node
/**
 * 첫 실행 준비:
 *  1) .env 파일 만들기
 *  2) 자막용 한글 폰트 내려받기
 *  3) ffmpeg 확인
 *
 *   npm run setup
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = path.join(root, 'assets', 'fonts');

const FONTS = [
  {
    name: 'Pretendard-Bold.otf',
    label: '프리텐다드 Bold — 깔끔하고 가독성 좋은 기본 자막용',
    url: 'https://raw.githubusercontent.com/orioncactus/pretendard/main/packages/pretendard/dist/public/static/Pretendard-Bold.otf',
  },
  {
    name: 'BlackHanSans-Regular.ttf',
    label: '검은고딕 — 굵고 시선 끌리는 후킹 자막용',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/blackhansans/BlackHanSans-Regular.ttf',
  },
  {
    name: 'GothicA1-Bold.ttf',
    label: '고딕 A1 Bold — 무난한 대체 폰트',
    url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/gothica1/GothicA1-Bold.ttf',
  },
];

function step(msg) {
  console.log(`\n▶ ${msg}`);
}

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg) {
  console.log(`  ! ${msg}`);
}

// ── 1. .env ────────────────────────────────────────────────────────
step('.env 파일 확인');
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  ok('.env 가 이미 있습니다 (건드리지 않음)');
} else {
  fs.copyFileSync(path.join(root, '.env.example'), envPath);
  ok('.env.example 을 복사해 .env 를 만들었습니다. API 키를 채워주세요.');
}

// ── 2. 폰트 ────────────────────────────────────────────────────────
step('자막용 한글 폰트 준비');
fs.mkdirSync(fontDir, { recursive: true });

let downloaded = 0;
for (const font of FONTS) {
  const dest = path.join(fontDir, font.name);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10_000) {
    ok(`${font.name} — 이미 있음`);
    downloaded++;
    continue;
  }

  try {
    const res = await fetch(font.url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10_000) throw new Error('파일이 너무 작습니다');
    fs.writeFileSync(dest, buf);
    ok(`${font.name} 받음 (${(buf.length / 1024 / 1024).toFixed(1)}MB) — ${font.label}`);
    downloaded++;
  } catch (err) {
    warn(`${font.name} 실패: ${err.message}`);
  }
}

if (downloaded === 0) {
  warn(
    '폰트를 하나도 받지 못했습니다. 인터넷 없이 쓰려면 한글 폰트(.ttf/.otf)를\n' +
      `    ${fontDir}\n    에 직접 넣어주세요. 없으면 자막이 네모로 깨집니다.`,
  );
}

// ── 3. ffmpeg ──────────────────────────────────────────────────────
step('ffmpeg 확인');
let ffmpegPath = null;
try {
  const mod = await import('ffmpeg-static');
  ffmpegPath = mod.default;
} catch {
  /* 아래에서 시스템 ffmpeg 로 폴백 */
}

const candidate = ffmpegPath ?? 'ffmpeg';
const probe = spawnSync(candidate, ['-version'], { encoding: 'utf8' });
if (probe.status === 0) {
  ok(probe.stdout.split('\n')[0]);
} else {
  warn(
    'ffmpeg 을 찾지 못했습니다. `npm install` 을 다시 실행하거나,\n' +
      '    시스템에 ffmpeg 을 설치한 뒤 .env 의 FFMPEG_PATH 에 경로를 적어주세요.',
  );
}

console.log(`
준비 끝. 다음 순서로 진행하세요.

  1. .env 를 열어 ANTHROPIC_API_KEY 를 채웁니다 (대본 생성에 필요).
  2. npm run dev
  3. 브라우저에서 http://localhost:5173 접속

TTS 목소리와 유튜브 자동 업로드는 .env 의 해당 항목을 채우면 켜집니다.
`);
