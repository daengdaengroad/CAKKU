// 대본 초안 파일 읽기/쓰기.
// 생성 -> 사람이 손으로 고침 -> 렌더링, 이 2단계를 위한 중간 파일이다.

const fs = require('fs');
const path = require('path');

/**
 * 한 줄은 { say, caption, photo } 형태다.
 *  - say: TTS가 읽을 문장
 *  - caption: 화면에 뜨는 자막 (비워두면 say를 그대로 쓴다)
 *  - photo: 이 문장에 붙일 사진 (비워두면 순서대로 돌아가며 배정)
 */
function normalizeLine(line, index) {
  if (typeof line === 'string') return { say: line.trim(), caption: '', photo: '' };
  const say = String(line.say || line.text || '').trim();
  if (!say) throw new Error(`${index + 1}번 문장의 say가 비어 있습니다.`);
  return {
    say,
    caption: String(line.caption || '').trim(),
    photo: String(line.photo || '').trim(),
  };
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || !lines.length) throw new Error('lines 가 비어 있습니다.');
  return lines.map(normalizeLine);
}

function writeDraft(file, { storeName, menus, photos, note, lines }) {
  const draft = {
    storeName,
    menus,
    note: note || '',
    photos,
    // 편집자를 위한 안내. 렌더링할 때는 무시된다.
    _안내: [
      'say = 성우가 읽을 문장, caption = 화면 자막 (비우면 say를 그대로 씀)',
      'photo = 그 문장에 붙일 사진 파일명 (비우면 photos 순서대로 배정)',
      '문장을 지우거나 추가해도 된다. 사진보다 문장이 많으면 사진을 돌려 쓴다.',
      '다 고쳤으면: npm run shorts -- --script <이 파일 경로>',
    ],
    lines: normalizeLines(lines),
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(draft, null, 2), 'utf8');
  return file;
}

function readDraft(file) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) throw new Error(`대본 파일이 없습니다: ${resolved}`);

  let draft;
  try {
    draft = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (e) {
    // 손으로 고치는 파일이라 쉼표 하나 빠뜨리는 일이 흔하다.
    throw new Error(`대본 파일 JSON 형식이 깨졌습니다 (${path.basename(resolved)}): ${e.message}`);
  }

  draft.lines = normalizeLines(draft.lines);
  // 사진 경로는 대본 파일 위치 기준으로 푼다.
  const base = path.dirname(resolved);
  if (Array.isArray(draft.photos)) {
    draft.photos = draft.photos.map((p) => (path.isAbsolute(p) ? p : path.resolve(base, p)));
  }
  return draft;
}

// 문장에 지정된 사진을 실제 경로로 바꾼다. 파일명만 적어도 찾아준다.
function resolveLinePhoto(linePhoto, photos, fallbackIndex) {
  if (!linePhoto) return photos[fallbackIndex % photos.length];
  const exact = photos.find((p) => p === linePhoto || path.basename(p) === linePhoto);
  if (exact) return exact;
  if (fs.existsSync(linePhoto)) return path.resolve(linePhoto);
  throw new Error(`문장에 지정된 사진을 찾을 수 없습니다: ${linePhoto}`);
}

module.exports = { writeDraft, readDraft, normalizeLines, resolveLinePhoto };
