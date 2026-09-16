import { useState, type FormEvent } from 'react';
import { areaByKey } from '../data';
import { fmtDayMonth, fmtISO, parseISODate, timeAgo } from '../lib/dates';
import { useStore } from '../store';
import { Avatar, Notice, useAsync } from './ui';
import type { Post } from '../types';
import type { Screen } from '../data';

export function PostCard({ post, me, go }: { post: Post; me: string; go: (s: Screen, param?: string) => void }) {
  const { api, mediaUrl } = useStore();
  const [showComments, setShowComments] = useState(post.comments.length > 0 && post.comments.length <= 2);
  const [comment, setComment] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const { busy, error, run } = useAsync();
  const mine = post.user_id === me;
  const shown = post.media.slice(0, 4);
  const extra = post.media.length - shown.length;
  const others = post.kudos_names.filter(n => n !== post.author.display_name || !post.kudos_by_me).slice(0, 3);
  const kudosLabel = post.kudos === 0 ? 'Be the first to give kudos'
    : post.kudos_by_me ? (post.kudos === 1 ? 'You gave kudos' : `You and ${post.kudos - 1} other${post.kudos - 1 === 1 ? '' : 's'} gave kudos`)
    : `${others.join(', ')}${post.kudos > others.length ? ` and ${post.kudos - others.length} more` : ''} gave kudos`;

  const submitComment = (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    void run(async () => { await api.addComment(post.id, comment); setComment(''); setShowComments(true); });
  };

  return (
    <article className="card post">
      <header className="post-head">
        <button className="link-btn" onClick={() => !mine && go('friend', post.user_id)} style={{ textDecoration: 'none', color: 'inherit', cursor: mine ? 'default' : 'pointer' }}>
          <Avatar name={post.author.display_name} url={post.author.avatar_url} size={40} style={{ background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)' }} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{mine ? 'You' : post.author.display_name}</div>
          <div className="small muted">{timeAgo(post.created_at)}</div>
        </div>
        {mine && <button className="link-btn small" disabled={busy} onClick={() => { if (confirm('Delete this post?')) void run(() => api.deletePost(post)); }}>Delete</button>}
      </header>

      {(post.entry || post.expedition) && (
        <div className="post-activity">
          {post.entry && (
            <>
              <span className="tag tag-accent-2">{areaByKey(post.entry.area).label}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{post.entry.activity.split(' — ')[0]}</span>
              <span className="muted">· <strong className="num" style={{ color: 'var(--color-text)' }}>{post.entry.hours} h</strong> · {(() => { const d = parseISODate(post.entry.date); return d ? fmtDayMonth(d) : post.entry.date; })()}</span>
            </>
          )}
          {post.expedition && (
            <>
              <span className={`tag ${post.expedition.status === 'completed' ? 'tag-accent-2' : 'tag-neutral'}`}>Expedition</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>{post.expedition.name}</span>
              <span className="muted">· {fmtISO(post.expedition.start_date)} – {fmtISO(post.expedition.end_date)}{post.expedition.location ? ` · ${post.expedition.location}` : ''}</span>
            </>
          )}
        </div>
      )}

      {post.caption && <p className="post-caption">{post.caption}</p>}

      {shown.length > 0 && (
        <div className={`post-media n${shown.length}`}>
          {shown.map((m, i) => {
            const url = mediaUrl(m.path);
            return (
              <button key={m.id} className="post-media-item" onClick={() => setLightbox(i)} aria-label={m.kind === 'video' ? 'Play video' : 'View photo'}>
                {!url ? <div className="media-skeleton" /> : m.kind === 'video'
                  ? <video src={url} preload="metadata" muted playsInline />
                  : <img src={url} alt="" loading="lazy" />}
                {m.kind === 'video' && <span className="play-badge" aria-hidden="true">▶</span>}
                {i === shown.length - 1 && extra > 0 && <span className="more-badge">+{extra}</span>}
              </button>
            );
          })}
        </div>
      )}

      <footer className="post-foot">
        <button className={`kudos${post.kudos_by_me ? ' on' : ''}`} onClick={() => void run(() => api.toggleKudos(post))} aria-pressed={post.kudos_by_me} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={post.kudos_by_me ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v10H3V11zM7 11l4-8a2.5 2.5 0 0 1 2.5 2.5V10h5.5a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7" /></svg>
          <span>Kudos{post.kudos ? ` · ${post.kudos}` : ''}</span>
        </button>
        <button className="link-btn small" onClick={() => setShowComments(v => !v)}>{post.comments.length ? `${post.comments.length} comment${post.comments.length === 1 ? '' : 's'}` : 'Comment'}</button>
        <span className="small muted" style={{ marginLeft: 'auto' }}>{kudosLabel}</span>
      </footer>

      {showComments && (
        <div className="post-comments">
          {post.comments.map(c => (
            <div key={c.id} className="comment">
              <Avatar name={c.name} url={c.avatar_url} size={28} style={{ background: 'var(--color-neutral-300)', fontSize: 11 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{c.user_id === me ? 'You' : c.name}</span>
                <span className="small muted"> · {timeAgo(c.created_at)}</span>
                <div style={{ fontSize: 14, lineHeight: 1.45 }}>{c.body}</div>
              </div>
              {(c.user_id === me || mine) && <button className="link-btn small" disabled={busy} onClick={() => void run(() => api.deleteComment(c.id))} aria-label="Delete comment">✕</button>}
            </div>
          ))}
          <form onSubmit={submitComment} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
            <input className="input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Say something nice…" maxLength={1000} />
            <button type="submit" className="btn btn-secondary" disabled={busy || !comment.trim()}>Post</button>
          </form>
        </div>
      )}
      {error && <Notice kind="block">{error}</Notice>}

      {lightbox !== null && post.media[lightbox] && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="Media viewer">
          {post.media[lightbox].kind === 'video'
            ? <video src={mediaUrl(post.media[lightbox].path)} controls autoPlay playsInline onClick={e => e.stopPropagation()} />
            : <img src={mediaUrl(post.media[lightbox].path)} alt="" onClick={e => e.stopPropagation()} />}
          {post.media.length > 1 && (
            <div className="lightbox-nav" onClick={e => e.stopPropagation()}>
              <button className="btn btn-secondary" onClick={() => setLightbox((lightbox + post.media.length - 1) % post.media.length)}>‹</button>
              <span className="small" style={{ color: '#fff' }}>{lightbox + 1} / {post.media.length}</span>
              <button className="btn btn-secondary" onClick={() => setLightbox((lightbox + 1) % post.media.length)}>›</button>
            </div>
          )}
          <button className="btn btn-secondary lightbox-close" onClick={() => setLightbox(null)} aria-label="Close">✕</button>
        </div>
      )}
    </article>
  );
}
