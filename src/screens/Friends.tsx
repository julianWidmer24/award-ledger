import { useState, type CSSProperties } from 'react';
import type { ScreenProps } from '../App';
import { AREAS, SHARE, levelById } from '../data';
import { areaProgress, timeline, weekHours } from '../derive';
import { fmtISO, parseISODate, startOfToday, timeAgo } from '../lib/dates';
import { useSnapshot, useStore } from '../store';
import { Avatar, Bar, Field, Notice, ringColor, useAsync } from '../components/ui';
import type { FriendSummary } from '../types';
import { DAY_MS, fmtMonth } from '../lib/dates';

export function Friends(_: ScreenProps) {
  const s = useSnapshot();
  const { api, social, session } = useStore();
  const [inviteOpen, setInviteOpen] = useState(social.friends.length === 0 && social.requests.length === 0);
  const [inviteCode, setInviteCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const invite = useAsync();
  const act = useAsync();
  const t = timeline(s.profile);
  const myTarget = levelById(s.profile.target_level);
  const myAreas = areaProgress(s, myTarget, t);
  const myWeek = weekHours(s, t);
  const me = session?.user.id;

  return (
    <section className="screen" aria-label="Friends">
      <div className="head">
        <div>
          <h6 className="eyebrow">Friends</h6>
          <h1 style={{ margin: 0 }}>Working on it together</h1>
          <p className="text-muted lede">Friends see your hours and pace, you see theirs. No scores, no leaderboard — just a weekly check-in on who logged what.</p>
        </div>
        <div className="row">
          <span className="text-muted small">Your friend code</span>
          <span className="tag tag-neutral" style={{ fontFamily: 'var(--font-heading)', fontSize: 13, padding: '6px 14px', letterSpacing: '.06em' }}>{s.profile.friend_code}</span>
          <button className="btn btn-primary" onClick={() => setInviteOpen(o => !o)} aria-expanded={inviteOpen}>Add a friend</button>
        </div>
      </div>

      {inviteOpen && (
        <form className="card pad" style={{ gap: 'var(--space-3)', border: '2px solid var(--color-accent)' }}
          onSubmit={e => { e.preventDefault(); void invite.run(async () => { const name = await api.sendFriendRequest(inviteCode); setSentTo(name); setInviteCode(''); }); }}>
          <div className="card-kicker">Add a friend</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 'var(--space-2)', alignItems: 'end' }}>
            <Field label="Their friend code"><input className="input" placeholder="e.g. OAK-7Q2M" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} autoFocus /></Field>
            <button type="submit" className="btn btn-secondary" disabled={invite.busy || inviteCode.trim().length < 6}>Send request</button>
          </div>
          {sentTo && <Notice kind="ok">Request sent to {sentTo}.</Notice>}
          {invite.error && <Notice kind="block">{invite.error}</Notice>}
          <p className="card-body plain">They will see your hours per area, target level and pace once they accept. Descriptions, validators and contact details are never shared.</p>
        </form>
      )}
      {act.error && <Notice kind="block">{act.error}</Notice>}

      <div className="split">
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {social.requests.map(rq => (
            <div key={rq.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)', flexDirection: 'row', alignItems: 'center', gap: 'var(--space-3)', background: 'var(--color-accent-100)', flexWrap: 'wrap' }}>
              <Avatar name={rq.display_name} url={rq.avatar_url} size={40} style={{ background: 'var(--color-accent-300)', color: 'var(--color-accent-900)' }} />
              <div style={{ flex: 1, minWidth: 160 }}><div style={{ fontWeight: 600 }}>{rq.display_name}</div><div className="muted" style={{ fontSize: 12.5 }}>{rq.school ? rq.school + ' · ' : ''}wants to be friends · {timeAgo(rq.created_at)}</div></div>
              <button className="btn btn-secondary" disabled={act.busy} onClick={() => void act.run(() => api.respondRequest(rq.id, false))}>Decline</button>
              <button className="btn btn-primary" disabled={act.busy} onClick={() => void act.run(() => api.respondRequest(rq.id, true))}>Accept</button>
            </div>
          ))}
          {social.friends.length === 0 && social.requests.length === 0 && (
            <div className="card pad"><p className="card-body plain">No friends yet. Share your code <strong>{s.profile.friend_code}</strong> with someone doing the award, or enter theirs above.</p></div>
          )}
          {social.friends.map(fr => <FriendCard key={fr.id} fr={fr} myWeek={myWeek} me={me} />)}
        </div>

        <div className="stack">
          <div className="card pad" style={{ gap: 'var(--space-3)' }}>
            <div className="card-kicker">What friends see of you</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Avatar name={s.profile.display_name} url={s.profile.avatar_url} style={{ background: 'var(--color-accent-2-300)', color: 'var(--color-accent-2-900)' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{s.profile.sharing.target ? myTarget.name : 'Target hidden'}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{s.profile.sharing.week ? `${myWeek} h this week` : 'Weekly hours hidden'}{t.deadline ? ` · ${t.timePct}% of time used` : ''}</div>
              </div>
            </div>
            {s.profile.sharing.hours ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {myAreas.map(a => (
                  <div key={a.key} style={{ display: 'grid', gap: 4 }}>
                    <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between' }}><span>{a.label}</span><span className="num nowrap" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{a.done}&nbsp;/&nbsp;{a.req}&nbsp;h</span></div>
                    <Bar value={a.pct * 100} color={ringColor(a.onPace)} />
                  </div>
                ))}
              </div>
            ) : <p className="card-body plain">Hours per area are hidden.</p>}
          </div>

          <div className="card pad">
            <div className="card-kicker">Sharing</div>
            {SHARE.map(([key, label, sub]) => (
              <label key={key} className="toggle-row" style={{ minHeight: 40 }}>
                <span style={{ display: 'grid' }}><span>{label}</span><span className="small muted">{sub}</span></span>
                <input type="checkbox" className="checkbox" checked={s.profile.sharing[key]} disabled={act.busy}
                  onChange={() => void act.run(() => api.updateProfile({ sharing: { ...s.profile.sharing, [key]: !s.profile.sharing[key] } }))} />
              </label>
            ))}
          </div>

          <div className="card pad">
            <div className="card-kicker">Check-ins</div>
            {social.checkins.length === 0 ? <p className="card-body plain">Check-ins you send and receive show up here.</p> : (
              <div className="divided">
                {social.checkins.map(ci => (
                  <div key={ci.id} className="bullet" style={{ '--dot': 'var(--color-accent-2)' } as CSSProperties}>
                    <span style={{ flex: 1 }}>{ci.from_user === me ? `You → ${ci.to_name}` : `${ci.from_name}`}: “{ci.message}”</span>
                    <span className="text-muted small nowrap">{timeAgo(ci.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FriendCard({ fr, myWeek, me }: { fr: FriendSummary; myWeek: number; me?: string }) {
  const { api, social } = useStore();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const { busy, error, run } = useAsync();
  const lv = fr.target_level ? levelById(fr.target_level) : null;
  const hours = fr.hours_vps !== null ? { vps: fr.hours_vps, pd: fr.hours_pd ?? 0, pf: fr.hours_pf ?? 0 } : null;
  // Pace from what they share: remaining hours vs. weeks to their 24th birthday is theirs alone, so
  // we approximate with hours vs. time since registration against the target's minimum months.
  let pace: 'on' | 'behind' | null = null;
  if (hours && lv && fr.registered_on) {
    const reg = parseISODate(fr.registered_on)!;
    const weeks = Math.max(1, (startOfToday().getTime() - reg.getTime()) / DAY_MS / 7);
    const monthsTarget = Math.max(lv.months, 6);
    const expected = Math.min(1, weeks / (monthsTarget * 4.33));
    const done = (hours.vps / lv.vps + hours.pd / lv.pd + hours.pf / lv.pf) / 3;
    pace = done >= expected * 0.85 ? 'on' : 'behind';
  }
  const on = pace !== 'behind';
  const lastCheckin = social.checkins.find(c => c.from_user === me && c.to_user === fr.id);
  const recentlyNudged = lastCheckin && Date.now() - new Date(lastCheckin.created_at).getTime() < 3 * DAY_MS;

  return (
    <div className="card pad" style={{ gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Avatar name={fr.display_name} url={fr.avatar_url} style={{ background: on ? 'var(--color-accent-2-200)' : 'var(--color-accent-200)', color: on ? 'var(--color-accent-2-900)' : 'var(--color-accent-900)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}><span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>{fr.display_name}</span>{fr.school && <span className="text-muted" style={{ fontSize: 12.5 }}>{fr.school}</span>}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {lv ? `Target ${lv.short}` : 'Target hidden'}{fr.registered_on ? ` · registered ${fmtMonth(parseISODate(fr.registered_on)!)}` : ''} · {fr.last_logged ? `last logged ${fmtISO(fr.last_logged)}` : 'nothing logged yet'}
          </div>
        </div>
        {pace && <span className={`tag ${on ? 'tag-accent-2' : 'tag-accent'}`}>{on ? 'On pace' : 'Behind pace'}</span>}
      </div>
      {hours && lv ? (
        <div className="friend-areas" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
          {AREAS.map(a => (
            <div key={a.key} style={{ display: 'grid', gap: 5 }}>
              <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><span>{a.label}</span><span className="num nowrap" style={{ color: 'var(--color-text)', fontWeight: 600 }}>{hours[a.key]} / {lv[a.key]}</span></div>
              <Bar value={Math.min(100, hours[a.key] / lv[a.key] * 100)} color={ringColor(on)} />
            </div>
          ))}
        </div>
      ) : <p className="card-body plain">{hours ? `${hours.vps + hours.pd + hours.pf} h logged in total.` : 'Hours hidden by this friend.'}</p>}
      {fr.activity_names && fr.activity_names.length > 0 && <div className="row" style={{ gap: 6 }}>{fr.activity_names.map(n => <span key={n} className="tag tag-neutral">{n}</span>)}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span className="muted nowrap" style={{ fontSize: 13 }}>
          This week: <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{fr.week_hours ?? '—'}&nbsp;h</strong> · you: <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>{myWeek}&nbsp;h</strong>
        </span>
        <span className="row" style={{ gap: 4 }}>
          <button className="link-btn small" disabled={busy} onClick={() => { if (confirm(`Remove ${fr.display_name} as a friend?`)) void run(() => api.removeFriend(fr.friendship_id)); }}>Remove</button>
          <button className="btn btn-ghost" disabled={busy || recentlyNudged} onClick={() => setOpen(o => !o)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '6px 12px' }}>{recentlyNudged ? 'Check-in sent' : 'Send a check-in'}</button>
        </span>
      </div>
      {open && !recentlyNudged && (
        <form style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }} onSubmit={e => { e.preventDefault(); void run(async () => { await api.sendCheckin(fr.id, msg.trim() || 'Checking in — how is this week going?'); setOpen(false); setMsg(''); }); }}>
          <input className="input" value={msg} onChange={e => setMsg(e.target.value)} maxLength={280} placeholder="Training hike Saturday? I'm in." autoFocus />
          <button type="submit" className="btn btn-primary" disabled={busy}>Send</button>
        </form>
      )}
      {error && <Notice kind="block">{error}</Notice>}
    </div>
  );
}
