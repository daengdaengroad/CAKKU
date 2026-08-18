import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import { SelectField, ToggleField } from './fields';
import type { YoutubeStatus } from '../types';

interface Props {
  projectId: string;
  title: string;
  durationSec: number;
  onClose: () => void;
}

export function YoutubeDialog({ projectId, title, durationSec, onClose }: Props) {
  const [status, setStatus] = useState<YoutubeStatus | null>(null);
  const [privacyStatus, setPrivacy] = useState<'private' | 'unlisted' | 'public'>('private');
  const [madeForKids, setMadeForKids] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api
      .youtubeStatus()
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false, channel: null }));
  }, []);

  const tooLong = durationSec > 60;

  const upload = async () => {
    setSending(true);
    setError(null);
    try {
      await api.youtubeUpload(projectId, { privacyStatus, madeForKids });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message} ${err.hint ?? ''}` : '업로드에 실패했습니다.');
      setSending(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3>유튜브에 올리기</h3>
        <p className="modal-title">{title}</p>

        {!status && <p className="empty">연결 상태 확인 중…</p>}

        {status && !status.configured && (
          <p className="empty">
            .env 에 YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 을 넣어야 업로드할 수 있습니다.
            지금은 영상 파일을 내려받아 직접 올려주세요.
          </p>
        )}

        {status?.configured && !status.connected && (
          <div className="connect-box">
            <p>유튜브 계정을 아직 연결하지 않았습니다.</p>
            <a className="button primary" href="/api/youtube/auth">
              유튜브 계정 연결하기
            </a>
          </div>
        )}

        {status?.connected && (
          <>
            <p className="channel">
              업로드 채널: <strong>{status.channel?.title}</strong>
            </p>

            {tooLong && (
              <p className="notice">
                {durationSec.toFixed(0)}초라 숏츠로 잡히지 않을 수 있습니다. 60초 이하로 줄이는 걸 권합니다.
              </p>
            )}

            <SelectField
              label="공개 범위"
              value={privacyStatus}
              options={[
                { value: 'private', label: '비공개 (나만 보기)' },
                { value: 'unlisted', label: '일부 공개 (링크 아는 사람)' },
                { value: 'public', label: '전체 공개' },
              ]}
              onChange={setPrivacy}
            />

            <ToggleField
              label="아동용 콘텐츠입니다"
              value={madeForKids}
              onChange={setMadeForKids}
              hint="유튜브 필수 항목"
            />

            {error && <p className="banner error">{error}</p>}

            <div className="button-row">
              <button type="button" className="secondary" onClick={onClose}>
                취소
              </button>
              <button type="button" className="primary" onClick={() => void upload()} disabled={sending}>
                {sending ? '올리는 중…' : '올리기'}
              </button>
            </div>

            <button
              type="button"
              className="mini"
              onClick={() => void api.youtubeDisconnect().then(() => setStatus(null))}
            >
              계정 연결 해제
            </button>
          </>
        )}

        {status && !status.connected && (
          <div className="button-row">
            <button type="button" className="secondary" onClick={onClose}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
