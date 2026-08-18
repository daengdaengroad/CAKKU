import fs from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { AppError } from '../util/errors.js';
import { logger } from '../util/log.js';

const log = logger('youtube');

/** 업로드 권한 + 채널 이름 확인용 읽기 권한 */
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

/** googleapis 가 돌려주는 Credentials 는 필드가 null 일 수 있어 그대로 받는다. */
interface StoredToken {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
  scope?: string;
  token_type?: string | null;
}

function tokenPath(): string {
  return path.join(config.workspace, 'credentials', 'youtube.json');
}

export function isYoutubeConfigured(): boolean {
  return Boolean(config.youtube.clientId && config.youtube.clientSecret);
}

export function oauthClient(): OAuth2Client {
  if (!isYoutubeConfigured()) {
    throw new AppError(
      '유튜브 업로드 설정이 없습니다.',
      400,
      'Google Cloud Console 에서 OAuth 클라이언트를 만들고 .env 의 ' +
        'YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 를 채워주세요.',
    );
  }

  return new google.auth.OAuth2(
    config.youtube.clientId,
    config.youtube.clientSecret,
    config.youtube.redirectUri,
  );
}

export function authUrl(): string {
  return oauthClient().generateAuthUrl({
    // offline + consent 를 줘야 refresh token 이 내려온다. 한 번 연결하면 계속 쓸 수 있다.
    access_type: 'offline',
    prompt: 'consent',
    scope: YOUTUBE_SCOPES,
  });
}

export async function saveToken(token: StoredToken): Promise<void> {
  const file = tokenPath();
  await fs.mkdir(path.dirname(file), { recursive: true });

  // 재발급 때 refresh_token 이 빠져 오는 경우가 있어 기존 값을 지키며 병합한다.
  const existing = await readToken();
  const merged: StoredToken = {
    ...existing,
    ...token,
    refresh_token: token.refresh_token ?? existing?.refresh_token ?? null,
  };

  await fs.writeFile(file, JSON.stringify(merged, null, 2), { encoding: 'utf8', mode: 0o600 });
  log.info('유튜브 계정 연결 정보를 저장했습니다.');
}

export async function readToken(): Promise<StoredToken | null> {
  try {
    return JSON.parse(await fs.readFile(tokenPath(), 'utf8')) as StoredToken;
  } catch {
    return null;
  }
}

export async function clearToken(): Promise<void> {
  await fs.rm(tokenPath(), { force: true });
  log.info('유튜브 계정 연결을 해제했습니다.');
}

/** 저장된 토큰을 붙인 클라이언트. 연결 전이면 null. */
export async function authorizedClient(): Promise<OAuth2Client | null> {
  const token = await readToken();
  if (!token?.refresh_token) return null;

  const client = oauthClient();
  client.setCredentials(token);

  // 라이브러리가 토큰을 자동 갱신하면 새 값을 파일에도 반영해 둔다.
  client.on('tokens', (fresh) => {
    void saveToken(fresh as StoredToken);
  });

  return client;
}

export async function requireAuthorizedClient(): Promise<OAuth2Client> {
  const client = await authorizedClient();
  if (!client) {
    throw new AppError(
      '유튜브 계정이 연결되어 있지 않습니다.',
      401,
      '설정 화면에서 유튜브 계정을 먼저 연결해 주세요.',
    );
  }
  return client;
}

export async function channelInfo(): Promise<{ title: string; id: string } | null> {
  const client = await authorizedClient();
  if (!client) return null;

  try {
    const youtube = google.youtube({ version: 'v3', auth: client });
    const res = await youtube.channels.list({ part: ['snippet'], mine: true });
    const channel = res.data.items?.[0];
    if (!channel?.id) return null;
    return { id: channel.id, title: channel.snippet?.title ?? '내 채널' };
  } catch (err) {
    log.warn('채널 정보를 가져오지 못했습니다.', err);
    return null;
  }
}
