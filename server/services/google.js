const FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';

// 구글이 찾은 위치가 실제 업체 좌표에서 이 거리보다 멀면 다른 가게로 보고 버린다.
const MATCH_RADIUS_M = 250;

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function findPlaceInfo(name, address, lat, lng) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const url = new URL(FIND_PLACE_URL);
  url.searchParams.set('input', name);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'photos,rating,user_ratings_total,geometry,formatted_phone_number');
  // 반경 1km 원형 바이어스로 근처 결과만 우선
  url.searchParams.set('locationbias', `circle:1000@${lat},${lng}`);
  url.searchParams.set('language', 'ko');
  url.searchParams.set('key', apiKey);

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`구글 Places 조회 실패 [${name}]: ${data.status} - ${data.error_message || ''}`);
      return null;
    }

    const c = data.candidates?.[0];
    if (!c) return null;

    // 잘못된 매칭 방지: 구글 결과 위치가 실제 업체 좌표에서 멀면 사진·별점을 쓰지 않는다.
    const g = c.geometry?.location;
    if (g && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      const d = distanceMeters(Number(lat), Number(lng), g.lat, g.lng);
      if (d > MATCH_RADIUS_M) return null;
    }

    return {
      photoRef: c.photos?.[0]?.photo_reference || null,
      rating: typeof c.rating === 'number' ? c.rating : null,
      reviews: typeof c.user_ratings_total === 'number' ? c.user_ratings_total : null,
      phone: c.formatted_phone_number || null,
    };
  } catch (err) {
    console.error(`구글 Places 조회 예외 [${name}]:`, err.message);
    return null;
  }
}

async function fetchPhoto(photoRef, maxWidth = 400) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY가 설정되지 않았습니다');

  const url = new URL(PHOTO_URL);
  url.searchParams.set('photo_reference', photoRef);
  url.searchParams.set('maxwidth', String(maxWidth));
  url.searchParams.set('key', apiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`구글 사진 API 오류: ${res.status}`);

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

module.exports = { findPlaceInfo, fetchPhoto };
