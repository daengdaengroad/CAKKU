const { getChatSystemPrompt, sanitizeMessages } = require('./chatPrompt');

const MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';

async function chatWithManager(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');

  const sanitized = sanitizeMessages(messages);
  if (!sanitized.length) throw new Error('메시지가 없습니다');

  // Gemini 형식: role은 user / model, 내용은 parts[].text
  const contents = sanitized.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: getChatSystemPrompt() }] },
        contents,
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('Gemini API error', res.status, errText);
    throw new Error('AI 응답 요청이 실패했습니다');
  }

  const data = await res.json();
  const reply = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim();

  if (!reply) throw new Error('AI 응답이 비어 있습니다');
  return reply;
}

module.exports = { chatWithManager };
