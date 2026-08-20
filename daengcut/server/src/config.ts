import path from 'node:path';
import fs from 'node:fs';
import { repoRoot, workspaceDir } from './paths.js';
import { readSettings } from './store/settings.js';
import type { TtsProviderName } from './store/settings.js';

/**
 * 설정값 하나를 읽는 순서: 화면에서 저장한 값 → .env → 기본값.
 * 게터로 만들어 두어 화면에서 설정을 바꾸면 서버를 껐다 켜지 않아도 바로 반영된다.
 */
function pick(settingsValue: string | undefined, envKey: string, fallback = ''): string {
  const fromSettings = settingsValue?.trim();
  if (fromSettings) return fromSettings;
  return process.env[envKey]?.trim() || fallback;
}

export const config = {
  get port(): number {
    return Number(process.env.PORT || 4000);
  },

  workspace: workspaceDir,

  anthropic: {
    get apiKey(): string {
      return pick(readSettings().anthropicApiKey, 'ANTHROPIC_API_KEY');
    },
    get model(): string {
      return pick(readSettings().anthropicModel, 'ANTHROPIC_MODEL', 'claude-opus-5');
    },
  },

  tts: {
    get provider(): TtsProviderName {
      return pick(readSettings().ttsProvider, 'TTS_PROVIDER', 'none') as TtsProviderName;
    },
    google: {
      get voice(): string {
        return pick(readSettings().googleVoice, 'GOOGLE_TTS_VOICE', 'ko-KR-Chirp3-HD-Leda');
      },
      get credentials(): string {
        return pick(readSettings().googleCredentials, 'GOOGLE_APPLICATION_CREDENTIALS');
      },
    },
    elevenlabs: {
      get apiKey(): string {
        return pick(readSettings().elevenlabsApiKey, 'ELEVENLABS_API_KEY');
      },
      get voiceId(): string {
        return pick(readSettings().elevenlabsVoiceId, 'ELEVENLABS_VOICE_ID');
      },
    },
    openai: {
      get apiKey(): string {
        return pick(readSettings().openaiApiKey, 'OPENAI_API_KEY');
      },
      get voice(): string {
        return pick(readSettings().openaiVoice, 'OPENAI_TTS_VOICE', 'nova');
      },
    },
  },

  youtube: {
    get clientId(): string {
      return pick(readSettings().youtubeClientId, 'YOUTUBE_CLIENT_ID');
    },
    get clientSecret(): string {
      return pick(readSettings().youtubeClientSecret, 'YOUTUBE_CLIENT_SECRET');
    },
    get redirectUri(): string {
      return (
        process.env.YOUTUBE_REDIRECT_URI?.trim() ||
        `http://localhost:${process.env.PORT || 4000}/api/youtube/callback`
      );
    },
  },

  bin: {
    get ffmpeg(): string {
      return process.env.FFMPEG_PATH?.trim() || '';
    },
    get ffprobe(): string {
      return process.env.FFPROBE_PATH?.trim() || '';
    },
  },
};

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

export { repoRoot };
