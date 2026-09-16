import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Field, Logo, Notice, useAsync } from '../components/ui';

/** Shown after the user follows a password-reset email link (Supabase fires PASSWORD_RECOVERY). */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, run, setError } = useAsync();
  const mismatch = confirm.length > 0 && password !== confirm;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    void run(async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      onDone();
    });
  };

  return (
    <div className="auth-wrap" style={{ gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 520 }}>
      <form className="card auth-card" onSubmit={submit}>
        <div className="nav-brand"><Logo size={26} /></div>
        <h2 style={{ margin: 0 }}>Choose a new password</h2>
        <p className="text-muted" style={{ margin: 0, fontSize: 14 }}>You're signed in through the reset link. Pick a new password and you'll go straight to your dashboard.</p>
        <Field label="New password" hint="At least 8 characters.">
          <input className="input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        <Field label="Confirm new password">
          <input className="input" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
        </Field>
        {mismatch && <Notice kind="block">The two passwords do not match.</Notice>}
        {error && !mismatch && <Notice kind="block">{error}</Notice>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || password.length < 8 || mismatch} style={{ minHeight: 48, fontSize: 15 }}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  );
}
