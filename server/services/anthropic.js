const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

const PRICE_REFERENCE = `
참고 시세표 (2026년 국내 기준, 반드시 이 범위 안에서 심각도에 맞게 추정하세요):
- 가죽 시트 부분 복원(작은 찢김/스크래치, 좌석 1개): 80,000 ~ 150,000원
- 가죽 시트 갈라짐/변색 복원(염색 포함): 100,000 ~ 200,000원
- 가죽 시트 전체 교체(좌석 1개): 250,000 ~ 500,000원
- 가죽 시트 전체 세트 교체(전 좌석): 1,000,000 ~ 2,500,000원
- 패브릭 시트 오염 클리닝: 30,000 ~ 70,000원
- 패브릭 시트 부분 수선(찢김): 50,000 ~ 120,000원
- 패브릭 시트 전체 교체(좌석 1개): 150,000 ~ 300,000원
- 알칸타라 시트 복원/수선: 100,000 ~ 200,000원
- 세미가죽 시트 부분 수선: 70,000 ~ 130,000원
- 시트 히터/열선 관련 작업: 100,000 ~ 250,000원
위 항목에 정확히 해당하지 않는 손상도 위 시세표의 단가 수준(작업 난이도·소재별 상대적 위치)을 기준 삼아 유사하게 추정하세요.
`;

function buildDamagePrompt(car, photoCount) {
  const multiPhotoNote =
    photoCount > 1
      ? `\n같은 손상 부위를 여러 각도에서 촬영한 사진 ${photoCount}장이 함께 제공됩니다. 모든 사진을 종합해서 하나의 진단으로 정리하세요 (사진마다 따로 진단하지 마세요).\n`
      : '';

  return `당신은 자동차 시트/실내 인테리어 손상 진단 전문가 AI입니다. 업로드된 사진을 분석하여 시트(나파 가죽, 세미가죽, 패브릭, 알칸타라 등) 및 실내 손상을 진단해주세요.

차량: ${car || '정보 없음'}
${multiPhotoNote}
**가장 먼저** 사진에 자동차 시트/실내가 실제로 찍혀 있는지 확인하세요. 시트나 차량 실내가 아닌 사진(외관, 다른 사물, 사람, 관련 없는 사진 등)이면 "isSeat"을 false로 하고, damages는 빈 배열로, summary에는 어떤 사진인 것 같은지와 시트 사진을 다시 올려달라는 안내를 담으세요.

시트/실내 사진이 맞으면 사진 속 소재(가죽/패브릭 등)를 스스로 판단하고, 그 소재 특성에 맞는 손상(찢김, 갈라짐, 오염, 변색, 마모 등)을 진단에 반영하세요.
${PRICE_REFERENCE}
반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만:
{
  "isSeat": true 또는 false,
  "severity": "심각" 또는 "보통" 또는 "경미",
  "confidence": 숫자(0-99),
  "damages": [
    {"name": "손상 부위명", "location": "시트/실내 위치(예: 운전석 시트, 뒷좌석 등받이)", "detail": "세부 설명 한 줄", "action": "교체" 또는 "복원" 또는 "청소" 또는 "수선", "priceMin": 숫자(원 단위), "priceMax": 숫자(원 단위)}
  ],
  "summary": "전체 진단 한 줄 요약"
}

시트/실내 사진일 때는, 손상이 잘 보이지 않더라도 사진 품질과 소재 특성 기반으로 전문적 추정을 반드시 제공하세요. priceMax는 priceMin보다 커야 하며, 위 시세표를 벗어나지 않게 하세요.`;
}

const CHAT_SYSTEM_PROMPT = `당신은 자동차 시트·실내 케어 서비스 '카쿠(CarCare)'의 AI 상담 매니저입니다.
고객의 차량 시트·실내 손상, 복원/교체 방법, 대략적인 수리 비용, 평소 관리 팁에 대해 친절하고 신뢰감 있게 상담해주세요.

- 항상 한국어로, 따뜻하고 간결한 말투로 답하세요. 답변은 보통 2~4문장이면 충분하고, 필요하면 짧은 목록을 쓰세요.
- 정확한 손상 진단과 견적은 사진이 필요합니다. 적절한 순간에 앱의 'AI 사진 진단'(진단 탭에서 손상 부위 촬영) 기능을 자연스럽게 안내해주세요.
- 비용을 물으면 대략적인 범위로만 안내하고, 실제 금액은 손상 정도·소재·정비소에 따라 달라진다는 점을 덧붙이세요.
- 자동차 시트·실내 케어와 무관한 질문에는 정중히 상담 범위를 알려주고 본래 주제로 돌아오세요.
- 확실하지 않은 내용을 단정하지 말고, 솔직하게 안내하세요.`;

async function chatWithManager(messages) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다');

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

  // Anthropic 메시지는 user로 시작해야 하므로 앞쪽 assistant 메시지는 제거
  while (sanitized.length && sanitized[0].role === 'assistant') sanitized.shift();
  if (!sanitized.length) throw new Error('메시지가 없습니다');

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: CHAT_SYSTEM_PROMPT,
    messages: sanitized,
  });

  return message.content.map((b) => b.text || '').join('').trim();
}

async function diagnoseDamage({ images, car }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다');
  if (!images?.length) throw new Error('이미지가 없습니다');

  const client = new Anthropic({ apiKey });

  const imageBlocks = images.map(({ buffer, mimeType }) => ({
    type: 'image',
    source: { type: 'base64', media_type: mimeType, data: buffer.toString('base64') },
  }));

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: buildDamagePrompt(car, images.length) }],
      },
    ],
  });

  const raw = message.content.map((b) => b.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    throw new Error('AI가 사진을 인식하지 못했어요. 더 밝은 곳에서 다시 촬영해주세요.');
  }
}

module.exports = { diagnoseDamage, chatWithManager };
