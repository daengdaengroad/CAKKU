const express = require('express');
const { chatWithManager } = require('../services/gemini');

const router = express.Router();

router.post('/chat', async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '메시지가 없습니다' });
  }

  try {
    const reply = await chatWithManager(messages);
    res.json({ reply });
  } catch (err) {
    console.error('상담 채팅 실패:', err.message);
    res.status(500).json({ error: '상담 응답에 실패했어요. 잠시 후 다시 시도해주세요.' });
  }
});

// 채팅(제미나이) 연결 상태 진단용. 키 노출 없이 실패 원인만 보여준다.
router.get('/chat/health', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';
  if (!key) {
    return res.json({ ok: false, hasKey: false, model, reason: 'GEMINI_API_KEY 환경변수가 없어요' });
  }
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: '핑' }] }],
          generationConfig: { maxOutputTokens: 16 },
        }),
      }
    );
    const body = await r.text();
    res.json({ ok: r.ok, hasKey: true, keyLen: key.length, model, status: r.status, body: body.slice(0, 400) });
  } catch (e) {
    res.json({ ok: false, hasKey: true, keyLen: key.length, model, error: e.message });
  }
});

module.exports = router;
