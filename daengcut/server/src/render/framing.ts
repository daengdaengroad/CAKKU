import type { Clip } from '../timeline/types.js';

export interface Canvas {
  width: number;
  height: number;
  fps: number;
}

export interface SourceSize {
  width: number;
  height: number;
}

/** libx264 는 짝수 크기를 요구한다. */
function even(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 프레이밍 계산을 ffmpeg 표현식이 아니라 자바스크립트에서 미리 끝낸다.
 * 원본 해상도를 이미 알고 있으니 실제 픽셀 값을 넣을 수 있고,
 * 그러면 필터 문자열에 콤마 이스케이프 지옥이 생기지 않는다.
 */
export function framingFilters(clip: Clip, source: SourceSize, canvas: Canvas): string[] {
  const { mode, offsetX, offsetY, zoom } = clip.framing;
  const W = canvas.width;
  const H = canvas.height;
  const sw = source.width || W;
  const sh = source.height || H;

  if (mode === 'contain') {
    const fit = Math.min(W / sw, H / sh) * zoom;
    const scaledW = even(sw * fit);
    const scaledH = even(sh * fit);

    // 확대해서 캔버스를 넘치면 잘라내고, 모자라면 검은 여백을 채운다.
    if (scaledW > W || scaledH > H) {
      const x = clamp(Math.round(((scaledW - W) / 2) * (1 + offsetX)), 0, Math.max(0, scaledW - W));
      const y = clamp(Math.round(((scaledH - H) / 2) * (1 + offsetY)), 0, Math.max(0, scaledH - H));
      return [`scale=${scaledW}:${scaledH}:flags=bicubic`, `crop=${W}:${H}:${x}:${y}`];
    }

    const padX = Math.round((W - scaledW) / 2);
    const padY = Math.round((H - scaledH) / 2);
    return [
      `scale=${scaledW}:${scaledH}:flags=bicubic`,
      `pad=${W}:${H}:${padX}:${padY}:color=black`,
    ];
  }

  // cover: 캔버스를 꽉 채우도록 키운 뒤 잘라낸다. blur 모드의 배경도 같은 계산을 쓴다.
  const fill = Math.max(W / sw, H / sh) * zoom;
  const scaledW = even(sw * fill);
  const scaledH = even(sh * fill);
  const x = clamp(Math.round(((scaledW - W) / 2) * (1 + offsetX)), 0, Math.max(0, scaledW - W));
  const y = clamp(Math.round(((scaledH - H) / 2) * (1 + offsetY)), 0, Math.max(0, scaledH - H));

  return [`scale=${scaledW}:${scaledH}:flags=bicubic`, `crop=${W}:${H}:${x}:${y}`];
}

/** blur 모드: 뒤에는 꽉 찬 흐린 영상, 앞에는 잘리지 않은 원본. 가로 영상을 세로로 올릴 때 쓴다. */
export function blurFramingParts(clip: Clip, source: SourceSize, canvas: Canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const sw = source.width || W;
  const sh = source.height || H;

  const background = framingFilters(
    { ...clip, framing: { mode: 'cover', offsetX: 0, offsetY: 0, zoom: 1.08 } },
    source,
    canvas,
  );

  const fit = Math.min(W / sw, H / sh) * clip.framing.zoom;
  const fgW = even(Math.min(sw * fit, W));
  const fgH = even(Math.min(sh * fit, H));

  return {
    background: [...background, 'gblur=sigma=32', 'eq=brightness=-0.08:saturation=1.25'],
    foreground: [`scale=${fgW}:${fgH}:flags=bicubic`],
    overlayX: Math.round((W - fgW) / 2),
    // 세로 위치는 offsetY 로 조금 움직일 수 있게 둔다.
    overlayY: clamp(
      Math.round(((H - fgH) / 2) * (1 + clip.framing.offsetY)),
      0,
      Math.max(0, H - fgH),
    ),
  };
}

/** atempo 는 한 번에 0.5~2배만 안정적이라 여러 번 걸어 목표 배속을 만든다. */
export function atempoChain(speed: number): string[] {
  const filters: string[] = [];
  let remaining = speed;

  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  while (remaining > 2) {
    filters.push('atempo=2.0');
    remaining /= 2;
  }
  if (Math.abs(remaining - 1) > 0.001) {
    filters.push(`atempo=${remaining.toFixed(4)}`);
  }
  return filters;
}
