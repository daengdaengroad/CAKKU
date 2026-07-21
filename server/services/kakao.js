const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_COORD2REGION_URL = 'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json';
const QUERIES = ['카인테리어 시트', '가죽시트 복원', '자동차 시트 수리', '자동차 실내복원'];

async function searchKeyword(query, lat, lng, radius) {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았습니다');

  const url = new URL(KAKAO_KEYWORD_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('radius', String(radius));
  url.searchParams.set('sort', 'distance');
  url.searchParams.set('size', '15');

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`카카오 로컬 API 오류: ${res.status}`);
  }

  const data = await res.json();
  return data.documents || [];
}

function mapShop(doc) {
  return {
    id: doc.id,
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name,
    phone: doc.phone || '',
    distanceMeters: Number(doc.distance) || null,
    lat: Number(doc.y),
    lng: Number(doc.x),
    placeUrl: doc.place_url,
    category: doc.category_name || '',
  };
}

async function reverseGeocode(lat, lng) {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) throw new Error('KAKAO_REST_API_KEY가 설정되지 않았습니다');

  const url = new URL(KAKAO_COORD2REGION_URL);
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`카카오 좌표-지역 변환 API 오류: ${res.status}`);
  }

  const data = await res.json();
  const region = (data.documents || []).find((d) => d.region_type === 'H') || data.documents?.[0];
  if (!region) return null;

  return region.region_2depth_name || region.region_1depth_name || null;
}

async function searchNearbyShops(lat, lng, radius = 20000) {
  const results = await Promise.all(
    QUERIES.map((q) => searchKeyword(q, lat, lng, radius))
  );

  const seen = new Set();
  const shops = [];
  for (const doc of results.flat()) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    shops.push(mapShop(doc));
  }

  shops.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  return shops;
}

module.exports = { searchNearbyShops, reverseGeocode };
