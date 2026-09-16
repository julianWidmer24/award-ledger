import { useState, type CSSProperties } from 'react';
import type { ScreenProps } from '../App';
import { ENTRY_STATUS, areaByKey, levelById, type DashboardLayout } from '../data';
import { activityById, areaProgress, expeditionSummary, gate, ladder, RING_CIRCUMFERENCE, tasks, timeline, type AreaProgress } from '../derive';
import { fmtDate, fmtDayMonth, parseISODate } from '../lib/dates';
import { usePref, useSnapshot, useStore } from '../store';
import { Bar, CheckIcon, Notice, paceColor, ringColor, useAsync, useCountUp, useMounted } from '../components/ui';
import { GettingStarted } from '../components/GettingStarted';

const LAYOUTS: [DashboardLayout, string][] = [['rings', 'Rings'], ['ledger', 'Ledger'], ['pace', 'Pace']];

export function Dashboard({ go }: ScreenProps) {
  const s = useSnapshot();
  const { api, social } = useStore();
  const [layout, setLayout] = usePref<DashboardLayout>('layout', 'rings');
  const { busy, error, run } = useAsync();
  const target = levelById(s.profile.target_level);
  const t = timeline(s.profile);
  const areas = areaProgress(s, target, t);
  const steps = ladder(s, t);
  const g = gate(target, t);
  const exp = expeditionSummary(s, target);
  const todo = tasks(s, target, t);
  const pending = s.entries.filter(e => e.status !== 'validated').length;
  const withValidator = new Set(s.activities.filter(a => a.validator_name).map(a => a.id));
  const sendable = s.entries.filter(e => e.status === 'logged' && withValidator.has(e.activity_id)).map(e => e.id);
  const sent = s.entries.filter(e => e.status === 'sent').map(e => e.id);
  const [showAll, setShowAll] = useState(false);
  const recent = showAll ? s.entries : s.entries.slice(0, 7);

  return (
    <section className="screen" aria-label="Dashboard">
      <div className="head">
        <div>
          <h6 className="eyebrow">Target level</h6>
          <h1 style={{ margin: 0, fontSize: 46 }}>{target.name}</h1>
          <p className="text-muted lede" style={{ maxWidth: 'none' }}>
            {target.vps} · {target.pd} · {target.pf} hours · {target.expText} · {target.months ? `${target.months} months minimum` : 'no minimum time'} · registered {fmtDate(t.registered)}
          </p>
        </div>
        <div className="row">
          <span className="text-muted small">Indicator style</span>
          <div className="seg" role="radiogroup" aria-label="Indicator style">
            {LAYOUTS.map(([key, label]) => (
              <label key={key} className="seg-opt" style={{ position: 'relative' }}>
                <input type="radio" name="layout" checked={layout === key} onChange={() => setLayout(key)} />{label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <GettingStarted snapshot={s} friendCount={social.friends.length} go={go} />

      <div className="ladder">
        {steps.map(lv => (
          <button key={lv.id} className="ladder-step" onClick={() => void run(() => api.updateProfile({ target_level: lv.id }))} aria-pressed={lv.isTarget} disabled={busy}
            style={{ '--step-border': lv.isTarget ? 'var(--color-accent)' : 'transparent', '--step-bg': lv.earned ? 'var(--color-accent-2-100)' : 'var(--color-surface)' } as CSSProperties}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, lineHeight: 1.2 }}>{lv.short}</span>
              {lv.earned && <CheckIcon />}
            </div>
            <div className="small muted num">{lv.reqs}</div>
            <div className="small muted">{lv.expText} · {lv.monthsText}</div>
            <div className="small" style={{ marginTop: 4, color: lv.earned ? 'var(--color-accent-2-700)' : lv.isTarget ? 'var(--color-text)' : 'var(--color-neutral-700)' }}>{lv.status}</div>
          </button>
        ))}
      </div>
      {error && <Notice kind="block">{error}</Notice>}

      {layout === 'rings' && <Rings areas={areas} />}
      {layout === 'ledger' && <Ledger areas={areas} timePct={t.timePct} />}
      {layout === 'pace' && <Pace areas={areas} />}

      <div className="grid-auto wide">
        <div className="card pad">
          <div className="card-kicker">Time gate</div>
          <div className="stat"><CountUp className="big" style={{ fontSize: 36 }} value={t.monthsElapsed} /><span className="muted">of {target.months} months since registration</span></div>
          <Bar value={g.pct} color="var(--color-accent-2)" />
          <p className="card-body plain">{g.text}</p>
        </div>
        <div className="card pad" style={{ background: 'var(--color-accent-100)' }}>
          <div className="card-kicker">Deadline · 24th birthday</div>
          {t.deadline ? (
            <>
              <div className="stat"><CountUp className="big" style={{ fontSize: 36 }} value={t.daysLeft} /><span className="muted">days left · {fmtDate(t.deadline)}</span></div>
              <Bar value={t.timePct} track="var(--color-accent-200)" />
              <p className="card-body plain">{t.timePct}% of the window between registration and your 24th birthday has passed. Everything, including the expedition and advisor sign-off, must be complete by then.</p>
            </>
          ) : (
            <p className="card-body plain">Add your date of birth in <button className="link-btn" onClick={() => go('settings')}>Settings</button> to see the deadline and pace math.</p>
          )}
        </div>
        <div className="card pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div className="card-kicker">Expedition</div><span className={`tag ${exp.tagClass}`}>{exp.status}</span></div>
          <div className="card-title">{exp.name}</div>
          <p className="card-body plain">{exp.detail}</p>
          <div className="card-meta">{exp.meta}</div>
        </div>
      </div>

      <div>
        <div className="section-head">
          <h4>This week</h4>
          <span className="text-muted small">{todo.length ? `${todo.filter(x => x.urgent).length} urgent · ${todo.length} open` : 'Nothing outstanding'}</span>
        </div>
        {todo.length === 0 ? (
          <div className="card pad"><p className="card-body plain">All caught up. Log a session or check on your friends.</p></div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {todo.map(task => (
              <button key={task.id} className={`task${task.urgent ? ' today' : ''}`} onClick={() => go(task.screen)} style={{ font: 'inherit', color: 'inherit', textAlign: 'left', gridTemplateColumns: '1fr auto' }}>
                <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{task.title}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>{task.sub}</span>
                </span>
                <span className="nowrap" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {task.urgent && <span className="tag tag-accent" style={{ fontWeight: 600 }}>Now</span>}
                  <span className="text-muted small">{SCREEN_NAMES[task.screen]} →</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="section-head">
          <h4>Recent entries</h4>
          <span className="row" style={{ gap: 8 }}>
            <span className="text-muted small">{pending} awaiting validation</span>
            {sendable.length > 0 && <button className="btn btn-secondary" disabled={busy} onClick={() => void run(() => api.setEntryStatus(sendable, 'sent'))} style={{ padding: '4px 12px', fontSize: 13 }}>Send {sendable.length} for validation</button>}
            {sent.length > 0 && <button className="btn btn-ghost" disabled={busy} onClick={() => void run(() => api.setEntryStatus(sent, 'validated'))} style={{ padding: '4px 10px', fontSize: 13, fontFamily: 'var(--font-body)' }}>Mark {sent.length} validated</button>}
          </span>
        </div>
        {s.entries.length === 0 ? (
          <div className="card pad"><p className="card-body plain">No sessions yet. <button className="link-btn" onClick={() => go('log')}>Log your first one</button> — anything since {fmtDate(t.registered)} counts.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Activity</th><th>Area</th><th style={{ textAlign: 'right' }}>Hours</th><th>Validator</th><th>Status</th><th /></tr></thead>
              <tbody>
                {recent.map(e => {
                  const act = activityById(s, e.activity_id);
                  const date = parseISODate(e.date);
                  const [label, tagClass] = ENTRY_STATUS[e.status];
                  return (
                    <tr key={e.id}>
                      <td className="nowrap num">{date ? fmtDayMonth(date) : e.date}</td>
                      <td>{act?.name ?? '—'}{e.description && <div className="small muted">{e.description}</div>}</td>
                      <td className="text-muted">{act ? areaByKey(act.area).label : '—'}</td>
                      <td className="num" style={{ textAlign: 'right' }}>{e.hours}</td>
                      <td className="text-muted" style={{ fontSize: 13 }}>{act?.validator_name ?? '— none set'}</td>
                      <td><span className={`tag ${tagClass}`}>{label}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        {e.status === 'logged' && <button className="link-btn small" disabled={busy} onClick={() => { if (confirm('Delete this entry?')) void run(() => api.deleteEntry(e.id)); }}>Delete</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {s.entries.length > 7 && <button className="btn btn-ghost" onClick={() => setShowAll(x => !x)} style={{ marginTop: 8, fontFamily: 'var(--font-body)', fontSize: 13 }}>{showAll ? 'Show fewer' : `Show all ${s.entries.length}`}</button>}
          </div>
        )}
      </div>
    </section>
  );
}

const SCREEN_NAMES = { dash: 'Dashboard', log: 'Log', goals: 'Goals', exp: 'Expedition', friends: 'Friends', friend: 'Friend', book: 'Record book', resources: 'Resources', settings: 'Settings' } as const;

function CountUp({ value, decimals = 0, className, style }: { value: number; decimals?: number; className?: string; style?: CSSProperties }) {
  const shown = useCountUp(value, decimals);
  return <span className={className} style={style}>{shown}</span>;
}

function Rings({ areas }: { areas: AreaProgress[] }) {
  const mounted = useMounted();
  return (
    <div className="grid-auto">
      {areas.map(a => (
        <div key={a.key} className="card pad" style={{ gap: 'var(--space-3)' }}>
          <div className="card-kicker">{a.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div className="ring">
              <svg viewBox="0 0 100 100" width="132" height="132" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-neutral-300)" strokeWidth="9" />
                <circle className="ring-anim" cx="50" cy="50" r="42" fill="none" stroke={ringColor(a.onPace)} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${((mounted ? a.pct : 0) * RING_CIRCUMFERENCE).toFixed(1)} ${RING_CIRCUMFERENCE}`} transform="rotate(-90 50 50)" />
              </svg>
              <div className="ring-label">
                <CountUp className="big" style={{ fontSize: 34 }} value={a.done} decimals={Number.isInteger(a.done) ? 0 : 1} />
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>of {a.req} h</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
              <div><div className="big" style={{ fontSize: 22 }}><CountUp value={a.remaining} decimals={Number.isInteger(a.remaining) ? 0 : 1} /> h</div><div className="small muted">remaining</div></div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12.5, lineHeight: 1.35 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: paceColor(a.onPace), flex: 'none', marginTop: 4 }} />
                <span><strong style={{ fontWeight: 600, color: paceColor(a.onPace) }}>{a.paceLabel}</strong><br /><span className="muted">{a.paceDetail}</span></span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Ledger({ areas, timePct }: { areas: AreaProgress[]; timePct: number }) {
  return (
    <div className="card" style={{ padding: 'var(--space-2) var(--space-4)', gap: 0 }}>
      {areas.map(a => (
        <div key={a.key} className="ledger-row">
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{a.name}</div>
          <div className="num"><span className="big" style={{ fontSize: 36 }}>{a.done}</span><span className="muted" style={{ fontSize: 13 }}> / {a.req}</span></div>
          <Bar value={a.pct * 100} color={ringColor(a.onPace)} thick><div className="time-marker" style={{ left: `${timePct}%` }} title="Time elapsed" /></Bar>
          <div className="num" style={{ textAlign: 'right' }}><div className="big" style={{ fontSize: 20 }}>{a.remaining} h</div><div className="muted" style={{ fontSize: 11 }}>remaining</div></div>
          <div className="pace" style={{ fontSize: 12.5, lineHeight: 1.35 }}><strong style={{ fontWeight: 600, color: paceColor(a.onPace) }}>{a.paceLabel}</strong><br /><span className="muted">{a.paceDetail}</span></div>
        </div>
      ))}
      <div className="muted" style={{ display: 'flex', gap: 16, padding: 'var(--space-2) 0', fontSize: 11 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 2, height: 10, background: 'var(--color-text)', opacity: 0.6, display: 'inline-block' }} />Time elapsed toward deadline ({timePct}%)</span>
      </div>
    </div>
  );
}

function Pace({ areas }: { areas: AreaProgress[] }) {
  return (
    <div className="grid-auto">
      {areas.map(a => (
        <div key={a.key} className="card pad" style={{ gap: 'var(--space-3)', background: a.onPace ? 'var(--color-surface)' : 'var(--color-accent-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><div className="card-kicker">{a.name}</div><span className="small" style={{ fontWeight: 600, color: paceColor(a.onPace) }}>{a.paceLabel}</span></div>
          <div className="stat"><span className="big" style={{ fontSize: 44 }}>{a.done}</span><span className="muted">/ {a.req} h</span></div>
          <div className="small muted" style={{ display: 'grid', gap: 6 }}>
            <PaceRow label="Logging" value={`${a.pace.toFixed(1)} h/wk`} />
            <PaceRow label="Needed by deadline" value={`${a.need.toFixed(1)} h/wk`} />
            <PaceRow label="At current pace, done" value={a.eta} color={paceColor(a.onPace)} />
          </div>
          <Bar value={a.pct * 100} color={ringColor(a.onPace)} />
        </div>
      ))}
    </div>
  );
}

function PaceRow({ label, value, color = 'var(--color-text)' }: { label: string; value: string; color?: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ flex: 1 }}>{label}</span><strong className="nowrap" style={{ color, fontWeight: 600 }}>{value}</strong></div>;
}
