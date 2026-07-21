const FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';

async function findPlaceInfo(name, address, lat, lng) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  // 전체 도로명 주소는 구글 매칭을 오히려 방해할 때가 많아, 이름 + 시/구 정도만 사용
  const locationHint = (address || '').split(' ').slice(0, 2).join(' ');
  const url = new URL(FIND_PLACE_URL);
  url.searchParams.set('input', `${name} ${locationHint}`.trim());
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'photos,rating,user_ratings_total');
  url.searchParams.set('locationbias', `point:${lat},${lng}`);
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

    return {
      photoRef: c.photos?.[0]?.photo_reference || null,
      rating: typeof c.rating === 'number' ? c.rating : null,
      reviews: typeof c.user_ratings_total === 'number' ? c.user_ratings_total : null,
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
