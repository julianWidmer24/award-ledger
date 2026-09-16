import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Field, Notice, useAsync } from '../components/ui';

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { busy, error, run } = useAsync();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'forgot') {
        // The link in the email brings the user back here with a recovery session; App then shows ResetPassword.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/' });
        if (error) throw error;
        setResetSent(true);
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setConfirmSent(true); // project requires email confirmation
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    });
  };

  return (
    <div className="auth-wrap">
      <div className="auth-intro">
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22 }}><span className="brand-dot" />Award Ledger</div>
        <h1 style={{ margin: '18px 0 8px', fontSize: 40 }}>Track your Congressional Award, together.</h1>
        <p className="text-muted" style={{ fontSize: 15, maxWidth: '44ch' }}>
          Log hours in the three program areas, plan your expedition, keep validators and goals in one place, and see whether you and your friends are on pace for the level you're aiming at.
        </p>
        <ul className="auth-points">
          <li><strong>Rules checked as you log.</strong> Paid work, private businesses, pre-registration hours — flagged before they cost you.</li>
          <li><strong>Pace, not just totals.</strong> Every area shows whether your current rhythm reaches the minimum before your 24th birthday.</li>
          <li><strong>Friends, no leaderboard.</strong> Share hours and pace with people you choose; descriptions and validators stay private.</li>
        </ul>
      </div>

      <form className="card auth-card" onSubmit={submit}>
        <div className="seg" role="tablist" style={{ alignSelf: 'flex-start' }}>
          {(['signup', 'signin'] as Mode[]).map(m => (
            <label key={m} className="seg-opt" style={{ position: 'relative' }}>
              <input type="radio" name="mode" checked={mode === m || (m === 'signin' && mode === 'forgot')} onChange={() => { setMode(m); setResetSent(false); }} />
              {m === 'signup' ? 'Create account' : 'Sign in'}
            </label>
          ))}
        </div>

        {confirmSent ? (
          <Notice kind="ok">
            Almost there — we sent a confirmation link to <strong>{email}</strong>. Open it, then come back and sign in.
          </Notice>
        ) : mode === 'forgot' ? (
          <>
            <div>
              <div className="card-kicker">Forgot password</div>
              <p className="small muted" style={{ margin: '4px 0 0' }}>Enter your email and we'll send a link that lets you set a new password.</p>
            </div>
            {resetSent ? (
              <Notice kind="ok">If <strong>{email}</strong> has an account, a reset link is on its way. Open it on this device to choose a new password.</Notice>
            ) : (
              <>
                <Field label="Email">
                  <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@school.edu" autoFocus />
                </Field>
                {error && <Notice kind="block">{error}</Notice>}
                <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ minHeight: 48, fontSize: 15 }}>{busy ? 'Sending…' : 'Send reset link'}</button>
              </>
            )}
            <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
              <button type="button" className="link-btn" onClick={() => { setMode('signin'); setResetSent(false); }}>Back to sign in</button>
            </p>
          </>
        ) : (
          <>
            {mode === 'signup' && (
              <Field label="Your name" hint="Shown to friends you add.">
                <input className="input" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Priya Kandasamy" />
              </Field>
            )}
            <Field label="Email">
              <input className="input" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@school.edu" />
            </Field>
            <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
              <input className="input" type="password" required minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            </Field>
            {error && <Notice kind="block">{error}</Notice>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy} style={{ minHeight: 48, fontSize: 15 }}>
              {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
            {mode === 'signin' && (
              <p className="small muted" style={{ margin: '-4px 0 0', textAlign: 'right' }}>
                <button type="button" className="link-btn" onClick={() => setMode('forgot')}>Forgot password?</button>
              </p>
            )}
            <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
              {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
              <button type="button" className="link-btn" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
                {mode === 'signup' ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
