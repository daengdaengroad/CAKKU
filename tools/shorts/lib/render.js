// 사진 + 문장별 mp3 -> 9:16 세로 MP4 한 방 렌더.
// ffmpeg 한 번만 호출한다 (중간 파일 없이 필터그래프로 처리).

const path = require('path');
const { execFileSync } = require('child_process');
const { ffmpeg } = require('./ffmpeg');

const W = 1080;
const H = 1920;
const FPS = 30;
// 켄번스 확대 배율. 너무 키우면 화질이 뭉개지고 너무 작으면 정지 사진처럼 보인다.
const ZOOM_MAX = 1.18;
const PAN_ZOOM = 1.12;
// zoompan은 입력 해상도 기준 정수 픽셀로 움직여서, 미리 키워두지 않으면 덜덜 떨린다.
const SUPERSAMPLE = 2;
// 자막이 밝은 음식 사진 위에서도 읽히도록 아래쪽에 까는 그라데이션 높이
const SCRIM_H = 620;

function pickFont() {
  if (process.env.SHORTS_FONT) return process.env.SHORTS_FONT;
  const candidates = ['NanumSquareRound', 'NanumBarunGothic', 'NanumGothic', 'Apple SD Gothic Neo', 'AppleGothic', 'Malgun Gothic'];
  try {
    const installed = execFileSync('fc-list', [':', 'family'], { encoding: 'utf8' });
    const found = candidates.find((name) => installed.includes(name));
    if (found) return found;
    console.warn('  ! 한글 폰트를 찾지 못했습니다. 자막이 깨지면 fonts-nanum 을 설치하세요.');
  } catch {
    /* fontconfig 없는 환경(mac/win)은 기본값으로 넘어간다 */
  }
  return candidates[0];
}

// 필터그래프 안에서 파일 경로에 쓰이는 특수문자를 이스케이프한다.
function escapePath(p) {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'").replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

// 사진 한 장의 켄번스 움직임. 인덱스마다 방향을 바꿔 단조로움을 없앤다.
function kenBurns(index, frames) {
  const last = Math.max(1, frames - 1);
  const center = { x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' };
  const step = ((ZOOM_MAX - 1) / last).toFixed(6);

  switch (index % 4) {
    case 0: // 서서히 확대
      return { z: `min(zoom+${step},${ZOOM_MAX})`, ...center };
    case 1: // 서서히 축소
      return { z: `if(eq(on,0),${ZOOM_MAX},max(zoom-${step},1.0))`, ...center };
    case 2: // 왼쪽 -> 오른쪽 패닝
      return { z: `${PAN_ZOOM}`, x: `(iw-iw/zoom)*on/${last}`, y: 'ih/2-(ih/zoom/2)' };
    default: // 아래 -> 위 패닝
      return { z: `${PAN_ZOOM}`, x: 'iw/2-(iw/zoom/2)', y: `(ih-ih/zoom)*(1-on/${last})` };
  }
}

// 자막 밑에 까는 반투명 그라데이션을 한 번만 만들어 둔다 (정적 이미지라 렌더 비용이 거의 없다).
async function makeScrim(file) {
  await ffmpeg([
    '-f', 'lavfi',
    '-i', `gradients=s=${W}x${SCRIM_H}:c0=black@0.0:c1=black@0.62:x0=0:y0=0:x1=0:y1=${SCRIM_H}:nb_colors=2`,
    '-frames:v', '1',
    '-pix_fmt', 'rgba',
    file,
  ], { capture: true });
  return file;
}

/**
 * segments: [{ photo, seconds }]  seconds = 그 사진이 화면에 머무는 시간
 * audioFiles: 문장별 mp3 경로 (segments와 같은 순서/개수)
 */
function buildFilterGraph({ segments, audioFiles, assFile, totalSeconds, gap, music, scrim }) {
  const parts = [];
  const vLabels = [];
  const aLabels = [];

  segments.forEach((seg, i) => {
    const frames = Math.max(2, Math.round(seg.seconds * FPS));
    const { z, x, y } = kenBurns(i, frames);
    parts.push(
      `[${i}:v]scale=${W * SUPERSAMPLE}:${H * SUPERSAMPLE}:force_original_aspect_ratio=increase,` +
        `crop=${W * SUPERSAMPLE}:${H * SUPERSAMPLE},setsar=1,` +
        `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${W}x${H}:fps=${FPS},` +
        `format=yuv420p[v${i}]`
    );
    vLabels.push(`[v${i}]`);
  });

  const audioOffset = segments.length;
  audioFiles.forEach((_, i) => {
    const target = segments[i].seconds;
    // 문장 사이 숨 쉴 틈(gap)만큼 무음을 덧대고, 영상 길이와 정확히 맞춘다.
    parts.push(
      `[${audioOffset + i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
        `apad=pad_dur=${(gap + 2).toFixed(3)},atrim=duration=${target.toFixed(3)},asetpts=N/SR/TB[a${i}]`
    );
    aLabels.push(`[a${i}]`);
  });

  parts.push(`${vLabels.join('')}concat=n=${segments.length}:v=1:a=0[vcat]`);

  const musicIndex = music ? audioOffset + audioFiles.length : null;
  const scrimIndex = scrim ? audioOffset + audioFiles.length + (music ? 1 : 0) : null;

  let videoChain = '[vcat]';
  if (scrim) {
    parts.push(`[vcat][${scrimIndex}:v]overlay=x=0:y=${H - SCRIM_H}:format=yuv420[vscrim]`);
    videoChain = '[vscrim]';
  }
  parts.push(
    `${videoChain}ass=filename='${escapePath(assFile)}',` +
      `fade=t=in:st=0:d=0.4,fade=t=out:st=${Math.max(0, totalSeconds - 0.5).toFixed(3)}:d=0.5[vout]`
  );

  parts.push(`${aLabels.join('')}concat=n=${audioFiles.length}:v=0:a=1[voice]`);

  if (music) {
    parts.push(
      `[${musicIndex}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,` +
        `volume=0.12,atrim=duration=${totalSeconds.toFixed(3)},` +
        `afade=t=out:st=${Math.max(0, totalSeconds - 1.5).toFixed(3)}:d=1.5[bgm]`
    );
    // normalize=0: amix 기본값은 입력 수만큼 음량을 나눠서 목소리까지 6dB 줄어든다.
    // 대신 합쳐서 넘칠 수 있으니 리미터로 잡는다.
    parts.push('[voice][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[mixed]');
    parts.push(`[mixed]afade=t=out:st=${Math.max(0, totalSeconds - 0.6).toFixed(3)}:d=0.6[aout]`);
  } else {
    parts.push(`[voice]afade=t=out:st=${Math.max(0, totalSeconds - 0.6).toFixed(3)}:d=0.6[aout]`);
  }

  return parts.join(';');
}

async function renderVideo({
  segments,
  audioFiles,
  assFile,
  outFile,
  totalSeconds,
  gap = 0.25,
  music = null,
  preset = 'veryfast',
  crf = 20,
}) {
  const scrim = await makeScrim(path.join(path.dirname(assFile), 'scrim.png'));

  const args = [];
  for (const seg of segments) args.push('-i', seg.photo);
  for (const file of audioFiles) args.push('-i', file);
  if (music) args.push('-i', music);
  args.push('-i', scrim);

  const graph = buildFilterGraph({ segments, audioFiles, assFile, totalSeconds, gap, music, scrim });

  args.push(
    '-filter_complex', graph,
    '-map', '[vout]',
    '-map', '[aout]',
    '-r', String(FPS),
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', String(crf),
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-movflags', '+faststart',
    '-t', totalSeconds.toFixed(3),
    outFile
  );

  await ffmpeg(args, { label: `렌더링 ${path.basename(outFile)} ` });
  return outFile;
}

module.exports = { renderVideo, buildFilterGraph, makeScrim, pickFont, W, H, FPS };
