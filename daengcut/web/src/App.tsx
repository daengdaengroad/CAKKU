import { useEffect, useState } from 'react';
import { api } from './api';
import { Editor } from './components/Editor';
import { ProjectList } from './components/ProjectList';
import { Settings } from './components/Settings';
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

/** 주소창의 해시로 화면을 정한다. 라우터를 따로 두기엔 화면이 몇 개 안 된다. */
function routeFromHash(): { name: 'list' } | { name: 'settings' } | { name: 'project'; id: string } {
  const hash = window.location.hash.replace('#', '').trim();
  if (!hash) return { name: 'list' };
  if (hash === 'settings') return { name: 'settings' };
  return { name: 'project', id: hash };
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [fonts, setFonts] = useState<string[]>([]);
  const [route, setRoute] = useState(routeFromHash());

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
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const go = (hash: string) => {
    window.location.hash = hash;
    setRoute(routeFromHash());
  };

  /** 설정을 바꾸면 어떤 기능이 켜졌는지 다시 확인한다. */
  const refreshHealth = () => {
    api.health().then(setHealth).catch(() => undefined);
  };

  if (!health) {
    return <div className="loading">서버에 연결하는 중…</div>;
  }

  if (route.name === 'settings') {
    return <Settings onBack={() => go('')} onChanged={refreshHealth} />;
  }

  if (route.name === 'project') {
    return (
      <Editor
        projectId={route.id}
        health={health}
        fonts={fonts}
        onBack={() => go('')}
        onOpenSettings={() => go('settings')}
      />
    );
  }

  return <ProjectList health={health} onOpen={(id) => go(id)} onOpenSettings={() => go('settings')} />;
}
