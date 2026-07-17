const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-8';

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

반드시 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만:
{
  "isSeat": true 또는 false,
  "severity": "심각" 또는 "보통" 또는 "경미",
  "confidence": 숫자(0-99),
  "damages": [
    {"name": "손상 부위명", "location": "시트/실내 위치(예: 운전석 시트, 뒷좌석 등받이)", "detail": "세부 설명 한 줄", "action": "교체" 또는 "복원" 또는 "청소" 또는 "수선", "price": 숫자(원 단위)}
  ],
  "summary": "전체 진단 한 줄 요약"
}

시트/실내 사진일 때는, 손상이 잘 보이지 않더라도 사진 품질과 소재 특성 기반으로 전문적 추정을 반드시 제공하세요.`;
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

module.exports = { diagnoseDamage };
