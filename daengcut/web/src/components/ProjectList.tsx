import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, fileUrl } from '../api';
import type { Health, ProjectListItem } from '../types';

interface Props {
  health: Health;
  onOpen: (projectId: string) => void;
  onOpenSettings: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft: '영상 대기',
  analyzing: '분석 중',
  ready: '편집 가능',
  rendering: '만드는 중',
  rendered: '완성',
  uploading: '올리는 중',
  uploaded: '업로드 완료',
  error: '오류',
};

export function ProjectList({ health, onOpen, onOpenSettings }: Props) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(() => {
    api
      .listProjects()
      .then(setProjects)
      .catch(() => setError('목록을 불러오지 못했습니다.'));
  }, []);

  useEffect(reload, [reload]);

  /** 영상을 떨어뜨리면 프로젝트를 만들고 바로 자동 편집까지 돌린다. */
  const startFromFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setUploading(0);

    try {
      const name = files[0]?.name.replace(/\.[^.]+$/, '') ?? '새 숏츠';
      const project = await api.createProject(name);
      await api.uploadSources(project.id, files, true, (ratio) => setUploading(ratio));
      onOpen(project.id);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message} ${err.hint ?? ''}` : '업로드에 실패했습니다.');
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="project-list">
      <header className="list-head">
        <div>
          <h1>댕컷</h1>
          <p>찍어둔 영상을 넣으면 숏츠로 만들어 드립니다.</p>
        </div>
        <button type="button" className="settings-button" onClick={onOpenSettings}>
          ⚙ 설정
        </button>
      </header>

      {health.hints.length > 0 && (
        <button type="button" className="hint-list" onClick={onOpenSettings}>
          <span className="hint-title">아직 켜지지 않은 기능이 있습니다 — 눌러서 설정하기</span>
          <ul>
            {health.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </button>
      )}

      <div
        className={`dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void startFromFiles([...event.dataTransfer.files]);
        }}
        onClick={() => inputRef.current?.click()}
      >
        {uploading === null ? (
          <>
            <strong>영상을 여기에 끌어다 놓으세요</strong>
            <span>여러 개를 한 번에 올리면 이어붙여 한 편으로 만듭니다</span>
          </>
        ) : (
          <>
            <strong>올리는 중… {Math.round(uploading * 100)}%</strong>
            <span>업로드가 끝나면 자동으로 편집이 시작됩니다</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          hidden
          onChange={(event) => {
            void startFromFiles([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="cards">
        {projects.map((project) => (
          <button key={project.id} type="button" className="card" onClick={() => onOpen(project.id)}>
            {project.thumbFile ? (
              <img src={fileUrl(project.id, project.thumbFile)} alt="" />
            ) : (
              <div className="card-thumb-empty" />
            )}
            <div className="card-body">
              <strong>{project.title}</strong>
              <span className={`status status-${project.status}`}>
                {STATUS_LABEL[project.status] ?? project.status}
              </span>
              <span className="card-meta">
                영상 {project.sourceCount}개
                {project.durationSec ? ` · ${project.durationSec.toFixed(0)}초` : ''}
              </span>
            </div>
          </button>
        ))}
      </div>

      {projects.length === 0 && <p className="empty">아직 만든 숏츠가 없습니다.</p>}
    </div>
  );
}
