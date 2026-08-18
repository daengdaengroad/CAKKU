import { useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { ColorField, Field, NumberField, SelectField, SliderField, ToggleField } from './fields';
import { layoutClips, newLocalId, totalDuration } from '../timelineUtils';
import type { Selection } from './TimelineStrip';
import type {
  BuildOptions,
  Caption,
  Clip,
  NarrationLine,
  Persona,
  ScriptOptions,
  Timeline,
  Tone,
} from '../types';

// ── 자막 ───────────────────────────────────────────────────────────
export function CaptionPanel({
  timeline,
  playhead,
  selection,
  onSelect,
  onSeek,
  onChange,
}: {
  timeline: Timeline;
  playhead: number;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onSeek: (time: number) => void;
  onChange: (captions: Caption[]) => void;
}) {
  const duration = totalDuration(timeline.clips);
  const sorted = [...timeline.captions].sort((a, b) => a.start - b.start);

  const update = (id: string, patch: Partial<Caption>) =>
    onChange(timeline.captions.map((caption) => (caption.id === id ? { ...caption, ...patch } : caption)));

  const addAtPlayhead = () => {
    const start = Math.min(playhead, Math.max(0, duration - 1.5));
    const caption: Caption = {
      id: newLocalId('cap'),
      start,
      end: Math.min(duration, start + 2),
      text: '새 자막',
      emphasis: false,
    };
    onChange([...timeline.captions, caption]);
    onSelect({ type: 'caption', id: caption.id });
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>자막</h3>
        <button type="button" onClick={addAtPlayhead} disabled={duration <= 0}>
          + 현재 위치에 추가
        </button>
      </div>

      {sorted.length === 0 && <p className="empty">자막이 없습니다. 자동 편집을 실행하거나 직접 추가하세요.</p>}

      <ul className="row-list">
        {sorted.map((caption) => {
          const selected = selection?.type === 'caption' && selection.id === caption.id;
          return (
            <li
              key={caption.id}
              className={`row${selected ? ' selected' : ''}`}
              onFocus={() => onSelect({ type: 'caption', id: caption.id })}
            >
              <textarea
                value={caption.text}
                rows={2}
                onChange={(event) => update(caption.id, { text: event.target.value })}
              />
              <div className="row-controls">
                <button type="button" className="mini" onClick={() => onSeek(caption.start)}>
                  ▶ {caption.start.toFixed(1)}초
                </button>
                <label className="mini-toggle">
                  <input
                    type="checkbox"
                    checked={caption.emphasis}
                    onChange={(event) => update(caption.id, { emphasis: event.target.checked })}
                  />
                  강조
                </label>
                <span className="row-length">{(caption.end - caption.start).toFixed(1)}초</span>
                <button
                  type="button"
                  className="mini danger"
                  onClick={() => onChange(timeline.captions.filter((c) => c.id !== caption.id))}
                >
                  삭제
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── 컷 ─────────────────────────────────────────────────────────────
export function ClipPanel({
  timeline,
  playhead,
  selection,
  onSelect,
  onClipsChange,
}: {
  timeline: Timeline;
  playhead: number;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onClipsChange: (clips: Clip[]) => void;
}) {
  const slots = layoutClips(timeline.clips);
  const selectedId = selection?.type === 'clip' ? selection.id : null;
  const selectedSlot = slots.find((slot) => slot.clip.id === selectedId) ?? slots[0] ?? null;

  if (!selectedSlot) {
    return (
      <div className="panel">
        <h3>컷</h3>
        <p className="empty">클립이 없습니다.</p>
      </div>
    );
  }

  const clip = selectedSlot.clip;
  const index = selectedSlot.index;

  const update = (patch: Partial<Clip>) =>
    onClipsChange(timeline.clips.map((c) => (c.id === clip.id ? { ...c, ...patch } : c)));

  const move = (direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= timeline.clips.length) return;
    const next = [...timeline.clips];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    onClipsChange(next);
  };

  const splitAtPlayhead = () => {
    // 재생 위치가 이 클립 안에 있어야 나눌 수 있다.
    if (playhead <= selectedSlot.start + 0.3 || playhead >= selectedSlot.end - 0.3) return;
    const cutPoint = clip.in + (playhead - selectedSlot.start) * clip.speed;
    const first: Clip = { ...clip, out: cutPoint };
    const second: Clip = { ...clip, id: newLocalId('clip'), in: cutPoint };
    const next = [...timeline.clips];
    next.splice(index, 1, first, second);
    onClipsChange(next);
  };

  const canSplit = playhead > selectedSlot.start + 0.3 && playhead < selectedSlot.end - 0.3;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>
          컷 {index + 1} / {timeline.clips.length}
        </h3>
        <div className="button-row">
          <button type="button" className="mini" onClick={() => move(-1)} disabled={index === 0}>
            ← 앞으로
          </button>
          <button
            type="button"
            className="mini"
            onClick={() => move(1)}
            disabled={index === timeline.clips.length - 1}
          >
            뒤로 →
          </button>
        </div>
      </div>

      <div className="clip-picker">
        {slots.map((slot) => (
          <button
            key={slot.clip.id}
            type="button"
            className={`clip-chip${slot.clip.id === clip.id ? ' selected' : ''}`}
            onClick={() => onSelect({ type: 'clip', id: slot.clip.id })}
          >
            {slot.index + 1}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <NumberField
          label="원본 시작"
          value={clip.in}
          step={0.1}
          min={0}
          suffix="초"
          onChange={(value) => update({ in: Math.min(value, clip.out - 0.3) })}
        />
        <NumberField
          label="원본 끝"
          value={clip.out}
          step={0.1}
          suffix="초"
          onChange={(value) => update({ out: Math.max(value, clip.in + 0.3) })}
        />
      </div>

      <SliderField
        label="배속"
        value={clip.speed}
        min={0.25}
        max={3}
        step={0.05}
        format={(v) => `${v.toFixed(2)}배`}
        onChange={(value) => update({ speed: value })}
      />

      <SliderField
        label="원본 소리"
        value={clip.volume}
        min={0}
        max={1.5}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(value) => update({ volume: value })}
      />

      <SelectField
        label="화면 채우기"
        value={clip.framing.mode}
        options={[
          { value: 'cover', label: '꽉 채우기 (잘림)' },
          { value: 'blur', label: '흐린 배경 (안 잘림)' },
          { value: 'contain', label: '검은 여백' },
        ]}
        onChange={(mode) => update({ framing: { ...clip.framing, mode } })}
      />

      <SliderField
        label="가로 위치"
        value={clip.framing.offsetX}
        min={-1}
        max={1}
        step={0.02}
        onChange={(offsetX) => update({ framing: { ...clip.framing, offsetX } })}
      />
      <SliderField
        label="세로 위치"
        value={clip.framing.offsetY}
        min={-1}
        max={1}
        step={0.02}
        onChange={(offsetY) => update({ framing: { ...clip.framing, offsetY } })}
      />
      <SliderField
        label="확대"
        value={clip.framing.zoom}
        min={1}
        max={2.5}
        step={0.02}
        format={(v) => `${v.toFixed(2)}배`}
        onChange={(zoom) => update({ framing: { ...clip.framing, zoom } })}
      />

      <div className="button-row">
        <button type="button" onClick={splitAtPlayhead} disabled={!canSplit}>
          현재 위치에서 나누기
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => onClipsChange(timeline.clips.filter((c) => c.id !== clip.id))}
          disabled={timeline.clips.length <= 1}
        >
          이 컷 삭제
        </button>
      </div>
    </div>
  );
}

// ── 내레이션 ───────────────────────────────────────────────────────
export function NarrationPanel({
  projectId,
  timeline,
  ttsEnabled,
  busy,
  onChange,
  onMusicChange,
  onRenarrate,
  onSeek,
}: {
  projectId: string;
  timeline: Timeline;
  ttsEnabled: boolean;
  busy: boolean;
  onChange: (narration: NarrationLine[]) => void;
  onMusicChange: (music: Timeline['music']) => void;
  onRenarrate: () => void;
  onSeek: (time: number) => void;
}) {
  const update = (id: string, patch: Partial<NarrationLine>) =>
    onChange(timeline.narration.map((line) => (line.id === id ? { ...line, ...patch } : line)));

  const pending = timeline.narration.filter((line) => line.text.trim() && !line.audioFile).length;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>내레이션</h3>
        <button type="button" onClick={onRenarrate} disabled={!ttsEnabled || busy}>
          목소리 다시 만들기
        </button>
      </div>

      {!ttsEnabled && (
        <p className="empty">
          TTS 설정이 없어 목소리는 들어가지 않습니다. 자막만으로도 숏츠는 충분히 돌아갑니다.
        </p>
      )}
      {ttsEnabled && pending > 0 && (
        <p className="notice">고친 문장 {pending}개는 아직 목소리가 없습니다. 다시 만들기를 눌러주세요.</p>
      )}

      <ul className="row-list">
        {timeline.narration.map((line) => (
          <li key={line.id} className="row">
            <textarea
              value={line.text}
              rows={2}
              onChange={(event) =>
                // 문장을 고치면 기존 음성은 더 이상 맞지 않으므로 연결을 끊는다.
                update(line.id, { text: event.target.value, audioFile: null, durationSec: null })
              }
            />
            <div className="row-controls">
              <button type="button" className="mini" onClick={() => onSeek(line.start)}>
                ▶ {line.start.toFixed(1)}초
              </button>
              <span className="row-length">
                {line.durationSec ? `${line.durationSec.toFixed(1)}초` : '음성 없음'}
              </span>
              <button
                type="button"
                className="mini danger"
                onClick={() => onChange(timeline.narration.filter((l) => l.id !== line.id))}
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>

      {timeline.narration.length === 0 && <p className="empty">내레이션이 없습니다.</p>}

      <hr />

      <MusicSection projectId={projectId} timeline={timeline} onChange={onMusicChange} />
    </div>
  );
}

/** 배경음악. 영상보다 짧으면 렌더링할 때 반복 재생된다. */
function MusicSection({
  projectId,
  timeline,
  onChange,
}: {
  projectId: string;
  timeline: Timeline;
  onChange: (music: Timeline['music']) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const music = timeline.music;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { file: relativePath } = await api.uploadMusic(projectId, file);
      onChange({
        file: relativePath,
        // 내레이션과 원본 소리를 덮지 않도록 낮게 시작한다.
        gain: music?.gain ?? 0.18,
        fadeInSec: 0.6,
        fadeOutSec: 1.2,
      });
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message} ${err.hint ?? ''}` : '올리지 못했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="panel-head">
        <h3>배경음악</h3>
        <button type="button" className="mini" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? '올리는 중…' : music ? '바꾸기' : '+ 음악 넣기'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {error && <p className="banner error">{error}</p>}

      {music ? (
        <>
          <p className="empty">{music.file.split('/').pop()}</p>
          <SliderField
            label="음량"
            value={music.gain}
            min={0}
            max={0.6}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(gain) => onChange({ ...music, gain })}
          />
          <button type="button" className="mini danger" onClick={() => onChange(null)}>
            음악 빼기
          </button>
        </>
      ) : (
        <p className="empty">
          저작권 걱정 없는 음원을 쓰세요. 유튜브 오디오 보관함에서 받은 파일이면 안전합니다.
        </p>
      )}
    </>
  );
}

// ── 자막 스타일 ────────────────────────────────────────────────────
export function StylePanel({
  timeline,
  fonts,
  onChange,
}: {
  timeline: Timeline;
  fonts: string[];
  onChange: (style: Timeline['style']) => void;
}) {
  const style = timeline.style;
  const update = (patch: Partial<Timeline['style']>) => onChange({ ...style, ...patch });

  return (
    <div className="panel">
      <h3>자막 스타일</h3>

      <SelectField
        label="폰트"
        value={style.fontFamily || (fonts[0] ?? '')}
        options={fonts.map((family) => ({ value: family, label: family }))}
        onChange={(fontFamily) => update({ fontFamily })}
      />

      <SliderField
        label="글자 크기"
        value={style.fontSizeRatio}
        min={0.025}
        max={0.09}
        step={0.002}
        format={(v) => `${Math.round(v * timeline.canvas.height)}px`}
        onChange={(fontSizeRatio) => update({ fontSizeRatio })}
      />

      <SelectField
        label="위치"
        value={style.position}
        options={[
          { value: 'bottom', label: '아래' },
          { value: 'middle', label: '가운데' },
          { value: 'top', label: '위' },
        ]}
        onChange={(position) => update({ position })}
      />

      <SliderField
        label="가장자리 여백"
        value={style.marginRatio}
        min={0.02}
        max={0.4}
        step={0.01}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(marginRatio) => update({ marginRatio })}
      />

      <div className="grid-2">
        <ColorField label="글자색" value={style.color} onChange={(color) => update({ color })} />
        <ColorField
          label="테두리색"
          value={style.outlineColor}
          onChange={(outlineColor) => update({ outlineColor })}
        />
      </div>

      <SliderField
        label="테두리 두께"
        value={style.outlineWidth}
        min={0}
        max={14}
        step={0.5}
        onChange={(outlineWidth) => update({ outlineWidth })}
      />

      <ToggleField label="굵게" value={style.bold} onChange={(bold) => update({ bold })} />

      <ToggleField
        label="자막 뒤 박스"
        value={style.boxColor !== null}
        onChange={(on) => update({ boxColor: on ? '#000000' : null })}
      />
      {style.boxColor !== null && (
        <div className="grid-2">
          <ColorField
            label="박스색"
            value={style.boxColor}
            onChange={(boxColor) => update({ boxColor })}
          />
          <SliderField
            label="박스 투명도"
            value={style.boxOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(boxOpacity) => update({ boxOpacity })}
          />
        </div>
      )}
    </div>
  );
}

// ── 유튜브 정보 ────────────────────────────────────────────────────
export function MetaPanel({
  timeline,
  onChange,
}: {
  timeline: Timeline;
  onChange: (meta: Timeline['meta']) => void;
}) {
  const meta = timeline.meta;

  return (
    <div className="panel">
      <h3>유튜브 정보</h3>

      <Field label="제목" hint={`${meta.title.length}/100`}>
        <input
          type="text"
          value={meta.title}
          maxLength={100}
          onChange={(event) => onChange({ ...meta, title: event.target.value })}
        />
      </Field>

      <Field label="설명">
        <textarea
          rows={5}
          value={meta.description}
          onChange={(event) => onChange({ ...meta, description: event.target.value })}
        />
      </Field>

      <Field label="태그" hint="쉼표로 구분">
        <input
          type="text"
          value={meta.tags.join(', ')}
          onChange={(event) =>
            onChange({
              ...meta,
              tags: event.target.value
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
    </div>
  );
}

// ── 자동 편집 설정 ─────────────────────────────────────────────────
export function AutoPanel({
  projectId,
  sourceCount,
  buildOptions,
  scriptOptions,
  aiEnabled,
  busy,
  onBuildChange,
  onScriptChange,
  onRun,
  onSourcesAdded,
}: {
  projectId: string;
  sourceCount: number;
  buildOptions: BuildOptions;
  scriptOptions: ScriptOptions;
  aiEnabled: boolean;
  busy: boolean;
  onBuildChange: (options: BuildOptions) => void;
  onScriptChange: (options: ScriptOptions) => void;
  onRun: (writeScript: boolean) => void;
  onSourcesAdded: () => void;
}) {
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [adding, setAdding] = useState(false);

  const addVideos = async (files: File[]) => {
    if (files.length === 0) return;
    setAdding(true);
    try {
      await api.uploadSources(projectId, files, false);
      onSourcesAdded();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>원본 영상 {sourceCount}개</h3>
        <button
          type="button"
          className="mini"
          onClick={() => videoInputRef.current?.click()}
          disabled={busy || adding}
        >
          {adding ? '올리는 중…' : '+ 영상 추가'}
        </button>
      </div>
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(event) => {
          void addVideos([...(event.target.files ?? [])]);
          event.target.value = '';
        }}
      />
      <p className="empty">
        영상을 추가한 뒤 아래 "컷 + 대본 다시 만들기"를 누르면 전부 합쳐 다시 편집합니다.
      </p>

      <hr />

      <h3>자동 편집 설정</h3>

      <SliderField
        label="목표 길이"
        value={buildOptions.targetSec}
        min={8}
        max={60}
        step={1}
        format={(v) => `${Math.round(v)}초`}
        onChange={(targetSec) => onBuildChange({ ...buildOptions, targetSec })}
      />
      <SliderField
        label="컷 하나 최대 길이"
        value={buildOptions.maxClipSec}
        min={1}
        max={10}
        step={0.5}
        format={(v) => `${v.toFixed(1)}초`}
        onChange={(maxClipSec) => onBuildChange({ ...buildOptions, maxClipSec })}
      />
      <SelectField
        label="기본 화면 채우기"
        value={buildOptions.framingMode}
        options={[
          { value: 'cover', label: '꽉 채우기' },
          { value: 'blur', label: '흐린 배경' },
          { value: 'contain', label: '검은 여백' },
        ]}
        onChange={(framingMode) => onBuildChange({ ...buildOptions, framingMode })}
      />

      <hr />

      <Field label="강아지 이름">
        <input
          type="text"
          value={scriptOptions.dogName}
          placeholder="예: 콩이"
          onChange={(event) => onScriptChange({ ...scriptOptions, dogName: event.target.value })}
        />
      </Field>
      <Field label="견종">
        <input
          type="text"
          value={scriptOptions.dogBreed}
          placeholder="예: 포메라니안"
          onChange={(event) => onScriptChange({ ...scriptOptions, dogBreed: event.target.value })}
        />
      </Field>

      <SelectField<Tone>
        label="말투"
        value={scriptOptions.tone}
        options={[
          { value: 'cute', label: '귀엽게' },
          { value: 'funny', label: '웃기게' },
          { value: 'emotional', label: '감성적으로' },
          { value: 'informative', label: '담백하게' },
        ]}
        onChange={(tone) => onScriptChange({ ...scriptOptions, tone })}
      />

      <SelectField<Persona>
        label="화자"
        value={scriptOptions.persona}
        options={[
          { value: 'dog', label: '강아지 1인칭' },
          { value: 'owner', label: '보호자 시점' },
          { value: 'narrator', label: '내레이터' },
        ]}
        onChange={(persona) => onScriptChange({ ...scriptOptions, persona })}
      />

      <Field label="배경 설명" hint="영상만 봐서는 모를 내용">
        <textarea
          rows={3}
          value={scriptOptions.context}
          placeholder="예: 오늘 처음 바다에 데려갔어요"
          onChange={(event) => onScriptChange({ ...scriptOptions, context: event.target.value })}
        />
      </Field>

      <ToggleField
        label="내레이션 대본도 쓰기"
        value={scriptOptions.withNarration}
        onChange={(withNarration) => onScriptChange({ ...scriptOptions, withNarration })}
      />

      <div className="button-row">
        <button type="button" onClick={() => onRun(true)} disabled={busy || !aiEnabled}>
          컷 + 대본 다시 만들기
        </button>
        <button type="button" className="secondary" onClick={() => onRun(false)} disabled={busy}>
          컷만 다시 잡기
        </button>
      </div>

      {!aiEnabled && (
        <p className="empty">
          .env 에 ANTHROPIC_API_KEY 를 넣으면 대본을 자동으로 써줍니다. 지금은 컷만 잡을 수 있어요.
        </p>
      )}
    </div>
  );
}
