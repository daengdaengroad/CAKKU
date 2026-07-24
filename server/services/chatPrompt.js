const fs = require('fs');
const path = require('path');
const { isSeatShop } = require('./seatShop');

// AI 상담 매니저 채팅에서 제미나이/클로드가 공통으로 쓰는 시스템 프롬프트와 정리 로직.
const CHAT_SYSTEM_PROMPT = `당신은 자동차 시트·실내 케어 서비스 '카꾸(CAKKU)'의 AI 상담 매니저입니다.
고객의 차량 시트·실내 손상, 복원/교체 방법, 대략적인 수리 비용, 평소 관리 팁에 대해 친절하고 신뢰감 있게 상담해주세요.

- 항상 한국어로, 따뜻하고 간결한 말투로 답하세요. 답변은 보통 2~4문장이면 충분하고, 필요하면 짧은 목록을 쓰세요.
- 정확한 손상 진단과 견적은 사진이 필요합니다. 적절한 순간에 앱의 'AI 사진 진단'(진단 탭에서 손상 부위 촬영) 기능을 자연스럽게 안내해주세요.
- 비용을 물으면 대략적인 범위로만 안내하고, 실제 금액은 손상 정도·소재·정비소에 따라 달라진다는 점을 덧붙이세요.
- 자동차 시트·실내 케어와 무관한 질문에는 정중히 상담 범위를 알려주고 본래 주제로 돌아오세요.
- 확실하지 않은 내용을 단정하지 말고, 솔직하게 안내하세요.`;

// shops.json에서 시트 전문 업체만 뽑아 채팅에 넘길 목록 컨텍스트를 만든다.
let cachedShops = null;
function getSeatShops() {
  if (cachedShops) return cachedShops;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'shops.json'), 'utf8');
    cachedShops = JSON.parse(raw).filter((s) => isSeatShop(s.name, s.category));
  } catch (e) {
    cachedShops = [];
  }
  return cachedShops;
}

function buildShopContext() {
  const shops = getSeatShops();
  if (!shops.length) return '';
  const lines = shops.map((s) => {
    // 주소 앞 두 토큰(시/도 + 시군구)만 지역으로 표기
    const region = (s.address || '').split(' ').slice(0, 2).join(' ');
    return `- ${s.name} (${region})${s.phone ? ` ${s.phone}` : ''}`;
  });
  return `

[카꾸에 등록된 실제 시트 전문 업체 목록 — 총 ${shops.length}곳]
${lines.join('\n')}

사용자가 특정 지역의 시트 수리 업체를 물으면, 위 목록에서 그 지역(또는 가장 가까운 지역)의 업체를 실제 상호·지역·전화번호와 함께 안내하세요. 해당 지역에 없으면 "그 지역엔 아직 등록된 곳이 없다"고 솔직히 말하고 가까운 지역의 업체를 대신 추천하세요. 목록에 없는 업체를 지어내지 말고, 더 많은 업체는 앱의 '수리업체' 탭에서 지역별로 볼 수 있다고 안내하세요.`;
}

// 시스템 프롬프트에 실시간 업체 목록을 붙여 반환한다.
function getChatSystemPrompt() {
  return CHAT_SYSTEM_PROMPT + buildShopContext();
}

// user/assistant 메시지만 남기고, 최근 20개로 자르고, 앞쪽 assistant는 제거(대화는 user로 시작).
function sanitizeMessages(messages) {
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

  while (sanitized.length && sanitized[0].role === 'assistant') sanitized.shift();
  return sanitized;
}

module.exports = { CHAT_SYSTEM_PROMPT, getChatSystemPrompt, sanitizeMessages };
