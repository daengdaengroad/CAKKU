import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';

function resolveWorkspace(): string {
  const raw = process.env.DAENGCUT_WORKSPACE?.trim() || './workspace';
  // 레포 루트(daengcut/) 기준으로 잡아야 server/ 안에서 실행하든 루트에서 실행하든 같은 곳을 본다.
  const repoRoot = path.resolve(import.meta.dirname, '..', '..');
  const abs = path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  workspace: resolveWorkspace(),

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY?.trim() || '',
    model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-opus-5',
  },

  tts: {
    provider: (process.env.TTS_PROVIDER?.trim() || 'none') as
      | 'none'
      | 'google'
      | 'elevenlabs'
      | 'openai',
    google: {
      voice: process.env.GOOGLE_TTS_VOICE?.trim() || 'ko-KR-Chirp3-HD-Leda',
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || '',
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY?.trim() || '',
      voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || '',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY?.trim() || '',
      voice: process.env.OPENAI_TTS_VOICE?.trim() || 'nova',
    },
  },

  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID?.trim() || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET?.trim() || '',
    redirectUri:
      process.env.YOUTUBE_REDIRECT_URI?.trim() ||
      'http://localhost:4000/api/youtube/callback',
  },

  bin: {
    ffmpeg: process.env.FFMPEG_PATH?.trim() || '',
    ffprobe: process.env.FFPROBE_PATH?.trim() || '',
  },
} as const;

/** 프로젝트 하나가 쓰는 디렉터리 구조. 전부 workspace 아래에 격리된다. */
export function projectDir(projectId: string) {
  const root = path.join(config.workspace, 'projects', projectId);
  return {
    root,
    source: path.join(root, 'source'), // 업로드된 원본
    proxy: path.join(root, 'proxy'), // 브라우저 미리보기용 저화질
    frames: path.join(root, 'frames'), // 비전 분석용 스틸컷
    audio: path.join(root, 'audio'), // TTS 내레이션
    output: path.join(root, 'output'), // 최종 렌더 결과
    tmp: path.join(root, 'tmp'),
  };
}

export function ensureProjectDirs(projectId: string) {
  const dirs = projectDir(projectId);
  for (const dir of Object.values(dirs)) fs.mkdirSync(dir, { recursive: true });
  return dirs;
}
