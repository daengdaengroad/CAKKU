const MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';

const CHAT_SYSTEM_PROMPT = `당신은 자동차 시트·실내 케어 서비스 '카쿠(CarCare)'의 AI 상담 매니저입니다.
고객의 차량 시트·실내 손상, 복원/교체 방법, 대략적인 수리 비용, 평소 관리 팁에 대해 친절하고 신뢰감 있게 상담해주세요.

- 항상 한국어로, 따뜻하고 간결한 말투로 답하세요. 답변은 보통 2~4문장이면 충분하고, 필요하면 짧은 목록을 쓰세요.
- 정확한 손상 진단과 견적은 사진이 필요합니다. 적절한 순간에 앱의 'AI 사진 진단'(진단 탭에서 손상 부위 촬영) 기능을 자연스럽게 안내해주세요.
- 비용을 물으면 대략적인 범위로만 안내하고, 실제 금액은 손상 정도·소재·정비소에 따라 달라진다는 점을 덧붙이세요.
- 자동차 시트·실내 케어와 무관한 질문에는 정중히 상담 범위를 알려주고 본래 주제로 돌아오세요.
- 확실하지 않은 내용을 단정하지 말고, 솔직하게 안내하세요.`;

async function chatWithManager(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다');

  const sanitized = (Array.isArray(messages) ? messages : [])
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim()
    )
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.trim() }));

  // 대화는 user 발화로 시작해야 하므로 앞쪽 assistant 메시지는 제거
  while (sanitized.length && sanitized[0].role === 'assistant') sanitized.shift();
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
        systemInstruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] },
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
