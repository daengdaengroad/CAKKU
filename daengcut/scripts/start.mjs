#!/usr/bin/env node
/**
 * 더블클릭 실행용 시작 스크립트.
 *
 * 처음 실행이면 설치·설정·빌드를 알아서 하고, 그 다음부터는 바로 켜진다.
 * 터미널을 써본 적 없는 사람도 파일 하나만 누르면 되도록 만든 것.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

// 포트는 .env 를 만든 뒤에 확정한다 (첫 실행 때는 아직 .env 가 없다).
let port = 4000;
let appUrl = `http://localhost:${port}`;

function say(message = '') {
  console.log(message);
}

function step(number, total, message) {
  say('');
  say(`[${number}/${total}] ${message}`);
}

function fail(title, ...details) {
  say('');
  say('━'.repeat(58));
  say(`  ${title}`);
  for (const line of details) say(`  ${line}`);
  say('━'.repeat(58));
  say('');
  process.exit(1);
}

/** .env 에 포트를 바꿔 적었을 수도 있으니 읽어본다. */
function readPort() {
  try {
    const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
    const match = /^PORT[ \t]*=[ \t]*(\d+)/m.exec(env);
    if (match?.[1]) return Number(match[1]);
  } catch {
    /* .env 가 아직 없으면 기본값 */
  }
  return 4000;
}

/** npm 명령 하나를 실행하고, 실패하면 이유를 설명하며 멈춘다. */
function run(args, description) {
  const result = spawnSync(npm, args, { cwd: root, stdio: 'inherit', shell: isWindows });

  if (result.error || result.status !== 0) {
    fail(
      `${description} 중에 문제가 생겼습니다.`,
      '',
      '위에 빨간 글씨로 이유가 적혀 있을 거예요.',
      '인터넷 연결을 확인하고 이 파일을 다시 실행해 보세요.',
      '그래도 안 되면 위 내용을 그대로 복사해서 물어보시면 됩니다.',
    );
  }
}

function checkNodeVersion() {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  const tooOld = major < 20 || (major === 20 && minor < 19);

  if (tooOld) {
    fail(
      `Node.js 버전이 낮습니다 (지금 ${process.versions.node}, 최소 20.19 필요).`,
      '',
      'https://nodejs.org 에서 LTS 버전을 내려받아 설치한 뒤',
      '이 파일을 다시 실행해 주세요.',
    );
  }
}

function hasKoreanFont() {
  try {
    return fs
      .readdirSync(path.join(root, 'assets', 'fonts'))
      .some((name) => /\.(ttf|otf|ttc)$/i.test(name));
  } catch {
    return false;
  }
}

function openBrowser(url) {
  const [command, args] = isWindows
    ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin'
      ? ['open', [url]]
      : ['xdg-open', [url]];

  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    // 브라우저를 못 열어도 주소를 알려주면 되니, 오류로 프로그램을 멈추지 않는다.
    child.on('error', () => undefined);
    child.unref();
  } catch {
    /* 무시 */
  }
}

/** 서버가 응답할 때까지 기다린다. 빌드 직후에는 몇 초 걸린다. */
async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${appUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      /* 아직 안 떴다 */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

/** 화면에서 저장한 설정과 .env 둘 중 한 곳에라도 키가 있으면 된다. */
function hasAnthropicKey() {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(root, 'workspace', 'settings.json'), 'utf8'));
    if (saved.anthropicApiKey) return true;
  } catch {
    /* 아직 설정한 적 없음 */
  }

  try {
    const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
    return /^ANTHROPIC_API_KEY[ \t]*=[ \t]*\S+/m.test(env);
  } catch {
    return false;
  }
}

// ── 시작 ───────────────────────────────────────────────────────────
say('');
say('  댕컷 — 반려견 영상 자동 편집기');
say('  ' + '─'.repeat(40));

checkNodeVersion();

const firstRun = !fs.existsSync(path.join(root, 'node_modules'));
const totalSteps = 3;

if (firstRun) {
  say('');
  say('  처음 실행이라 준비할 게 좀 있습니다.');
  say('  인터넷에서 필요한 파일을 받아오는데 2~5분쯤 걸려요.');
  say('  글자가 주르륵 올라가도 정상이니 그냥 두시면 됩니다.');
  step(1, totalSteps, '필요한 프로그램 설치하는 중… (제일 오래 걸립니다)');
  run(['install'], '설치');
} else {
  step(1, totalSteps, '설치 확인 완료');
}

if (!fs.existsSync(path.join(root, '.env')) || !hasKoreanFont()) {
  step(2, totalSteps, '자막 폰트와 설정 파일 준비하는 중…');
  run(['run', 'setup'], '초기 설정');
} else {
  step(2, totalSteps, '설정 확인 완료');
}

// 이제 .env 가 확실히 있으므로 포트를 다시 읽는다.
port = readPort();
appUrl = `http://localhost:${port}`;

step(3, totalSteps, '프로그램 준비하는 중… (10초쯤 걸립니다)');
run(['run', 'build'], '빌드');

// ── 서버 실행 ──────────────────────────────────────────────────────
say('');
say('  서버를 켜는 중…');

const server = spawn(npm, ['start'], {
  cwd: root,
  stdio: 'inherit',
  shell: isWindows,
});

server.on('exit', (code) => {
  if (code !== 0) {
    fail(
      '서버가 꺼졌습니다.',
      '',
      `${port}번 포트를 다른 프로그램이 쓰고 있을 수 있습니다.`,
      '이미 켜둔 댕컷 창이 있다면 닫고 다시 실행해 주세요.',
    );
  }
  process.exit(code ?? 0);
});

const ready = await waitForServer();

if (!ready) {
  say('');
  say('  서버가 아직 응답하지 않습니다. 잠시 뒤 브라우저에서 직접 열어보세요:');
  say(`  ${appUrl}`);
} else {
  openBrowser(appUrl);

  say('');
  say('  ' + '━'.repeat(52));
  say('   준비 끝!  브라우저가 열렸습니다.');
  say(`   안 열렸다면 주소창에 직접 입력하세요 →  ${appUrl}`);
  say('');

  if (!hasAnthropicKey()) {
    say('   ※ 자막을 자동으로 쓰게 하려면 API 키가 하나 필요합니다.');
    say('     방금 열린 화면 오른쪽 위 [⚙ 설정] 을 누르면 넣는 방법이 안내됩니다.');
    say('     여기서 넣으면 이 창을 껐다 켤 필요 없이 바로 적용됩니다.');
    say('     (키 없이도 컷 편집과 자막 직접 입력은 됩니다)');
    say('');
  }

  say('   끌 때는 이 검은 창을 닫으면 됩니다.');
  say('  ' + '━'.repeat(52));
  say('');
}
