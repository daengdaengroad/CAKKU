import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, voicePreviewUrl } from '../api';
import type { SettingsView, TtsProviderName, VoiceOption, YoutubeStatus } from '../types';

interface Props {
  onBack: () => void;
  onChanged: () => void;
}

const PROVIDER_LABELS: { value: TtsProviderName; title: string; note: string }[] = [
  { value: 'none', title: '목소리 없음', note: '자막만 넣습니다. 이것만으로도 숏츠는 충분히 돌아가요' },
  { value: 'openai', title: 'OpenAI', note: '설정이 제일 간단합니다. 키 하나만 있으면 돼요' },
  { value: 'elevenlabs', title: '일레븐랩스', note: '한국어 감정 표현이 가장 자연스럽습니다' },
  { value: 'google', title: '구글', note: '유튜브 업로드와 같은 계정을 쓸 수 있지만 설정이 번거롭습니다' },
];

export function Settings({ onBack, onChanged }: Props) {
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [youtube, setYoutube] = useState<YoutubeStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setSettings(await api.getSettings());
      setYoutube(await api.youtubeStatus());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '설정을 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async (patch: Parameters<typeof api.saveSettings>[0], note = '저장했습니다.') => {
    setError(null);
    try {
      await api.saveSettings(patch);
      setMessage(note);
      await reload();
      onChanged();
      window.setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message} ${err.hint ?? ''}` : '저장하지 못했습니다.');
    }
  };

  if (!settings) {
    return <div className="loading">{error ?? '불러오는 중…'}</div>;
  }

  return (
    <div className="settings">
      <header className="settings-head">
        <button type="button" className="ghost" onClick={onBack}>
          ← 목록
        </button>
        <h1>설정</h1>
      </header>

      {message && <div className="banner ok">{message}</div>}
      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      <ScriptSection settings={settings} onSave={save} />
      <VoiceSection settings={settings} onSave={save} />
      <YoutubeSection settings={settings} status={youtube} onSave={save} onRefresh={reload} />
    </div>
  );
}

// ── 대본 ───────────────────────────────────────────────────────────
function ScriptSection({
  settings,
  onSave,
}: {
  settings: SettingsView;
  onSave: (patch: Parameters<typeof api.saveSettings>[0], note?: string) => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [model, setModel] = useState(settings.anthropic.model);

  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <h2>대본 자동 작성</h2>
        <StatusDot on={settings.anthropic.configured} />
      </div>
      <p className="settings-desc">
        영상을 보고 자막과 제목을 대신 써줍니다. 이게 이 프로그램의 핵심 기능이에요.
      </p>

      {settings.anthropic.configured ? (
        <p className="settings-current">
          지금 키: <code>{settings.anthropic.masked}</code>
          {settings.anthropic.source === 'env' && <em> (.env 파일에서 읽음)</em>}
        </p>
      ) : (
        <ol className="settings-steps">
          <li>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>{' '}
            에 가입합니다
          </li>
          <li>API Keys → Create Key 를 눌러 키를 만듭니다</li>
          <li><code>sk-ant-</code> 로 시작하는 긴 글자를 복사해 아래에 붙여넣습니다</li>
        </ol>
      )}

      <div className="settings-row">
        <input
          type="password"
          placeholder={settings.anthropic.configured ? '새 키로 바꾸려면 입력' : 'sk-ant-...'}
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <button
          type="button"
          className="primary"
          disabled={!key.trim()}
          onClick={() => {
            void onSave({ anthropicApiKey: key.trim() }, '키를 저장했습니다.');
            setKey('');
          }}
        >
          저장
        </button>
      </div>

      <label className="field">
        <span className="field-label">
          모델<em>비쌀수록 대본이 낫습니다</em>
        </span>
        <select
          value={model}
          onChange={(event) => {
            setModel(event.target.value);
            void onSave({ anthropicModel: event.target.value }, '모델을 바꿨습니다.');
          }}
        >
          <option value="claude-opus-5">가장 좋음 (한 편에 약 130원)</option>
          <option value="claude-sonnet-5">저렴함 (한 편에 약 80원)</option>
        </select>
      </label>
    </section>
  );
}

// ── 목소리 ─────────────────────────────────────────────────────────
function VoiceSection({
  settings,
  onSave,
}: {
  settings: SettingsView;
  onSave: (patch: Parameters<typeof api.saveSettings>[0], note?: string) => Promise<void>;
}) {
  const provider = settings.tts.provider;
  const [key, setKey] = useState('');
  const [credentials, setCredentials] = useState(settings.tts.google.credentials);
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const keyConfigured =
    provider === 'openai'
      ? settings.tts.openai.configured
      : provider === 'elevenlabs'
        ? settings.tts.elevenlabs.configured
        : provider === 'google'
          ? settings.tts.google.configured
          : false;

  const loadVoices = useCallback(async () => {
    if (provider === 'none') {
      setVoices(null);
      return;
    }
    setLoadingVoices(true);
    setVoiceError(null);
    try {
      const list = await api.getVoices();
      setVoices(list.voices);
    } catch (err) {
      setVoices(null);
      setVoiceError(err instanceof ApiError ? `${err.message} ${err.hint ?? ''}` : '목소리를 불러오지 못했습니다.');
    } finally {
      setLoadingVoices(false);
    }
  }, [provider]);

  useEffect(() => {
    if (keyConfigured) void loadVoices();
    else setVoices(null);
  }, [keyConfigured, loadVoices]);

  /** 미리듣기. 서버가 샘플 문장을 합성해 mp3 로 돌려준다. */
  const preview = (voiceId: string) => {
    setVoiceError(null);
    audioRef.current?.pause();

    const audio = new Audio(voicePreviewUrl(voiceId));
    audioRef.current = audio;
    setPlaying(voiceId);

    audio.addEventListener('ended', () => setPlaying(null));
    audio.addEventListener('error', () => {
      setPlaying(null);
      setVoiceError('미리듣기를 만들지 못했습니다. 키가 맞는지 확인해 주세요.');
    });
    void audio.play().catch(() => setPlaying(null));
  };

  const saveVoice = (voiceId: string) => {
    const patch =
      provider === 'openai'
        ? { openaiVoice: voiceId }
        : provider === 'elevenlabs'
          ? { elevenlabsVoiceId: voiceId }
          : { googleVoice: voiceId };
    void onSave(patch, '목소리를 바꿨습니다.');
  };

  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <h2>내레이션 목소리</h2>
        <StatusDot on={provider !== 'none' && keyConfigured} />
      </div>
      <p className="settings-desc">
        대본을 읽어주는 목소리입니다. 안 켜도 자막은 그대로 들어갑니다.
      </p>

      <div className="provider-list">
        {PROVIDER_LABELS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`provider-option${provider === option.value ? ' selected' : ''}`}
            onClick={() => void onSave({ ttsProvider: option.value }, `${option.title} 로 바꿨습니다.`)}
          >
            <strong>{option.title}</strong>
            <span>{option.note}</span>
          </button>
        ))}
      </div>

      {provider === 'google' && (
        <>
          <ol className="settings-steps">
            <li>구글 클라우드 콘솔에서 <b>Cloud Text-to-Speech API</b> 를 사용 설정합니다</li>
            <li>서비스 계정을 만들고 <b>JSON 키</b>를 내려받습니다</li>
            <li>그 파일의 전체 경로를 아래에 붙여넣습니다</li>
          </ol>
          <div className="settings-row">
            <input
              type="text"
              placeholder="C:\\Users\\나\\Downloads\\key.json"
              value={credentials}
              onChange={(event) => setCredentials(event.target.value)}
            />
            <button
              type="button"
              className="primary"
              disabled={!credentials.trim()}
              onClick={() => void onSave({ googleCredentials: credentials.trim() }, '경로를 저장했습니다.')}
            >
              저장
            </button>
          </div>
        </>
      )}

      {(provider === 'openai' || provider === 'elevenlabs') && (
        <>
          {!keyConfigured && (
            <ol className="settings-steps">
              {provider === 'openai' ? (
                <>
                  <li>
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                      platform.openai.com/api-keys
                    </a>{' '}
                    에서 키를 만듭니다
                  </li>
                  <li>결제 수단을 등록해야 쓸 수 있습니다</li>
                </>
              ) : (
                <>
                  <li>
                    <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer">
                      elevenlabs.io
                    </a>{' '}
                    에 가입하고 API 키를 만듭니다
                  </li>
                  <li>무료 요금제로도 한 달에 몇 편은 만들 수 있습니다</li>
                </>
              )}
            </ol>
          )}

          <p className="settings-current">
            {keyConfigured ? (
              <>
                지금 키:{' '}
                <code>
                  {provider === 'openai' ? settings.tts.openai.masked : settings.tts.elevenlabs.masked}
                </code>
              </>
            ) : (
              '아직 키가 없습니다.'
            )}
          </p>

          <div className="settings-row">
            <input
              type="password"
              placeholder={keyConfigured ? '새 키로 바꾸려면 입력' : 'API 키 붙여넣기'}
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <button
              type="button"
              className="primary"
              disabled={!key.trim()}
              onClick={() => {
                const patch =
                  provider === 'openai'
                    ? { openaiApiKey: key.trim() }
                    : { elevenlabsApiKey: key.trim() };
                void onSave(patch, '키를 저장했습니다.');
                setKey('');
              }}
            >
              저장
            </button>
          </div>
        </>
      )}

      {provider !== 'none' && (
        <div className="voice-area">
          <div className="settings-card-head">
            <h3>목소리 고르기</h3>
            <button type="button" className="mini" onClick={() => void loadVoices()} disabled={loadingVoices}>
              {loadingVoices ? '불러오는 중…' : '다시 불러오기'}
            </button>
          </div>

          {voiceError && <p className="banner error">{voiceError}</p>}

          {voices && voices.length > 0 ? (
            <ul className="voice-list">
              {voices.map((voice) => {
                const selected = voice.id === settings.tts.voiceId;
                return (
                  <li key={voice.id} className={`voice-row${selected ? ' selected' : ''}`}>
                    <button
                      type="button"
                      className="voice-play"
                      onClick={() => preview(voice.id)}
                      title="들어보기"
                    >
                      {playing === voice.id ? '❚❚' : '▶'}
                    </button>
                    <div className="voice-name">
                      <strong>{voice.label}</strong>
                      {voice.note && <span>{voice.note}</span>}
                    </div>
                    <button
                      type="button"
                      className={selected ? 'mini' : 'mini pick'}
                      onClick={() => saveVoice(voice.id)}
                      disabled={selected}
                    >
                      {selected ? '사용 중' : '이걸로'}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            !voiceError && <p className="empty">키를 저장하면 고를 수 있는 목소리가 여기에 나옵니다.</p>
          )}
        </div>
      )}
    </section>
  );
}

// ── 유튜브 ─────────────────────────────────────────────────────────
function YoutubeSection({
  settings,
  status,
  onSave,
  onRefresh,
}: {
  settings: SettingsView;
  status: YoutubeStatus | null;
  onSave: (patch: Parameters<typeof api.saveSettings>[0], note?: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <h2>유튜브 자동 업로드</h2>
        <StatusDot on={Boolean(status?.connected)} />
      </div>
      <p className="settings-desc">
        안 켜도 됩니다. 완성된 영상 파일을 내려받아 직접 올려도 똑같아요.
      </p>

      {!settings.youtube.configured && (
        <ol className="settings-steps">
          <li>
            <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer">
              구글 클라우드 콘솔
            </a>{' '}
            에서 프로젝트를 만듭니다
          </li>
          <li><b>YouTube Data API v3</b> 를 사용 설정합니다</li>
          <li>OAuth 동의 화면을 구성하고 본인 계정을 테스트 사용자로 넣습니다</li>
          <li>
            사용자 인증 정보 → OAuth 클라이언트 ID → <b>웹 애플리케이션</b> 을 만들고,
            리디렉션 URI 에 <code>{settings.youtube.redirectUri}</code> 를 넣습니다
          </li>
        </ol>
      )}

      {settings.youtube.configured ? (
        <p className="settings-current">
          클라이언트 ID: <code>{settings.youtube.clientIdMasked}</code>
        </p>
      ) : null}

      <div className="settings-row">
        <input
          type="text"
          placeholder="클라이언트 ID"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        />
      </div>
      <div className="settings-row">
        <input
          type="password"
          placeholder="클라이언트 보안 비밀"
          value={clientSecret}
          onChange={(event) => setClientSecret(event.target.value)}
        />
        <button
          type="button"
          className="primary"
          disabled={!clientId.trim() || !clientSecret.trim()}
          onClick={() => {
            void onSave(
              { youtubeClientId: clientId.trim(), youtubeClientSecret: clientSecret.trim() },
              '유튜브 설정을 저장했습니다.',
            );
            setClientId('');
            setClientSecret('');
          }}
        >
          저장
        </button>
      </div>

      {settings.youtube.configured && (
        <div className="button-row">
          {status?.connected ? (
            <>
              <span className="settings-current">
                연결된 채널: <strong>{status.channel?.title}</strong>
              </span>
              <button
                type="button"
                className="mini danger"
                onClick={() => void api.youtubeDisconnect().then(onRefresh)}
              >
                연결 해제
              </button>
            </>
          ) : (
            <a className="button primary" href="/api/youtube/auth">
              유튜브 계정 연결하기
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function StatusDot({ on }: { on: boolean }) {
  return <span className={`status-dot${on ? ' on' : ''}`}>{on ? '켜짐' : '꺼짐'}</span>;
}
