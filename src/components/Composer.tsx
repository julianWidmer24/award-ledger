import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { areaByKey } from '../data';
import { fmtDayMonth, fmtISO, parseISODate } from '../lib/dates';
import { formatBytes, isImage, isVideo } from '../lib/image';
import { useSnapshot, useStore } from '../store';
import { Avatar, Notice, useAsync } from './ui';

const MAX_FILES = 8, MAX_VIDEO_MB = 80;

/** Share a session, a trip, or just photos with friends. `presetEntry` pre-attaches a log entry (from "Share it" after logging). */
export function Composer({ presetEntry, onPosted }: { presetEntry?: string; onPosted: () => void }) {
  const s = useSnapshot();
  const { api } = useStore();
  const [open, setOpen] = useState(!!presetEntry);
  const [caption, setCaption] = useState('');
  const [attach, setAttach] = useState<string>(presetEntry ? `entry:${presetEntry}` : '');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, run, setError } = useAsync();

  useEffect(() => { if (presetEntry) { setOpen(true); setAttach(`entry:${presetEntry}`); } }, [presetEntry]);
  useEffect(() => {
    const urls = files.map(f => (isImage(f) || isVideo(f) ? URL.createObjectURL(f) : ''));
    setPreviews(urls);
    return () => urls.forEach(u => u && URL.revokeObjectURL(u));
  }, [files]);

  const recent = s.entries.slice(0, 12);
  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    const incoming = [...list].filter(f => isImage(f) || isVideo(f));
    const tooBig = incoming.find(f => isVideo(f) && f.size > MAX_VIDEO_MB * 1048576);
    if (tooBig) { setError(`${tooBig.name} is ${formatBytes(tooBig.size)}; videos are limited to ${MAX_VIDEO_MB} MB.`); return; }
    setError(null);
    setFiles(f => [...f, ...incoming].slice(0, MAX_FILES));
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); };
  const reset = () => { setCaption(''); setAttach(''); setFiles([]); setProgress(null); setOpen(false); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!caption.trim() && !files.length && !attach) return;
    const [kind, id] = attach.split(':');
    void run(async () => {
      await api.createPost({ caption, entry_id: kind === 'entry' ? id : null, expedition_id: kind === 'exp' ? id : null, files }, (d, t) => setProgress([d, t]));
      reset(); onPosted();
    });
  };

  if (!open) {
    return (
      <button className="card composer-closed" onClick={() => setOpen(true)}>
        <Avatar name={s.profile.display_name} url={s.profile.avatar_url} size={40} style={{ background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)' }} />
        <span className="muted">Share a session, a trip, or a few photos…</span>
        <span className="btn btn-primary" style={{ pointerEvents: 'none' }}>Post</span>
      </button>
    );
  }

  return (
    <form className="card pad composer" onSubmit={submit} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar name={s.profile.display_name} url={s.profile.avatar_url} size={40} style={{ background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)', flex: 'none' }} />
        <textarea className="input" rows={3} value={caption} onChange={e => setCaption(e.target.value)} placeholder="How did it go?" maxLength={2000} autoFocus style={{ borderRadius: 'var(--radius-md)', minHeight: 72 }} />
      </div>

      {files.length > 0 && (
        <div className="composer-previews">
          {files.map((f, i) => (
            <div key={i} className="composer-preview">
              {isVideo(f) ? <video src={previews[i]} muted playsInline preload="metadata" /> : <img src={previews[i]} alt="" />}
              <button type="button" className="remove" onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>✕</button>
              {isVideo(f) && <span className="play-badge" aria-hidden="true">▶</span>}
            </div>
          ))}
        </div>
      )}

      <div className={`composer-tools${over ? ' over' : ''}`}>
        <input ref={input} type="file" hidden multiple accept="image/*,video/*,.heic,.heif,.mov,.mp4" onChange={e => { add(e.target.files); e.target.value = ''; }} />
        <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()} disabled={busy || files.length >= MAX_FILES}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 8" /></svg>
          Photos / video
        </button>
        <select className="input" value={attach} onChange={e => setAttach(e.target.value)} aria-label="Attach an activity" style={{ minHeight: 36, width: 'auto', maxWidth: '100%' }}>
          <option value="">No activity attached</option>
          {recent.length > 0 && <optgroup label="Recent sessions">
            {recent.map(e => { const a = s.activities.find(x => x.id === e.activity_id); const d = parseISODate(e.date); return <option key={e.id} value={`entry:${e.id}`}>{d ? fmtDayMonth(d) : e.date} · {a?.name.split(' — ')[0] ?? 'Session'} · {e.hours} h{a ? ` · ${areaByKey(a.area).label}` : ''}</option>; })}
          </optgroup>}
          {s.expeditions.length > 0 && <optgroup label="Expeditions">
            {s.expeditions.map(x => <option key={x.id} value={`exp:${x.id}`}>{x.name} · {fmtISO(x.start_date)}</option>)}
          </optgroup>}
        </select>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Visible to your friends only. Photos are resized before upload; videos up to {MAX_VIDEO_MB} MB. Drag files anywhere on this card.</p>
      {error && <Notice kind="block">{error}</Notice>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
        {busy && progress && <span className="small muted">Uploading {progress[0]} of {progress[1]}…</span>}
        {busy && <span className="spinner" aria-hidden="true" />}
        <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || (!caption.trim() && !files.length && !attach)}>{busy ? 'Posting…' : 'Post'}</button>
      </div>
    </form>
  );
}
