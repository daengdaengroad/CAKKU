import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../util/log.js';

const log = logger('fonts');

export interface FontEntry {
  family: string;
  file: string;
  /** 한글 글리프가 실제로 들어있는지. false면 자막이 네모로 깨진다. */
  hangul: boolean;
}

interface SfntTables {
  buf: Buffer;
  tables: Map<string, { offset: number; length: number }>;
}

function readSfnt(buf: Buffer, base: number): SfntTables | null {
  if (base + 12 > buf.length) return null;
  const numTables = buf.readUInt16BE(base + 4);
  const tables = new Map<string, { offset: number; length: number }>();

  for (let i = 0; i < numTables; i++) {
    const rec = base + 12 + i * 16;
    if (rec + 16 > buf.length) return null;
    tables.set(buf.toString('latin1', rec, rec + 4), {
      offset: buf.readUInt32BE(rec + 8),
      length: buf.readUInt32BE(rec + 12),
    });
  }
  return { buf, tables };
}

/** name 테이블에서 패밀리 이름을 읽는다. nameID 16(선호 패밀리)이 있으면 그쪽을 쓴다. */
function readFamily(sfnt: SfntTables): string | null {
  const table = sfnt.tables.get('name');
  if (!table) return null;
  const { buf } = sfnt;
  const base = table.offset;
  if (base + 6 > buf.length) return null;

  const count = buf.readUInt16BE(base + 2);
  const stringOffset = base + buf.readUInt16BE(base + 4);
  const found = new Map<number, string>();

  for (let i = 0; i < count; i++) {
    const rec = base + 6 + i * 12;
    if (rec + 12 > buf.length) break;
    const platformId = buf.readUInt16BE(rec);
    const nameId = buf.readUInt16BE(rec + 6);
    if (nameId !== 1 && nameId !== 16) continue;

    const length = buf.readUInt16BE(rec + 8);
    const offset = stringOffset + buf.readUInt16BE(rec + 10);
    if (offset + length > buf.length) continue;

    const slice = Buffer.from(buf.subarray(offset, offset + length));
    const value = platformId === 3 ? slice.swap16().toString('utf16le') : slice.toString('latin1');
    const clean = value.replace(/\0/g, '').trim();
    if (clean && !found.has(nameId)) found.set(nameId, clean);
  }

  return found.get(16) ?? found.get(1) ?? null;
}

function lookupFormat4(buf: Buffer, base: number, cp: number): boolean {
  if (cp > 0xffff) return false;
  const segCountX2 = buf.readUInt16BE(base + 6);
  const segCount = segCountX2 / 2;
  const endBase = base + 14;
  const startBase = endBase + segCountX2 + 2;
  const deltaBase = startBase + segCountX2;
  const rangeBase = deltaBase + segCountX2;

  for (let i = 0; i < segCount; i++) {
    if (endBase + i * 2 + 2 > buf.length) return false;
    const end = buf.readUInt16BE(endBase + i * 2);
    if (cp > end) continue;
    const start = buf.readUInt16BE(startBase + i * 2);
    if (cp < start) return false;

    const idRangeOffset = buf.readUInt16BE(rangeBase + i * 2);
    if (idRangeOffset === 0) {
      const delta = buf.readInt16BE(deltaBase + i * 2);
      return ((cp + delta) & 0xffff) !== 0;
    }
    const glyphIndexAddr = rangeBase + i * 2 + idRangeOffset + (cp - start) * 2;
    if (glyphIndexAddr + 2 > buf.length) return false;
    return buf.readUInt16BE(glyphIndexAddr) !== 0;
  }
  return false;
}

function lookupFormat12(buf: Buffer, base: number, cp: number): boolean {
  const nGroups = buf.readUInt32BE(base + 12);
  for (let i = 0; i < nGroups; i++) {
    const rec = base + 16 + i * 12;
    if (rec + 12 > buf.length) return false;
    const start = buf.readUInt32BE(rec);
    const end = buf.readUInt32BE(rec + 4);
    if (cp < start) return false;
    if (cp <= end) return buf.readUInt32BE(rec + 8) !== 0;
  }
  return false;
}

/** cmap 테이블을 직접 뒤져 해당 글자의 글리프가 있는지 확인한다. */
function hasGlyphs(sfnt: SfntTables, codepoints: number[]): boolean {
  const table = sfnt.tables.get('cmap');
  if (!table) return false;
  const { buf } = sfnt;
  const base = table.offset;
  if (base + 4 > buf.length) return false;

  const numSubtables = buf.readUInt16BE(base + 2);
  const subtables: number[] = [];

  for (let i = 0; i < numSubtables; i++) {
    const rec = base + 4 + i * 8;
    if (rec + 8 > buf.length) break;
    const platformId = buf.readUInt16BE(rec);
    const encodingId = buf.readUInt16BE(rec + 2);
    // 유니코드 서브테이블만 본다 (platform 0 = Unicode, 3 = Windows)
    const isUnicode =
      platformId === 0 || (platformId === 3 && (encodingId === 1 || encodingId === 10));
    if (isUnicode) subtables.push(base + buf.readUInt32BE(rec + 4));
  }

  return codepoints.every((cp) =>
    subtables.some((offset) => {
      if (offset + 2 > buf.length) return false;
      const format = buf.readUInt16BE(offset);
      try {
        if (format === 4) return lookupFormat4(buf, offset, cp);
        if (format === 12) return lookupFormat12(buf, offset, cp);
      } catch {
        return false;
      }
      return false;
    }),
  );
}

// '가'(U+AC00), '한'(U+D55C) — 둘 다 있으면 한글 조합형 완성자를 갖췄다고 본다.
const HANGUL_SAMPLES = [0xac00, 0xd55c];

function readFontFile(file: string): FontEntry[] {
  const buf = fs.readFileSync(file);
  const bases: number[] = [];

  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'ttcf') {
    const numFonts = buf.readUInt32BE(8);
    for (let i = 0; i < numFonts; i++) {
      const off = 12 + i * 4;
      if (off + 4 <= buf.length) bases.push(buf.readUInt32BE(off));
    }
  } else {
    bases.push(0);
  }

  const entries: FontEntry[] = [];
  for (const base of bases) {
    const sfnt = readSfnt(buf, base);
    if (!sfnt) continue;
    const family = readFamily(sfnt);
    if (!family) continue;
    entries.push({ family, file, hangul: hasGlyphs(sfnt, HANGUL_SAMPLES) });
  }
  return entries;
}

// 리눅스 폰트는 /usr/share/fonts/truetype/제조사/파일.ttf 처럼 두세 단계 아래에 있다.
function scanDir(dir: string, depth = 3): FontEntry[] {
  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const fonts: FontEntry[] = [];
  for (const entry of dirents) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth > 0) fonts.push(...scanDir(full, depth - 1));
      continue;
    }
    if (!entry.isFile() || !/\.(ttf|otf|ttc)$/i.test(entry.name)) continue;
    try {
      fonts.push(...readFontFile(full));
    } catch (err) {
      log.warn(`폰트를 읽지 못함: ${entry.name}`, err);
    }
  }
  return fonts;
}

const SYSTEM_FONT_DIRS = [
  '/usr/share/fonts',
  '/usr/local/share/fonts',
  `${process.env.HOME ?? ''}/.local/share/fonts`,
  '/Library/Fonts',
  '/System/Library/Fonts',
  '/System/Library/Fonts/Supplemental',
  `${process.env.HOME ?? ''}/Library/Fonts`,
  'C:\\Windows\\Fonts',
];

// 숏츠 자막으로 보기 좋은 순서. 앞에 있을수록 우선.
const PREFERRED = [
  'pretendard', 'noto sans kr', 'noto sans cjk kr', 'spoqa han sans',
  'gmarket sans', 'nanumsquare', 'nanum gothic', 'apple sd gothic neo',
  'malgun gothic', 'noto sans cjk', 'source han sans',
];

function rank(font: FontEntry): number {
  if (!font.hangul) return -1;
  const lower = font.family.toLowerCase();
  const index = PREFERRED.findIndex((name) => lower.includes(name));
  return index === -1 ? 0 : PREFERRED.length - index;
}

let cache: { dir: string; fonts: FontEntry[] } | null = null;

/**
 * 자막에 쓸 폰트 목록.
 * assets/fonts 에 사용자가 넣은 폰트를 최우선으로 하고, 부족하면 시스템 폰트도 훑는다.
 * 한글 글리프가 있는 폰트를 앞으로 정렬한다.
 */
export function availableFonts(assetsFontDir: string): FontEntry[] {
  if (cache?.dir === assetsFontDir) return cache.fonts;

  const bundled = scanDir(assetsFontDir);
  const system = SYSTEM_FONT_DIRS.flatMap((dir) => scanDir(dir));

  const deduped = new Map<string, FontEntry>();
  for (const font of [...bundled, ...system]) {
    if (!deduped.has(font.family)) deduped.set(font.family, font);
  }

  const fonts = [...deduped.values()].sort((a, b) => {
    const diff = rank(b) - rank(a);
    return diff !== 0 ? diff : a.family.localeCompare(b.family);
  });

  cache = { dir: assetsFontDir, fonts };

  const korean = fonts.filter((f) => f.hangul);
  if (korean.length === 0) {
    log.warn(
      `한글이 나오는 폰트가 없습니다. \`npm run setup\` 을 실행하거나 ${assetsFontDir} 에 한글 폰트(.ttf)를 넣어주세요.`,
    );
  } else {
    log.info(`폰트 ${fonts.length}개 인식 (한글 지원 ${korean.length}개), 기본값: ${korean[0]?.family}`);
  }
  return fonts;
}

/** 요청한 폰트가 있으면 그것을, 없으면 한글이 나오는 폰트 중 가장 나은 것을 고른다. */
export function resolveFont(assetsFontDir: string, requested: string): FontEntry | null {
  const fonts = availableFonts(assetsFontDir);

  if (requested) {
    const lower = requested.toLowerCase();
    const match =
      fonts.find((f) => f.family.toLowerCase() === lower) ??
      fonts.find((f) => f.family.toLowerCase().includes(lower));
    if (match) return match;
    log.warn(`'${requested}' 폰트를 찾지 못해 기본 폰트로 대체합니다.`);
  }

  return fonts.find((f) => f.hangul) ?? fonts[0] ?? null;
}

export function clearFontCache() {
  cache = null;
}
