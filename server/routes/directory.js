const express = require('express');
const fs = require('fs');
const path = require('path');
const { findPlaceInfo } = require('../services/google');

const router = express.Router();

let SHOPS = null;
function loadShops() {
  if (SHOPS) return SHOPS;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'shops.json'), 'utf8');
    SHOPS = JSON.parse(raw);
  } catch (e) {
    SHOPS = [];
  }
  return SHOPS;
}

// 주소 첫 토큰(시/도)을 짧은 이름으로 정규화
function normRegion(address) {
  const t = (address || '').split(' ')[0] || '';
  if (t.startsWith('전남광주통합')) return '광주·전남';
  return (
    t
      .replace('특별자치도', '')
      .replace('특별자치시', '')
      .replace('광역시', '')
      .replace('특별시', '') || '기타'
  );
}

const ENRICH_LIMIT = 20; // 사진·별점을 붙일 상위 개수
const PAGE_SIZE = 40; // 한 지역에서 보여줄 최대 업체 수

router.get('/directory', async (req, res) => {
  const shops = loadShops();

  const counts = {};
  for (const s of shops) {
    const r = normRegion(s.address);
    counts[r] = (counts[r] || 0) + 1;
  }
  const regions = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const region = req.query.region;
  if (!region) {
    return res.json({ regions, region: null, shops: [] });
  }

  let list = shops.filter((s) => normRegion(s.address) === region).slice(0, PAGE_SIZE);

  list = await Promise.all(
    list.map(async (s, i) => {
      if (i >= ENRICH_LIMIT) return s;
      const info = await findPlaceInfo(s.name, s.address, s.lat, s.lng);
      if (!info) return s;
      return {
        ...s,
        ...(info.photoRef ? { photoRef: info.photoRef } : {}),
        rating: info.rating,
        reviews: info.reviews,
      };
    })
  );

  // 사진 있는 곳 먼저, 그 안에서 이름순
  list.sort((a, b) => {
    const ap = a.photoRef ? 0 : 1;
    const bp = b.photoRef ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return (a.name || '').localeCompare(b.name || '', 'ko');
  });

  res.json({ regions, region, shops: list });
});

module.exports = router;
