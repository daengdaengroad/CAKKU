import fs from 'node:fs/promises';
import path from 'node:path';
import { config, ensureProjectDirs, projectDir } from '../config.js';
import { AppError } from '../util/errors.js';
import { newId } from '../util/ids.js';
import { logger } from '../util/log.js';
import type { SourceAnalysis } from '../media/analyze.js';
import type { MediaInfo } from '../media/probe.js';
import type { Timeline } from '../timeline/types.js';
import type { BuildOptions } from '../timeline/build.js';
import { DEFAULT_BUILD_OPTIONS } from '../timeline/build.js';
import type { GeneratedScript, ScriptOptions } from '../ai/script.js';
import { DEFAULT_SCRIPT_OPTIONS } from '../ai/script.js';

const log = logger('store');

export type ProjectStatus =
  | 'draft'
  | 'analyzing'
  | 'ready'
  | 'rendering'
  | 'rendered'
  | 'uploading'
  | 'uploaded'
  | 'error';

export interface ProjectSource {
  id: string;
  /** 사용자가 올린 원래 파일명 */
  originalName: string;
  /** 프로젝트 폴더 기준 상대경로 */
  file: string;
  proxyFile: string | null;
  thumbFile: string | null;
  info: MediaInfo | null;
  /** 분석 결과는 용량이 커서 별도 파일에 둔다. 여기엔 존재 여부만 */
  analyzed: boolean;
}

export interface RenderRecord {
  file: string;
  durationSec: number;
  renderedAt: string;
  quality: 'preview' | 'final';
}

export interface YoutubeRecord {
  videoId: string;
  url: string;
  uploadedAt: string;
  privacyStatus: string;
}

export interface Project {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  sources: ProjectSource[];
  buildOptions: BuildOptions;
  scriptOptions: ScriptOptions;
  script: GeneratedScript | null;
  timeline: Timeline | null;
  render: RenderRecord | null;
  youtube: YoutubeRecord | null;
  error: string | null;
}

function projectFile(id: string): string {
  return path.join(projectDir(id).root, 'project.json');
}

function analysisFile(projectId: string, sourceId: string): string {
  return path.join(projectDir(projectId).root, 'analysis', `${sourceId}.json`);
}

/** 프로젝트 폴더 안의 절대경로. 저장된 상대경로를 실제 파일로 바꾼다. */
export function resolveProjectPath(projectId: string, relativePath: string): string {
  const root = projectDir(projectId).root;
  const abs = path.resolve(root, relativePath);
  // 상대경로가 프로젝트 밖을 가리키지 못하게 막는다.
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new AppError('잘못된 파일 경로입니다.', 400);
  }
  return abs;
}

export function toProjectRelative(projectId: string, absolutePath: string): string {
  return path.relative(projectDir(projectId).root, absolutePath);
}

export async function createProject(title: string): Promise<Project> {
  const id = newId();
  ensureProjectDirs(id);

  const now = new Date().toISOString();
  const project: Project = {
    id,
    title: title.trim() || '제목 없는 숏츠',
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    sources: [],
    buildOptions: { ...DEFAULT_BUILD_OPTIONS },
    scriptOptions: { ...DEFAULT_SCRIPT_OPTIONS },
    script: null,
    timeline: null,
    render: null,
    youtube: null,
    error: null,
  };

  await saveProject(project);
  log.info(`프로젝트 생성: ${id} (${project.title})`);
  return project;
}

export async function saveProject(project: Project): Promise<Project> {
  const updated = { ...project, updatedAt: new Date().toISOString() };
  ensureProjectDirs(project.id);
  await fs.writeFile(projectFile(project.id), JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

export async function getProject(id: string): Promise<Project> {
  try {
    const raw = await fs.readFile(projectFile(id), 'utf8');
    return JSON.parse(raw) as Project;
  } catch {
    throw new AppError('프로젝트를 찾을 수 없습니다.', 404);
  }
}

/** 프로젝트를 읽어 수정한 뒤 저장하는 흔한 패턴을 한 번에. */
export async function updateProject(
  id: string,
  mutate: (project: Project) => Project | Promise<Project>,
): Promise<Project> {
  const current = await getProject(id);
  return saveProject(await mutate(current));
}

export async function listProjects(): Promise<Project[]> {
  const root = path.join(config.workspace, 'projects');
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }

  const projects: Project[] = [];
  for (const id of entries) {
    try {
      projects.push(await getProject(id));
    } catch {
      // 반쯤 만들다 만 폴더는 조용히 건너뛴다.
    }
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string): Promise<void> {
  await fs.rm(projectDir(id).root, { recursive: true, force: true });
  log.info(`프로젝트 삭제: ${id}`);
}

// ── 분석 결과 (용량이 커서 따로 보관) ────────────────────────────────
export async function saveAnalysis(
  projectId: string,
  sourceId: string,
  analysis: SourceAnalysis,
): Promise<void> {
  const file = analysisFile(projectId, sourceId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(analysis), 'utf8');
}

export async function getAnalysis(projectId: string, sourceId: string): Promise<SourceAnalysis> {
  try {
    return JSON.parse(await fs.readFile(analysisFile(projectId, sourceId), 'utf8')) as SourceAnalysis;
  } catch {
    throw new AppError('영상 분석 결과가 없습니다.', 400, '분석을 다시 실행해 주세요.');
  }
}
