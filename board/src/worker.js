/* 인건비 현황판 동기화 Worker.
 *
 * 하는 일은 두 가지뿐이다.
 *   1. public/index.html (현황판) 서빙 — 정적 자산은 Workers 가 알아서 내보낸다
 *   2. 현황판 내용을 '동기화 키' 하나에 묶어 D1 에 저장 / 조회
 *
 * 로그인은 없다. 24자리 무작위 키를 아는 쪽만 읽고 쓸 수 있는 구조라 키가 곧 비밀번호다.
 * 키 목록을 뽑는 경로는 없고, 로그에도 키를 남기지 않는다.
 */

const KEY_RE = /^[a-z0-9]{20,48}$/;
const MAX_BODY = 512 * 1024;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    // 현황판이 "여기는 동기화가 되는 곳인가"를 이걸로 판단한다.
    // 아티팩트나 로컬 파일로 열면 이 요청이 실패하고 동기화 UI 자체가 숨겨진다.
    if (pathname === "/api/health") return json({ ok: true, storage: "d1" });

    const m = pathname.match(/^\/api\/board\/([^/]+)\/?$/);
    if (m) {
      try {
        return await board(request, env, m[1]);
      } catch (e) {
        console.error("현황판 처리 실패:", e.message);   // 키는 남기지 않는다
        return json({ error: "server_error" }, 500);
      }
    }

    if (pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);
    return env.ASSETS.fetch(request);
  },
};

async function board(request, env, key) {
  if (!KEY_RE.test(key)) return json({ error: "bad_key" }, 400);
  if (request.method === "GET") return read(env, key);
  if (request.method === "PUT") return write(request, env, key);
  return json({ error: "method_not_allowed" }, 405);
}

const SELECT = "SELECT rev, data, updated_at FROM boards WHERE key = ?";

async function read(env, key) {
  const row = await env.DB.prepare(SELECT).bind(key).first();
  if (!row) return json({ error: "not_found" }, 404);
  return json({ rev: row.rev, data: JSON.parse(row.data), updatedAt: row.updated_at });
}

/* rev 는 클라이언트가 "내가 마지막으로 본 서버 버전"으로 보내온다.
 * 그 사이 다른 기기가 저장했으면 rev 가 어긋나므로 덮어쓰지 않고 409 로 돌려준다.
 * 조건을 SQL 안에 넣어야(WHERE rev = ?) 동시에 들어온 두 저장 중 하나만 통과한다.
 *   rev 0  = "이 키는 처음"  → 이미 있으면 충돌
 *   force  = 사용자가 '내 내용으로 덮어쓰기'를 고른 경우 → 무조건 통과
 */
async function write(request, env, key) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) {
    return json({ error: "too_large" }, 413);
  }

  let body;
  try { body = await request.json(); }
  catch (e) { return json({ error: "bad_json" }, 400); }

  const { data, rev, force } = body || {};
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json({ error: "bad_data" }, 400);
  }

  const text = JSON.stringify(data);
  if (text.length > MAX_BODY) return json({ error: "too_large" }, 413);

  const now = new Date().toISOString();
  const seen = Number(rev) || 0;
  let row;

  if (force === true) {
    row = await env.DB.prepare(
      `INSERT INTO boards (key, rev, data, updated_at) VALUES (?1, 1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET rev = boards.rev + 1, data = ?2, updated_at = ?3
       RETURNING rev`
    ).bind(key, text, now).first();
  } else if (seen === 0) {
    row = await env.DB.prepare(
      `INSERT INTO boards (key, rev, data, updated_at) VALUES (?, 1, ?, ?)
       ON CONFLICT(key) DO NOTHING
       RETURNING rev`
    ).bind(key, text, now).first();
  } else {
    row = await env.DB.prepare(
      `UPDATE boards SET rev = rev + 1, data = ?, updated_at = ?
       WHERE key = ? AND rev = ?
       RETURNING rev`
    ).bind(text, now, key, seen).first();
  }

  if (row) return json({ rev: row.rev, updatedAt: now });

  // 통과하지 못했다 = 그 사이 다른 기기가 저장했다. 서버 내용을 함께 돌려줘 고르게 한다.
  const cur = await env.DB.prepare(SELECT).bind(key).first();
  if (!cur) return json({ error: "server_error" }, 500);
  return json(
    { error: "conflict", rev: cur.rev, data: JSON.parse(cur.data), updatedAt: cur.updated_at },
    409
  );
}
