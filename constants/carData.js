export const CAR_BRANDS = [
  '현대', '기아', '제네시스', '쉐보레',
  'KG모빌리티', '르노', '벤츠', 'BMW',
  '아우디', '볼보', '테슬라', '기타'
];

export const CONSUMABLES = [
  {
    name: '엔진오일',
    icon: '🛢️',
    intervalKm: 10000,
    intervalMonths: 6,
    description: '엔진 보호를 위한 핵심 소모품',
  },
  {
    name: '타이어 점검',
    icon: '⚙️',
    intervalKm: 20000,
    intervalMonths: 12,
    description: '마모 상태 및 공기압 확인',
  },
  {
    name: '에어필터',
    icon: '💨',
    intervalKm: 15000,
    intervalMonths: 12,
    description: '엔진 흡기 필터 교체',
  },
  {
    name: '브레이크 패드',
    icon: '🔴',
    intervalKm: 30000,
    intervalMonths: 24,
    description: '제동 성능 유지를 위한 필수 점검',
  },
  {
    name: '와이퍼',
    icon: '🌧️',
    intervalKm: 0,
    intervalMonths: 12,
    description: '우천 시 시야 확보',
  },
  {
    name: '배터리',
    icon: '🔋',
    intervalKm: 0,
    intervalMonths: 36,
    description: '시동 불량 방지 정기 점검',
  },
];

export const getConsumableStatus = (mileage, lastReplacedKm, intervalKm) => {
  if (!intervalKm) return null;
  const driven = mileage - lastReplacedKm;
  const remaining = intervalKm - driven;
  if (remaining <= 0) return 'overdue';
  if (remaining <= 2000) return 'urgent';
  return 'ok';
};
