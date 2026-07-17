const FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const PHOTO_URL = 'https://maps.googleapis.com/maps/api/place/photo';

async function findPhotoRef(name, address, lat, lng) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const url = new URL(FIND_PLACE_URL);
  url.searchParams.set('input', `${name} ${address}`);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'photos');
  url.searchParams.set('locationbias', `point:${lat},${lng}`);
  url.searchParams.set('language', 'ko');
  url.searchParams.set('key', apiKey);

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const photoRef = data.candidates?.[0]?.photos?.[0]?.photo_reference;
    return photoRef || null;
  } catch (err) {
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

module.exports = { findPhotoRef, fetchPhoto };
