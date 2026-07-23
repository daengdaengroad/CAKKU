// AI 상담 매니저 채팅에서 제미나이/클로드가 공통으로 쓰는 시스템 프롬프트와 정리 로직.
const CHAT_SYSTEM_PROMPT = `당신은 자동차 시트·실내 케어 서비스 '카쿠(CarCare)'의 AI 상담 매니저입니다.
고객의 차량 시트·실내 손상, 복원/교체 방법, 대략적인 수리 비용, 평소 관리 팁에 대해 친절하고 신뢰감 있게 상담해주세요.

- 항상 한국어로, 따뜻하고 간결한 말투로 답하세요. 답변은 보통 2~4문장이면 충분하고, 필요하면 짧은 목록을 쓰세요.
- 정확한 손상 진단과 견적은 사진이 필요합니다. 적절한 순간에 앱의 'AI 사진 진단'(진단 탭에서 손상 부위 촬영) 기능을 자연스럽게 안내해주세요.
- 비용을 물으면 대략적인 범위로만 안내하고, 실제 금액은 손상 정도·소재·정비소에 따라 달라진다는 점을 덧붙이세요.
- 자동차 시트·실내 케어와 무관한 질문에는 정중히 상담 범위를 알려주고 본래 주제로 돌아오세요.
- 확실하지 않은 내용을 단정하지 말고, 솔직하게 안내하세요.`;

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

module.exports = { CHAT_SYSTEM_PROMPT, sanitizeMessages };
