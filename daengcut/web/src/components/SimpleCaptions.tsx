import { newLocalId, totalDuration } from '../timelineUtils';
import type { Caption, Timeline } from '../types';

interface Props {
  timeline: Timeline;
  playhead: number;
  aiEnabled: boolean;
  busy: boolean;
  onSeek: (time: number) => void;
  onChange: (captions: Caption[]) => void;
  onOpenSettings: () => void;
  /** 컷과 자막을 처음부터 다시 만든다 */
  onRegenerate: () => void;
}

/**
 * 간단 모드의 자막 편집.
 * 컷·소리·스타일은 이미 자동으로 맞춰져 있으니, 여기서는 글자만 고치면 된다.
 * 시작/끝 시간, 강조, 폰트 같은 건 일부러 감췄다 — 고급 편집을 켜면 나온다.
 */
export function SimpleCaptions({
  timeline,
  playhead,
  aiEnabled,
  busy,
  onSeek,
  onChange,
  onOpenSettings,
  onRegenerate,
}: Props) {
  const sorted = [...timeline.captions].sort((a, b) => a.start - b.start);
  const duration = totalDuration(timeline.clips);

  const update = (id: string, text: string) =>
    onChange(timeline.captions.map((caption) => (caption.id === id ? { ...caption, text } : caption)));

  const remove = (id: string) => onChange(timeline.captions.filter((caption) => caption.id !== id));

  const addAtPlayhead = () => {
    const start = Math.min(playhead, Math.max(0, duration - 1.5));
    onChange([
      ...timeline.captions,
      {
        id: newLocalId('cap'),
        start,
        end: Math.min(duration, start + 2),
        text: '',
        emphasis: false,
      },
    ]);
  };

  if (sorted.length === 0) {
    return (
      <div className="simple-panel">
        <div className="simple-empty">
          {aiEnabled ? (
            <>
              <strong>자막이 아직 없습니다.</strong>
              <p>영상을 보고 자막을 대신 써줄 수 있습니다.</p>
              <button type="button" className="primary" onClick={onRegenerate} disabled={busy}>
                자막 자동으로 만들기
              </button>
            </>
          ) : (
            <>
              <strong>자막을 자동으로 써주려면 설정이 필요합니다.</strong>
              <p>설정에서 API 키를 넣으면 영상을 보고 자막을 대신 써줍니다.</p>
              <button type="button" className="primary" onClick={onOpenSettings}>
                ⚙ 설정하러 가기
              </button>
            </>
          )}
          <button type="button" className="secondary" onClick={addAtPlayhead}>
            자막 직접 추가
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="simple-panel">
      <div className="simple-head">
        <div>
          <h2>자막</h2>
          <span>글자만 고치면 됩니다. 나머지는 자동이에요.</span>
        </div>
        {aiEnabled && (
          <button
            type="button"
            className="mini"
            onClick={onRegenerate}
            disabled={busy}
            title="컷과 자막을 처음부터 다시 만듭니다"
          >
            다시 만들기
          </button>
        )}
      </div>

      <ol className="simple-list">
        {sorted.map((caption, index) => {
          const active = playhead >= caption.start && playhead < caption.end;
          return (
            <li key={caption.id} className={`simple-row${active ? ' active' : ''}`}>
              <button
                type="button"
                className="simple-index"
                onClick={() => onSeek(caption.start + 0.05)}
                title="이 장면 보기"
              >
                {index + 1}
              </button>
              <textarea
                value={caption.text}
                rows={2}
                placeholder="자막을 입력하세요"
                onChange={(event) => update(caption.id, event.target.value)}
              />
              <button
                type="button"
                className="simple-remove"
                onClick={() => remove(caption.id)}
                title="이 자막 지우기"
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>

      <button type="button" className="secondary simple-add" onClick={addAtPlayhead}>
        + 지금 위치에 자막 추가
      </button>
    </div>
  );
}
