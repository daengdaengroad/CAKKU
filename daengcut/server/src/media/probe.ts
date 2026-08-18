import { runFfprobe } from './ffmpeg.js';
import { AppError } from '../util/errors.js';

export interface MediaInfo {
  path: string;
  durationSec: number;
  /** 회전 메타데이터를 반영한, 실제로 화면에 보이는 크기 */
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

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  tags?: Record<string, string>;
  side_data_list?: { rotation?: number }[];
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string; size?: string };
}

function parseRate(rate?: string): number {
  if (!rate) return 0;
  const [num, den] = rate.split('/');
  const n = Number(num);
  const d = Number(den ?? 1);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return n / d;
}

function parseRotation(stream: FfprobeStream): number {
  const fromSideData = stream.side_data_list?.find((s) => typeof s.rotation === 'number')?.rotation;
  const fromTag = stream.tags?.rotate ? Number(stream.tags.rotate) : undefined;
  const raw = fromSideData ?? fromTag ?? 0;
  // ffprobe 는 -90 처럼 음수를 주기도 한다. 0/90/180/270 으로 정규화.
  return ((Math.round(raw / 90) * 90) % 360 + 360) % 360;
}

/** 영상 파일의 기본 정보를 읽는다. 휴대폰 세로 촬영 회전값까지 반영한 크기를 돌려준다. */
export async function probe(filePath: string): Promise<MediaInfo> {
  const { stdout } = await runFfprobe([
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ], { label: 'probe' });

  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    throw new AppError('영상 정보를 읽지 못했습니다.', 400, '지원하지 않는 파일 형식일 수 있습니다.');
  }

  const video = parsed.streams?.find((s) => s.codec_type === 'video');
  const audio = parsed.streams?.find((s) => s.codec_type === 'audio');

  if (!video) {
    throw new AppError('영상 트랙이 없는 파일입니다.', 400, '동영상 파일인지 확인해 주세요.');
  }

  const rotation = parseRotation(video);
  const rawWidth = video.width ?? 0;
  const rawHeight = video.height ?? 0;
  const swapped = rotation === 90 || rotation === 270;

  const durationSec =
    Number(parsed.format?.duration) || Number(video.duration) || 0;

  if (!durationSec) {
    throw new AppError('영상 길이를 알 수 없습니다.', 400, '파일이 손상되었을 수 있습니다.');
  }

  const width = swapped ? rawHeight : rawWidth;
  const height = swapped ? rawWidth : rawHeight;

  return {
    path: filePath,
    durationSec,
    width,
    height,
    fps: parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate) || 30,
    rotation,
    hasAudio: Boolean(audio),
    videoCodec: video.codec_name ?? 'unknown',
    audioCodec: audio?.codec_name ?? null,
    sizeBytes: Number(parsed.format?.size) || 0,
    isPortrait: height >= width,
  };
}

/** 오디오 파일(TTS 결과 등) 길이만 빠르게 잰다. */
export async function audioDuration(filePath: string): Promise<number> {
  const { stdout } = await runFfprobe([
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ], { label: 'audio-duration' });
  const seconds = Number(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new AppError('오디오 길이를 읽지 못했습니다.', 500);
  }
  return seconds;
}
