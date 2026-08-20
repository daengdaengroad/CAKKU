import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

/** daengcut/ 폴더. server/src 와 server/dist 어느 쪽에서 실행해도 같은 곳을 가리킨다. */
export const repoRoot = path.resolve(import.meta.dirname, '..', '..');

// dotenv 는 기본적으로 실행 위치(cwd)에서 .env 를 찾는다.
// 서버는 server/ 안에서 실행되므로 경로를 명시하지 않으면 daengcut/.env 를 영영 못 읽는다.
// (이미 셸에 설정된 환경변수는 그대로 우선한다)
dotenv.config({ path: path.join(repoRoot, '.env') });

function resolveWorkspace(): string {
  const raw = process.env.DAENGCUT_WORKSPACE?.trim() || './workspace';
  const abs = path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

export const workspaceDir = resolveWorkspace();

/** 자막 폰트가 들어있는 폴더 */
export const fontDir = path.join(repoRoot, 'assets', 'fonts');

/** 화면에서 설정한 값이 저장되는 곳 */
export const settingsFile = path.join(workspaceDir, 'settings.json');
