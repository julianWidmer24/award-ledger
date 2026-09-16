import { useEffect, useState } from 'react';
import type { ScreenProps } from '../App';
import { GOAL_AREAS, GOAL_STATUS, type GoalArea } from '../data';
import { fmtISO } from '../lib/dates';
import { useSnapshot, useStore } from '../store';
import { Field, Notice, useAsync } from '../components/ui';

export function Goals(_: ScreenProps) {
  const s = useSnapshot();
  const { api } = useStore();
  const [area, setArea] = useState<GoalArea>('vps');
  const goal = s.goals.find(g => g.area === area);
  const meta = GOAL_AREAS.find(g => g.key === area)!;
  const [title, setTitle] = useState(goal?.title ?? '');
  const [text, setText] = useState(goal?.text ?? '');
  const [note, setNote] = useState('');
  const { busy, error, run } = useAsync();

  // Reset the editor when the selected area (or its saved goal) changes.
  useEffect(() => { setTitle(goal?.title ?? ''); setText(goal?.text ?? ''); setNote(''); }, [area, goal?.id, goal?.version, goal?.title, goal?.text]);

  const dirty = title.trim() !== (goal?.title ?? '') || text.trim() !== (goal?.text ?? '');
  const revising = !!goal && goal.status !== 'draft' && text.trim() !== goal.text.trim();
  const [statusLabel, tagClass] = goal ? GOAL_STATUS[goal.status] : ['Not written', 'tag-neutral'];

  return (
    <section className="screen" aria-label="Goal setting">
      <div>
        <h6 className="eyebrow">Written goals</h6>
        <h1 style={{ margin: 0 }}>Goals</h1>
        <p className="text-muted lede">One written goal per program area, dated before the hours start. Revisions keep their history; the advisor signs each version.</p>
      </div>

      <div className="goals-layout">
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {GOAL_AREAS.map(g => {
            const gl = s.goals.find(x => x.area === g.key);
            const [st, cls] = gl ? GOAL_STATUS[gl.status] : ['Not written', 'tag-neutral'];
            return (
              <button key={g.key} className={`card goal-item${g.key === area ? ' on' : ''}`} aria-pressed={g.key === area} onClick={() => setArea(g.key)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><span className="card-kicker">{g.name}</span><span className={`tag ${cls}`}>{st}</span></div>
                <div className="clamp-2" style={{ fontSize: 14, lineHeight: 1.4 }}>{gl?.text || <span className="muted">{g.hint}</span>}</div>
                {gl && <div className="card-meta">v{gl.version} · {fmtISO(gl.dated)}</div>}
              </button>
            );
          })}
        </div>

        <form className="card" style={{ padding: 'var(--space-6)', gap: 'var(--space-4)' }} onSubmit={e => { e.preventDefault(); void run(() => api.saveGoal(area, { title: title.trim(), text: text.trim() }, note.trim() || undefined)); }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div><div className="card-kicker">{meta.name}</div><h3 style={{ margin: '4px 0 0' }}>{goal?.title || 'New goal'}</h3></div>
            <span className={`tag ${tagClass}`} style={{ fontSize: 12, padding: '6px 14px' }}>{statusLabel}</span>
          </div>
          <Field label="Title"><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Emergency department volunteering" required /></Field>
          <Field label={`Goal statement${goal ? ` · v${goal.version}` : ''}`} hint="Specific and measurable: what you'll do, how often, and what 'done' looks like.">
            <textarea className="input" rows={5} value={text} onChange={e => setText(e.target.value)} required placeholder={`e.g. ${placeholders[area]}`} style={{ borderRadius: 'var(--radius-md)', fontSize: 15, lineHeight: 1.5, minHeight: 130 }} />
          </Field>
          {revising && (
            <Field label="What changed?" hint="Kept in the revision history so your advisor sees why v${goal.version + 1} differs.">
              <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Raised weekly target from 2 h to 4 h after falling behind pace" />
            </Field>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div><div className="label-sm">Dated</div><div style={{ fontWeight: 600 }}>{goal ? fmtISO(goal.dated) : '—'}</div></div>
            <div><div className="label-sm">Advisor</div><div style={{ fontWeight: 600 }}>{s.profile.advisor_name || <span className="muted">Not named — add in Settings</span>}</div></div>
          </div>
          {goal && goal.history.length > 0 && (
            <div>
              <div className="label-sm" style={{ marginBottom: 8 }}>Revision history</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {goal.history.map(h => (
                  <div key={h.v} className="history-row"><span style={{ fontFamily: 'var(--font-heading)' }}>v{h.v}</span><span>{h.note}</span><span className="text-muted num">{fmtISO(h.date)}</span></div>
                ))}
              </div>
            </div>
          )}
          {error && <Notice kind="block">{error}</Notice>}
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {goal && goal.status === 'draft' && !dirty && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(() => api.setGoalStatus(goal.id, 'awaiting'))}>Request advisor signature</button>}
            {goal && goal.status === 'awaiting' && !dirty && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(() => api.setGoalStatus(goal.id, 'signed'))}>Mark as signed</button>}
            {goal && goal.status === 'signed' && !dirty && <span className="tag tag-accent-2" style={{ alignSelf: 'center' }}>Signed · edit the text to start a new version</span>}
            <button type="submit" className="btn btn-primary" disabled={busy || !dirty || !title.trim() || !text.trim()}>{busy ? 'Saving…' : revising ? `Save as v${goal!.version + 1}` : goal ? 'Save changes' : 'Save goal'}</button>
          </div>
        </form>
      </div>
    </section>
  );
}

const placeholders: Record<GoalArea, string> = {
  vps: 'Serve 400 hours across weekly 4-hour shifts in the hospital emergency department, moving from patient transport to the triage desk by year two.',
  pd: 'Reach JLPT N4 through 3 hours of weekly study outside coursework and sit the December exam.',
  pf: 'Build to 4 hours of weekly training: two climbing sessions, one trail run, and a monthly loaded hike.',
  exp: 'Plan and lead a five-day, four-night self-supported loop in the Sierra Nevada, including permits, food and safety planning.',
};
