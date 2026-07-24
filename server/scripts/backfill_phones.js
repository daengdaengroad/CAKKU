/**
 * 카꾸(CAKKU) 시트 업체 전화번호 백필 스크립트
 * shops.json의 시트 전문 업체 중 전화번호가 비어 있는 곳을 구글 Places로 보강한다.
 * 실행: GOOGLE_PLACES_API_KEY=... node server/scripts/backfill_phones.js
 * 결과: server/data/shops.json 갱신 (전화번호가 채워진 만큼)
 */
try {
  require('dotenv').config();
} catch {}

const fs = require('fs');
const path = require('path');
const { findPlaceInfo } = require('../services/google');
const { isSeatShop } = require('../services/seatShop');

const FILE = path.join(__dirname, '..', 'data', 'shops.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY 환경변수가 없습니다.');
    process.exit(1);
  }

  const shops = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  // 시트 전문 업체 중 전화번호가 없고 좌표가 있는 곳만 대상
  const targets = shops.filter(
    (s) =>
      isSeatShop(s.name, s.category) &&
      !s.phone &&
      Number.isFinite(Number(s.lat)) &&
      Number.isFinite(Number(s.lng))
  );

  console.log(`전화번호 없는 시트 업체 ${targets.length}곳 보강 시도`);

  let filled = 0;
  for (const s of targets) {
    try {
      const info = await findPlaceInfo(s.name, s.address, s.lat, s.lng);
      if (info && info.phone) {
        s.phone = info.phone; // shops 배열 내 동일 참조라 그대로 반영됨
        filled += 1;
        console.log(`  ✓ ${s.name} → ${info.phone}`);
      } else {
        console.log(`  - ${s.name}: 구글에도 전화번호 없음`);
      }
    } catch (e) {
      console.log(`  ! ${s.name}: ${e.message}`);
    }
    await sleep(200); // 호출 간격
  }

  fs.writeFileSync(FILE, JSON.stringify(shops, null, 2), 'utf8');
  console.log(`\n총 ${filled}곳 전화번호를 채웠습니다.`);
}

main().catch((e) => {
  console.error('백필 실패:', e.message);
  process.exit(1);
});
