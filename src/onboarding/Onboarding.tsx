import { useState, type CSSProperties, type ReactNode } from 'react';
import { AREAS, LEVELS, type LevelId } from '../data';
import { useSnapshot, useStore } from '../store';
import { ActivityForm, CheckIcon, Field, Notice, cleanDraft, emptyActivity, useAsync } from '../components/ui';
import { addYears, fmtDate, parseISODate, startOfToday, toISODate } from '../lib/dates';

const STEPS = ['Welcome', 'About you', 'Target level', 'Activities', 'Friends', 'Ready'] as const;

/** Five-step welcome sequence shown once after sign-up (and again from Settings → “Show the welcome tour”). */
export function Onboarding({ onDone, replay }: { onDone: () => void; replay: boolean }) {
  const { api, social } = useStore();
  const s = useSnapshot();
  const p = s.profile;
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [form, setForm] = useState({
    display_name: p.display_name, school: p.school ?? '', birthday: p.birthday ?? '', registered_on: p.registered_on ?? '', advisor_name: p.advisor_name ?? '',
    target_level: p.target_level as LevelId,
  });
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));
  const { busy, error, run } = useAsync();

  const today = startOfToday();
  const birthday = parseISODate(form.birthday);
  const registered = parseISODate(form.registered_on);
  const deadline = birthday ? addYears(birthday, 24) : null;
  const aboutProblems: string[] = [];
  if (form.display_name.trim().length < 2) aboutProblems.push('Enter your name.');
  if (!birthday) aboutProblems.push('Enter your date of birth.');
  else if (deadline && deadline <= today) aboutProblems.push('Your 24th birthday has already passed — the award has to be completed before it.');
  else if (addYears(birthday, 13) > today) aboutProblems.push('You must be at least 13½ to register for the award.');
  if (!registered) aboutProblems.push('Enter the date you registered with the Congressional Award program.');
  else if (registered > today) aboutProblems.push('Registration date cannot be in the future.');
  else if (birthday && registered < birthday) aboutProblems.push('Registration date is before your birthday.');

  const saveProfile = (finish: boolean) => run(() => api.updateProfile({
    display_name: form.display_name.trim(), school: form.school.trim() || null, birthday: form.birthday, registered_on: form.registered_on,
    advisor_name: form.advisor_name.trim() || null, target_level: form.target_level,
    ...(finish ? { onboarded_at: new Date().toISOString() } : {}),
  }));

  const next = async () => {
    if (step === 1 && !(await saveProfile(false))) return;
    if (step === 2 && !(await saveProfile(false))) return;
    setDir('fwd');
    setStep(x => Math.min(STEPS.length - 1, x + 1));
    window.scrollTo({ top: 0 });
  };
  const finish = async () => { if (await saveProfile(true)) onDone(); };

  return (
    <div className="onboard">
      <ol className="steps" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="step-dot">{i < step ? <CheckIcon size={12} stroke="var(--color-bg)" /> : i + 1}</span>
            <span className="step-label">{label}</span>
          </li>
        ))}
      </ol>
      <div className="step-progress" aria-hidden="true"><div style={{ width: `${(step + 1) / STEPS.length * 100}%` }} /></div>

      <div className="card onboard-card">
        <div key={step} className={`onboard-panel${dir === 'back' ? ' back' : ''}`}>
        {step === 0 && (
          <Panel kicker={replay ? 'Welcome back' : 'Welcome'} title={replay ? 'A quick tour of Award Ledger' : `Hi ${p.display_name.split(' ')[0]}. Here's how this works.`}>
            <p style={{ fontSize: 15.5, lineHeight: 1.55, maxWidth: '62ch' }}>
              The <strong>Congressional Award</strong> is earned by setting goals and logging hours in three program areas, plus an expedition — all before your 24th birthday. Higher levels need more hours, longer expeditions, and a minimum amount of time since you registered. Award Ledger keeps the record for you and shows whether you're on pace.
            </p>
            <div className="intro-grid">
              {AREAS.map(a => (
                <div key={a.key} className="intro-tile">
                  <div className="card-kicker">{a.label}</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{a.name}</div>
                  <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>{a.blurb}</p>
                </div>
              ))}
              <div className="intro-tile">
                <div className="card-kicker">Plus one trip</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>Expedition / Exploration</div>
                <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>From a single day out to four consecutive overnights at Gold Medal — planned by you, in an unfamiliar environment.</p>
              </div>
            </div>
            <div className="intro-grid" style={{ marginTop: 4 }}>
              <HowTile n="1" title="Log as you go">Each session attaches to an activity with a named adult validator. Rules are checked before you save.</HowTile>
              <HowTile n="2" title="Watch your pace">Rings, a ledger, or pace cards — pick the view that motivates you. Behind-pace areas turn terracotta.</HowTile>
              <HowTile n="3" title="Export the record book">When every section is complete, the structured record book is ready for your advisor to sign.</HowTile>
            </div>
          </Panel>
        )}

        {step === 1 && (
          <Panel kicker="About you" title="Two dates set your whole timeline">
            <p className="text-muted" style={{ maxWidth: '60ch' }}>Hours only count from the day you registered with the program, and everything must be finished before you turn 24. We use these two dates for the deadline, the pace math and the time gates.</p>
            <div className="form-grid">
              <Field label="Your name"><input className="input" value={form.display_name} onChange={e => set({ display_name: e.target.value })} autoComplete="name" /></Field>
              <Field label="School (optional)" hint="Shown to friends next to your name."><input className="input" value={form.school} onChange={e => set({ school: e.target.value })} placeholder="UC Berkeley · Chem E" /></Field>
              <Field label="Date of birth" hint={deadline ? `Deadline: your 24th birthday, ${fmtDate(deadline)}.` : 'Sets your deadline.'}>
                <input className="input" type="date" value={form.birthday} max={toISODate(today)} onChange={e => set({ birthday: e.target.value })} />
              </Field>
              <Field label="Program registration date" hint="The date on your Congressional Award registration confirmation.">
                <input className="input" type="date" value={form.registered_on} max={toISODate(today)} onChange={e => set({ registered_on: e.target.value })} />
              </Field>
              <Field label="Advisor (optional)" hint="The adult who signs your goals and, at the end, your record book. You can add this later.">
                <input className="input" value={form.advisor_name} onChange={e => set({ advisor_name: e.target.value })} placeholder="Prof. L. Okonkwo · faculty advisor" />
              </Field>
            </div>
            {aboutProblems.length > 0 && form.birthday && form.registered_on && <Notice kind="block">{aboutProblems[0]}</Notice>}
          </Panel>
        )}

        {step === 2 && (
          <Panel kicker="Target level" title="Which level are you aiming for?">
            <p className="text-muted" style={{ maxWidth: '60ch' }}>Levels build on each other — hours carry forward, so you earn each one on the way up. Pick the one you're working toward; you can change it any time from the dashboard.</p>
            <div className="level-grid">
              {LEVELS.map(l => (
                <button key={l.id} className={`ladder-step${form.target_level === l.id ? ' on' : ''}`} aria-pressed={form.target_level === l.id} onClick={() => set({ target_level: l.id })}
                  style={{ '--step-border': form.target_level === l.id ? 'var(--color-accent)' : 'transparent', '--step-bg': 'var(--color-bg)' } as CSSProperties}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{l.name}</span>
                  <span className="small muted num">{l.vps} h service · {l.pd} h development · {l.pf} h fitness</span>
                  <span className="small muted">Expedition: {l.expText} · {l.months ? `at least ${l.months} months after registering` : 'no minimum time'}</span>
                </button>
              ))}
            </div>
          </Panel>
        )}

        {step === 3 && <ActivitiesStep />}

        {step === 4 && <FriendsStep code={p.friend_code} friendCount={social.friends.length} />}

        {step === 5 && (
          <Panel kicker="Ready" title="You're set. Here's what to do first.">
            <p className="text-muted" style={{ maxWidth: '60ch' }}>Your dashboard has a short checklist that ticks itself off as you use the app. Three things worth doing this week:</p>
            <ol className="ready-list">
              <li><strong>Write a goal for each area.</strong> The award wants goals dated before the hours start, and your advisor signs each version.</li>
              <li><strong>Log a session</strong> — even a past one from after {form.registered_on ? fmtDate(parseISODate(form.registered_on)!) : 'your registration date'}. It takes four taps.</li>
              <li><strong>Send entries for validation in batches.</strong> Entries go Logged → Sent → Validated; the record book counts all three but flags what's unvalidated.</li>
            </ol>
            <Notice kind="ok">Your friend code is <strong>{p.friend_code}</strong>. It's always on the Friends page.</Notice>
          </Panel>
        )}

        </div>
        {error && <Notice kind="block">{error}</Notice>}

        <div className="onboard-actions">
          {step > 0 ? <button className="btn btn-secondary" onClick={() => { setDir('back'); setStep(x => x - 1); }} disabled={busy}>Back</button> : <span />}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {replay && step < STEPS.length - 1 && <button className="btn btn-ghost" onClick={() => void finish()} disabled={busy} style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>Skip tour</button>}
            {(step === 3 || step === 4) && <span className="small muted">Optional</span>}
            {step < STEPS.length - 1
              ? <button className="btn btn-primary" onClick={() => void next()} disabled={busy || (step === 1 && aboutProblems.length > 0)}>{busy ? 'Saving…' : step === 0 ? "Let's set up" : 'Continue'}</button>
              : <button className="btn btn-primary" onClick={() => void finish()} disabled={busy}>{busy ? 'Saving…' : 'Go to my dashboard'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
      <div>
        <h6 className="eyebrow">{kicker}</h6>
        <h2 style={{ margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function HowTile({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="intro-tile" style={{ background: 'var(--color-bg)' }}>
      <span className="avatar" style={{ width: 30, height: 30, fontSize: 14, background: 'var(--color-accent)', color: 'var(--color-bg)' }}>{n}</span>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{title}</div>
      <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>{children}</p>
    </div>
  );
}

function ActivitiesStep() {
  const { api } = useStore();
  const s = useSnapshot();
  const [adding, setAdding] = useState(s.activities.length === 0);
  const active = s.activities.filter(a => !a.archived);
  return (
    <Panel kicker="Activities" title="What will you be logging?">
      <p className="text-muted" style={{ maxWidth: '60ch' }}>
        An <strong>activity</strong> is a recurring thing you do — a volunteering shift, a lesson, a training session. Every activity needs a <strong>validator</strong>: an adult who supervises it, isn't related to you, and can confirm your hours. Add one now or skip and do it when you first log.
      </p>
      {active.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {active.map(a => (
            <div key={a.id} className="activity" style={{ cursor: 'default' }}>
              <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>{a.validator_name ? `Validator: ${a.validator_name}${a.validator_title ? ' · ' + a.validator_title : ''}` : 'No validator yet'}</span>
              </span>
              <span className="tag tag-neutral">{AREAS.find(x => x.key === a.area)?.label}</span>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div className="card" style={{ background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
          <ActivityForm initial={emptyActivity()} submitLabel="Add activity" onCancel={active.length ? () => setAdding(false) : undefined}
            onSubmit={async d => { await api.addActivity(cleanDraft(d)); setAdding(false); }} />
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => setAdding(true)} style={{ justifySelf: 'start' }}>+ Add another activity</button>
      )}
    </Panel>
  );
}

function FriendsStep({ code, friendCount }: { code: string; friendCount: number }) {
  const { api } = useStore();
  const [friendCode, setFriendCode] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, run } = useAsync();
  return (
    <Panel kicker="Friends" title="Working on it together">
      <p className="text-muted" style={{ maxWidth: '60ch' }}>Friends see your hours per area, your target level and whether you're on pace — and you see theirs. Descriptions, validators and contact details are never shared, and there's no leaderboard. You control what's visible on the Friends page.</p>
      <div className="friend-code-card">
        <div>
          <div className="label-sm">Your friend code</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, letterSpacing: '.08em' }}>{code}</div>
        </div>
        <p className="small muted" style={{ margin: 0, maxWidth: '36ch' }}>Send it to a friend who's also doing the award. When they enter it, you'll get a request to accept.</p>
      </div>
      <form onSubmit={e => { e.preventDefault(); void run(async () => { const name = await api.sendFriendRequest(friendCode); setSent(name); setFriendCode(''); }); }}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
        <Field label="Have a friend's code already?"><input className="input" value={friendCode} onChange={e => setFriendCode(e.target.value.toUpperCase())} placeholder="e.g. OAK-7Q2M" /></Field>
        <button type="submit" className="btn btn-secondary" disabled={busy || friendCode.trim().length < 6}>Send request</button>
      </form>
      {sent && <Notice kind="ok">Request sent to {sent}. They'll see it the next time they open the app.</Notice>}
      {error && <Notice kind="block">{error}</Notice>}
      {friendCount > 0 && <p className="small muted" style={{ margin: 0 }}>You already have {friendCount} {friendCount === 1 ? 'friend' : 'friends'} here.</p>}
    </Panel>
  );
}
