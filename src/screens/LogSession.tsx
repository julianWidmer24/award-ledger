import { useState } from 'react';
import type { ScreenProps } from '../App';
import { AREAS, LOG_RULES, type AreaKey } from '../data';
import { activityById, logWarnings, timeline, type LogForm } from '../derive';
import { toISODate } from '../lib/dates';
import { useSnapshot, useStore } from '../store';
import { ActivityForm, Notice, cleanDraft, emptyActivity, useAsync } from '../components/ui';

const DURATIONS = [30, 60, 90, 120, 240];
const fmtMins = (m: number) => (m < 60 ? `${m} m` : `${m / 60} h`);

export function LogSession({ go }: ScreenProps) {
  const s = useSnapshot();
  const { api } = useStore();
  const t = timeline(s.profile);
  const active = s.activities.filter(a => !a.archived);
  const firstIn = (area: AreaKey) => active.find(a => a.area === area)?.id ?? '';
  const [f, setF] = useState<LogForm>(() => ({ area: 'vps', activityId: firstIn('vps'), date: toISODate(t.today), mins: 60, desc: '', paid: false, privateBiz: false }));
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const { busy, error, run } = useAsync();
  const set = (patch: Partial<LogForm>) => { setSaved(null); setF(x => ({ ...x, ...patch })); };

  const selected = activityById(s, f.activityId);
  const warnings = logWarnings(f, s, t);
  const blocked = warnings.some(w => w.block) || !selected;

  const save = () => void run(async () => {
    if (blocked || !selected) return;
    const id = await api.addEntry({ activity_id: selected.id, date: f.date, hours: f.mins / 60, description: f.desc.trim() || undefined });
    setSavedId(id);
    setSaved(`Saved ${fmtMins(f.mins)} to ${selected.name.split(' — ')[0]}. Status: logged — send it for validation from the dashboard.`);
    setF(x => ({ ...x, desc: '', paid: false, privateBiz: false }));
  });

  return (
    <section className="log-layout" aria-label="Log a session">
      <div className="log-side intro">
        <h6 className="eyebrow">Mobile fast path</h6>
        <h2 style={{ margin: '0 0 var(--space-3)' }}>Log a session</h2>
        <p className="text-muted" style={{ fontSize: 14, maxWidth: '34ch' }}>Four taps for a routine shift: area, activity, duration, save. Sessions attach to a recurring activity so the validator and context are already filled in.</p>
      </div>

      <div className="phone">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-ghost" onClick={() => go('dash')} style={{ padding: '6px 10px' }}>Cancel</button>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>New session</span>
          <span style={{ width: 60 }} />
        </div>

        <fieldset className="fs">
          <legend className="label-sm">Program area</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {AREAS.map(a => (
              <button key={a.key} type="button" aria-pressed={f.area === a.key} className={`chip${f.area === a.key ? ' on' : ''}`}
                onClick={() => { set({ area: a.key, activityId: firstIn(a.key), privateBiz: false }); setAdding(false); }}>{a.label}</button>
            ))}
          </div>
        </fieldset>

        <fieldset className="fs">
          <legend className="label-sm">Activity</legend>
          <div style={{ display: 'grid', gap: 6 }}>
            {active.filter(a => a.area === f.area).map(a => (
              <button key={a.id} type="button" aria-pressed={a.id === f.activityId} className={`activity${a.id === f.activityId ? ' on' : ''}`} onClick={() => set({ activityId: a.id })}>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                  <span className="muted" style={{ fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.validator_name ? 'Validator: ' + a.validator_name : 'No validator yet'}</span>
                </span>
                <span className="small muted nowrap num">{hoursFor(s.entries, a.id)} h</span>
              </button>
            ))}
            {adding ? (
              <div className="card" style={{ padding: 'var(--space-3)', background: 'var(--color-surface)' }}>
                <ActivityForm initial={emptyActivity(f.area)} lockArea submitLabel="Add activity" onCancel={() => setAdding(false)}
                  onSubmit={async d => { const a = await api.addActivity(cleanDraft(d)); set({ activityId: a.id }); setAdding(false); }} />
              </div>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setAdding(true)} style={{ justifyContent: 'flex-start', padding: '8px 10px', fontFamily: 'var(--font-body)', fontSize: 13 }}>+ New activity</button>
            )}
          </div>
        </fieldset>

        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 5 }}>
            <span className="label-sm">Date</span>
            <input className="input" type="date" value={f.date} min={toISODate(t.registered)} max={toISODate(t.today)} onChange={e => set({ date: e.target.value })} style={{ minHeight: 44 }} />
          </label>
          <div style={{ display: 'grid', gap: 5 }}>
            <span className="label-sm" id="duration-label">Duration</span>
            <div style={{ display: 'flex', gap: 4 }} role="group" aria-labelledby="duration-label">
              {DURATIONS.map(m => (
                <button key={m} type="button" aria-pressed={m === f.mins} className={`chip${m === f.mins ? ' on' : ''}`} style={{ flex: 1, padding: 0, fontSize: 12 }} onClick={() => set({ mins: m })}>{fmtMins(m)}</button>
              ))}
            </div>
          </div>
        </div>

        <label style={{ display: 'grid', gap: 5 }}>
          <span className="label-sm">What did you do?</span>
          <textarea className="input" rows={2} placeholder="Triage desk, restocked bays 4–9, wheelchair transport" value={f.desc} onChange={e => set({ desc: e.target.value })} style={{ minHeight: 64, borderRadius: 'var(--radius-md)' }} />
        </label>

        <div style={{ display: 'grid', gap: 8 }}>
          <label className="toggle-row"><span>This was paid work</span><input type="checkbox" className="checkbox" checked={f.paid} onChange={() => set({ paid: !f.paid })} style={{ width: 22, height: 22 }} /></label>
          <label className="toggle-row"><span>At a private business</span><input type="checkbox" className="checkbox" checked={f.privateBiz} onChange={() => set({ privateBiz: !f.privateBiz })} style={{ width: 22, height: 22 }} /></label>
        </div>

        {warnings.map(w => <Notice key={w.text} kind={w.block ? 'block' : 'info'}>{w.text}</Notice>)}
        {error && <Notice kind="block">{error}</Notice>}

        <button type="button" onClick={save} className="btn btn-primary btn-block" disabled={blocked || busy} style={{ minHeight: 52, fontSize: 16, marginTop: 4 }}>
          {busy ? 'Saving…' : blocked || !selected ? 'Cannot save this session' : `Save ${fmtMins(f.mins)} to ${selected.name.split(' — ')[0]}`}
        </button>
        {saved && (
          <p role="status" style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-accent-2-700)', margin: 0 }}>
            {saved}{savedId && <> <button type="button" className="link-btn" onClick={() => go('friends', 'entry:' + savedId)} style={{ fontSize: 13 }}>Share it with friends →</button></>}
          </p>
        )}
      </div>

      <div className="log-side" style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <h6 className="eyebrow" style={{ margin: 0 }}>Rules checked on save</h6>
        {LOG_RULES.map(r => <div key={r} className="bullet muted"><span>{r}</span></div>)}
      </div>
    </section>
  );
}

const hoursFor = (entries: { activity_id: string; hours: number }[], id: string) =>
  Math.round(entries.filter(e => e.activity_id === id).reduce((n, e) => n + Number(e.hours), 0) * 10) / 10;
