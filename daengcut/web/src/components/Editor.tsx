import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, fileUrl, subscribeJob } from '../api';
import { rebindTimeline, totalDuration } from '../timelineUtils';
import { PreviewPlayer } from './PreviewPlayer';
import { TimelineStrip } from './TimelineStrip';
import type { Selection } from './TimelineStrip';
import { AutoPanel, CaptionPanel, ClipPanel, MetaPanel, NarrationPanel, StylePanel } from './panels';
import { YoutubeDialog } from './YoutubeDialog';
import type { Caption, Clip, Health, JobState, NarrationLine, Project, Timeline } from '../types';

type Tab = 'caption' | 'clip' | 'narration' | 'style' | 'meta' | 'auto';

const TABS: { id: Tab; label: string }[] = [
  { id: 'caption', label: '자막' },
  { id: 'clip', label: '컷' },
  { id: 'narration', label: '소리' },
  { id: 'style', label: '스타일' },
  { id: 'meta', label: '유튜브' },
  { id: 'auto', label: '자동 편집' },
];

interface Props {
  projectId: string;
  health: Health;
  fonts: string[];
  onBack: () => void;
}

export function Editor({ projectId, health, fonts, onBack }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [tab, setTab] = useState<Tab>('caption');
  const [selection, setSelection] = useState<Selection>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showUpload, setShowUpload] = useState(false);

  const saveTimer = useRef<number | null>(null);
  const busy = job?.status === 'running';

  const reload = useCallback(async () => {
    try {
      const next = await api.getProject(projectId);
      setProject(next);
      setTimeline(next.timeline);
      setJob(next.job);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '프로젝트를 불러오지 못했습니다.');
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 작업 진행률 구독. 작업이 끝나면 결과를 다시 읽어온다.
  useEffect(() => {
    return subscribeJob(projectId, (next) => {
      setJob(next);
      if (next.status !== 'running') void reload();
    });
  }, [projectId, reload]);

  /** 타임라인을 고치면 잠시 뒤 자동 저장한다. 매 입력마다 요청하면 서버가 시달린다. */
  const applyTimeline = useCallback(
    (next: Timeline) => {
      setTimeline(next);
      setSaveState('saving');

      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        api
          .saveTimeline(projectId, next)
          .then(() => setSaveState('saved'))
          .catch((err: unknown) => {
            setSaveState('idle');
            setError(err instanceof ApiError ? `${err.message} ${err.hint ?? ''}` : '저장에 실패했습니다.');
          });
      }, 700);
    },
    [projectId],
  );

  // 컷을 바꾸면 자막·내레이션이 붙어 있던 컷을 따라 움직여야 한다.
  const applyClips = useCallback(
    (clips: Clip[]) => {
      if (!timeline) return;
      applyTimeline(rebindTimeline(timeline, clips));
    },
    [timeline, applyTimeline],
  );

  const applyCaptions = useCallback(
    (captions: Caption[]) => {
      if (!timeline) return;
      applyTimeline({ ...timeline, captions });
    },
    [timeline, applyTimeline],
  );

  const applyNarration = useCallback(
    (narration: NarrationLine[]) => {
      if (!timeline) return;
      applyTimeline({ ...timeline, narration });
    },
    [timeline, applyTimeline],
  );

  const duration = useMemo(() => (timeline ? totalDuration(timeline.clips) : 0), [timeline]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setPlaying(false);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message} ${err.hint ?? ''}` : '요청에 실패했습니다.');
    }
  };

  if (!project) {
    return <div className="loading">{error ?? '불러오는 중…'}</div>;
  }

  return (
    <div className="editor">
      <header className="editor-head">
        <button type="button" className="ghost" onClick={onBack}>
          ← 목록
        </button>
        <input
          className="project-title"
          value={project.title}
          onChange={(event) => setProject({ ...project, title: event.target.value })}
          onBlur={() => void api.updateOptions(projectId, { title: project.title })}
        />
        <span className="save-state">
          {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : ''}
        </span>

        <div className="head-actions">
          <button
            type="button"
            onClick={() => void run(() => api.render(projectId, 'final'))}
            disabled={busy || !timeline || timeline.clips.length === 0}
          >
            영상 만들기
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => setShowUpload(true)}
            disabled={busy || !project.render}
          >
            유튜브에 올리기
          </button>
        </div>
      </header>

      {job && job.status === 'running' && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${job.progress * 100}%` }} />
          <span>
            {job.step} · {Math.round(job.progress * 100)}%
          </span>
          <button type="button" className="mini" onClick={() => void api.cancel(projectId)}>
            중단
          </button>
        </div>
      )}

      {job?.status === 'error' && (
        <div className="banner error">
          <strong>{job.error}</strong>
          {job.hint && <span>{job.hint}</span>}
        </div>
      )}

      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {project.render && (
        <div className="banner ok">
          영상이 완성되었습니다 ({project.render.durationSec.toFixed(1)}초).
          <a href={fileUrl(projectId, project.render.file)} download>
            내려받기
          </a>
          {project.youtube && (
            <a href={project.youtube.url} target="_blank" rel="noreferrer">
              유튜브에서 보기
            </a>
          )}
        </div>
      )}

      {timeline ? (
        <div className="editor-body">
          <div className="editor-left">
            <PreviewPlayer
              projectId={projectId}
              timeline={timeline}
              sources={project.sources}
              playhead={playhead}
              playing={playing}
              onSeek={setPlayhead}
              onPlayingChange={setPlaying}
            />
            <TimelineStrip
              timeline={timeline}
              playhead={playhead}
              selection={selection}
              onSelect={setSelection}
              onSeek={(time) => {
                setPlaying(false);
                setPlayhead(time);
              }}
              onClipsChange={applyClips}
              onCaptionsChange={applyCaptions}
            />
          </div>

          <div className="editor-right">
            <nav className="tabs">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={tab === item.id ? 'active' : ''}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="panel-scroll">
              {tab === 'caption' && (
                <CaptionPanel
                  timeline={timeline}
                  playhead={playhead}
                  selection={selection}
                  onSelect={setSelection}
                  onSeek={setPlayhead}
                  onChange={applyCaptions}
                />
              )}
              {tab === 'clip' && (
                <ClipPanel
                  timeline={timeline}
                  playhead={playhead}
                  selection={selection}
                  onSelect={setSelection}
                  onClipsChange={applyClips}
                />
              )}
              {tab === 'narration' && (
                <NarrationPanel
                  projectId={projectId}
                  timeline={timeline}
                  ttsEnabled={health.features.tts}
                  busy={busy}
                  onChange={applyNarration}
                  onMusicChange={(music) => applyTimeline({ ...timeline, music })}
                  onRenarrate={() => void run(() => api.narrate(projectId))}
                  onSeek={setPlayhead}
                />
              )}
              {tab === 'style' && (
                <StylePanel
                  timeline={timeline}
                  fonts={fonts}
                  onChange={(style) => applyTimeline({ ...timeline, style })}
                />
              )}
              {tab === 'meta' && (
                <MetaPanel timeline={timeline} onChange={(meta) => applyTimeline({ ...timeline, meta })} />
              )}
              {tab === 'auto' && (
                <AutoPanel
                  projectId={projectId}
                  sourceCount={project.sources.length}
                  onSourcesAdded={() => void reload()}
                  buildOptions={project.buildOptions}
                  scriptOptions={project.scriptOptions}
                  aiEnabled={health.features.script}
                  busy={busy}
                  onBuildChange={(buildOptions) => {
                    setProject({ ...project, buildOptions });
                    void api.updateOptions(projectId, { buildOptions });
                  }}
                  onScriptChange={(scriptOptions) => {
                    setProject({ ...project, scriptOptions });
                    void api.updateOptions(projectId, { scriptOptions });
                  }}
                  onRun={(writeScript) => void run(() => api.autoEdit(projectId, writeScript))}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="editor-empty">
          <p>아직 편집본이 없습니다.</p>
          <button
            type="button"
            className="primary"
            onClick={() => void run(() => api.autoEdit(projectId, health.features.script))}
            disabled={busy || project.sources.length === 0}
          >
            자동 편집 시작
          </button>
        </div>
      )}

      {showUpload && project.render && (
        <YoutubeDialog
          projectId={projectId}
          title={timeline?.meta.title ?? project.title}
          durationSec={duration}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
