const express = require('express');
const { searchNearbyShops, reverseGeocode } = require('../services/kakao');
const { findPlaceInfo, fetchPhoto } = require('../services/google');

const router = express.Router();

const PHOTO_LOOKUP_LIMIT = 8;

router.get('/shops', async (req, res) => {
  const { lat, lng, radius } = req.query;
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({ error: '위치 정보가 없습니다' });
  }

  try {
    const [shops, regionName] = await Promise.all([
      searchNearbyShops(latNum, lngNum, radius ? Number(radius) : undefined),
      reverseGeocode(latNum, lngNum).catch(() => null),
    ]);

    const withInfo = await Promise.all(
      shops.map(async (shop, i) => {
        if (i >= PHOTO_LOOKUP_LIMIT) return shop;
        const info = await findPlaceInfo(shop.name, shop.address, shop.lat, shop.lng);
        if (!info) return shop;
        return {
          ...shop,
          ...(info.photoRef ? { photoRef: info.photoRef } : {}),
          rating: info.rating,
          reviews: info.reviews,
        };
      })
    );

    res.json({ shops: withInfo, regionName });
  } catch (err) {
    res.status(500).json({ error: err.message || '업체 검색에 실패했습니다' });
  }
});

router.get('/shop-photo', async (req, res) => {
  const { ref, w } = req.query;
  if (!ref) return res.status(400).send('missing ref');

  try {
    const { buffer, contentType } = await fetchPhoto(ref, w ? Number(w) : undefined);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('photo fetch failed');
  }
});

module.exports = router;
