/* 인건비 현황판 동기화 서버.
 *
 * 카꾸 앱 서버와는 완전히 별개로 도는 작은 서비스다. 하는 일은 두 가지뿐:
 *   1. public/index.html (현황판) 서빙
 *   2. 현황판 내용을 동기화 키 하나에 묶어 저장 / 조회
 *
 * 로그인은 없다. 긴 무작위 동기화 키를 아는 사람만 읽고 쓸 수 있는 구조라
 * 키 자체가 비밀번호다. 키는 목록으로 뽑을 수 없고, 서버 로그에도 남기지 않는다.
 */

const path = require('path');
const express = require('express');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3100;

app.disable('x-powered-by');
app.set('trust proxy', 1);          // Railway 프록시 뒤라 실제 접속 IP를 보려면 필요
app.use(express.json({ limit: '512kb' }));

/* 키를 무작위로 넣어보며 남의 현황판을 찾는 걸 막는다.
 * 정상 사용은 몇 초에 한 번이라 넉넉히 잡아도 걸릴 일이 없다. */
const HITS = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_MIN = 120;
const MAX_MISS_PER_MIN = 15;        // 없는 키 조회 = 추측 시도로 본다

function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  let h = HITS.get(ip);
  if (!h || now - h.start > WINDOW_MS) {
    h = { start: now, count: 0, miss: 0 };
    HITS.set(ip, h);
  }
  h.count += 1;
  if (h.count > MAX_PER_MIN || h.miss > MAX_MISS_PER_MIN) {
    return res.status(429).json({ error: 'too_many_requests' });
  }
  req.rateBucket = h;
  next();
}

// Map 이 무한정 커지지 않도록 지난 창은 주기적으로 버린다
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of HITS) if (now - h.start > WINDOW_MS * 2) HITS.delete(ip);
}, WINDOW_MS).unref();

const KEY_RE = /^[a-z0-9]{20,48}$/;
const badKey = (k) => !KEY_RE.test(k || '');

/* 현황판이 "여기는 동기화가 되는 곳인가"를 판단하는 데 쓴다.
 * 아티팩트나 로컬 파일로 열면 이 요청이 실패하고, 동기화 UI 자체가 숨겨진다. */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, storage: store.kind() });
});

app.get('/api/board/:key', rateLimit, async (req, res) => {
  const { key } = req.params;
  if (badKey(key)) return res.status(400).json({ error: 'bad_key' });
  try {
    const row = await store.get(key);
    if (!row) {
      req.rateBucket.miss += 1;
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ rev: row.rev, data: row.data, updatedAt: row.updatedAt });
  } catch (e) {
    console.error('조회 실패:', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.put('/api/board/:key', rateLimit, async (req, res) => {
  const { key } = req.params;
  if (badKey(key)) return res.status(400).json({ error: 'bad_key' });

  const { data, rev, force } = req.body || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'bad_data' });
  }

  try {
    const saved = await store.put(key, data, Number(rev) || 0, force === true);
    if (saved.conflict) {
      // 다른 기기가 먼저 저장했다. 덮어쓰지 않고 서버 내용을 돌려준다.
      return res.status(409).json({
        error: 'conflict',
        rev: saved.current.rev,
        data: saved.current.data,
        updatedAt: saved.current.updatedAt,
      });
    }
    res.json({ rev: saved.rev, updatedAt: saved.updatedAt });
  } catch (e) {
    console.error('저장 실패:', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

store.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`현황판 서버 실행 중: http://localhost:${PORT} (저장소: ${store.kind()})`);
    });
  })
  .catch((e) => {
    console.error('저장소 초기화 실패:', e.message);
    process.exit(1);
  });
