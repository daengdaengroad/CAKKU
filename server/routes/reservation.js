const express = require('express');
const { insertReservation, listReservations, updateReservationStatus, hasDb } = require('../services/db');
const { sendReservationEmail, hasEmail } = require('../services/email');

const router = express.Router();

// 고객이 예약/문의를 접수한다: DB에 저장하고 사장님께 메일 발송(둘 다 graceful).
router.post('/reservation', async (req, res) => {
  const { name, phone, message, type, shopName } = req.body || {};
  if (!name || !phone || !message) {
    return res.status(400).json({ error: '이름, 연락처, 요청 내용을 모두 입력해주세요.' });
  }

  let saved = null;
  try {
    saved = await insertReservation({ name, phone, message, type, shopName });
  } catch (e) {
    console.error('예약 DB 저장 실패:', e.message);
  }

  const record = saved || { name, phone, message, type, shop_name: shopName, created_at: new Date() };

  let emailed = false;
  try {
    emailed = await sendReservationEmail(record);
  } catch (e) {
    console.error('예약 메일 발송 실패:', e.message);
  }

  // DB에도 못 남기고 메일도 못 보냈으면 실패로 처리
  if (!saved && !emailed) {
    return res.status(500).json({ error: '예약 접수에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }

  res.json({ ok: true, id: saved ? saved.id : null, stored: !!saved, emailed });
});

// --- 관리자 (PIN 보호) ---
function requirePin(req, res, next) {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return res.status(503).json({ error: '관리자 기능이 아직 설정되지 않았어요 (ADMIN_PIN 필요).' });
  const given = req.headers['x-admin-pin'] || req.query.pin;
  if (given !== pin) return res.status(401).json({ error: 'PIN이 올바르지 않아요.' });
  next();
}

router.get('/admin/reservations', requirePin, async (req, res) => {
  if (!hasDb()) return res.json({ reservations: [], dbEnabled: false, emailEnabled: hasEmail() });
  try {
    const reservations = await listReservations();
    res.json({ reservations, dbEnabled: true, emailEnabled: hasEmail() });
  } catch (e) {
    console.error('예약 목록 조회 실패:', e.message);
    res.status(500).json({ error: '예약 목록을 불러오지 못했어요.' });
  }
});

router.patch('/admin/reservations/:id', requirePin, async (req, res) => {
  const { status } = req.body || {};
  try {
    const updated = await updateReservationStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: '예약을 찾지 못했어요.' });
    res.json({ reservation: updated });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
