/**
 * 타임라인 = 이 프로그램의 유일한 진실.
 *
 * AI가 처음 한 벌 만들어주고, 사용자는 UI에서 이 문서를 고치고,
 * 렌더러는 이 문서만 보고 영상을 만든다. 같은 타임라인이면 항상 같은 결과가 나온다.
 */

export const TIMELINE_VERSION = 1;

export type FramingMode = 'cover' | 'blur' | 'contain';

export interface Framing {
  /** cover: 꽉 채우고 잘라냄 / blur: 뒤에 흐린 배경 / contain: 검은 여백 */
  mode: FramingMode;
  /** -1 ~ 1. 크롭 위치를 좌우로 민다 (강아지가 화면 한쪽에 있을 때) */
  offsetX: number;
  /** -1 ~ 1. 크롭 위치를 위아래로 민다 */
  offsetY: number;
  /** 1 = 원본 크기, 1.2 = 20% 확대 */
  zoom: number;
}

export interface Clip {
  id: string;
  /** 어느 원본 영상에서 잘라왔는지 */
  sourceId: string;
  /** 원본에서의 시작/끝 (초) */
  in: number;
  out: number;
  /** 1 = 등속, 0.5 = 슬로우모션, 2 = 2배속 */
  speed: number;
  framing: Framing;
  /** 원본 소리 볼륨 0~2. 0이면 무음 */
  volume: number;
}

export type CaptionPosition = 'top' | 'middle' | 'bottom';

export interface CaptionStyle {
  /** assets/fonts 에 있는 폰트 이름. 비우면 자동 선택 */
  fontFamily: string;
  /** 캔버스 높이 대비 글자 크기 비율 (0.045 = 1920px 기준 86px) */
  fontSizeRatio: number;
  /** #RRGGBB */
  color: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: number;
  bold: boolean;
  position: CaptionPosition;
  /** 화면 가장자리에서 띄우는 여백 비율 */
  marginRatio: number;
  /** 자막 뒤 반투명 박스 (#RRGGBB + 투명도 0~1). null이면 박스 없음 */
  boxColor: string | null;
  boxOpacity: number;
  /**
   * 한 줄 최대 글자 수. 기본값은 넉넉하게 두고, 줄바꿈은 실제 글자 폭으로 판단한다.
   * 더 짧게 끊고 싶을 때만 낮춰 쓰는 값.
   */
  maxCharsPerLine: number;
}

export interface Caption {
  id: string;
  /** 최종 타임라인 기준 절대 시각 (초) */
  start: number;
  end: number;
  text: string;
  /** 강조 자막 (색/크기 다르게) */
  emphasis: boolean;
}

export interface NarrationLine {
  id: string;
  /** 최종 타임라인 기준 시작 시각 */
  start: number;
  text: string;
  /** TTS 결과 파일 (workspace 기준 상대경로). 아직 합성 전이면 null */
  audioFile: string | null;
  /** 합성된 실제 길이 (초) */
  durationSec: number | null;
  /** 이 줄만 다른 목소리로 쓰고 싶을 때 */
  voice: string | null;
}

export interface MusicTrack {
  /** workspace 기준 상대경로 */
  file: string;
  /** 0~1 */
  gain: number;
  fadeInSec: number;
  fadeOutSec: number;
}

export interface TimelineMeta {
  title: string;
  description: string;
  tags: string[];
}

export interface Timeline {
  version: number;
  canvas: {
    width: number;
    height: number;
    fps: number;
  };
  clips: Clip[];
  captions: Caption[];
  narration: NarrationLine[];
  music: MusicTrack | null;
  /** 내레이션이 나올 때 원본/배경음 볼륨을 이 비율로 낮춘다 */
  duckRatio: number;
  style: CaptionStyle;
  meta: TimelineMeta;
}

/** 클립 하나가 최종 영상에서 차지하는 길이 */
export function clipDuration(clip: Clip): number {
  const raw = Math.max(0, clip.out - clip.in);
  return raw / (clip.speed || 1);
}

/** 각 클립이 최종 영상에서 시작하는 시각 */
export function clipOffsets(clips: Clip[]): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (const clip of clips) {
    offsets.push(acc);
    acc += clipDuration(clip);
  }
  return offsets;
}

export function timelineDuration(timeline: Timeline): number {
  return timeline.clips.reduce((sum, clip) => sum + clipDuration(clip), 0);
}

export const DEFAULT_CANVAS = { width: 1080, height: 1920, fps: 30 } as const;

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: '',
  fontSizeRatio: 0.045,
  color: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 5,
  shadow: 1,
  bold: true,
  position: 'bottom',
  marginRatio: 0.14,
  boxColor: null,
  boxOpacity: 0.55,
  maxCharsPerLine: 24,
};

export const DEFAULT_FRAMING: Framing = {
  mode: 'cover',
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
};
