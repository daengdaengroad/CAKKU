const express = require('express');
const { searchNearbyShops } = require('../services/kakao');

const router = express.Router();

router.get('/shops', async (req, res) => {
  const { lat, lng, radius } = req.query;
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({ error: '위치 정보가 없습니다' });
  }

  try {
    const shops = await searchNearbyShops(latNum, lngNum, radius ? Number(radius) : undefined);
    res.json({ shops });
  } catch (err) {
    res.status(500).json({ error: err.message || '업체 검색에 실패했습니다' });
  }
});

module.exports = router;
