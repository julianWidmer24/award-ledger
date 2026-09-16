import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Screen } from './data';
import { isConfigured } from './lib/supabase';
import { StoreProvider, usePref, useStore } from './store';
import { Avatar, Logo, MoonIcon, SunIcon } from './components/ui';
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
import { FriendProfileScreen } from './screens/FriendProfile';

const NAV: [Screen, string][] = [
  ['dash', 'Dashboard'], ['log', 'Log'], ['goals', 'Goals'], ['exp', 'Expedition'], ['friends', 'Friends'], ['book', 'Record book'], ['resources', 'Resources'],
];
const SCREENS: Screen[] = [...NAV.map(n => n[0]), 'settings', 'friend'];

interface Route { screen: Screen; param?: string }

const routeFromHash = (): Route => {
  const [h, param] = window.location.hash.replace(/^#\/?/, '').split('/');
  const screen = h as Screen;
  return SCREENS.includes(screen) ? { screen, param } : { screen: 'dash' };
};

/** Current screen (+ optional id), mirrored in the URL hash so reloads and back/forward work. */
function useScreen(): [Route, (s: Screen, param?: string) => void] {
  const [route, setRoute] = useState<Route>(routeFromHash);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((s: Screen, param?: string) => {
    window.location.hash = s === 'dash' ? '' : `/${s}${param ? '/' + param : ''}`;
    setRoute({ screen: s, param });
    window.scrollTo({ top: 0 });
  }, []);
  return [route, go];
}

export interface ScreenProps { go: (s: Screen, param?: string) => void }

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
  const [{ screen, param }, go] = useScreen();
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
        <div className="nav-brand"><Logo size={26} /></div>
        <nav className="links desktop-only" aria-label="Main">
          {NAV.map(([key, label]) => (
            <a key={key} href={key === 'dash' ? '#' : `#/${key}`} aria-current={screen === key || (key === 'friends' && screen === 'friend') ? 'page' : undefined} onClick={e => { e.preventDefault(); go(key); }}>{label}</a>
          ))}
        </nav>
        {themeButton}
        <button className="avatar-btn" onClick={() => go('settings')} aria-label="Settings and profile" aria-current={screen === 'settings' ? 'page' : undefined} title="Settings">
          <Avatar name={snapshot.profile.display_name} url={snapshot.profile.avatar_url} size={36} style={{ background: 'transparent' }} />
        </button>
        <button className="btn btn-primary desktop-only" onClick={() => go('log')}>Log activity</button>
      </header>
      <MobileNav screen={screen} go={go} />
      <main className="app-main" aria-busy={loading}>
        {screen === 'dash' && <Dashboard go={go} />}
        {screen === 'log' && <LogSession go={go} />}
        {screen === 'goals' && <Goals go={go} />}
        {screen === 'exp' && <Expedition go={go} />}
        {screen === 'friends' && <Friends go={go} />}
        {screen === 'friend' && <FriendProfileScreen go={go} friendId={param ?? ''} />}
        {screen === 'book' && <RecordBook go={go} />}
        {screen === 'resources' && <Resources go={go} />}
        {screen === 'settings' && <Settings go={go} onReplayTour={() => setReplayTour(true)} />}
      </main>
    </>
  );
}

const TABS: { key: Screen; label: string; icon: ReactNode }[] = [
  { key: 'dash', label: 'Home', icon: <path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /> },
  { key: 'log', label: 'Log', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></> },
  { key: 'goals', label: 'Goals', icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 12h.01" /></> },
  { key: 'friends', label: 'Friends', icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" /></> },
];
const MORE: { key: Screen; label: string }[] = [
  { key: 'exp', label: 'Expedition' }, { key: 'book', label: 'Record book' }, { key: 'resources', label: 'Resources' }, { key: 'settings', label: 'Settings' },
];

/** Bottom tab bar for phones; hidden on wider screens where the header links show. */
function MobileNav({ screen, go }: { screen: Screen; go: (s: Screen, param?: string) => void }) {
  const [more, setMore] = useState(false);
  const moreActive = MORE.some(m => m.key === screen);
  const tabActive = (k: Screen) => screen === k || (k === 'friends' && screen === 'friend');
  // Close the sheet whenever navigation happens (tab, hash, back button) or Escape is pressed.
  useEffect(() => setMore(false), [screen]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [more]);
  const pick = (s: Screen) => { setMore(false); go(s); };
  return (
    <>
      {more && <button className="sheet-backdrop" aria-label="Close menu" onClick={() => setMore(false)} />}
      <nav className="tabbar" aria-label="Main">
        {more && (
          <div className="sheet" role="menu">
            {MORE.map(m => <button key={m.key} role="menuitem" className={`sheet-item${screen === m.key ? ' on' : ''}`} onClick={() => pick(m.key)}>{m.label}</button>)}
          </div>
        )}
        {TABS.map(t => (
          <button key={t.key} className={`tab${tabActive(t.key) ? ' on' : ''}`} aria-current={tabActive(t.key) ? 'page' : undefined} onClick={() => pick(t.key)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.icon}</svg>
            <span>{t.label}</span>
          </button>
        ))}
        <button className={`tab${moreActive || more ? ' on' : ''}`} aria-expanded={more} aria-haspopup="menu" onClick={() => setMore(m => !m)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div style={{ minHeight: '60vh', display: 'grid', placeContent: 'center', textAlign: 'center', gap: 12, padding: 'var(--space-6)' }} className="text-muted">{children}</div>;
}
