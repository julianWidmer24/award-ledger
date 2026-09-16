import { useState } from 'react';
import type { ScreenProps } from '../App';
import { levelById } from '../data';
import { expeditionCredit, expeditionMeets, expeditionNights, ladder, timeline } from '../derive';
import { fmtISO, parseISODate, startOfToday } from '../lib/dates';
import { useSnapshot, useStore } from '../store';
import { CheckIcon, Field, Notice, useAsync } from '../components/ui';
import type { Expedition as Exp, ItineraryDay } from '../types';

type Draft = Omit<Exp, 'id' | 'user_id' | 'created_at'> & { id?: string };

const blank = (): Draft => ({ name: '', location: '', start_date: '', end_date: '', status: 'planned', purpose: '', itinerary: [], validator_name: '', validator_title: '', validator_contact: '', reflection: '' });

export function Expedition(_: ScreenProps) {
  const s = useSnapshot();
  const { api } = useStore();
  const t = timeline(s.profile);
  const target = levelById(s.profile.target_level);
  const steps = ladder(s, t);
  const credit = expeditionCredit(s);
  const [selectedId, setSelectedId] = useState<string | null>(s.expeditions.find(x => x.status === 'planned')?.id ?? s.expeditions[0]?.id ?? null);
  const [editing, setEditing] = useState<Draft | null>(s.expeditions.length ? null : blank());
  const selected = s.expeditions.find(x => x.id === selectedId) ?? null;

  return (
    <section className="screen" aria-label="Expedition planner">
      <div className="head">
        <div>
          <h6 className="eyebrow">Expedition planner</h6>
          <h1 style={{ margin: 0 }}>{selected && !editing ? selected.name : editing?.id ? 'Edit expedition' : editing ? 'Plan an expedition' : 'Expeditions'}</h1>
          <p className="text-muted lede">{selected && !editing ? selected.location || 'Location not set' : `${target.short} requires ${target.expText}, consecutive, in an unfamiliar environment.`}</p>
        </div>
        <div className="row">
          {selected && !editing && <StatusTags x={selected} targetShort={target.short} meets={expeditionMeets(target, { nights: expeditionNights(selected), days: expeditionNights(selected) + 1 })} />}
          {!editing && <button className="btn btn-primary" onClick={() => setEditing(blank())}>+ New expedition</button>}
        </div>
      </div>

      <div className="split">
        <div className="stack">
          {s.expeditions.length > 1 && !editing && (
            <div className="row">
              {s.expeditions.map(x => <button key={x.id} className={`chip${x.id === selectedId ? ' on' : ''}`} onClick={() => setSelectedId(x.id)}>{x.name}</button>)}
            </div>
          )}
          {editing ? (
            <ExpeditionForm draft={editing} onCancel={s.expeditions.length ? () => setEditing(null) : undefined}
              onSave={async d => { await api.saveExpedition({ ...d, location: d.location || null, purpose: d.purpose || null, reflection: d.reflection || null, validator_name: d.validator_name || null, validator_title: d.validator_title || null, validator_contact: d.validator_contact || null }); setEditing(null); }}
              onDelete={editing.id ? async () => { await api.deleteExpedition(editing.id!); setEditing(null); setSelectedId(null); } : undefined} />
          ) : selected ? (
            <ExpeditionView x={selected} onEdit={() => setEditing({ ...selected, location: selected.location ?? '', purpose: selected.purpose ?? '', reflection: selected.reflection ?? '', validator_name: selected.validator_name ?? '', validator_title: selected.validator_title ?? '', validator_contact: selected.validator_contact ?? '' })} />
          ) : null}
        </div>

        <div className="stack">
          <div className="card pad">
            <div className="card-kicker">Requirement by level</div>
            <div className="divided" style={{ display: 'grid', gap: 8, fontSize: 13.5 }}>
              {steps.map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: e.isTarget ? 600 : 400 }}>{e.short}</span>
                  <span className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{e.expText}{e.expMet && <CheckIcon size={14} />}</span>
                </div>
              ))}
            </div>
            <p className="card-body plain" style={{ marginTop: 4 }}>Nights are counted within one continuous trip; two separate weekends don't add up.</p>
          </div>
          <div className="card pad">
            <div className="card-kicker">Completed</div>
            {credit.best ? (
              <>
                <div className="card-title">{credit.best.name}</div>
                <p className="card-body plain">{fmtISO(credit.best.start_date)} – {fmtISO(credit.best.end_date)} · {credit.days} days · {credit.nights} consecutive overnights</p>
                <div className="card-meta">{credit.best.validator_name ? <><span className="tag tag-accent-2">Validator on file</span><span>{credit.best.validator_name}</span></> : <span className="tag tag-accent">No validator yet</span>}</div>
              </>
            ) : <p className="card-body plain">Nothing completed yet. When a planned trip is done, edit it and mark it completed.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusTags({ x, targetShort, meets }: { x: Exp; targetShort: string; meets: boolean }) {
  return (
    <>
      <span className={`tag ${x.status === 'completed' ? 'tag-accent-2' : 'tag-neutral'}`}>{x.status === 'completed' ? 'Completed' : 'Planned'}</span>
      <span className={`tag ${meets ? 'tag-accent-2' : 'tag-accent'}`}>{meets ? `Meets ${targetShort} requirement` : `Too short for ${targetShort}`}</span>
    </>
  );
}

function ExpeditionView({ x, onEdit }: { x: Exp; onEdit: () => void }) {
  const nights = expeditionNights(x);
  const end = parseISODate(x.end_date);
  const past = end ? end < startOfToday() : false;
  return (
    <>
      <div className="card pad" style={{ gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div className="card-kicker">Dates</div><button className="btn btn-ghost" onClick={onEdit} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '4px 10px' }}>Edit</button></div>
        <div className="dates-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 130px', gap: 'var(--space-6)', alignItems: 'end' }}>
          <div><div className="label-sm">Start</div><div style={{ fontWeight: 600 }}>{fmtISO(x.start_date)}</div></div>
          <div><div className="label-sm">End</div><div style={{ fontWeight: 600 }}>{fmtISO(x.end_date)}</div></div>
          <div className="num" style={{ textAlign: 'right' }}><div className="big" style={{ fontSize: 32 }}>{nights}</div><div className="muted" style={{ fontSize: 11 }}>consecutive overnights</div></div>
        </div>
        {nights > 0 && <div style={{ display: 'flex', gap: 6 }}>{Array.from({ length: Math.min(nights, 14) }, (_, i) => <div key={i} style={{ flex: 1, height: 10, borderRadius: 999, background: 'var(--color-accent-2)' }} title={`Night ${i + 1}`} />)}</div>}
      </div>
      {x.itinerary.length > 0 && (
        <div className="card pad" style={{ gap: 'var(--space-3)' }}>
          <div className="card-kicker">Itinerary</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Day</th><th>Route</th><th style={{ textAlign: 'right' }}>Miles</th><th>Camp</th></tr></thead>
              <tbody>{x.itinerary.map((d, i) => <tr key={i}><td className="nowrap num">{d.day}</td><td>{d.route}</td><td className="num" style={{ textAlign: 'right' }}>{d.miles}</td><td className="text-muted">{d.camp || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
      <div className="card pad" style={{ gap: 'var(--space-3)' }}>
        <div className="card-kicker">Purpose statement</div>
        {x.purpose ? <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{x.purpose}</p> : <p className="card-body plain">Not written yet. What do you want to learn or achieve, and how does it stretch you?</p>}
      </div>
      <div className="card pad" style={{ gap: 'var(--space-3)', border: x.reflection ? undefined : '1px dashed var(--color-divider)', background: x.reflection ? undefined : 'transparent' }}>
        <div className="card-kicker" style={{ color: x.reflection ? undefined : 'var(--color-neutral-600)' }}>Post-trip reflection</div>
        {x.reflection ? <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>{x.reflection}</p>
          : <p className="card-body plain">{past ? 'The trip is over — edit it, mark it completed, and write what you planned, what happened, and what you would change.' : `Unlocks after ${fmtISO(x.end_date)}. The record book asks what you planned, what happened, and what you would change.`}</p>}
      </div>
      <div className="card pad">
        <div className="card-kicker">Validator</div>
        {x.validator_name ? (
          <div style={{ display: 'grid', gap: 4, fontSize: 14 }}><strong>{x.validator_name}</strong><span className="muted">{x.validator_title || 'Title not set'}</span><span className="muted">{x.validator_contact || 'Contact not set'}</span></div>
        ) : <p className="card-body plain">The trip leader — an adult who isn't a relative — signs off on the expedition. Add their details when you edit.</p>}
      </div>
    </>
  );
}

function ExpeditionForm({ draft, onSave, onCancel, onDelete }: { draft: Draft; onSave: (d: Draft) => Promise<void>; onCancel?: () => void; onDelete?: () => Promise<void> }) {
  const [d, setD] = useState<Draft>(draft);
  const { busy, error, run } = useAsync();
  const set = (patch: Partial<Draft>) => setD(x => ({ ...x, ...patch }));
  const start = parseISODate(d.start_date), end = parseISODate(d.end_date);
  const nights = start && end && end >= start ? expeditionNights({ start_date: d.start_date, end_date: d.end_date } as Exp) : null;
  const setDay = (i: number, patch: Partial<ItineraryDay>) => set({ itinerary: d.itinerary.map((row, j) => (j === i ? { ...row, ...patch } : row)) });
  const addDay = () => set({ itinerary: [...d.itinerary, { day: `Day ${d.itinerary.length + 1}`, route: '', miles: '', camp: '' }] });
  const problems: string[] = [];
  if (!d.name.trim()) problems.push('Give the expedition a name.');
  if (!start || !end) problems.push('Set the start and end dates.');
  else if (end < start) problems.push('The end date is before the start.');

  return (
    <form className="card pad" style={{ gap: 'var(--space-4)' }} onSubmit={e => { e.preventDefault(); if (!problems.length) void run(() => onSave({ ...d, name: d.name.trim() })); }}>
      <div className="form-grid">
        <Field label="Name"><input className="input" value={d.name} onChange={e => set({ name: e.target.value })} placeholder="Rae Lakes Loop" required /></Field>
        <Field label="Location"><input className="input" value={d.location ?? ''} onChange={e => set({ location: e.target.value })} placeholder="Kings Canyon National Park · Sierra Nevada" /></Field>
        <Field label="Start"><input className="input" type="date" value={d.start_date} onChange={e => set({ start_date: e.target.value })} required /></Field>
        <Field label="End" hint={nights !== null ? `${nights + 1} days · ${nights} consecutive overnights` : undefined}><input className="input" type="date" value={d.end_date} min={d.start_date || undefined} onChange={e => set({ end_date: e.target.value })} required /></Field>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <span className="label-sm">Status</span>
        <div className="row">
          {(['planned', 'completed'] as const).map(st => <button key={st} type="button" className={`chip${d.status === st ? ' on' : ''}`} aria-pressed={d.status === st} onClick={() => set({ status: st })} style={{ padding: '8px 18px' }}>{st === 'planned' ? 'Planned' : 'Completed'}</button>)}
        </div>
      </div>
      <Field label="Purpose statement" hint="What you'll do, with whom, and what you personally want to get out of it.">
        <textarea className="input" rows={4} value={d.purpose ?? ''} onChange={e => set({ purpose: e.target.value })} style={{ borderRadius: 'var(--radius-md)' }} />
      </Field>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="label-sm">Itinerary</span><button type="button" className="btn btn-ghost" onClick={addDay} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '4px 10px' }}>+ Add day</button></div>
        {d.itinerary.map((row, i) => (
          <div key={i} className="itin-row">
            <input className="input" value={row.day} onChange={e => setDay(i, { day: e.target.value })} placeholder="Mon 12 Jul" aria-label="Day" />
            <input className="input" value={row.route} onChange={e => setDay(i, { route: e.target.value })} placeholder="Road's End → Mist Falls → Paradise Valley" aria-label="Route" />
            <input className="input" value={row.miles} onChange={e => setDay(i, { miles: e.target.value })} placeholder="mi" aria-label="Miles" style={{ width: 70 }} />
            <input className="input" value={row.camp} onChange={e => setDay(i, { camp: e.target.value })} placeholder="Camp" aria-label="Camp" />
            <button type="button" className="link-btn small" onClick={() => set({ itinerary: d.itinerary.filter((_, j) => j !== i) })} aria-label="Remove day">✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="label-sm">Trip leader / validator <span className="muted">— adult, not a relative</span></span>
        <div className="form-grid">
          <input className="input" value={d.validator_name ?? ''} onChange={e => set({ validator_name: e.target.value })} placeholder="Full name" aria-label="Validator name" />
          <input className="input" value={d.validator_title ?? ''} onChange={e => set({ validator_title: e.target.value })} placeholder="Title · organization" aria-label="Validator title" />
          <input className="input" value={d.validator_contact ?? ''} onChange={e => set({ validator_contact: e.target.value })} placeholder="Email or phone" aria-label="Validator contact" />
        </div>
      </div>
      {d.status === 'completed' && (
        <Field label="Post-trip reflection" hint="What you planned, what happened, and what you would change.">
          <textarea className="input" rows={4} value={d.reflection ?? ''} onChange={e => set({ reflection: e.target.value })} style={{ borderRadius: 'var(--radius-md)' }} />
        </Field>
      )}
      {error && <Notice kind="block">{error}</Notice>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span>{onDelete && <button type="button" className="link-btn small" disabled={busy} onClick={() => { if (confirm('Delete this expedition?')) void run(onDelete); }}>Delete expedition</button>}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>}
          <button type="submit" className="btn btn-primary" disabled={busy || problems.length > 0} title={problems[0]}>{busy ? 'Saving…' : 'Save expedition'}</button>
        </span>
      </div>
    </form>
  );
}
