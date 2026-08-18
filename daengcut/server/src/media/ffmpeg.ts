import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { config } from '../config.js';
import { AppError } from '../util/errors.js';
import { logger } from '../util/log.js';

const log = logger('ffmpeg');

// 두 패키지 모두 CommonJS 로 경로 문자열을 내보낸다.
// ESM 에서 default import 하면 타입이 어긋나므로 require 로 곧장 읽는다.
const require = createRequire(import.meta.url);
const bundledFfmpeg = require('ffmpeg-static') as string | null;
const bundledFfprobe = require('ffprobe-static') as { path: string } | null;

function firstExisting(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}

let cachedFfmpeg: string | null | undefined;
let cachedFfprobe: string | null | undefined;

/**
 * ffmpeg 실행 파일 경로.
 * 1) .env 의 FFMPEG_PATH  2) npm 으로 번들된 ffmpeg-static  3) PATH 의 시스템 ffmpeg
 * 2번 덕분에 사용자가 ffmpeg 을 따로 설치하지 않아도 된다.
 */
export function ffmpegPath(): string {
  if (cachedFfmpeg === undefined) {
    cachedFfmpeg = firstExisting(config.bin.ffmpeg, bundledFfmpeg, '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg');
  }
  if (!cachedFfmpeg) {
    throw new AppError(
      'ffmpeg 을 찾을 수 없습니다.',
      500,
      'npm install 을 다시 실행하거나 .env 에 FFMPEG_PATH 를 지정하세요.',
    );
  }
  return cachedFfmpeg;
}

export function ffprobePath(): string {
  if (cachedFfprobe === undefined) {
    cachedFfprobe = firstExisting(
      config.bin.ffprobe,
      bundledFfprobe?.path,
      '/usr/bin/ffprobe',
      '/usr/local/bin/ffprobe',
    );
  }
  if (!cachedFfprobe) {
    throw new AppError(
      'ffprobe 를 찾을 수 없습니다.',
      500,
      'npm install 을 다시 실행하거나 .env 에 FFPROBE_PATH 를 지정하세요.',
    );
  }
  return cachedFfprobe;
}

export interface RunOptions {
  /** 렌더 진행률 콜백. totalDurationSec 을 같이 넘겨야 0~1 비율이 나온다. */
  onProgress?: (ratio: number, info: { outTimeSec: number; speed: string }) => void;
  totalDurationSec?: number;
  /** stderr 를 라인 단위로 흘려보낸다 (씬 감지 등 메타데이터 파싱용) */
  onStderrLine?: (line: string) => void;
  onStdoutLine?: (line: string) => void;
  signal?: AbortSignal;
  label?: string;
  /** 실행 디렉터리. 자막 파일처럼 경로 이스케이프가 까다로운 인자를 상대경로로 넘길 때 쓴다. */
  cwd?: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

/** ffmpeg 을 한 번 돌리고 끝날 때까지 기다린다. 실패하면 stderr 꼬리를 붙여 던진다. */
export function runFfmpeg(args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return runBinary(ffmpegPath(), ['-hide_banner', '-nostdin', ...args], opts);
}

export function runFfprobe(args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return runBinary(ffprobePath(), ['-hide_banner', ...args], opts);
}

interface ProgressState {
  outTimeSec: number;
  speed: string;
}

function runBinary(bin: string, args: string[], opts: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // 실행 하나마다 독립된 상태. 여러 렌더가 동시에 돌아도 섞이지 않는다.
    const progress: ProgressState = { outTimeSec: 0, speed: '' };
    const label = opts.label ?? args.find((a) => a.endsWith('.mp4')) ?? 'run';
    log.debug(`${label}: ${bin.split('/').pop()} ${args.slice(0, 12).join(' ')}${args.length > 12 ? ' …' : ''}`);

    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: opts.cwd });

    let stdout = '';
    let stderr = '';
    let stdoutBuf = '';
    let stderrBuf = '';

    const onAbort = () => child.kill('SIGKILL');
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (!opts.onStdoutLine && !opts.onProgress) return;
      stdoutBuf += chunk;
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        opts.onStdoutLine?.(line);
        handleProgressLine(line, opts, progress);
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      // stderr 는 무한정 쌓이면 메모리를 먹으므로 뒤쪽만 유지한다.
      stderr = (stderr + chunk).slice(-64_000);
      if (!opts.onStderrLine) return;
      stderrBuf += chunk;
      const lines = stderrBuf.split('\n');
      stderrBuf = lines.pop() ?? '';
      for (const line of lines) opts.onStderrLine(line);
    });

    child.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort);
      reject(new AppError(`${bin} 실행 실패: ${err.message}`, 500));
    });

    child.on('close', (code) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (stderrBuf && opts.onStderrLine) opts.onStderrLine(stderrBuf);
      if (stdoutBuf && opts.onStdoutLine) opts.onStdoutLine(stdoutBuf);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const tail = stderr.split('\n').filter(Boolean).slice(-12).join('\n');
        reject(new AppError(`영상 처리에 실패했습니다 (exit ${code}).`, 500, tail));
      }
    });
  });
}

function handleProgressLine(line: string, opts: RunOptions, progress: ProgressState) {
  if (!opts.onProgress || !opts.totalDurationSec) return;
  const [rawKey, rawValue] = line.split('=');
  const key = rawKey?.trim();
  const value = rawValue?.trim();
  if (!key || value === undefined) return;

  if (key === 'out_time_us' || key === 'out_time_ms') {
    // ffmpeg 은 out_time_ms 에도 마이크로초를 넣는 버전이 있어 둘 다 마이크로초로 취급한다.
    const us = Number(value);
    if (Number.isFinite(us)) progress.outTimeSec = us / 1_000_000;
  } else if (key === 'speed') {
    progress.speed = value;
  } else if (key === 'progress') {
    const ratio = Math.min(1, Math.max(0, progress.outTimeSec / opts.totalDurationSec));
    opts.onProgress(value === 'end' ? 1 : ratio, { ...progress });
  }
}
