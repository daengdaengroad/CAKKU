-- 현황판 저장 테이블. 동기화 키 하나에 현황판 한 벌이 통째로 들어간다.
CREATE TABLE IF NOT EXISTS boards (
  key        TEXT PRIMARY KEY,
  rev        INTEGER NOT NULL DEFAULT 1,
  data       TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
