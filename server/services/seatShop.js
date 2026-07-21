// 시트/실내/가죽 복원 관련 업체만 골라내기 위한 필터.
// 이름 또는 카테고리에 아래 신호가 있으면 시트 관련 업체로 본다.
// (신호가 전혀 없는 일반 자동차정비소는 제외)
const SEAT_HINTS = [
  '시트',
  '카인테리어',
  '인테리어',
  '가죽',
  '레자',
  '레쟈',
  '실내',
  '카시트',
  '알칸타라',
  '스웨이드',
];

function isSeatShop(name = '', category = '') {
  const hay = `${name} ${category}`;
  return SEAT_HINTS.some((k) => hay.includes(k));
}

module.exports = { isSeatShop };
