import { useEffect, useState } from 'react';
import type { ScreenProps } from '../App';
import { AREAS, ENTRY_STATUS, GOAL_AREAS, GOAL_STATUS, areaByKey, levelById } from '../data';
import { fmtDayMonth, fmtISO, fmtMonth, parseISODate } from '../lib/dates';
import { useStore } from '../store';
import { Avatar, Bar, Notice, ringColor } from '../components/ui';
import { errorMessage } from '../lib/supabase';
import type { FriendProfile } from '../types';

/** A friend's shared view: target and hours, written goals, and their log — never descriptions or validators. */
export function FriendProfileScreen({ go, friendId }: ScreenProps & { friendId: string }) {
  const { api, social } = useStore();
  const [fp, setFp] = useState<FriendProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summary = social.friends.find(f => f.id === friendId);

  useEffect(() => {
    let live = true;
    setFp(null); setError(null);
    api.friendProfile(friendId).then(p => { if (live) setFp(p); }).catch(e => { if (live) setError(errorMessage(e)); });
    return () => { live = false; };
  }, [api, friendId]);

  if (error) return <section className="screen"><Notice kind="block">{error}</Notice><button className="btn btn-secondary" onClick={() => go('friends')} style={{ justifySelf: 'start' }}>← Back to friends</button></section>;
  if (!fp) return <section className="screen"><p className="text-muted">Loading {summary?.display_name ?? 'profile'}…</p></section>;

  const lv = fp.target_level ? levelById(fp.target_level) : null;
  const hours = fp.hours;
  const totalHours = hours ? Object.values(hours).reduce((n, h) => n + (h ?? 0), 0) : null;
  const hidden = (what: string) => <p className="card-body plain">{fp.display_name.split(' ')[0]} keeps {what} private.</p>;

  return (
    <section className="screen" aria-label={`${fp.display_name}'s profile`}>
      <button className="link-btn small" onClick={() => go('friends')} style={{ justifySelf: 'start' }}>← Back to friends</button>
      <div className="head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Avatar name={fp.display_name} url={fp.avatar_url} size={72} style={{ background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', fontSize: 26 }} />
          <div>
            <h6 className="eyebrow">Friend</h6>
            <h1 style={{ margin: 0, fontSize: 38 }}>{fp.display_name}</h1>
            <p className="text-muted lede">{[fp.school, lv ? `Target ${lv.name}` : null, fp.registered_on ? `registered ${fmtMonth(parseISODate(fp.registered_on)!)}` : null].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        {summary && <span className={`tag ${summary.week_hours ? 'tag-accent-2' : 'tag-neutral'}`}>{summary.week_hours ?? 0} h this week</span>}
      </div>

      <div className="grid-auto">
        {AREAS.map(a => {
          const done = hours ? hours[a.key] ?? 0 : null;
          const req = lv ? lv[a.key] : null;
          return (
            <div key={a.key} className="card pad" style={{ gap: 8 }}>
              <div className="card-kicker">{a.name}</div>
              {done === null ? <p className="card-body plain">Hours hidden</p> : (
                <>
                  <div className="stat"><span className="big" style={{ fontSize: 34 }}>{Math.round(done * 10) / 10}</span><span className="muted">{req ? `/ ${req} h` : 'h'}</span></div>
                  {req && <Bar value={Math.min(100, done / req * 100)} color={ringColor(true)} />}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="split">
        <div className="stack">
          <div className="card pad" style={{ gap: 'var(--space-3)' }}>
            <div className="section-head" style={{ marginBottom: 0 }}><h4>Written goals</h4>{fp.goals && <span className="text-muted small">{fp.goals.filter(g => g.status === 'signed').length} of 4 signed</span>}</div>
            {!fp.shares.goals ? hidden('their goals') : fp.goals!.length === 0 ? <p className="card-body plain">No goals written yet.</p> : (
              <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {GOAL_AREAS.map(ga => {
                  const g = fp.goals!.find(x => x.area === ga.key);
                  if (!g) return null;
                  const [st, cls] = GOAL_STATUS[g.status];
                  return (
                    <div key={ga.key} className="card" style={{ background: 'var(--color-bg)', padding: 'var(--space-3) var(--space-4)', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="card-kicker">{ga.name}</span><span className={`tag ${cls}`}>{st}</span></div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{g.title}</div>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>{g.text}</p>
                      <div className="card-meta">v{g.version} · {fmtISO(g.dated)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="stack">
          <div className="card pad" style={{ gap: 'var(--space-3)' }}>
            <div className="section-head" style={{ marginBottom: 0 }}><h4>Log</h4>{fp.entries && <span className="text-muted small">{totalHours !== null ? `${Math.round(totalHours * 10) / 10} h total` : `${fp.entries.length} entries`}</span>}</div>
            {!fp.shares.logs ? hidden('their log') : fp.entries!.length === 0 ? <p className="card-body plain">Nothing logged yet.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Activity</th><th style={{ textAlign: 'right' }}>Hours</th><th>Status</th></tr></thead>
                  <tbody>
                    {fp.entries!.map(e => {
                      const d = parseISODate(e.date);
                      const [label, cls] = ENTRY_STATUS[e.status];
                      return (
                        <tr key={e.id}>
                          <td className="nowrap num">{d ? fmtDayMonth(d) : e.date}</td>
                          <td>{e.activity}<div className="small muted">{areaByKey(e.area).label}</div></td>
                          <td className="num" style={{ textAlign: 'right' }}>{e.hours}</td>
                          <td><span className={`tag ${cls}`}>{label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
