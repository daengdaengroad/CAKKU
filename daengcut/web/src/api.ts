import type {
  Health,
  SettingsPatch,
  SettingsView,
  VoiceList,
  Project,
  ProjectListItem,
  Timeline,
  BuildOptions,
  ScriptOptions,
  JobState,
  YoutubeStatus,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
    throw new ApiError(body.error ?? `요청이 실패했습니다 (${res.status})`, body.hint);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<Health>('/api/health'),

  getSettings: () => request<SettingsView>('/api/settings'),
  saveSettings: (patch: SettingsPatch) =>
    request<{ saved: boolean }>('/api/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  getVoices: () => request<VoiceList>('/api/tts/voices'),

  fonts: () => request<{ family: string }[]>('/api/fonts'),

  listProjects: () => request<ProjectListItem[]>('/api/projects'),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (title: string) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  updateOptions: (
    id: string,
    patch: { title?: string; buildOptions?: BuildOptions; scriptOptions?: ScriptOptions },
  ) => request<Project>(`/api/projects/${id}/options`, { method: 'PATCH', body: JSON.stringify(patch) }),

  saveTimeline: (id: string, timeline: Timeline) =>
    request<Project>(`/api/projects/${id}/timeline`, {
      method: 'PUT',
      body: JSON.stringify(timeline),
    }),

  uploadSources: (id: string, files: File[], auto: boolean, onProgress?: (r: number) => void) =>
    // 업로드 진행률을 보려면 fetch 로는 부족해서 XHR 을 쓴다.
    new Promise<void>((resolve, reject) => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      form.append('auto', String(auto));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/projects/${id}/sources`);
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          const body = safeParse(xhr.responseText);
          reject(new ApiError(body.error ?? '업로드에 실패했습니다.', body.hint));
        }
      });
      xhr.addEventListener('error', () => reject(new ApiError('업로드 중 연결이 끊겼습니다.')));
      xhr.send(form);
    }),

  uploadMusic: async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ file: string }>(`/api/projects/${id}/music`, { method: 'POST', body: form });
  },

  autoEdit: (id: string, writeScript: boolean) =>
    request<{ started: boolean }>(`/api/projects/${id}/auto`, {
      method: 'POST',
      body: JSON.stringify({ writeScript }),
    }),

  narrate: (id: string) =>
    request<{ started: boolean }>(`/api/projects/${id}/narrate`, { method: 'POST' }),

  render: (id: string, quality: 'preview' | 'final') =>
    request<{ started: boolean }>(`/api/projects/${id}/render`, {
      method: 'POST',
      body: JSON.stringify({ quality }),
    }),

  cancel: (id: string) => request<{ canceled: boolean }>(`/api/projects/${id}/cancel`, { method: 'POST' }),

  youtubeStatus: () => request<YoutubeStatus>('/api/youtube/status'),
  youtubeDisconnect: () => request<{ connected: boolean }>('/api/youtube/disconnect', { method: 'POST' }),
  youtubeUpload: (
    projectId: string,
    body: { privacyStatus: 'private' | 'unlisted' | 'public'; madeForKids: boolean },
  ) =>
    request<{ started: boolean }>(`/api/youtube/upload/${projectId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

function safeParse(text: string): { error?: string; hint?: string } {
  try {
    return JSON.parse(text) as { error?: string; hint?: string };
  } catch {
    return {};
  }
}

/** 목소리 미리듣기 오디오 주소. 서버가 샘플을 만들어 돌려준다. */
export function voicePreviewUrl(voiceId: string): string {
  return `/api/tts/preview?voice=${encodeURIComponent(voiceId)}`;
}

/** 프로젝트 폴더 안의 파일을 브라우저에서 받아볼 수 있는 URL 로 */
export function fileUrl(projectId: string, relativePath: string): string {
  const encoded = relativePath.split('/').map(encodeURIComponent).join('/');
  return `/api/projects/${projectId}/files/${encoded}`;
}

/** 작업 진행률 스트림 구독. 반환값을 호출하면 끊는다. */
export function subscribeJob(projectId: string, onJob: (job: JobState) => void): () => void {
  const source = new EventSource(`/api/projects/${projectId}/events`);
  source.onmessage = (event) => {
    try {
      onJob(JSON.parse(event.data) as JobState);
    } catch {
      // 형식이 깨진 이벤트는 무시한다.
    }
  };
  return () => source.close();
}
