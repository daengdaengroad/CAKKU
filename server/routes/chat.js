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

module.exports = router;
