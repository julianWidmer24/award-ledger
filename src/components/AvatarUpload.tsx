import { useRef, useState } from 'react';
import { squareThumbnail } from '../lib/image';
import { useStore } from '../store';
import { Avatar, Notice, useAsync } from './ui';

/** Profile photo with an edit badge; the chosen image is cropped square and downscaled before upload. */
export function AvatarUpload({ name, url }: { name: string; url: string | null }) {
  const { api } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { busy, error, run, setError } = useAsync();

  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose an image file (JPEG, PNG, WebP or HEIC).'); return; }
    const ok = await run(async () => {
      const blob = await squareThumbnail(file);
      setPreview(URL.createObjectURL(blob));
      await api.uploadAvatar(blob);
    });
    if (!ok) setPreview(null);
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
      <div className={`avatar-upload${busy ? ' busy' : ''}`}>
        <Avatar name={name} url={preview ?? url} size={112} style={{ background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-900)' }} />
        <button type="button" className="edit" onClick={() => input.current?.click()} disabled={busy} aria-label="Change profile photo" title="Change photo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
        </button>
        <input ref={input} type="file" accept="image/*" hidden onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>Profile photo</div>
        <span className="small muted" style={{ lineHeight: 1.45, maxWidth: '36ch' }}>Friends see it next to your name. It's cropped to a square and resized before upload, so any photo works.</span>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()} disabled={busy} style={{ padding: '6px 14px', fontSize: 13 }}>{busy ? 'Uploading…' : url ? 'Change photo' : 'Add a photo'}</button>
          {url && <button type="button" className="link-btn small" disabled={busy} onClick={() => { setPreview(null); void run(() => api.removeAvatar()); }}>Remove</button>}
        </div>
        {error && <Notice kind="block">{error}</Notice>}
      </div>
    </div>
  );
}
