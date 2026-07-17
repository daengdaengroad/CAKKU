const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

function buildDamagePrompt(car) {
  return `당신은 자동차 외장/차체 손상 진단 전문가 AI입니다. 업로드된 사진을 분석하여 손상을 진단해주세요.

차량: ${car || '정보 없음'}

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만:
{
  "severity": "심각" 또는 "보통" 또는 "경미",
  "confidence": 숫자(0-99),
  "damages": [
    {"name": "손상 부위명", "location": "차체 위치(예: 앞범퍼, 좌측 도어)", "detail": "세부 설명 한 줄", "action": "교체" 또는 "판금" 또는 "도색" 또는 "수리", "price": 숫자(원 단위)}
  ],
  "summary": "전체 진단 한 줄 요약"
}

손상이 잘 보이지 않더라도 사진 품질과 손상 형태 기반으로 전문적 추정을 반드시 제공하세요.`;
}

async function diagnoseDamage({ imageBuffer, mimeType, car }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다');

  const client = new Anthropic({ apiKey });
  const imageBase64 = imageBuffer.toString('base64');

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          { type: 'text', text: buildDamagePrompt(car) },
        ],
      },
    ],
  });

  const raw = message.content.map((b) => b.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

module.exports = { diagnoseDamage };
