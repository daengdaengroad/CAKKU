const nodemailer = require('nodemailer');

// GMAIL_USER + GMAIL_APP_PASSWORD가 있으면 Gmail로 예약 알림 메일을 보낸다.
// 없으면 메일 발송은 조용히 건너뛴다(예약은 DB에 남음).
let transport = null;

function getTransport() {
  if (transport) return transport;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  // 앱 비밀번호는 공백 없이 16자. 사용자가 공백 포함해 넣어도 처리.
  transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: pass.replace(/\s+/g, '') },
  });
  return transport;
}

function hasEmail() {
  return !!getTransport();
}

function typeLabel(type) {
  return { reservation: '정비소 예약', estimate: '견적 요청', consult: '상담 요청' }[type] || '예약/문의';
}

async function sendReservationEmail(r) {
  const t = getTransport();
  if (!t) return false;

  const to = process.env.RESERVATION_TO || process.env.GMAIL_USER;
  const when = new Date(r.created_at || Date.now()).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const lines = [
    `■ 종류: ${typeLabel(r.type)}`,
    `■ 희망 업체: ${r.shop_name || '미지정'}`,
    `■ 이름: ${r.name}`,
    `■ 연락처: ${r.phone}`,
    '',
    '■ 요청 내용:',
    r.message,
    '',
    `■ 접수 시각: ${when}`,
    r.id ? `■ 접수 번호: #${r.id}` : '',
  ].filter(Boolean);

  await t.sendMail({
    from: `카꾸 예약 접수 <${process.env.GMAIL_USER}>`,
    to,
    replyTo: r.phone ? undefined : undefined,
    subject: `[카꾸 예약] ${r.name} · ${r.shop_name || '업체 미지정'}`,
    text: lines.join('\n'),
  });
  return true;
}

module.exports = { hasEmail, sendReservationEmail };
