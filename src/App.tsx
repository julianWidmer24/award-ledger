import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Screen } from './data';
import { isConfigured } from './lib/supabase';
import { StoreProvider, usePref, useStore } from './store';
import { Avatar, MoonIcon, SunIcon } from './components/ui';
import { AuthScreen } from './auth/AuthScreen';
import { ResetPassword } from './auth/ResetPassword';
import { Onboarding } from './onboarding/Onboarding';
import { Setup } from './screens/Setup';
import { Dashboard } from './screens/Dashboard';
import { LogSession } from './screens/LogSession';
import { Goals } from './screens/Goals';
import { Expedition } from './screens/Expedition';
import { Friends } from './screens/Friends';
import { RecordBook } from './screens/RecordBook';
import { Settings } from './screens/Settings';
import { Resources } from './screens/Resources';

const NAV: [Screen, string][] = [
  ['dash', 'Dashboard'], ['log', 'Log'], ['goals', 'Goals'], ['exp', 'Expedition'], ['friends', 'Friends'], ['book', 'Record book'], ['resources', 'Resources'],
];
const SCREENS: Screen[] = [...NAV.map(n => n[0]), 'settings'];

const screenFromHash = (): Screen => {
  const h = window.location.hash.replace(/^#\/?/, '') as Screen;
  return SCREENS.includes(h) ? h : 'dash';
};

/** Current screen, mirrored in the URL hash so reloads and back/forward work. */
function useScreen(): [Screen, (s: Screen) => void] {
  const [screen, setScreen] = useState<Screen>(screenFromHash);
  useEffect(() => {
    const onHash = () => setScreen(screenFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((s: Screen) => {
    window.location.hash = s === 'dash' ? '' : `/${s}`;
    setScreen(s);
    window.scrollTo({ top: 0 });
  }, []);
  return [screen, go];
}

export interface ScreenProps { go: (s: Screen) => void }

export function App() {
  const [theme, setTheme] = usePref<'light' | 'dark'>('theme', 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  return (
    <div className="app" data-theme={theme}>
      {isConfigured ? <StoreProvider><Shell theme={theme} setTheme={setTheme} /></StoreProvider> : <Setup />}
    </div>
  );
}

function Shell({ theme, setTheme }: { theme: 'light' | 'dark'; setTheme: (t: 'light' | 'dark') => void }) {
  const { session, authReady, recovering, setRecovering, snapshot, loading, error, reload, api } = useStore();
  const [screen, go] = useScreen();
  const dark = theme === 'dark';
  const [replayTour, setReplayTour] = useState(false);

  const themeButton = (
    <button className="btn btn-secondary btn-icon" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );

  if (!authReady) return <Centered>Loading…</Centered>;
  if (!session) return <><div className="floating-theme">{themeButton}</div><AuthScreen /></>;
  if (recovering) return <><div className="floating-theme">{themeButton}</div><ResetPassword onDone={() => { setRecovering(false); go('dash'); }} /></>;
  if (error) return <Centered><p>Couldn't load your data: {error}</p><button className="btn btn-primary" onClick={() => void reload()}>Try again</button> <button className="btn btn-secondary" onClick={() => void api.signOut()}>Sign out</button></Centered>;
  if (!snapshot) return <Centered>Loading your ledger…</Centered>;
  if (!snapshot.profile.onboarded_at || replayTour) {
    return <><div className="floating-theme">{themeButton}</div><Onboarding onDone={() => { setReplayTour(false); go('dash'); }} replay={replayTour} /></>;
  }

  return (
    <>
      <header className="nav app-nav">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="brand-dot" />Award Ledger</div>
        <nav className="links" aria-label="Main">
          {NAV.map(([key, label]) => (
            <a key={key} href={key === 'dash' ? '#' : `#/${key}`} aria-current={screen === key ? 'page' : undefined} onClick={e => { e.preventDefault(); go(key); }}>{label}</a>
          ))}
        </nav>
        {themeButton}
        <button className="avatar-btn" onClick={() => go('settings')} aria-label="Settings and profile" aria-current={screen === 'settings' ? 'page' : undefined} title="Settings">
          <Avatar name={snapshot.profile.display_name} url={snapshot.profile.avatar_url} size={36} style={{ background: 'transparent' }} />
        </button>
        <button className="btn btn-primary" onClick={() => go('log')}>Log activity</button>
      </header>
      <main className="app-main" aria-busy={loading}>
        {screen === 'dash' && <Dashboard go={go} />}
        {screen === 'log' && <LogSession go={go} />}
        {screen === 'goals' && <Goals go={go} />}
        {screen === 'exp' && <Expedition go={go} />}
        {screen === 'friends' && <Friends go={go} />}
        {screen === 'book' && <RecordBook go={go} />}
        {screen === 'resources' && <Resources go={go} />}
        {screen === 'settings' && <Settings go={go} onReplayTour={() => setReplayTour(true)} />}
      </main>
    </>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '60vh', display: 'grid', placeContent: 'center', textAlign: 'center', gap: 12, padding: 'var(--space-6)' }} className="text-muted">{children}</div>;
}
