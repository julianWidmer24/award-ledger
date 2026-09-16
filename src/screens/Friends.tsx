import { useEffect, useState } from 'react';
import type { ScreenProps } from '../App';
import { SHARE, levelById, shareOn } from '../data';
import { DAY_MS, parseISODate, startOfToday, timeAgo } from '../lib/dates';
import { useSnapshot, useStore } from '../store';
import { Avatar, Field, Notice, useAsync } from '../components/ui';
import { Composer } from '../components/Composer';
import { PostCard } from '../components/PostCard';
import { errorMessage } from '../lib/supabase';
import type { FriendSummary } from '../types';

/** The Friends page is the feed: your posts and your friends', with the friend list alongside. */
export function Friends({ go, shareParam }: ScreenProps & { shareParam?: string }) {
  const s = useSnapshot();
  const { api, social, feed, session } = useStore();
  const me = session?.user.id ?? '';
  const [feedError, setFeedError] = useState<string | null>(null);
  const presetEntry = shareParam?.startsWith('entry:') ? shareParam.slice(6) : undefined;

  useEffect(() => { api.loadFeed().catch(e => setFeedError(errorMessage(e))); /* eslint-disable-line */ }, [social.friends.length]);

  return (
    <section className="screen" aria-label="Friends">
      <div className="head">
        <div>
          <h6 className="eyebrow">Friends</h6>
          <h1 style={{ margin: 0 }}>Working on it together</h1>
          <p className="text-muted lede">Post a session, a trip, a few photos. Friends give kudos and comment. No scores, no leaderboard.</p>
        </div>
        <FriendStrip friends={social.friends} go={go} />
      </div>

      <div className="feed-layout">
        <div className="feed">
          <Composer presetEntry={presetEntry} onPosted={() => { if (presetEntry) go('friends'); }} />
          {feedError && <Notice kind="block">{feedError}</Notice>}
          {feed === null && !feedError && <div className="card pad"><p className="card-body plain">Loading the feed…</p></div>}
          {feed && feed.length === 0 && (
            <div className="card pad"><p className="card-body plain">Nothing here yet. {social.friends.length ? 'Post something — your friends will see it.' : `Share your code ${s.profile.friend_code} with someone doing the award, or enter theirs in the panel.`}</p></div>
          )}
          {feed?.map(p => <PostCard key={p.id} post={p} me={me} go={go} />)}
        </div>

        <aside className="stack feed-side">
          <AddFriend />
          {social.requests.length > 0 && <Requests />}
          <FriendList friends={social.friends} go={go} />
          <div className="card pad">
            <div className="card-kicker">Sharing</div>
            <p className="small muted" style={{ margin: 0 }}>Posts are always visible to friends. These control what friends see on your profile.</p>
            <SharingToggles />
          </div>
        </aside>
      </div>
    </section>
  );
}

function FriendStrip({ friends, go }: { friends: FriendSummary[]; go: ScreenProps['go'] }) {
  if (!friends.length) return null;
  return (
    <div className="friend-strip" aria-label="Your friends">
      {friends.map(f => (
        <button key={f.id} className="friend-chip" onClick={() => go('friend', f.id)}>
          <Avatar name={f.display_name} url={f.avatar_url} size={48} style={{ background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)' }} />
          <span>{f.display_name.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  );
}

function AddFriend() {
  const s = useSnapshot();
  const { api } = useStore();
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { busy, error, run } = useAsync();
  return (
    <form className="card pad" style={{ gap: 'var(--space-2)' }} onSubmit={e => { e.preventDefault(); void run(async () => { const name = await api.sendFriendRequest(code); setSentTo(name); setCode(''); }); }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="card-kicker">Your friend code</div>
        <span className="tag tag-neutral" style={{ fontFamily: 'var(--font-heading)', fontSize: 13, padding: '6px 14px', letterSpacing: '.06em' }}>{s.profile.friend_code}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, alignItems: 'end' }}>
        <Field label="Add a friend by their code"><input className="input" placeholder="e.g. OAK-7Q2M" value={code} onChange={e => setCode(e.target.value.toUpperCase())} /></Field>
        <button type="submit" className="btn btn-secondary" disabled={busy || code.trim().length < 6}>Send</button>
      </div>
      {sentTo && <Notice kind="ok">Request sent to {sentTo}.</Notice>}
      {error && <Notice kind="block">{error}</Notice>}
    </form>
  );
}

function Requests() {
  const { api, social } = useStore();
  const { busy, error, run } = useAsync();
  return (
    <div className="card pad" style={{ gap: 'var(--space-2)', background: 'var(--color-accent-100)' }}>
      <div className="card-kicker">Friend requests</div>
      {social.requests.map(rq => (
        <div key={rq.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Avatar name={rq.display_name} url={rq.avatar_url} size={36} style={{ background: 'var(--color-accent-300)', color: 'var(--color-accent-900)' }} />
          <div style={{ flex: 1, minWidth: 120 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{rq.display_name}</div><div className="small muted">{rq.school ? rq.school + ' · ' : ''}{timeAgo(rq.created_at)}</div></div>
          <button className="link-btn small" disabled={busy} onClick={() => void run(() => api.respondRequest(rq.id, false))}>Decline</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void run(() => api.respondRequest(rq.id, true))} style={{ padding: '6px 12px', fontSize: 13 }}>Accept</button>
        </div>
      ))}
      {error && <Notice kind="block">{error}</Notice>}
    </div>
  );
}

function FriendList({ friends, go }: { friends: FriendSummary[]; go: ScreenProps['go'] }) {
  const { api } = useStore();
  const { busy, run } = useAsync();
  return (
    <div className="card pad" style={{ gap: 4 }}>
      <div className="card-kicker" style={{ marginBottom: 4 }}>Friends · {friends.length}</div>
      {friends.length === 0 && <p className="card-body plain">No friends yet.</p>}
      {friends.map(f => {
        const pace = paceOf(f);
        return (
          <div key={f.id} className="friend-row">
            <Avatar name={f.display_name} url={f.avatar_url} size={34} style={{ background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', fontSize: 12 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <button className="link-btn" onClick={() => go('friend', f.id)} style={{ fontWeight: 600, fontSize: 14, textDecoration: 'none', color: 'inherit' }}>{f.display_name}</button>
              <div className="small muted">{f.target_level ? levelById(f.target_level).short : 'Target hidden'} · {f.week_hours ?? '—'} h this week</div>
            </div>
            {pace && <span className={`tag ${pace === 'on' ? 'tag-accent-2' : 'tag-accent'}`}>{pace === 'on' ? 'On pace' : 'Behind'}</span>}
            <button className="link-btn small" disabled={busy} onClick={() => { if (confirm(`Remove ${f.display_name} as a friend?`)) void run(() => api.removeFriend(f.friendship_id)); }} aria-label={`Remove ${f.display_name}`}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

/** Rough pace from what a friend shares: progress toward their target vs. time since registration. */
function paceOf(f: FriendSummary): 'on' | 'behind' | null {
  if (f.hours_vps === null || !f.target_level || !f.registered_on) return null;
  const lv = levelById(f.target_level);
  const weeks = Math.max(1, (startOfToday().getTime() - parseISODate(f.registered_on)!.getTime()) / DAY_MS / 7);
  const expected = Math.min(1, weeks / (Math.max(lv.months, 6) * 4.33));
  const done = (f.hours_vps / lv.vps + (f.hours_pd ?? 0) / lv.pd + (f.hours_pf ?? 0) / lv.pf) / 3;
  return done >= expected * 0.85 ? 'on' : 'behind';
}

function SharingToggles() {
  const s = useSnapshot();
  const { api } = useStore();
  const { busy, error, run } = useAsync();
  return (
    <>
      {SHARE.map(([key, label, sub]) => (
        <label key={key} className="toggle-row" style={{ minHeight: 40 }}>
          <span style={{ display: 'grid' }}><span style={{ fontSize: 14 }}>{label}</span><span className="small muted">{sub}</span></span>
          <input type="checkbox" className="checkbox" checked={shareOn(s.profile.sharing, key)} disabled={busy}
            onChange={() => void run(() => api.updateProfile({ sharing: { ...s.profile.sharing, [key]: !shareOn(s.profile.sharing, key) } }))} />
        </label>
      ))}
      {error && <Notice kind="block">{error}</Notice>}
    </>
  );
}
