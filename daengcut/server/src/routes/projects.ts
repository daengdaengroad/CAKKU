import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ensureProjectDirs } from '../config.js';
import { timelineSchema } from '../timeline/schema.js';
import type { Timeline } from '../timeline/types.js';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  resolveProjectPath,
  updateProject,
} from '../store/projects.js';
import {
  autoEdit,
  ingestSources,
  renarrate,
  renderProject,
  runFullPipeline,
  timelineSummary,
} from '../jobs/pipeline.js';
import type { IncomingFile } from '../jobs/pipeline.js';
import { cancelJob, getJob, runJob, subscribe } from '../jobs/runner.js';
import { AppError } from '../util/errors.js';
import { newShortId } from '../util/ids.js';

export const projectsRouter = Router();

// ── 업로드 설정 ────────────────────────────────────────────────────
/** 업로드 미들웨어를 거친 라우트는 경로 파라미터 타입 추론이 끊긴다. 한 번에 확인하고 꺼낸다. */
function projectIdOf(params: Record<string, unknown>): string {
  const id = params.id;
  if (typeof id !== 'string' || !id) throw new AppError('프로젝트 ID 가 없습니다.', 400);
  return id;
}

const VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|avi|mkv|webm|3gp|mpg|mpeg)$/i;

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      try {
        cb(null, ensureProjectDirs(projectIdOf(req.params)).source);
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename(_req, file, cb) {
      // 원본 파일명에 한글·공백이 섞여도 안전하도록 확장자만 살린다.
      const ext = path.extname(file.originalname) || '.mp4';
      cb(null, `${newShortId()}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 20 },
  fileFilter(_req, file, cb) {
    if (!VIDEO_EXTENSIONS.test(file.originalname)) {
      cb(new AppError(`동영상 파일이 아닙니다: ${file.originalname}`, 400));
      return;
    }
    cb(null, true);
  },
});

/** 멀티파트 업로드에서 원래 파일명을 살린다. 브라우저가 latin1 로 보내는 경우가 있다. */
function decodeOriginalName(name: string): string {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

function toIncomingFiles(files: Express.Multer.File[]): IncomingFile[] {
  return files.map((file) => ({
    originalName: decodeOriginalName(file.originalname),
    storedPath: file.path,
  }));
}

// ── 프로젝트 CRUD ──────────────────────────────────────────────────
projectsRouter.get('/', async (_req, res, next) => {
  try {
    const projects = await listProjects();
    res.json(
      projects.map((project) => ({
        id: project.id,
        title: project.title,
        status: project.status,
        updatedAt: project.updatedAt,
        sourceCount: project.sources.length,
        thumbFile: project.sources[0]?.thumbFile ?? null,
        durationSec: project.timeline ? timelineSummary(project.timeline).durationSec : null,
        youtubeUrl: project.youtube?.url ?? null,
      })),
    );
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/', async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().max(100).optional() }).parse(req.body ?? {});
    res.status(201).json(await createProject(body.title ?? ''));
  } catch (err) {
    next(err);
  }
});

projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    res.json({
      ...project,
      job: getJob(project.id),
      summary: project.timeline ? timelineSummary(project.timeline) : null,
    });
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    await deleteProject(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── 설정 변경 ──────────────────────────────────────────────────────
const optionsSchema = z.object({
  title: z.string().max(100).optional(),
  buildOptions: z
    .object({
      targetSec: z.number().min(5).max(180),
      minClipSec: z.number().min(0.4).max(20),
      maxClipSec: z.number().min(0.6).max(30),
      framingMode: z.enum(['cover', 'blur', 'contain']),
    })
    .optional(),
  scriptOptions: z
    .object({
      tone: z.enum(['cute', 'funny', 'emotional', 'informative']),
      persona: z.enum(['dog', 'owner', 'narrator']),
      dogName: z.string().max(40),
      dogBreed: z.string().max(40),
      context: z.string().max(1000),
      withNarration: z.boolean(),
    })
    .optional(),
});

projectsRouter.patch('/:id/options', async (req, res, next) => {
  try {
    const body = optionsSchema.parse(req.body ?? {});
    const project = await updateProject(req.params.id, (current) => ({
      ...current,
      title: body.title ?? current.title,
      buildOptions: body.buildOptions ?? current.buildOptions,
      scriptOptions: body.scriptOptions ?? current.scriptOptions,
    }));
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// ── 타임라인 직접 수정 (편집 UI 가 저장할 때) ────────────────────────
projectsRouter.put('/:id/timeline', async (req, res, next) => {
  try {
    const timeline = timelineSchema.parse(req.body) as Timeline;

    const project = await updateProject(req.params.id, (current) => {
      const knownSources = new Set(current.sources.map((s) => s.id));
      for (const clip of timeline.clips) {
        if (!knownSources.has(clip.sourceId)) {
          throw new AppError(`이 프로젝트에 없는 원본을 참조합니다: ${clip.sourceId}`, 400);
        }
      }
      return { ...current, timeline, error: null };
    });

    res.json({ ...project, summary: timelineSummary(timeline) });
  } catch (err) {
    next(err);
  }
});

// ── 작업 실행 ──────────────────────────────────────────────────────
projectsRouter.post('/:id/sources', upload.array('files', 20), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw new AppError('올린 영상이 없습니다.', 400);

    const projectId = projectIdOf(req.params);
    await getProject(projectId); // 없는 프로젝트면 여기서 404

    const incoming = toIncomingFiles(files);
    const auto = req.body?.auto === 'true' || req.body?.auto === true;

    // 응답을 먼저 돌려주고 작업은 뒤에서 돌린다. UI 는 SSE 로 진행률을 받는다.
    void runJob(projectId, auto ? 'auto' : 'ingest', async (ctx) => {
      if (auto) await runFullPipeline(projectId, incoming, ctx);
      else await ingestSources(projectId, incoming, ctx);
    });

    res.status(202).json({ started: true, files: incoming.length });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/auto', async (req, res, next) => {
  try {
    const projectId = req.params.id;
    await getProject(projectId);
    const writeScript = req.body?.writeScript !== false;

    void runJob(projectId, 'script', (ctx) => autoEdit(projectId, ctx, { writeScript }).then(() => undefined));
    res.status(202).json({ started: true });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/narrate', async (req, res, next) => {
  try {
    const projectId = req.params.id;
    await getProject(projectId);
    void runJob(projectId, 'narrate', (ctx) => renarrate(projectId, ctx).then(() => undefined));
    res.status(202).json({ started: true });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/render', async (req, res, next) => {
  try {
    const projectId = req.params.id;
    await getProject(projectId);
    const quality = req.body?.quality === 'preview' ? 'preview' : 'final';

    void runJob(projectId, 'render', (ctx) =>
      renderProject(projectId, quality, ctx).then(() => undefined),
    );
    res.status(202).json({ started: true, quality });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    res.json({ canceled: cancelJob(req.params.id) });
  } catch (err) {
    next(err);
  }
});

// ── 진행률 스트림 ──────────────────────────────────────────────────
projectsRouter.get('/:id/events', async (req, res) => {
  const projectId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // 프록시 뒤에서 SSE 가 버퍼링되지 않도록
    'X-Accel-Buffering': 'no',
  });

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const current = getJob(projectId);
  if (current) send(current);

  const unsubscribe = subscribe(projectId, send);
  // 중간 장비가 유휴 연결을 끊지 않도록 주기적으로 주석 줄을 보낸다.
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
    res.end();
  });
});

// ── 파일 서빙 (원본/미리보기/결과물) ────────────────────────────────
projectsRouter.get('/:id/files/*splat', async (req, res, next) => {
  try {
    const relative = (req.params as Record<string, string | string[]>).splat;
    const relPath = Array.isArray(relative) ? relative.join('/') : String(relative ?? '');
    const absPath = resolveProjectPath(req.params.id, relPath);

    if (!fs.existsSync(absPath)) throw new AppError('파일이 없습니다.', 404);

    // resolveProjectPath 가 이미 프로젝트 폴더 밖으로 못 나가게 막았으므로 절대경로로 바로 보낸다.
    // sendFile 이 Range 요청을 처리해 줘서 브라우저에서 영상 탐색이 된다.
    res.sendFile(absPath, { dotfiles: 'deny' }, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
});
