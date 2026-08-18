import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fileUrl } from '../api';
import { wrapCaption, wrapWidthEm } from '../caption';
import {
  captionsAt,
  layoutClips,
  slotAt,
  sourceTimeAt,
  totalDuration,
} from '../timelineUtils';
import type { ProjectSource, Timeline } from '../types';

interface Props {
  projectId: string;
  timeline: Timeline;
  sources: ProjectSource[];
  playhead: number;
  playing: boolean;
  onSeek: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

/**
 * 렌더링하지 않고도 결과를 확인하는 미리보기.
 * 저화질 사본을 클립 순서대로 이어 재생하고, 자막은 화면 위에 DOM 으로 겹쳐 그린다.
 * 자막을 고치면 바로 보이므로 매번 렌더를 돌릴 필요가 없다.
 */
export function PreviewPlayer({
  projectId,
  timeline,
  sources,
  playhead,
  playing,
  onSeek,
  onPlayingChange,
}: Props) {
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const audios = useRef(new Map<string, HTMLAudioElement>());
  const backgroundRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [stageHeight, setStageHeight] = useState(0);

  const slots = useMemo(() => layoutClips(timeline.clips), [timeline.clips]);
  const duration = useMemo(() => totalDuration(timeline.clips), [timeline.clips]);
  const activeSlot = useMemo(() => slotAt(slots, playhead), [slots, playhead]);

  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const playheadRef = useRef(playhead);
  playheadRef.current = playhead;

  const activeSourceId = activeSlot?.clip.sourceId ?? null;
  const framing = activeSlot?.clip.framing;
  const usesBlur = framing?.mode === 'blur';

  const activeSource = sources.find((source) => source.id === activeSourceId) ?? null;

  // ── 화면 크기 추적 (자막 크기를 캔버스 비율에 맞추기 위해) ─────────
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setStageHeight(entry.contentRect.height);
    });
    observer.observe(stage);
    setStageHeight(stage.clientHeight);
    return () => observer.disconnect();
  }, []);

  // ── 재생/일시정지 ────────────────────────────────────────────────
  useEffect(() => {
    for (const [sourceId, video] of videos.current) {
      if (sourceId !== activeSourceId) {
        video.pause();
        continue;
      }
      video.playbackRate = activeSlot?.clip.speed ?? 1;
      video.volume = Math.min(1, Math.max(0, activeSlot?.clip.volume ?? 1));
      if (playing) void video.play().catch(() => undefined);
      else video.pause();
    }

    const background = backgroundRef.current;
    if (background) {
      if (playing && usesBlur) void background.play().catch(() => undefined);
      else background.pause();
    }

    if (!playing) {
      for (const audio of audios.current.values()) audio.pause();
    }
  }, [playing, activeSourceId, activeSlot?.clip.speed, activeSlot?.clip.volume, usesBlur]);

  // ── 바깥에서 재생 위치를 옮겼을 때 영상도 따라가게 ─────────────────
  useEffect(() => {
    if (!activeSlot) return;
    const video = videos.current.get(activeSlot.clip.sourceId);
    if (!video) return;

    const desired = sourceTimeAt(activeSlot, playhead);
    // 재생 중에는 영상이 기준이므로, 차이가 클 때(= 사용자가 직접 옮겼을 때)만 맞춘다.
    if (Math.abs(video.currentTime - desired) > 0.3) {
      video.currentTime = desired;
      const background = backgroundRef.current;
      if (background) background.currentTime = desired;
    }
  }, [playhead, activeSlot]);

  // ── 재생 루프: 클립 경계에서 다음 클립으로 넘긴다 ──────────────────
  useEffect(() => {
    if (!playing) return;

    let frame = 0;
    let lastReport = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      const slot = slotAt(slotsRef.current, playheadRef.current);
      if (!slot) return;
      const video = videos.current.get(slot.clip.sourceId);
      if (!video || video.readyState < 2) return;

      if (video.currentTime >= slot.clip.out - 0.03) {
        const next = slotsRef.current[slot.index + 1];
        if (!next) {
          onPlayingChange(false);
          onSeek(slot.end);
          return;
        }

        // 같은 원본에서 바로 이어지는 컷이면 굳이 탐색하지 않는다 (끊김 방지).
        const contiguous =
          next.clip.sourceId === slot.clip.sourceId &&
          Math.abs(next.clip.in - slot.clip.out) < 0.05;

        if (!contiguous) {
          const nextVideo = videos.current.get(next.clip.sourceId);
          if (nextVideo) nextVideo.currentTime = next.clip.in;
        }

        playheadRef.current = next.start + 0.001;
        onSeek(playheadRef.current);
        return;
      }

      const virtual = slot.start + (video.currentTime - slot.clip.in) / slot.clip.speed;
      playheadRef.current = virtual;

      // 매 프레임 상태를 갱신하면 편집 패널까지 다시 그려진다. 20fps 면 충분하다.
      if (now - lastReport > 50) {
        lastReport = now;
        onSeek(virtual);
      }

      syncNarration(virtual);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, onSeek, onPlayingChange]);

  /** 내레이션 음성을 재생 위치에 맞춰 틀고 끈다. */
  const syncNarration = useCallback(
    (time: number) => {
      for (const line of timeline.narration) {
        const audio = audios.current.get(line.id);
        if (!audio || !line.audioFile) continue;

        const end = line.start + (line.durationSec ?? 0);
        const inside = time >= line.start && time < end;

        if (!inside) {
          if (!audio.paused) audio.pause();
          continue;
        }

        const offset = time - line.start;
        if (Math.abs(audio.currentTime - offset) > 0.25) audio.currentTime = offset;
        if (audio.paused) void audio.play().catch(() => undefined);
      }
    },
    [timeline.narration],
  );

  const visibleCaptions = captionsAt(timeline.captions, playhead);

  // ── 자막 스타일 (캔버스 좌표 → 화면 픽셀) ──────────────────────────
  const scale = stageHeight > 0 ? stageHeight / timeline.canvas.height : 0;
  const fontSize = timeline.style.fontSizeRatio * timeline.canvas.height;
  const fontPx = fontSize * scale;
  const outlinePx = timeline.style.outlineWidth * scale;
  const marginPx = timeline.style.marginRatio * timeline.canvas.height * scale;

  const objectPosition = framing
    ? `${((framing.offsetX + 1) / 2) * 100}% ${((framing.offsetY + 1) / 2) * 100}%`
    : '50% 50%';

  return (
    <div className="preview">
      <div className="preview-stage" ref={stageRef}>
        {usesBlur && activeSource?.proxyFile && (
          <video
            ref={backgroundRef}
            className="preview-video preview-video-blur"
            src={fileUrl(projectId, activeSource.proxyFile)}
            muted
            playsInline
            preload="auto"
          />
        )}

        {sources.map((source) =>
          source.proxyFile ? (
            <video
              key={source.id}
              ref={(element) => {
                if (element) videos.current.set(source.id, element);
                else videos.current.delete(source.id);
              }}
              className="preview-video"
              src={fileUrl(projectId, source.proxyFile)}
              playsInline
              preload="auto"
              style={{
                display: source.id === activeSourceId ? 'block' : 'none',
                objectFit: framing?.mode === 'cover' ? 'cover' : 'contain',
                objectPosition,
                transform: framing ? `scale(${framing.zoom})` : undefined,
              }}
            />
          ) : null,
        )}

        {timeline.narration.map((line) =>
          line.audioFile ? (
            <audio
              key={line.id}
              ref={(element) => {
                if (element) audios.current.set(line.id, element);
                else audios.current.delete(line.id);
              }}
              src={fileUrl(projectId, line.audioFile)}
              preload="auto"
            />
          ) : null,
        )}

        <div
          className={`caption-layer caption-${timeline.style.position}`}
          style={{
            paddingBottom: timeline.style.position === 'bottom' ? marginPx : undefined,
            paddingTop: timeline.style.position === 'top' ? marginPx : undefined,
          }}
        >
          {visibleCaptions.map((caption) => {
            const emphasisScale = caption.emphasis ? 1.14 : 1;
            const lines = wrapCaption(caption.text, {
              maxWidthEm: wrapWidthEm(timeline.canvas.width, fontSize, caption.emphasis),
              maxChars: timeline.style.maxCharsPerLine,
            });

            return (
              <div
                key={caption.id}
                className="caption-block"
                style={{
                  fontFamily: `'${timeline.style.fontFamily || 'Pretendard'}', system-ui, sans-serif`,
                  fontSize: fontPx * emphasisScale,
                  fontWeight: timeline.style.bold || caption.emphasis ? 800 : 500,
                  color: caption.emphasis ? '#FFE14D' : timeline.style.color,
                  WebkitTextStrokeWidth: `${outlinePx * emphasisScale}px`,
                  WebkitTextStrokeColor: timeline.style.outlineColor,
                  background: timeline.style.boxColor
                    ? hexToRgba(timeline.style.boxColor, timeline.style.boxOpacity)
                    : undefined,
                }}
              >
                {lines.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            );
          })}
        </div>

        {timeline.clips.length === 0 && (
          <div className="preview-empty">클립이 없습니다. 자동 편집을 실행해 주세요.</div>
        )}
      </div>

      <div className="preview-controls">
        <button
          type="button"
          className="play-button"
          onClick={() => onPlayingChange(!playing)}
          disabled={timeline.clips.length === 0}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.01}
          value={Math.min(playhead, duration)}
          onChange={(event) => {
            onPlayingChange(false);
            onSeek(Number(event.target.value));
          }}
        />
        <span className="preview-time">
          {playhead.toFixed(1)} / {duration.toFixed(1)}초
        </span>
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
