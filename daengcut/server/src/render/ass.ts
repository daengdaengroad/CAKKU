import type { Caption, CaptionStyle } from '../timeline/types.js';

/** #RRGGBB + 투명도 → ASS 색상(&HAABBGGRR). ASS 는 알파가 반대(00=불투명)다. */
function assColor(hex: string, opacity = 1): string {
  const clean = hex.replace('#', '');
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  const alpha = Math.round((1 - Math.min(1, Math.max(0, opacity))) * 255)
    .toString(16)
    .padStart(2, '0');
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

function assTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  // 반올림으로 100이 되면 초를 올린다.
  const carry = cs === 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(carry ? s + 1 : s).padStart(2, '0')}.${String(
    carry ? 0 : cs,
  ).padStart(2, '0')}`;
}

/** 전각(한글/한자/가나)인지. 한글은 글자 하나가 대략 정사각형이라 폭 계산 기준이 다르다. */
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

/** 글자 하나의 대략적인 가로 폭 (em 단위). 폰트마다 다르지만 줄바꿈 판단에는 충분하다. */
function charWidthEm(ch: string): number {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return 0;
  if (isWide(cp)) return 1;
  if (ch === ' ') return 0.3;
  if (/[.,!?'":;·]/.test(ch)) return 0.32;
  if (/[iIl1|!\[\]()rtfj]/.test(ch)) return 0.36;
  if (/[A-Z@#%&WM]/.test(ch)) return 0.72;
  return 0.56;
}

function textWidthEm(text: string): number {
  let sum = 0;
  for (const ch of text) sum += charWidthEm(ch);
  return sum;
}

export interface WrapLimits {
  /** 한 줄이 차지할 수 있는 최대 폭 (글자 크기의 배수) */
  maxWidthEm: number;
  /** 사용자가 더 좁게 강제하고 싶을 때의 글자 수 상한 */
  maxChars: number;
}

/**
 * 자막 한 줄을 화면 폭에 맞게 접는다.
 * 글자 수가 아니라 실제 폭(em)으로 계산해야 "오늘도 산책 나온 우리 강아지"처럼
 * 한글이 길어지는 문장이 화면 밖으로 삐져나가지 않는다.
 */
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
      // 어절 하나가 통째로 안 들어가면 어쩔 수 없이 중간에서 자른다.
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

/** ASS 는 중괄호를 명령어 블록으로 읽는다. 자막 본문의 중괄호는 전각으로 바꿔 흘려보낸다. */
function escapeText(text: string): string {
  return text.replace(/\{/g, '｛').replace(/\}/g, '｝').replace(/\r?\n/g, ' ');
}

const ALIGNMENT: Record<CaptionStyle['position'], number> = {
  bottom: 2,
  middle: 5,
  top: 8,
};

export interface AssOptions {
  width: number;
  height: number;
  /** 실제로 렌더에 쓸 폰트 패밀리명 (resolveFont 로 확정한 값) */
  fontFamily: string;
  /** 자막 등장/퇴장 페이드 (밀리초). 0이면 딱 끊긴다. */
  fadeMs?: number;
}

/** 타임라인의 자막 목록을 libass 가 읽을 .ass 문서로 만든다. */
export function buildAss(captions: Caption[], style: CaptionStyle, opts: AssOptions): string {
  const fontSize = Math.round(style.fontSizeRatio * opts.height);
  const marginV = Math.round(style.marginRatio * opts.height);
  const marginH = Math.round(opts.width * 0.06);
  const fade = opts.fadeMs ?? 80;

  // 박스 자막은 BorderStyle 3 (BackColour 가 박스 색이 된다), 아니면 외곽선.
  const borderStyle = style.boxColor ? 3 : 1;
  const backColor = style.boxColor
    ? assColor(style.boxColor, style.boxOpacity)
    : assColor('#000000', 0.5);

  const baseStyle = [
    'Default',
    opts.fontFamily || 'Sans',
    fontSize,
    assColor(style.color),
    assColor('#FFFFFF'),
    assColor(style.outlineColor),
    backColor,
    style.bold ? -1 : 0,
    0, 0, 0,
    100, 100, 0, 0,
    borderStyle,
    style.outlineWidth,
    style.shadow,
    ALIGNMENT[style.position],
    marginH, marginH, marginV,
    1,
  ].join(',');

  // 강조 자막은 노란색 + 살짝 크게.
  const emphasisStyle = [
    'Emphasis',
    opts.fontFamily || 'Sans',
    Math.round(fontSize * 1.14),
    assColor('#FFE14D'),
    assColor('#FFFFFF'),
    assColor(style.outlineColor),
    backColor,
    -1,
    0, 0, 0,
    100, 100, 0, 0,
    borderStyle,
    style.outlineWidth + 1,
    style.shadow,
    ALIGNMENT[style.position],
    marginH, marginH, marginV,
    1,
  ].join(',');

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${opts.width}`,
    `PlayResY: ${opts.height}`,
    // 2 = 자동 줄바꿈 없음. 줄바꿈은 우리가 \N 으로 직접 넣는다.
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ${baseStyle}`,
    `Style: ${emphasisStyle}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  // 좌우 여백을 뺀 실제 가용 폭을 글자 크기로 나누면 "한 줄에 몇 em 들어가는지"가 나온다.
  const usableWidth = opts.width - marginH * 2;
  const baseWidthEm = usableWidth / fontSize;
  // 강조 자막은 14% 크게 그리므로 그만큼 덜 들어간다.
  const emphasisWidthEm = usableWidth / (fontSize * 1.14);

  const events = [...captions]
    .filter((c) => c.end > c.start && c.text.trim())
    .sort((a, b) => a.start - b.start)
    .map((caption) => {
      const lines = wrapCaption(escapeText(caption.text), {
        maxWidthEm: caption.emphasis ? emphasisWidthEm : baseWidthEm,
        maxChars: style.maxCharsPerLine,
      });
      const body = lines.join('\\N');
      const prefix = fade > 0 ? `{\\fad(${fade},${fade})}` : '';
      return `Dialogue: 0,${assTime(caption.start)},${assTime(caption.end)},${
        caption.emphasis ? 'Emphasis' : 'Default'
      },,0,0,0,,${prefix}${body}`;
    });

  return [...header, ...events, ''].join('\n');
}
