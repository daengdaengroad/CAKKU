const express = require('express');
const multer = require('multer');
const { diagnoseDamage } = require('../services/anthropic');
const { searchNearbyShops } = require('../services/kakao');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/diagnose', upload.array('images', 5), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: '이미지가 없습니다' });

  const { lat, lng, radius, car } = req.body;
  const latNum = Number(lat);
  const lngNum = Number(lng);

  const [diagnosisResult, shopsResult] = await Promise.allSettled([
    diagnoseDamage({
      images: req.files.map((file) => ({
        buffer: file.buffer,
        mimeType: file.mimetype || 'image/jpeg',
      })),
      car,
    }),
    Number.isFinite(latNum) && Number.isFinite(lngNum)
      ? searchNearbyShops(latNum, lngNum, radius ? Number(radius) : undefined)
      : Promise.reject(new Error('위치 정보가 없습니다')),
  ]);

  res.json({
    diagnosis: diagnosisResult.status === 'fulfilled' ? diagnosisResult.value : null,
    shops: shopsResult.status === 'fulfilled' ? shopsResult.value : [],
    errors: {
      diagnosis: diagnosisResult.status === 'rejected' ? diagnosisResult.reason.message : null,
      shops: shopsResult.status === 'rejected' ? shopsResult.reason.message : null,
    },
  });
});

module.exports = router;
