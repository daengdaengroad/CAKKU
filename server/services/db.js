const { Pool } = require('pg');

// DATABASE_URL이 있으면 PostgreSQL에 예약을 저장한다. 없으면 저장 기능은 꺼진 채
// (이메일만) 동작하도록 graceful degrade.
let pool = null;
let triedInit = false;

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  pool = new Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

function hasDb() {
  return !!getPool();
}

async function initReservations() {
  triedInit = true;
  const p = getPool();
  if (!p) {
    console.warn('DATABASE_URL이 없어 예약 DB 저장이 비활성화됐습니다 (이메일 접수만 동작).');
    return;
  }
  await p.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT,
      shop_name TEXT,
      status TEXT NOT NULL DEFAULT '대기',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('예약 테이블 준비 완료');
}

async function insertReservation({ name, phone, message, type, shopName }) {
  const p = getPool();
  if (!p) return null;
  if (!triedInit) await initReservations();
  const { rows } = await p.query(
    `INSERT INTO reservations (name, phone, message, type, shop_name)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, phone, message, type || null, shopName || null]
  );
  return rows[0];
}

async function listReservations() {
  const p = getPool();
  if (!p) return [];
  const { rows } = await p.query(
    'SELECT * FROM reservations ORDER BY created_at DESC LIMIT 300'
  );
  return rows;
}

const ALLOWED_STATUS = ['대기', '확정', '완료', '취소'];

async function updateReservationStatus(id, status) {
  const p = getPool();
  if (!p) return null;
  if (!ALLOWED_STATUS.includes(status)) throw new Error('허용되지 않은 상태값');
  const { rows } = await p.query(
    'UPDATE reservations SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] || null;
}

module.exports = {
  hasDb,
  initReservations,
  insertReservation,
  listReservations,
  updateReservationStatus,
  ALLOWED_STATUS,
};
