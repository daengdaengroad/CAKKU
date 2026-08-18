/**
 * 자막 줄바꿈 계산.
 * server/src/render/ass.ts 의 wrapCaption 과 같은 규칙을 따른다.
 * 미리보기와 실제 렌더 결과의 줄바꿈이 달라지면 안 되므로, 한쪽을 고치면 다른 쪽도 고쳐야 한다.
 */

function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    codePoint >= 0x20000
  );
}

function charWidthEm(ch: string): number {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return 0;
  if (isWide(cp)) return 1;
  if (ch === ' ') return 0.3;
  if (/[.,!?'":;·]/.test(ch)) return 0.32;
  if (/[iIl1|![\]()rtfj]/.test(ch)) return 0.36;
  if (/[A-Z@#%&WM]/.test(ch)) return 0.72;
  return 0.56;
}

function textWidthEm(text: string): number {
  let sum = 0;
  for (const ch of text) sum += charWidthEm(ch);
  return sum;
}

export interface WrapLimits {
  maxWidthEm: number;
  maxChars: number;
}

export function wrapCaption(text: string, limits: WrapLimits): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const fits = (candidate: string) =>
    textWidthEm(candidate) <= limits.maxWidthEm && [...candidate].length <= limits.maxChars;

  const lines: string[] = [];
  let current = '';

  const hardBreak = (word: string) => {
    let chunk = '';
    for (const ch of word) {
      if (chunk && !fits(chunk + ch)) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    return chunk;
  };

  for (const word of normalized.split(' ')) {
    if (!fits(word)) {
      if (current) {
        lines.push(current);
        current = '';
      }
      current = hardBreak(word);
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

/** 캔버스 좌우 여백(6%)을 뺀 폭을 글자 크기로 나눈 값. ass.ts 의 계산과 같아야 한다. */
export function wrapWidthEm(canvasWidth: number, fontSize: number, emphasis: boolean): number {
  const marginH = Math.round(canvasWidth * 0.06);
  const usable = canvasWidth - marginH * 2;
  return usable / (fontSize * (emphasis ? 1.14 : 1));
}
