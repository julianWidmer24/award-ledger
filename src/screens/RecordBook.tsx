import type { ScreenProps } from '../App';
import { levelById } from '../data';
import { areaProgress, expeditionCredit, recordBookSections, timeline } from '../derive';
import { useSnapshot } from '../store';
import { Bar } from '../components/ui';

export function RecordBook({ go }: ScreenProps) {
  const s = useSnapshot();
  const t = timeline(s.profile);
  const target = levelById(s.profile.target_level);
  const sections = recordBookSections(s, target, t);
  const issueCount = sections.reduce((n, x) => n + x.issues.length, 0);
  const totals = areaProgress(s, target, t);
  const credit = expeditionCredit(s);

  return (
    <section className="screen" aria-label="Record book export">
      <div className="head">
        <div>
          <h6 className="eyebrow">Record book</h6>
          <h1 style={{ margin: 0 }}>{target.name} submission</h1>
          <p className="text-muted lede">Preview of the structured record book as it will be exported. Change the level on the dashboard to check a different submission.</p>
        </div>
        <div className="row no-print">
          <button className="btn btn-secondary" onClick={() => window.print()}>Preview draft PDF</button>
          <button className="btn btn-primary" disabled={issueCount > 0} onClick={() => window.print()} title={issueCount ? 'Resolve the listed items first' : 'Print or save as PDF'}>Export record book</button>
        </div>
      </div>

      <div className="split">
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {sections.map(x => (
            <div key={x.n} className="card" style={{ padding: 'var(--space-3) var(--space-4)', gap: 8 }}>
              <div className="section-row">
                <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-neutral-600)' }}>{x.n}</span>
                <div><div style={{ fontFamily: 'var(--font-heading)', fontSize: 17 }}>{x.title}</div><div className="muted" style={{ fontSize: 12.5 }}>{x.sub}</div></div>
                <Bar value={x.pct} color={x.pct === 100 ? 'var(--color-accent-2)' : 'var(--color-accent)'} />
                <span className={`tag ${x.tagClass}`} style={{ minWidth: 86, justifyContent: 'center' }}>{x.state}</span>
              </div>
              {x.issues.map(issue => <div key={issue} className="bullet issue"><span>{issue}</span></div>)}
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="card pad" style={{ background: issueCount ? 'var(--color-accent-100)' : 'var(--color-accent-2-100)' }}>
            <div className="card-kicker" style={{ color: issueCount ? undefined : 'var(--color-accent-2-700)' }}>{issueCount ? 'Export blocked' : 'Ready to export'}</div>
            <div className="big" style={{ fontSize: 40 }}>{issueCount}</div>
            <p className="card-body plain">{issueCount ? `items to resolve before the record book can be exported. Hour totals keep blocking until each area reaches the ${target.short} minimum.` : 'Every section is complete. Print it, then take it to your advisor for the final signature.'}</p>
          </div>
          <div className="card pad">
            <div className="card-kicker">Totals</div>
            <div className="num" style={{ display: 'grid', gap: 6, fontSize: 14 }}>
              {totals.map(a => (
                <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--color-divider)', padding: '6px 0' }}>
                  <span>{a.label}</span><span className="nowrap"><strong style={{ fontWeight: 600 }}>{a.done}</strong><span className="muted"> / {a.req} h</span></span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>Expedition</span>
                <span className="muted">{target.expNights ? `${Math.min(credit.nights, target.expNights)} of ${target.expNights} overnights` : `${Math.min(credit.days, target.expDays)} of ${target.expDays} days`}</span>
              </div>
            </div>
          </div>
          <div className="card pad no-print">
            <div className="card-kicker">Validators on file</div>
            {s.activities.filter(a => !a.archived).length === 0 ? <p className="card-body plain">No activities yet.</p> : (
              <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
                {s.activities.filter(a => !a.archived).map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--color-divider)', padding: '6px 0' }}>
                    <span style={{ minWidth: 0 }}>{a.name}</span>
                    <span className={`tag ${a.validator_name && a.validator_title && a.validator_contact ? 'tag-accent-2' : 'tag-accent'}`} style={{ flex: 'none' }}>{a.validator_name ? (a.validator_title && a.validator_contact ? 'Complete' : 'Partial') : 'Missing'}</span>
                  </div>
                ))}
                <button className="link-btn small" onClick={() => go('settings')} style={{ justifySelf: 'start', marginTop: 4 }}>Edit validators in Settings →</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
