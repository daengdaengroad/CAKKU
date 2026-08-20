import fs from 'node:fs';
import { settingsFile } from '../paths.js';
import { logger } from '../util/log.js';

const log = logger('settings');

export type TtsProviderName = 'none' | 'google' | 'elevenlabs' | 'openai';

/**
 * 화면에서 설정한 값.
 * .env 를 직접 고치지 않아도 되도록, 앱 안에서 저장하고 서버 재시작 없이 반영된다.
 * 여기 있는 값이 .env 보다 우선한다.
 */
export interface Settings {
  anthropicApiKey?: string;
  anthropicModel?: string;

  ttsProvider?: TtsProviderName;
  googleVoice?: string;
  googleCredentials?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  openaiApiKey?: string;
  openaiVoice?: string;

  youtubeClientId?: string;
  youtubeClientSecret?: string;
}

let cache: Settings | null = null;

export function readSettings(): Settings {
  if (cache) return cache;

  try {
    cache = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as Settings;
  } catch {
    cache = {};
  }
  return cache;
}

/** 넘긴 항목만 갱신한다. 빈 문자열은 "지움"으로 취급해 .env 값으로 되돌아가게 한다. */
export function updateSettings(patch: Settings): Settings {
  const next: Settings = { ...readSettings() };

  for (const [key, value] of Object.entries(patch) as [keyof Settings, string | undefined][]) {
    if (value === undefined) continue;
    if (value === '') delete next[key];
    else Object.assign(next, { [key]: value });
  }

  // API 키가 들어있는 파일이므로 본인만 읽을 수 있게 저장한다.
  fs.writeFileSync(settingsFile, JSON.stringify(next, null, 2), { encoding: 'utf8', mode: 0o600 });
  cache = next;
  log.info('설정을 저장했습니다.');

  return next;
}

/** 테스트나 외부에서 파일을 고쳤을 때 다시 읽게 한다. */
export function resetSettingsCache() {
  cache = null;
}
