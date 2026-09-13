// 문장별 mp3 길이를 그대로 자막 타이밍으로 쓴다 (ASS 자막 파일 생성).

const fs = require('fs');

const PLAY_W = 1080;
const PLAY_H = 1920;
// 한 줄에 이 글자 수를 넘으면 두 줄로 쪼갠다. 세로 화면에서 가독성 한계치.
const MAX_CHARS_PER_LINE = 16;

function toAssTime(seconds) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
}

function escapeText(text) {
  return String(text).replace(/[{}]/g, '').replace(/\r?\n/g, ' ').trim();
}

// 공백 기준으로 가운데에 가장 가까운 지점에서 두 줄로 나눈다.
function wrap(text) {
  const clean = escapeText(text);
  if (clean.length <= MAX_CHARS_PER_LINE) return clean;

  const words = clean.split(' ');
  if (words.length === 1) return clean;

  const mid = clean.length / 2;
  let best = null;
  let pos = 0;
  for (let i = 0; i < words.length - 1; i += 1) {
    pos += words[i].length + 1;
    const score = Math.abs(pos - mid);
    if (!best || score < best.score) best = { score, index: i + 1 };
  }
  return `${words.slice(0, best.index).join(' ')}\\N${words.slice(best.index).join(' ')}`;
}

function header(fontName) {
  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${PLAY_W}`,
    `PlayResY: ${PLAY_H}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour,' +
      ' Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline,' +
      ' Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // 자막: 흰 글씨 + 검은 외곽선, 아래쪽 중앙 (ASS 색상은 &HAABBGGRR)
    `Style: Sub,${fontName},66,&H00FFFFFF,&H00FFFFFF,&HC8101010,&H64000000,-1,0,0,0,100,100,1,0,1,6,3,2,70,70,300,1`,
    // 오프닝 타이틀: 화면 가운데 위쪽
    `Style: Title,${fontName},104,&H00FFFFFF,&H00FFFFFF,&HC8101010,&H64000000,-1,0,0,0,100,100,3,0,1,7,4,8,60,60,300,1`,
    // 마지막 컷에 뜨는 마무리 카드 (화면 정중앙)
    `Style: End,${fontName},96,&H00FFFFFF,&H00FFFFFF,&HC8101010,&H64000000,-1,0,0,0,100,100,3,0,1,7,4,5,60,60,0,1`,
    // 타이틀 아래 메뉴 줄
    `Style: Menu,${fontName},52,&H00E8F4FF,&H00E8F4FF,&HC8101010,&H64000000,-1,0,0,0,100,100,2,0,1,5,2,8,60,60,470,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');
}

function dialogue({ start, end, style, text, effect = '\\fad(180,180)' }) {
  return `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},${style},,0,0,0,,{${effect}}${text}`;
}

/**
 * clips: [{ text, start, end }]  (start/end는 실제 mp3 길이로 계산된 값)
 */
function buildAss({ clips, storeName, menus, titleSeconds = 2.4, endCard = null, fontName = 'NanumSquareRound', file }) {
  const events = [];

  if (titleSeconds > 0 && storeName) {
    events.push(dialogue({ start: 0.15, end: titleSeconds, style: 'Title', text: escapeText(storeName) }));
    if (menus && menus.length) {
      events.push(
        dialogue({
          start: 0.35,
          end: titleSeconds,
          style: 'Menu',
          text: escapeText(menus.join('  ·  ')),
        })
      );
    }
  }

  for (const clip of clips) {
    events.push(dialogue({ start: clip.start, end: clip.end, style: 'Sub', text: wrap(clip.text) }));
  }

  // 마지막 여운 구간에 매장명을 한 번 더 띄워 마무리한다.
  if (endCard && endCard.end > endCard.start) {
    const text = menus && menus.length
      ? `${escapeText(storeName)}\\N{\\fs52}${escapeText(menus.join('  ·  '))}`
      : escapeText(storeName);
    events.push(dialogue({ start: endCard.start, end: endCard.end, style: 'End', text, effect: '\\fad(300,200)' }));
  }

  const content = `${header(fontName)}\n${events.join('\n')}\n`;
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

module.exports = { buildAss, wrap, toAssTime };
