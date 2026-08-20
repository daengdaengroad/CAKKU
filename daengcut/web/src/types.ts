// 서버(server/src/timeline/types.ts)의 타입을 UI 쪽에 맞춰 옮겨 적은 것.
// 타임라인 형태가 바뀌면 양쪽을 같이 고쳐야 한다.

export type FramingMode = 'cover' | 'blur' | 'contain';
export type CaptionPosition = 'top' | 'middle' | 'bottom';

export interface Framing {
  mode: FramingMode;
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface Clip {
  id: string;
  sourceId: string;
  in: number;
  out: number;
  speed: number;
  framing: Framing;
  volume: number;
}

export interface Caption {
  id: string;
  start: number;
  end: number;
  text: string;
  emphasis: boolean;
}

export interface NarrationLine {
  id: string;
  start: number;
  text: string;
  audioFile: string | null;
  durationSec: number | null;
  voice: string | null;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSizeRatio: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: number;
  bold: boolean;
  position: CaptionPosition;
  marginRatio: number;
  boxColor: string | null;
  boxOpacity: number;
  maxCharsPerLine: number;
}

export interface MusicTrack {
  file: string;
  gain: number;
  fadeInSec: number;
  fadeOutSec: number;
}

export interface Timeline {
  version: number;
  canvas: { width: number; height: number; fps: number };
  clips: Clip[];
  captions: Caption[];
  narration: NarrationLine[];
  music: MusicTrack | null;
  duckRatio: number;
  style: CaptionStyle;
  meta: { title: string; description: string; tags: string[] };
}

export interface MediaInfo {
  path: string;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  rotation: number;
  hasAudio: boolean;
  videoCodec: string;
  audioCodec: string | null;
  sizeBytes: number;
  isPortrait: boolean;
}

export interface ProjectSource {
  id: string;
  originalName: string;
  file: string;
  proxyFile: string | null;
  thumbFile: string | null;
  info: MediaInfo | null;
  analyzed: boolean;
}

export type ProjectStatus =
  | 'draft'
  | 'analyzing'
  | 'ready'
  | 'rendering'
  | 'rendered'
  | 'uploading'
  | 'uploaded'
  | 'error';

export interface BuildOptions {
  targetSec: number;
  minClipSec: number;
  maxClipSec: number;
  framingMode: FramingMode;
}

export type Tone = 'cute' | 'funny' | 'emotional' | 'informative';
export type Persona = 'dog' | 'owner' | 'narrator';

export interface ScriptOptions {
  tone: Tone;
  persona: Persona;
  dogName: string;
  dogBreed: string;
  context: string;
  withNarration: boolean;
}

export interface JobState {
  id: string;
  projectId: string;
  kind: 'ingest' | 'script' | 'narrate' | 'render' | 'upload' | 'auto';
  status: 'running' | 'done' | 'error' | 'canceled';
  progress: number;
  step: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  hint: string | null;
}

export interface TimelineSummary {
  durationSec: number;
  clips: { id: string; start: number; duration: number }[];
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
  timeline: Timeline | null;
  render: { file: string; durationSec: number; renderedAt: string; quality: string } | null;
  youtube: { videoId: string; url: string; uploadedAt: string; privacyStatus: string } | null;
  error: string | null;
  job: JobState | null;
  summary: TimelineSummary | null;
}

export interface ProjectListItem {
  id: string;
  title: string;
  status: ProjectStatus;
  updatedAt: string;
  sourceCount: number;
  thumbFile: string | null;
  durationSec: number | null;
  youtubeUrl: string | null;
}

export interface Health {
  ok: boolean;
  features: {
    ffmpeg: boolean;
    script: boolean;
    tts: boolean;
    ttsProvider: string;
    youtube: boolean;
    fonts: boolean;
  };
  hints: string[];
}

export interface YoutubeStatus {
  configured: boolean;
  connected: boolean;
  channel: { id: string; title: string } | null;
}

export type TtsProviderName = 'none' | 'google' | 'elevenlabs' | 'openai';

export interface SettingsView {
  anthropic: {
    configured: boolean;
    masked: string;
    /** app = 화면에서 저장함, env = .env 파일에서 옴 */
    source: 'app' | 'env' | 'none';
    model: string;
  };
  tts: {
    provider: TtsProviderName;
    voiceId: string;
    google: { credentials: string; configured: boolean };
    elevenlabs: { configured: boolean; masked: string };
    openai: { configured: boolean; masked: string };
  };
  youtube: {
    configured: boolean;
    clientIdMasked: string;
    redirectUri: string;
  };
}

export interface SettingsPatch {
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

export interface VoiceOption {
  id: string;
  label: string;
  note: string;
}

export interface VoiceList {
  provider: TtsProviderName;
  current: string;
  voices: VoiceOption[];
  previewText: string;
}
