/* 현황판 저장소.
 *
 * DATABASE_URL 이 있으면 PostgreSQL 을 쓴다 (Railway 배포용).
 * 없으면 로컬 파일에 저장한다 — 개발 중 바로 띄워보기 위한 것이지 운영용이 아니다.
 * Railway 컨테이너의 디스크는 재배포하면 날아가므로, 배포에는 반드시 DB를 붙여야 한다.
 */

const fs = require('fs/promises');
const path = require('path');

const url = process.env.DATABASE_URL;
const FILE = path.join(__dirname, '.data', 'boards.json');

let pool = null;

function kind() {
  return url ? 'postgres' : 'file';
}

async function init() {
  if (!url) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    console.warn(
      'DATABASE_URL 이 없어 로컬 파일에 저장합니다. 개발용이며, 배포 환경에서는 재배포 시 내용이 사라집니다.'
    );
    return;
  }
  const { Pool } = require('pg');
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  pool = new Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS boards (
      key        TEXT PRIMARY KEY,
      rev        INTEGER NOT NULL DEFAULT 1,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('현황판 테이블 준비 완료');
}

/* ---------- 파일 저장소 ---------- */

async function readFileStore() {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeFileStore(all) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all), 'utf8');
}

/* ---------- 공용 ---------- */

async function get(key) {
  if (!pool) {
    const all = await readFileStore();
    return all[key] || null;
  }
  const { rows } = await pool.query(
    'SELECT rev, data, updated_at FROM boards WHERE key = $1',
    [key]
  );
  if (!rows.length) return null;
  return { rev: rows[0].rev, data: rows[0].data, updatedAt: rows[0].updated_at };
}

/* rev 는 "내가 마지막으로 본 서버 버전". 그 사이 다른 기기가 저장했으면
 * rev 가 어긋나므로 덮어쓰지 않고 conflict 로 돌려준다.
 * rev 0 은 "이 키는 처음"이라는 뜻이고, force 는 사용자가 덮어쓰기를 고른 경우다. */
async function put(key, data, rev, force) {
  const current = await get(key);

  if (current && !force && current.rev !== rev) {
    return { conflict: true, current };
  }

  const next = {
    rev: (current ? current.rev : 0) + 1,
    data,
    updatedAt: new Date().toISOString(),
  };

  if (!pool) {
    const all = await readFileStore();
    all[key] = next;
    await writeFileStore(all);
    return next;
  }

  const { rows } = await pool.query(
    `INSERT INTO boards (key, rev, data, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET rev = $2, data = $3, updated_at = now()
     RETURNING rev, updated_at`,
    [key, next.rev, JSON.stringify(data)]
  );
  return { rev: rows[0].rev, updatedAt: rows[0].updated_at };
}

module.exports = { init, kind, get, put };
