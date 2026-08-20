import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureProjectDirs, projectDir } from '../config.js';
import { fontDir } from '../paths.js';
import { analyzeSource } from '../media/analyze.js';
import { extractFrames } from '../media/frames.js';
import { probe } from '../media/probe.js';
import { buildProxy, buildThumbnail } from '../media/proxy.js';
import { renderTimeline } from '../render/render.js';
import type { RenderSource } from '../render/render.js';
import { applyScript, buildBaseTimeline } from '../timeline/build.js';
import type { AnalyzedSource } from '../timeline/build.js';
import { clipDuration, clipOffsets, timelineDuration } from '../timeline/types.js';
import type { Timeline } from '../timeline/types.js';
import { isAiConfigured } from '../ai/anthropic.js';
import { generateScript } from '../ai/script.js';
import type { ScriptClipInput } from '../ai/script.js';
import { synthesizeNarration } from '../ai/narrate.js';
import { isTtsConfigured } from '../ai/tts.js';
import {
  getAnalysis,
  getProject,
  resolveProjectPath,
  saveAnalysis,
  toProjectRelative,
  updateProject,
} from '../store/projects.js';
import type { Project, ProjectSource } from '../store/projects.js';
import { AppError } from '../util/errors.js';
import { newShortId } from '../util/ids.js';
import { logger } from '../util/log.js';
import type { JobContext } from './runner.js';
import { subProgress } from './runner.js';

const log = logger('pipeline');

const FONT_DIR = fontDir;

// ── 1단계: 업로드된 원본 읽어들이기 ─────────────────────────────────
export interface IncomingFile {
  originalName: string;
  /** 이미 프로젝트의 source 폴더에 저장된 절대경로 */
  storedPath: string;
}

export async function ingestSources(
  projectId: string,
  files: IncomingFile[],
  ctx: JobContext,
): Promise<Project> {
  const dirs = ensureProjectDirs(projectId);
  const added: ProjectSource[] = [];

  for (const [index, file] of files.entries()) {
    const base = index / files.length;
    const span = 1 / files.length;
    const label = `${index + 1}/${files.length}`;

    ctx.step(`${label} 영상 정보 읽는 중`, base);
    const info = await probe(file.storedPath);

    const sourceId = newShortId();

    ctx.step(`${label} 미리보기 만드는 중`, base + span * 0.1);
    // 원본마다 폴더를 나눠야 여러 개를 올렸을 때 썸네일이 서로 덮어쓰지 않는다.
    const sourceProxyDir = path.join(dirs.proxy, sourceId);
    const thumbPath = await buildThumbnail(info, sourceProxyDir);
    const proxyPath = await buildProxy(info, sourceProxyDir, (ratio) =>
      subProgress(ctx, base + span * 0.15, base + span * 0.6)(ratio),
    );

    ctx.step(`${label} 장면 분석하는 중`, base + span * 0.6);
    const analysis = await analyzeSource(info);
    await saveAnalysis(projectId, sourceId, analysis);

    added.push({
      id: sourceId,
      originalName: file.originalName,
      file: toProjectRelative(projectId, file.storedPath),
      proxyFile: toProjectRelative(projectId, proxyPath),
      thumbFile: toProjectRelative(projectId, thumbPath),
      info,
      analyzed: true,
    });

    ctx.progress(base + span);
  }

  return updateProject(projectId, (project) => ({
    ...project,
    status: 'ready',
    sources: [...project.sources, ...added],
    error: null,
  }));
}

// ── 2단계: 컷 잡고 대본 쓰기 ────────────────────────────────────────
async function loadAnalyzedSources(project: Project): Promise<AnalyzedSource[]> {
  const sources: AnalyzedSource[] = [];
  for (const source of project.sources) {
    if (!source.info || !source.analyzed) continue;
    sources.push({
      id: source.id,
      // 저장된 경로는 상대경로다. 분석 당시의 절대경로는 옮겨졌을 수 있으니 지금 기준으로 다시 만든다.
      info: { ...source.info, path: resolveProjectPath(project.id, source.file) },
      analysis: await getAnalysis(project.id, source.id),
    });
  }
  if (sources.length === 0) {
    throw new AppError('분석된 영상이 없습니다.', 400, '영상을 먼저 올려주세요.');
  }
  return sources;
}

/** 클립마다 대표 프레임 2장을 뽑아 AI 에게 보여줄 재료를 만든다. */
async function collectClipFrames(
  project: Project,
  timeline: Timeline,
  sources: AnalyzedSource[],
): Promise<ScriptClipInput[]> {
  const dirs = projectDir(project.id);
  const byId = new Map(sources.map((s) => [s.id, s]));
  const inputs: ScriptClipInput[] = [];

  for (const [index, clip] of timeline.clips.entries()) {
    const source = byId.get(clip.sourceId);
    if (!source) continue;

    const length = clip.out - clip.in;
    // 클립 앞뒤 끝은 전환 중이라 흐릿한 경우가 많아 안쪽에서 고른다.
    const stamps = [clip.in + length * 0.3, clip.in + length * 0.75];

    const frames = await extractFrames(source.info, stamps, path.join(dirs.frames, clip.id), {
      maxWidth: 768,
    });

    inputs.push({
      index,
      durationSec: clipDuration(clip),
      framePaths: frames.map((f) => f.path),
    });
  }

  return inputs;
}

export interface AutoEditOptions {
  /** 대본을 새로 쓸지. false 면 컷만 다시 잡는다. */
  writeScript: boolean;
}

export async function autoEdit(
  projectId: string,
  ctx: JobContext,
  opts: AutoEditOptions = { writeScript: true },
): Promise<Project> {
  const project = await getProject(projectId);
  const sources = await loadAnalyzedSources(project);

  ctx.step('볼 만한 구간 고르는 중', 0.05);
  let timeline = buildBaseTimeline(sources, project.buildOptions);

  if (timeline.clips.length === 0) {
    throw new AppError(
      '쓸 만한 구간을 찾지 못했습니다.',
      400,
      '영상이 너무 짧거나 계속 정지 화면일 수 있습니다. 목표 길이를 줄여보세요.',
    );
  }

  log.info(
    `클립 ${timeline.clips.length}개, 총 ${timelineDuration(timeline).toFixed(1)}초 ` +
      `(목표 ${project.buildOptions.targetSec}초)`,
  );

  let script = project.script;

  // 키가 없으면 대본만 건너뛰고 컷은 그대로 잡아준다.
  // 여기서 실패로 끝내면 사용자는 아무것도 못 받는데, 컷만 있어도 자막은 직접 쓸 수 있다.
  const canWriteScript = opts.writeScript && isAiConfigured();
  if (opts.writeScript && !canWriteScript) {
    log.warn('ANTHROPIC_API_KEY 가 없어 대본 없이 컷만 잡습니다.');
  }

  if (canWriteScript) {
    ctx.step('장면 캡처하는 중', 0.15);
    const clipInputs = await collectClipFrames(project, timeline, sources);

    ctx.step('대본 쓰는 중', 0.3);
    script = await generateScript(clipInputs, project.scriptOptions);
  }

  if (script) {
    timeline = applyScript(timeline, script);
  }

  if (isTtsConfigured() && timeline.narration.length > 0) {
    ctx.step('내레이션 목소리 만드는 중', 0.6);
    const dirs = projectDir(projectId);
    timeline = await synthesizeNarration(timeline, {
      audioDir: dirs.audio,
      assetRoot: dirs.root,
      onProgress: (done, total) => subProgress(ctx, 0.6, 0.95)(done / total),
    });
  }

  ctx.step('편집본 저장하는 중', 0.97);
  return updateProject(projectId, (current) => ({
    ...current,
    status: 'ready',
    script,
    timeline,
    error: null,
  }));
}

// ── 3단계: 내레이션만 다시 만들기 (대본을 손으로 고친 뒤) ────────────
export async function renarrate(projectId: string, ctx: JobContext): Promise<Project> {
  const project = await getProject(projectId);
  if (!project.timeline) {
    throw new AppError('편집본이 없습니다.', 400);
  }
  if (!isTtsConfigured()) {
    throw new AppError(
      'TTS 설정이 없습니다.',
      400,
      '.env 의 TTS_PROVIDER 와 해당 제공자의 키를 채워주세요.',
    );
  }

  ctx.step('내레이션 목소리 만드는 중', 0.1);
  const dirs = projectDir(projectId);
  const timeline = await synthesizeNarration(project.timeline, {
    audioDir: dirs.audio,
    assetRoot: dirs.root,
    onProgress: (done, total) => subProgress(ctx, 0.1, 0.95)(done / total),
  });

  return updateProject(projectId, (current) => ({ ...current, timeline, error: null }));
}

// ── 4단계: 렌더링 ───────────────────────────────────────────────────
export async function renderProject(
  projectId: string,
  quality: 'preview' | 'final',
  ctx: JobContext,
): Promise<Project> {
  const project = await getProject(projectId);
  if (!project.timeline) {
    throw new AppError('편집본이 없습니다.', 400, '먼저 자동 편집을 실행해 주세요.');
  }

  const dirs = ensureProjectDirs(projectId);
  const sources = new Map<string, RenderSource>();

  for (const source of project.sources) {
    if (!source.info) continue;
    sources.set(source.id, {
      id: source.id,
      path: resolveProjectPath(projectId, source.file),
      width: source.info.width,
      height: source.info.height,
      hasAudio: source.info.hasAudio,
      durationSec: source.info.durationSec,
    });
  }

  await updateProject(projectId, (current) => ({ ...current, status: 'rendering' }));

  ctx.step('영상 만드는 중', 0.02);
  const fileName = quality === 'final' ? 'shorts.mp4' : 'preview.mp4';
  const outPath = path.join(dirs.output, fileName);

  try {
    const result = await renderTimeline({
      timeline: project.timeline,
      sources,
      outPath,
      workDir: path.join(dirs.tmp, 'render'),
      fontDir: FONT_DIR,
      assetRoot: dirs.root,
      quality,
      onProgress: (ratio) => subProgress(ctx, 0.02, 0.99)(ratio),
      signal: ctx.signal,
    });

    return updateProject(projectId, (current) => ({
      ...current,
      status: 'rendered',
      render: {
        file: toProjectRelative(projectId, result.outPath),
        durationSec: result.durationSec,
        renderedAt: new Date().toISOString(),
        quality,
      },
      error: null,
    }));
  } catch (err) {
    await updateProject(projectId, (current) => ({ ...current, status: 'error' }));
    throw err;
  }
}

// ── 전체 자동 실행 ──────────────────────────────────────────────────
export async function runFullPipeline(
  projectId: string,
  files: IncomingFile[],
  ctx: JobContext,
): Promise<Project> {
  if (files.length > 0) {
    ctx.step('영상 읽어들이는 중', 0);
    await withScaledProgress(ctx, 0, 0.45, (scoped) => ingestSources(projectId, files, scoped));
  }

  await withScaledProgress(ctx, 0.45, 0.7, (scoped) => autoEdit(projectId, scoped));
  await withScaledProgress(ctx, 0.7, 1, (scoped) => renderProject(projectId, 'final', scoped));

  return getProject(projectId);
}

/** 하위 단계가 0~1 로 보고하는 진행률을 전체 진행률의 한 구간에 매핑한다. */
async function withScaledProgress<T>(
  ctx: JobContext,
  from: number,
  to: number,
  fn: (scoped: JobContext) => Promise<T>,
): Promise<T> {
  const scale = subProgress(ctx, from, to);
  const scoped: JobContext = {
    step: (label, progress) => {
      if (progress !== undefined) scale(progress);
      ctx.step(label);
    },
    progress: scale,
    signal: ctx.signal,
  };
  return fn(scoped);
}

/** UI 가 타임라인을 그릴 때 쓰는, 클립별 시작 위치 요약 */
export function timelineSummary(timeline: Timeline) {
  const offsets = clipOffsets(timeline.clips);
  return {
    durationSec: timelineDuration(timeline),
    clips: timeline.clips.map((clip, i) => ({
      id: clip.id,
      start: offsets[i] ?? 0,
      duration: clipDuration(clip),
    })),
  };
}

export async function projectHasFonts(): Promise<boolean> {
  try {
    const entries = await fs.readdir(FONT_DIR);
    return entries.some((name) => /\.(ttf|otf|ttc)$/i.test(name));
  } catch {
    return false;
  }
}
