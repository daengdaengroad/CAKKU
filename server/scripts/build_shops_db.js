/**
 * 카쿠(CAKKU) 전국 시트/실내 복원 전문 업체 DB 구축 스크립트
 * 실행: KAKAO_REST_API_KEY=... node server/scripts/build_shops_db.js
 * 결과: server/data/shops.json 생성
 *
 * 사용 API: 카카오 로컬(키워드 검색) — CAKKU가 이미 쓰는 KAKAO_REST_API_KEY 재사용
 * 참고: daengdaengroad/build_places_db.js 방식을 시트수리용으로 응용
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';

// 핵심: 시트/가죽/실내 복원 전문 업체 위주 키워드
const KEYWORDS = [
  '자동차 시트 수리',
  '가죽시트 복원',
  '자동차 실내복원',
  '카인테리어',
  '가죽시트',
];

// 전국 주요 도시 좌표 (댕댕로드에서 검증된 목록 재사용)
const CITIES = [
  { name: '서울 강남', lat: 37.4979, lng: 127.0276 },
  { name: '서울 홍대', lat: 37.5563, lng: 126.9236 },
  { name: '서울 잠실', lat: 37.5133, lng: 127.1001 },
  { name: '서울 마포', lat: 37.5663, lng: 126.9014 },
  { name: '서울 용산', lat: 37.5298, lng: 126.9647 },
  { name: '서울 노원', lat: 37.6542, lng: 127.0568 },
  { name: '서울 강서', lat: 37.5589, lng: 126.8497 },
  { name: '인천 부평', lat: 37.4897, lng: 126.7230 },
  { name: '인천 송도', lat: 37.3925, lng: 126.6453 },
  { name: '수원', lat: 37.2636, lng: 127.0286 },
  { name: '성남 판교', lat: 37.3947, lng: 127.1112 },
  { name: '용인', lat: 37.2411, lng: 127.1775 },
  { name: '고양', lat: 37.6583, lng: 126.8320 },
  { name: '하남', lat: 37.5397, lng: 127.2148 },
  { name: '남양주', lat: 37.6360, lng: 127.2165 },
  { name: '파주', lat: 37.7603, lng: 126.7800 },
  { name: '가평', lat: 37.8313, lng: 127.5096 },
  { name: '양평', lat: 37.4916, lng: 127.4874 },
  { name: '화성', lat: 37.1996, lng: 126.8313 },
  { name: '평택', lat: 36.9921, lng: 127.1128 },
  { name: '안성', lat: 37.0078, lng: 127.2797 },
  { name: '춘천', lat: 37.8813, lng: 127.7298 },
  { name: '강릉', lat: 37.7519, lng: 128.8761 },
  { name: '원주', lat: 37.3422, lng: 127.9201 },
  { name: '속초', lat: 38.2070, lng: 128.5918 },
  { name: '홍천', lat: 37.6970, lng: 127.8886 },
  { name: '평창', lat: 37.3706, lng: 128.3904 },
  { name: '철원', lat: 38.1467, lng: 127.3139 },
  { name: '대전 유성', lat: 36.3624, lng: 127.3565 },
  { name: '세종', lat: 36.4800, lng: 127.2890 },
  { name: '청주', lat: 36.6424, lng: 127.4890 },
  { name: '천안', lat: 36.8151, lng: 127.1139 },
  { name: '충주', lat: 36.9910, lng: 127.9259 },
  { name: '제천', lat: 37.1325, lng: 128.1908 },
  { name: '보령', lat: 36.3330, lng: 126.6127 },
  { name: '서산', lat: 36.7847, lng: 126.4503 },
  { name: '공주', lat: 36.4465, lng: 127.1191 },
  { name: '광주 상무', lat: 35.1531, lng: 126.8516 },
  { name: '전주', lat: 35.8242, lng: 127.1479 },
  { name: '순천', lat: 34.9506, lng: 127.4872 },
  { name: '여수', lat: 34.7604, lng: 127.6622 },
  { name: '목포', lat: 34.8118, lng: 126.3922 },
  { name: '남원', lat: 35.4165, lng: 127.3900 },
  { name: '담양', lat: 35.3219, lng: 126.9880 },
  { name: '고창', lat: 35.4355, lng: 126.7021 },
  { name: '부산 해운대', lat: 35.1587, lng: 129.1603 },
  { name: '부산 서면', lat: 35.1556, lng: 129.0590 },
  { name: '대구 동성로', lat: 35.8714, lng: 128.5980 },
  { name: '대구 수성', lat: 35.8581, lng: 128.6305 },
  { name: '울산', lat: 35.5384, lng: 129.3114 },
  { name: '창원', lat: 35.2280, lng: 128.6811 },
  { name: '경주', lat: 35.8562, lng: 129.2247 },
  { name: '포항', lat: 36.0190, lng: 129.3435 },
  { name: '안동', lat: 36.5684, lng: 128.7294 },
  { name: '구미', lat: 36.1196, lng: 128.3446 },
  { name: '진주', lat: 35.1799, lng: 128.1076 },
  { name: '통영', lat: 34.8544, lng: 128.4330 },
  { name: '거제', lat: 34.8803, lng: 128.6213 },
  { name: '남해', lat: 34.8375, lng: 127.8924 },
  { name: '하동', lat: 35.0675, lng: 127.7512 },
  { name: '제주시', lat: 33.4996, lng: 126.5312 },
  { name: '서귀포', lat: 33.2541, lng: 126.5600 },
  { name: '제주 협재', lat: 33.3940, lng: 126.2395 },
  { name: '제주 성산', lat: 33.4588, lng: 126.9426 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchKakao(keyword, lat, lng, page = 1) {
  const url = new URL(KAKAO_KEYWORD_URL);
  url.searchParams.set('query', keyword);
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('radius', '20000');
  url.searchParams.set('size', '15');
  url.searchParams.set('page', String(page));
  url.searchParams.set('sort', 'distance');

  try {
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } });
    if (!res.ok) {
      console.error(`  카카오 오류 ${res.status} [${keyword}]`);
      return { docs: [], isEnd: true };
    }
    const data = await res.json();
    return { docs: data.documents || [], isEnd: data.meta?.is_end !== false };
  } catch (err) {
    console.error(`  카카오 예외 [${keyword}]: ${err.message}`);
    return { docs: [], isEnd: true };
  }
}

function mapShop(doc, region, keyword) {
  return {
    id: doc.id,
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name,
    phone: doc.phone || '',
    lat: Number(doc.y),
    lng: Number(doc.x),
    category: doc.category_name || '',
    placeUrl: doc.place_url || '',
    region,
    keyword,
    source: 'kakao',
  };
}

async function build() {
  if (!KAKAO_REST_KEY) {
    console.error('KAKAO_REST_API_KEY가 설정되지 않았습니다. (예: KAKAO_REST_API_KEY=xxx node server/scripts/build_shops_db.js)');
    process.exit(1);
  }

  const byId = new Map();

  for (const city of CITIES) {
    for (const keyword of KEYWORDS) {
      for (let page = 1; page <= 3; page++) {
        const { docs, isEnd } = await searchKakao(keyword, city.lat, city.lng, page);
        for (const doc of docs) {
          if (!byId.has(doc.id)) byId.set(doc.id, mapShop(doc, city.name, keyword));
        }
        await sleep(120);
        if (isEnd) break;
      }
    }
    console.log(`  ${city.name} 완료 · 누적 ${byId.size}곳`);
  }

  const shops = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const outDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'shops.json');
  fs.writeFileSync(outPath, JSON.stringify(shops, null, 2), 'utf8');

  console.log(`\n완료! 총 ${shops.length}곳 → ${outPath}`);
}

build();
