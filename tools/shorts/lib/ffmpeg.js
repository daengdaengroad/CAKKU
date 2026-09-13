const { spawn } = require('child_process');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

function run(bin, args, { capture = false, label = '' } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      const text = d.toString();
      err += text;
      // 렌더링은 오래 걸리므로 진행률만 한 줄로 흘려보낸다.
      if (!capture && process.stdout.isTTY && /frame=/.test(text)) {
        const line = text.trim().split('\n').pop();
        process.stdout.write(`\r  ${label}${line.slice(0, 100)}`);
      }
    });
    child.on('error', (e) => {
      if (e.code === 'ENOENT') {
        reject(new Error(`${bin} 을 찾을 수 없습니다. ffmpeg를 설치하세요 (README 참고).`));
        return;
      }
      reject(e);
    });
    child.on('close', (code) => {
      if (!capture && process.stdout.isTTY) process.stdout.write('\r\x1b[K');
      if (code !== 0) {
        reject(new Error(`${bin} 실패 (exit ${code})\n${err.split('\n').slice(-25).join('\n')}`));
        return;
      }
      resolve({ stdout: out, stderr: err });
    });
  });
}

const ffmpeg = (args, opts) => run(FFMPEG, ['-hide_banner', '-y', ...args], opts);
const ffprobe = (args) => run(FFPROBE, ['-hide_banner', ...args], { capture: true });

async function checkTools() {
  const missing = [];
  for (const bin of [FFMPEG, FFPROBE]) {
    try {
      await run(bin, ['-version'], { capture: true });
    } catch {
      missing.push(bin);
    }
  }
  if (missing.length) {
    throw new Error(
      `${missing.join(', ')} 가 없습니다.\n` +
        '  macOS: brew install ffmpeg\n' +
        '  Ubuntu: sudo apt-get install -y ffmpeg fonts-nanum'
    );
  }
}

// mp3 등 미디어 파일의 길이(초)를 잰다.
async function durationOf(file) {
  const { stdout } = await ffprobe([
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  const seconds = parseFloat(stdout.trim());
  if (!Number.isFinite(seconds)) throw new Error(`길이 측정 실패: ${file}`);
  return seconds;
}

module.exports = { ffmpeg, ffprobe, checkTools, durationOf, FFMPEG, FFPROBE };
