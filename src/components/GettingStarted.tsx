import { useState } from 'react';
import type { Screen } from '../data';
import { gettingStarted, type Snapshot } from '../derive';
import { CheckIcon, ArrowIcon } from './ui';

/** First-run checklist on the dashboard. Items tick themselves off from real data; the card hides once dismissed or complete. */
export function GettingStarted({ snapshot, friendCount, go }: { snapshot: Snapshot; friendCount: number; go: (s: Screen) => void }) {
  const key = `award-ledger:started-dismissed:${snapshot.profile.id}`;
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const items = gettingStarted(snapshot, friendCount);
  const done = items.filter(i => i.done).length;
  if (dismissed || done === items.length) return null;

  const dismiss = () => { setDismissed(true); try { localStorage.setItem(key, '1'); } catch { /* fine */ } };

  return (
    <div className="card pad started" style={{ gap: 'var(--space-3)', border: '2px solid var(--color-accent-2-400)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="card-kicker" style={{ color: 'var(--color-accent-2-700)' }}>Getting started</div>
          <div className="card-title" style={{ fontSize: 20 }}>{done === 0 ? 'Five things that set you up' : `${done} of ${items.length} done`}</div>
        </div>
        <button className="btn btn-ghost" onClick={dismiss} style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>Hide this</button>
      </div>
      <div className="started-grid">
        {items.map(i => (
          <button key={i.id} className={`started-item${i.done ? ' done' : ''}`} onClick={() => go(i.screen)} disabled={i.done}>
            <span className="started-check">{i.done ? <CheckIcon size={14} stroke="var(--color-bg)" /> : null}</span>
            <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{i.label}</span>
              <span className="small muted" style={{ lineHeight: 1.4 }}>{i.why}</span>
            </span>
            {!i.done && <span className="muted" style={{ alignSelf: 'center' }}><ArrowIcon /></span>}
          </button>
        ))}
      </div>
    </div>
  );
}
