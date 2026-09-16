import { useState, type FormEvent } from 'react';
import type { ScreenProps } from '../App';
import { AREAS, LEVELS } from '../data';
import { toISODate } from '../lib/dates';
import { useSnapshot, useStore } from '../store';
import { supabase } from '../lib/supabase';
import { ActivityForm, Field, Notice, cleanDraft, draftFrom, emptyActivity, useAsync } from '../components/ui';
import type { Activity } from '../types';
import { AvatarUpload } from '../components/AvatarUpload';

export function Settings({ onReplayTour }: ScreenProps & { onReplayTour: () => void }) {
  const s = useSnapshot();
  const { api, session } = useStore();
  const p = s.profile;
  const [form, setForm] = useState({ display_name: p.display_name, school: p.school ?? '', birthday: p.birthday ?? '', registered_on: p.registered_on ?? '', advisor_name: p.advisor_name ?? '', target_level: p.target_level });
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));
  const profile = useAsync();
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<Activity | 'new' | null>(null);
  const acts = useAsync();
  const hoursFor = (id: string) => Math.round(s.entries.filter(e => e.activity_id === id).reduce((n, e) => n + Number(e.hours), 0) * 10) / 10;

  return (
    <section className="screen" aria-label="Settings">
      <div className="head">
        <div>
          <h6 className="eyebrow">Settings</h6>
          <h1 style={{ margin: 0 }}>{p.display_name}</h1>
          <p className="text-muted lede">{session?.user.email} · friend code {p.friend_code}</p>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={onReplayTour}>Show the welcome tour</button>
          <button className="btn btn-secondary" onClick={() => void api.signOut()}>Sign out</button>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card pad" style={{ gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-kicker">Activities & validators</div>
              {editing === null && <button className="btn btn-secondary" onClick={() => setEditing('new')} style={{ padding: '4px 12px', fontSize: 13 }}>+ Add activity</button>}
            </div>
            {editing === 'new' && (
              <div className="card" style={{ background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
                <ActivityForm initial={emptyActivity()} submitLabel="Add activity" onCancel={() => setEditing(null)} onSubmit={async d => { await api.addActivity(cleanDraft(d)); setEditing(null); }} />
              </div>
            )}
            {s.activities.filter(a => !a.archived).length === 0 && editing !== 'new' && <p className="card-body plain">Nothing yet. An activity is a recurring thing you log hours against, with an adult validator who can confirm them.</p>}
            {AREAS.map(area => {
              const list = s.activities.filter(a => a.area === area.key && !a.archived);
              if (!list.length) return null;
              return (
                <div key={area.key} style={{ display: 'grid', gap: 6 }}>
                  <div className="label-sm">{area.name}</div>
                  {list.map(a => editing !== 'new' && editing?.id === a.id ? (
                    <div key={a.id} className="card" style={{ background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
                      <ActivityForm initial={draftFrom(a)} lockArea onCancel={() => setEditing(null)} onSubmit={async d => { await api.updateActivity(a.id, cleanDraft(d)); setEditing(null); }} />
                      <div style={{ marginTop: 8 }}>
                        <button className="link-btn small" disabled={acts.busy} onClick={() => { if (confirm(hoursFor(a.id) ? `Archive "${a.name}"? Its ${hoursFor(a.id)} h stay in your totals; it just won't be offered when logging.` : `Remove "${a.name}"?`)) void acts.run(async () => { await api.updateActivity(a.id, { archived: true }); setEditing(null); }); }}>Archive activity</button>
                      </div>
                    </div>
                  ) : (
                    <div key={a.id} className="activity" style={{ cursor: 'default' }}>
                      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                        <span className="muted" style={{ fontSize: 11.5 }}>{a.validator_name ? `${a.validator_name}${a.validator_title ? ' · ' + a.validator_title : ''}${a.validator_contact ? ' · ' + a.validator_contact : ''}` : 'No validator yet'}</span>
                      </span>
                      <span className="row" style={{ gap: 8, flex: 'none' }}>
                        <span className="small muted num">{hoursFor(a.id)} h</span>
                        {!a.validator_name && hoursFor(a.id) > 0 && <span className="tag tag-accent">At risk</span>}
                        <button className="link-btn small" onClick={() => setEditing(a)}>Edit</button>
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            {acts.error && <Notice kind="block">{acts.error}</Notice>}
          </div>
        </div>

        <form className="card pad" style={{ gap: 'var(--space-3)' }} onSubmit={e => { e.preventDefault(); setSaved(false); void profile.run(async () => { await api.updateProfile({ display_name: form.display_name.trim(), school: form.school.trim() || null, birthday: form.birthday || null, registered_on: form.registered_on || null, advisor_name: form.advisor_name.trim() || null, target_level: form.target_level }); setSaved(true); }); }}>
          <div className="card-kicker">Profile</div>
          <AvatarUpload name={p.display_name} url={p.avatar_url} />
          <Field label="Name"><input className="input" value={form.display_name} onChange={e => set({ display_name: e.target.value })} required /></Field>
          <Field label="School"><input className="input" value={form.school} onChange={e => set({ school: e.target.value })} /></Field>
          <Field label="Date of birth" hint="Sets your 24th-birthday deadline."><input className="input" type="date" value={form.birthday} max={toISODate(new Date())} onChange={e => set({ birthday: e.target.value })} /></Field>
          <Field label="Program registration date" hint="Hours before this date don't count."><input className="input" type="date" value={form.registered_on} max={toISODate(new Date())} onChange={e => set({ registered_on: e.target.value })} /></Field>
          <Field label="Advisor" hint="Signs your goals and, at the end, the record book."><input className="input" value={form.advisor_name} onChange={e => set({ advisor_name: e.target.value })} placeholder="Prof. L. Okonkwo · faculty advisor" /></Field>
          <Field label="Target level">
            <select className="input" value={form.target_level} onChange={e => set({ target_level: e.target.value as typeof form.target_level })}>
              {LEVELS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          {profile.error && <Notice kind="block">{profile.error}</Notice>}
          {saved && <Notice kind="ok">Profile saved.</Notice>}
          <button type="submit" className="btn btn-primary" disabled={profile.busy} style={{ justifySelf: 'end' }}>{profile.busy ? 'Saving…' : 'Save profile'}</button>
        </form>
      </div>
      <ChangePassword />
    </section>
  );
}

function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const { busy, error, run, setError } = useAsync();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(false);
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    void run(async () => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(''); setConfirm(''); setDone(true);
    });
  };
  return (
    <form className="card pad" style={{ gap: 'var(--space-3)', maxWidth: 480 }} onSubmit={submit}>
      <div className="card-kicker">Change password</div>
      <div className="form-grid">
        <Field label="New password" hint="At least 8 characters."><input className="input" type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Confirm"><input className="input" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
      </div>
      {error && <Notice kind="block">{error}</Notice>}
      {done && <Notice kind="ok">Password updated.</Notice>}
      <button type="submit" className="btn btn-secondary" disabled={busy || password.length < 8} style={{ justifySelf: 'start' }}>{busy ? 'Saving…' : 'Update password'}</button>
    </form>
  );
}
