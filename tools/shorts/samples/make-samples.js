#!/usr/bin/env node
// 실제 매장 사진이 없어도 파이프라인을 끝까지 돌려볼 수 있게 더미 사진 5장을 만든다.
// 실제 검증에서는 이 폴더 대신 진짜 매장 사진을 --photos 로 넘기면 된다.

const path = require('path');
const fs = require('fs');
const { ffmpeg } = require('../lib/ffmpeg');

// 폰 사진처럼 가로/세로 비율을 섞어 크롭이 제대로 되는지 함께 확인한다.
const PHOTOS = [
  { name: '1-외관.jpg', size: '1600x1200', color: '0x2E4057', label: '매장 외관' },
  { name: '2-메뉴A.jpg', size: '1200x1600', color: '0x8C3B2E', label: '대표 메뉴 1' },
  { name: '3-내부.jpg', size: '1920x1080', color: '0x3F6C51', label: '매장 내부' },
  { name: '4-메뉴B.jpg', size: '1440x1440', color: '0xB07A2A', label: '대표 메뉴 2' },
  { name: '5-사장님.jpg', size: '1080x1350', color: '0x4A3A63', label: '사장님' },
];

// 나눔고딕이 있으면 쓰고, 없으면 fontconfig 기본값에 맡긴다.
function fontArg() {
  const nanum = '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf';
  return fs.existsSync(nanum) ? `fontfile=${nanum}` : 'font=NanumGothic';
}

async function main() {
  const outDir = __dirname;
  const font = fontArg();
  for (const photo of PHOTOS) {
    const file = path.join(outDir, photo.name);
    await ffmpeg([
      '-f', 'lavfi',
      '-i', `color=c=${photo.color}:s=${photo.size}`,
      '-vf',
      `drawtext=text='${photo.label}':fontcolor=white@0.85:fontsize=h/12:x=(w-text_w)/2:y=(h-text_h)/2:` +
        `${font},` +
        `vignette`,
      '-frames:v', '1',
      '-q:v', '3',
      file,
    ], { capture: true });
    console.log(`  ${photo.name} (${photo.size})`);
  }
  fs.writeFileSync(path.join(outDir, '.gitignore'), '*.jpg\n');
  console.log(`\n샘플 사진 ${PHOTOS.length}장 생성: ${outDir}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
