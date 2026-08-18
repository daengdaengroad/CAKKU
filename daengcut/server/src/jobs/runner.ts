import { EventEmitter } from 'node:events';
import { AppError, isAppError } from '../util/errors.js';
import { newShortId } from '../util/ids.js';
import { logger } from '../util/log.js';

const log = logger('jobs');

export type JobKind = 'ingest' | 'script' | 'narrate' | 'render' | 'upload' | 'auto';

export type JobStatus = 'running' | 'done' | 'error' | 'canceled';

export interface JobState {
  id: string;
  projectId: string;
  kind: JobKind;
  status: JobStatus;
  /** 0~1 */
  progress: number;
  /** 지금 뭐 하는 중인지 사용자에게 보여줄 한 줄 */
  step: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  hint: string | null;
}

export interface JobContext {
  /** 새 단계로 넘어갈 때. progress 를 같이 주면 진행률도 갱신한다. */
  step(label: string, progress?: number): void;
  /** 같은 단계 안에서 진행률만 갱신 */
  progress(ratio: number): void;
  readonly signal: AbortSignal;
}

const emitter = new EventEmitter();
// 프로젝트 상세 화면 여러 개를 동시에 열어도 되도록 넉넉히 잡는다.
emitter.setMaxListeners(100);

const jobs = new Map<string, JobState>();
const controllers = new Map<string, AbortController>();

function publish(job: JobState) {
  jobs.set(job.projectId, job);
  emitter.emit(job.projectId, job);
}

export function getJob(projectId: string): JobState | null {
  return jobs.get(projectId) ?? null;
}

export function isBusy(projectId: string): boolean {
  return jobs.get(projectId)?.status === 'running';
}

/** SSE 로 진행률을 흘려보내기 위한 구독. 반환값을 호출하면 구독이 끊긴다. */
export function subscribe(projectId: string, listener: (job: JobState) => void): () => void {
  emitter.on(projectId, listener);
  return () => emitter.off(projectId, listener);
}

export function cancelJob(projectId: string): boolean {
  const controller = controllers.get(projectId);
  if (!controller) return false;
  controller.abort();
  return true;
}

/**
 * 프로젝트 하나당 작업 하나만 돌린다.
 * 영상 처리는 CPU 를 다 쓰기 때문에 같은 프로젝트에서 두 개가 겹치면 둘 다 느려진다.
 */
export async function runJob(
  projectId: string,
  kind: JobKind,
  task: (ctx: JobContext) => Promise<void>,
): Promise<JobState> {
  if (isBusy(projectId)) {
    throw new AppError('이미 작업이 진행 중입니다.', 409, '끝난 뒤에 다시 시도해 주세요.');
  }

  const controller = new AbortController();
  controllers.set(projectId, controller);

  const job: JobState = {
    id: newShortId(),
    projectId,
    kind,
    status: 'running',
    progress: 0,
    step: '시작하는 중',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    hint: null,
  };
  publish(job);

  const ctx: JobContext = {
    step(label, progress) {
      job.step = label;
      if (progress !== undefined) job.progress = clamp(progress);
      log.info(`[${projectId}] ${label} (${Math.round(job.progress * 100)}%)`);
      publish({ ...job });
    },
    progress(ratio) {
      job.progress = clamp(ratio);
      publish({ ...job });
    },
    signal: controller.signal,
  };

  try {
    await task(ctx);
    job.status = 'done';
    job.progress = 1;
    job.step = '완료';
  } catch (err) {
    if (controller.signal.aborted) {
      job.status = 'canceled';
      job.step = '취소됨';
    } else {
      job.status = 'error';
      job.step = '실패';
      job.error = isAppError(err) ? err.message : '알 수 없는 오류가 발생했습니다.';
      job.hint = isAppError(err) ? (err.hint ?? null) : String(err);
      log.error(`[${projectId}] 작업 실패: ${job.error}`, job.hint);
    }
  } finally {
    job.finishedAt = new Date().toISOString();
    controllers.delete(projectId);
    publish({ ...job });
  }

  return job;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 여러 단계를 순서대로 돌릴 때 각 단계가 전체 진행률의 일부만 차지하도록 나눈다. */
export function subProgress(ctx: JobContext, from: number, to: number) {
  return (ratio: number) => ctx.progress(from + (to - from) * Math.min(1, Math.max(0, ratio)));
}
