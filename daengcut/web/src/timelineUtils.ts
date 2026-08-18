import type { Caption, Clip, Timeline } from './types';

export interface ClipSlot {
  clip: Clip;
  index: number;
  start: number;
  end: number;
}

export function clipDuration(clip: Clip): number {
  return Math.max(0, clip.out - clip.in) / (clip.speed || 1);
}

/** 클립들이 최종 영상에서 차지하는 구간 */
export function layoutClips(clips: Clip[]): ClipSlot[] {
  let acc = 0;
  return clips.map((clip, index) => {
    const start = acc;
    const end = start + clipDuration(clip);
    acc = end;
    return { clip, index, start, end };
  });
}

export function totalDuration(clips: Clip[]): number {
  return clips.reduce((sum, clip) => sum + clipDuration(clip), 0);
}

export function slotAt(slots: ClipSlot[], time: number): ClipSlot | null {
  if (slots.length === 0) return null;
  for (const slot of slots) {
    if (time >= slot.start && time < slot.end) return slot;
  }
  // 끝을 살짝 넘으면 마지막 클립으로 본다.
  return slots[slots.length - 1] ?? null;
}

/** 최종 영상 기준 시각 → 원본 영상에서의 시각 */
export function sourceTimeAt(slot: ClipSlot, time: number): number {
  const local = Math.max(0, time - slot.start) * slot.clip.speed;
  return Math.min(slot.clip.out, slot.clip.in + local);
}

export function captionsAt(captions: Caption[], time: number): Caption[] {
  return captions.filter((caption) => time >= caption.start && time < caption.end);
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${cs}`;
}

/**
 * 클립을 자르거나 옮기거나 지운 뒤, 자막과 내레이션을 따라 움직이게 한다.
 *
 * 자막은 "영상 시작부터 N초" 라는 절대 시각으로 저장되지만,
 * 사용자가 생각하는 건 "이 장면에 붙은 자막"이다.
 * 그래서 편집 전에 각 자막이 어느 클립에 속했는지 기억해 두고,
 * 편집 후 그 클립의 새 위치를 기준으로 다시 계산한다.
 */
export function rebindTimeline(timeline: Timeline, nextClips: Clip[]): Timeline {
  const before = layoutClips(timeline.clips);
  const after = layoutClips(nextClips);
  const afterById = new Map(after.map((slot) => [slot.clip.id, slot]));

  const remap = (time: number): number | null => {
    const oldSlot = slotAt(before, time);
    if (!oldSlot) return null;

    const newSlot = afterById.get(oldSlot.clip.id);
    if (!newSlot) return null; // 붙어 있던 클립이 사라졌다

    const offset = time - oldSlot.start;
    const newLength = newSlot.end - newSlot.start;
    return newSlot.start + Math.min(offset, Math.max(0, newLength - 0.05));
  };

  const duration = totalDuration(nextClips);

  const captions = timeline.captions.flatMap((caption) => {
    const start = remap(caption.start);
    if (start === null) return [];
    const length = Math.max(0.3, caption.end - caption.start);
    return [
      {
        ...caption,
        start,
        end: Math.min(duration, start + length),
      },
    ];
  });

  const narration = timeline.narration.flatMap((line) => {
    const start = remap(line.start);
    if (start === null) return [];
    return [{ ...line, start }];
  });

  return { ...timeline, clips: nextClips, captions, narration };
}

/** 자막이 영상 길이를 벗어나지 않게 정리한다. */
export function clampCaptions(timeline: Timeline): Caption[] {
  const duration = totalDuration(timeline.clips);
  return timeline.captions
    .map((caption) => ({
      ...caption,
      start: Math.min(caption.start, Math.max(0, duration - 0.3)),
      end: Math.min(caption.end, duration),
    }))
    .filter((caption) => caption.end > caption.start);
}

export function newLocalId(prefix: string): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`;
}
