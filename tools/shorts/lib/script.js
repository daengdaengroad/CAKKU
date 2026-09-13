// 25초짜리 매장 홍보 쇼츠 대본을 만든다.
// 문장 수 = 사진 수. 사진 한 장이 문장 하나 길이만큼 화면에 머문다.

const TARGET_SECONDS = 25;
// 한국어 TTS는 대략 초당 5.5자를 읽는다. 길이 추정과 프롬프트 가이드에 함께 쓴다.
const CHARS_PER_SECOND = 5.5;

function buildPrompt({ storeName, menus, note, lines, perLineChars }) {
  return [
    '너는 소상공인 매장 홍보용 세로형 쇼츠(숏폼) 대본을 쓰는 카피라이터다.',
    '',
    `매장명: ${storeName}`,
    `대표 메뉴: ${menus.join(', ')}`,
    note ? `추가 정보: ${note}` : '',
    '',
    '조건:',
    `- 정확히 ${lines}개의 문장을 쓴다. 문장 하나가 사진 한 장에 대응한다.`,
    `- 각 문장은 한국어로 ${perLineChars - 6}~${perLineChars + 6}자. 전체를 소리내어 읽으면 약 ${TARGET_SECONDS}초.`,
    '- 1번 문장은 스크롤을 멈추게 하는 후킹 문장(질문이나 감탄).',
    '- 중간 문장에서 대표 메뉴 2개를 자연스럽게 한 번씩 언급한다.',
    '- 마지막 문장은 매장명을 넣은 방문 유도 문구.',
    '- 이모지, 해시태그, 괄호, 따옴표, 특수문자를 쓰지 않는다. 구어체 존댓말.',
    '- 없는 사실(수상 이력, 가격, 영업시간, 원산지)을 지어내지 않는다.',
    '',
    `출력 형식: 문장 ${lines}개만 담은 JSON 배열. 설명이나 코드펜스 없이 배열만 출력한다.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function parseLines(raw, expected) {
  let text = String(raw || '').trim();
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  let lines = null;
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) lines = parsed.map((v) => String(v));
    } catch {
      /* 아래 줄바꿈 분리로 폴백 */
    }
  }
  if (!lines) {
    lines = text
      .split('\n')
      .map((l) => l.replace(/^\s*[-*\d.")\]]+\s*/, '').trim())
      .filter(Boolean);
  }

  lines = lines.map(cleanLine).filter(Boolean);
  if (!lines.length) throw new Error('대본 파싱 실패: 빈 결과');
  // 개수가 어긋나면 자르거나 마지막 문장을 반복하지 않고 순환시켜 맞춘다.
  if (lines.length > expected) lines = lines.slice(0, expected);
  if (lines.length < expected) {
    const seed = [...lines];
    for (let i = lines.length; i < expected; i += 1) lines.push(seed[i % seed.length]);
  }
  return lines;
}

function cleanLine(line) {
  return String(line)
    .replace(/[#*`"'""''()[\]{}]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function viaGemini({ prompt, apiKey }) {
  const model = process.env.GEMINI_SCRIPT_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}

async function viaAnthropic({ prompt, apiKey }) {
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 1,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data?.content || []).map((b) => b.text || '').join('');
}

// API 키가 없어도 파이프라인 전체를 돌려볼 수 있게 하는 템플릿 대본.
function template({ storeName, menus, lines }) {
  const [menuA, menuB = menus[0]] = menus;
  const base = [
    `이 동네 사는데 ${storeName} 아직 안 가보셨어요`,
    `자리 잡고 앉으면 바로 나오는 ${menuA}`,
    `한 입 먹으면 왜 다들 여기 오는지 알게 됩니다`,
    `같이 시키면 좋은 건 ${menuB} 입니다`,
    `오늘 저녁은 ${storeName} 에서 드셔보세요`,
  ];
  const out = [];
  for (let i = 0; i < lines; i += 1) out.push(base[i % base.length]);
  return out;
}

async function generateScript({ storeName, menus, note, lines }) {
  const perLineChars = Math.round((TARGET_SECONDS * CHARS_PER_SECOND) / lines);
  const prompt = buildPrompt({ storeName, menus, note, lines, perLineChars });

  const providers = [];
  if (process.env.GEMINI_API_KEY) providers.push(['gemini', viaGemini, process.env.GEMINI_API_KEY]);
  if (process.env.ANTHROPIC_API_KEY) providers.push(['anthropic', viaAnthropic, process.env.ANTHROPIC_API_KEY]);

  for (const [name, fn, apiKey] of providers) {
    try {
      const raw = await fn({ prompt, apiKey });
      return { source: name, lines: parseLines(raw, lines) };
    } catch (e) {
      console.warn(`  ! ${name} 대본 생성 실패: ${e.message}`);
    }
  }

  return { source: 'template', lines: template({ storeName, menus, lines }) };
}

module.exports = { generateScript, cleanLine, TARGET_SECONDS, CHARS_PER_SECOND };
