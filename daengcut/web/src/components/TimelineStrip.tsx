import { useCallback, useMemo, useRef } from 'react';
import { layoutClips, totalDuration } from '../timelineUtils';
import type { Caption, Clip, Timeline } from '../types';

export type Selection = { type: 'clip' | 'caption'; id: string } | null;

interface Props {
  timeline: Timeline;
  playhead: number;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onSeek: (time: number) => void;
  onClipsChange: (clips: Clip[]) => void;
  onCaptionsChange: (captions: Caption[]) => void;
}

type DragKind =
  | { type: 'clip-in'; id: string }
  | { type: 'clip-out'; id: string }
  | { type: 'caption-move'; id: string }
  | { type: 'caption-in'; id: string }
  | { type: 'caption-out'; id: string }
  | { type: 'seek' };

const MIN_CLIP = 0.3;
const MIN_CAPTION = 0.3;

/**
 * 아래쪽 타임라인. 컷의 앞뒤를 끌어서 자르고, 자막 블록을 끌어서 옮긴다.
 * 컷 길이를 바꾸면 뒤에 오는 자막이 같이 밀려야 해서, 실제 반영은 상위에서 rebind 를 거친다.
 */
export function TimelineStrip({
  timeline,
  playhead,
  selection,
  onSelect,
  onSeek,
  onClipsChange,
  onCaptionsChange,
}: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ kind: DragKind; startX: number; origin: number } | null>(null);

  const slots = useMemo(() => layoutClips(timeline.clips), [timeline.clips]);
  const duration = Math.max(0.1, totalDuration(timeline.clips));

  const pxPerSecond = useCallback(() => {
    const width = trackRef.current?.clientWidth ?? 1;
    return width / duration;
  }, [duration]);

  const timeFromEvent = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const ratio = (clientX - rect.left) / rect.width;
      return Math.min(duration, Math.max(0, ratio * duration));
    },
    [duration],
  );

  const startDrag = (event: React.PointerEvent, kind: DragKind, origin: number) => {
    event.stopPropagation();
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    dragRef.current = { kind, startX: event.clientX, origin };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaSec = (event.clientX - drag.startX) / pxPerSecond();

    if (drag.kind.type === 'clip-in' || drag.kind.type === 'clip-out') {
      const id = drag.kind.id;
      const isIn = drag.kind.type === 'clip-in';

      onClipsChange(
        timeline.clips.map((clip) => {
          if (clip.id !== id) return clip;
          // 배속이 걸린 클립은 화면상의 1초가 원본의 speed 초에 해당한다.
          const shift = deltaSec * clip.speed;
          if (isIn) {
            const next = Math.min(clip.out - MIN_CLIP, Math.max(0, drag.origin + shift));
            return { ...clip, in: next };
          }
          const next = Math.max(clip.in + MIN_CLIP, drag.origin + shift);
          return { ...clip, out: next };
        }),
      );
      return;
    }

    if (drag.kind.type.startsWith('caption')) {
      const id = (drag.kind as { id: string }).id;
      onCaptionsChange(
        timeline.captions.map((caption) => {
          if (caption.id !== id) return caption;
          const length = caption.end - caption.start;

          if (drag.kind.type === 'caption-move') {
            const start = Math.min(duration - length, Math.max(0, drag.origin + deltaSec));
            return { ...caption, start, end: start + length };
          }
          if (drag.kind.type === 'caption-in') {
            const start = Math.min(caption.end - MIN_CAPTION, Math.max(0, drag.origin + deltaSec));
            return { ...caption, start };
          }
          const end = Math.max(caption.start + MIN_CAPTION, Math.min(duration, drag.origin + deltaSec));
          return { ...caption, end };
        }),
      );
      return;
    }

    if (drag.kind.type === 'seek') {
      onSeek(timeFromEvent(event.clientX));
    }
  };

  const endDrag = (event: React.PointerEvent) => {
    if (dragRef.current) {
      (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
      dragRef.current = null;
    }
  };

  return (
    <div className="timeline">
      <div className="timeline-labels">
        <span>컷</span>
        <span>자막</span>
      </div>

      <div
        className="timeline-track"
        ref={trackRef}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={(event) => {
          onSeek(timeFromEvent(event.clientX));
          startDrag(event, { type: 'seek' }, 0);
        }}
      >
        <div className="timeline-row">
          {slots.map((slot) => {
            const selected = selection?.type === 'clip' && selection.id === slot.clip.id;
            return (
              <div
                key={slot.clip.id}
                className={`clip-block${selected ? ' selected' : ''}`}
                style={{
                  left: `${(slot.start / duration) * 100}%`,
                  width: `${((slot.end - slot.start) / duration) * 100}%`,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect({ type: 'clip', id: slot.clip.id });
                  // 컷을 누르면 그 지점으로 재생 위치도 옮긴다.
                  onSeek(timeFromEvent(event.clientX));
                }}
              >
                <span
                  className="handle handle-left"
                  onPointerDown={(event) => {
                    onSelect({ type: 'clip', id: slot.clip.id });
                    startDrag(event, { type: 'clip-in', id: slot.clip.id }, slot.clip.in);
                  }}
                />
                <span className="clip-label">
                  {slot.index + 1} · {(slot.end - slot.start).toFixed(1)}초
                </span>
                <span
                  className="handle handle-right"
                  onPointerDown={(event) => {
                    onSelect({ type: 'clip', id: slot.clip.id });
                    startDrag(event, { type: 'clip-out', id: slot.clip.id }, slot.clip.out);
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="timeline-row timeline-row-captions">
          {timeline.captions.map((caption) => {
            const selected = selection?.type === 'caption' && selection.id === caption.id;
            return (
              <div
                key={caption.id}
                className={`caption-block-strip${selected ? ' selected' : ''}${
                  caption.emphasis ? ' emphasis' : ''
                }`}
                style={{
                  left: `${(caption.start / duration) * 100}%`,
                  width: `${((caption.end - caption.start) / duration) * 100}%`,
                }}
                onPointerDown={(event) => {
                  onSelect({ type: 'caption', id: caption.id });
                  // 자막을 누르면 그 자막이 뜨는 순간을 바로 보여준다.
                  onSeek(caption.start + 0.05);
                  startDrag(event, { type: 'caption-move', id: caption.id }, caption.start);
                }}
              >
                <span
                  className="handle handle-left"
                  onPointerDown={(event) =>
                    startDrag(event, { type: 'caption-in', id: caption.id }, caption.start)
                  }
                />
                <span className="caption-strip-text">{caption.text}</span>
                <span
                  className="handle handle-right"
                  onPointerDown={(event) =>
                    startDrag(event, { type: 'caption-out', id: caption.id }, caption.end)
                  }
                />
              </div>
            );
          })}
        </div>

        <div className="playhead" style={{ left: `${(playhead / duration) * 100}%` }} />
      </div>
    </div>
  );
}
