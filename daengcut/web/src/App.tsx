import { useEffect, useState } from 'react';
import { api } from './api';
import { Editor } from './components/Editor';
import { ProjectList } from './components/ProjectList';
import type { Health } from './types';

/**
 * 서버가 가진 자막 폰트를 브라우저에도 심는다.
 * 미리보기와 실제 렌더 결과의 글자 모양이 달라지면 자막 위치를 잡을 수 없다.
 */
function injectFontFaces(families: string[]) {
  const id = 'daengcut-fonts';
  document.getElementById(id)?.remove();

  const style = document.createElement('style');
  style.id = id;
  style.textContent = families
    .map(
      (family) =>
        `@font-face{font-family:'${family}';` +
        `src:url('/api/fonts/file?family=${encodeURIComponent(family)}');` +
        `font-weight:100 900;font-display:swap;}`,
    )
    .join('\n');
  document.head.append(style);
}

/** 주소창의 #프로젝트ID 로 화면을 정한다. 라우터를 따로 두기엔 화면이 둘뿐이다. */
function projectIdFromHash(): string | null {
  const hash = window.location.hash.replace('#', '').trim();
  return hash || null;
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [fonts, setFonts] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string | null>(projectIdFromHash());

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    api
      .fonts()
      .then((list) => {
        const families = list.map((font) => font.family);
        setFonts(families);
        injectFontFaces(families);
      })
      .catch(() => setFonts([]));
  }, []);

  useEffect(() => {
    const onHashChange = () => setProjectId(projectIdFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const open = (id: string) => {
    window.location.hash = id;
    setProjectId(id);
  };

  const back = () => {
    window.location.hash = '';
    setProjectId(null);
  };

  if (!health) {
    return <div className="loading">서버에 연결하는 중…</div>;
  }

  return projectId ? (
    <Editor projectId={projectId} health={health} fonts={fonts} onBack={back} />
  ) : (
    <ProjectList health={health} onOpen={open} />
  );
}
