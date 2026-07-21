// 업체 이름에 '시트'가 들어간 곳만 시트 전문 업체로 본다.
// (오디오·유리·내비·용품점 등 카테고리가 '카인테리어'로 뭉뚱그려진 곳은 자연히 제외)
function isSeatShop(name = '') {
  return typeof name === 'string' && name.includes('시트');
}

module.exports = { isSeatShop };
