import { useRef, useState, type DragEvent, type FormEvent } from 'react';
import type { ScreenProps } from '../App';
import { OFFICIAL_RESOURCES, RESOURCE_CATEGORIES, type ResourceCategory } from '../data';
import { formatBytes } from '../lib/image';
import { timeAgo } from '../lib/dates';
import { useSnapshot, useStore } from '../store';
import { Field, Notice, useAsync } from '../components/ui';
import type { Resource } from '../types';

const MAX_MB = 25;

export function Resources(_: ScreenProps) {
  const s = useSnapshot();
  const { api } = useStore();
  const [filter, setFilter] = useState<ResourceCategory | 'all'>('all');
  const [mode, setMode] = useState<'none' | 'link' | 'file'>('none');
  const act = useAsync();
  const mine = s.resources.filter(r => filter === 'all' || r.category === filter);
  const files = mine.filter(r => r.kind === 'file'), links = mine.filter(r => r.kind === 'link');

  const open = async (r: Resource) => {
    if (r.kind === 'link' && r.url) { window.open(r.url, '_blank', 'noopener'); return; }
    if (r.storage_path) await act.run(async () => { const url = await api.documentUrl(r.storage_path!); window.open(url, '_blank', 'noopener'); });
  };

  return (
    <section className="screen" aria-label="Resources">
      <div className="head">
        <div>
          <h6 className="eyebrow">Resources</h6>
          <h1 style={{ margin: 0 }}>Everything in one place</h1>
          <p className="text-muted lede">The program's official guides, plus your own documents and links — validator letters, itineraries, syllabi, anything you'll want when the record book comes together.</p>
        </div>
        <div className="row">
          <button className={`btn ${mode === 'file' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode(m => (m === 'file' ? 'none' : 'file'))}>Upload a document</button>
          <button className={`btn ${mode === 'link' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode(m => (m === 'link' ? 'none' : 'link'))}>Save a link</button>
        </div>
      </div>

      {mode === 'file' && <UploadCard onDone={() => setMode('none')} />}
      {mode === 'link' && <LinkCard onDone={() => setMode('none')} />}

      <div>
        <div className="section-head">
          <h4>From the Congressional Award</h4>
          <span className="text-muted small">Official documents · congressionalaward.org</span>
        </div>
        <div className="resource-grid">
          {OFFICIAL_RESOURCES.map(r => (
            <a key={r.url} className="card resource-card" href={r.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', padding: 'var(--space-3) var(--space-4)', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className="card-kicker">{r.kind === 'pdf' ? 'PDF' : r.kind === 'portal' ? 'Submission portal' : 'Website'}</span>
                <span className="muted" aria-hidden="true">↗</span>
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, lineHeight: 1.2 }}>{r.title}</div>
              <p className="small muted" style={{ margin: 0, lineHeight: 1.45 }}>{r.blurb}</p>
            </a>
          ))}
        </div>
      </div>

      <div>
        <div className="section-head">
          <h4>Mine</h4>
          <div className="row" style={{ gap: 4 }}>
            <button className={`chip${filter === 'all' ? ' on' : ''}`} style={{ minHeight: 32, padding: '4px 12px' }} onClick={() => setFilter('all')}>All</button>
            {RESOURCE_CATEGORIES.map(([k, label]) => <button key={k} className={`chip${filter === k ? ' on' : ''}`} style={{ minHeight: 32, padding: '4px 12px' }} onClick={() => setFilter(k)}>{label}</button>)}
          </div>
        </div>
        {act.error && <Notice kind="block">{act.error}</Notice>}
        {mine.length === 0 ? (
          <div className="card pad"><p className="card-body plain">Nothing saved{filter !== 'all' ? ' in this category' : ''} yet. Upload a document or save a link above — a signed validator form, your expedition permit, the syllabus for your language class.</p></div>
        ) : (
          <div className="split even">
            <ResourceList title="Documents" items={files} empty="No documents in this view." onOpen={open} />
            <ResourceList title="Links" items={links} empty="No links in this view." onOpen={open} />
          </div>
        )}
      </div>
    </section>
  );
}

function ResourceList({ title, items, empty, onOpen }: { title: string; items: Resource[]; empty: string; onOpen: (r: Resource) => void }) {
  const { api } = useStore();
  const { busy, run } = useAsync();
  const cat = (k: ResourceCategory) => RESOURCE_CATEGORIES.find(c => c[0] === k)?.[1] ?? k;
  return (
    <div className="card pad" style={{ gap: 'var(--space-2)' }}>
      <div className="card-kicker">{title} · {items.length}</div>
      {items.length === 0 && <p className="card-body plain">{empty}</p>}
      {items.map(r => (
        <div key={r.id} className="activity resource-card" style={{ cursor: 'default', alignItems: 'flex-start' }}>
          <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <button className="link-btn" onClick={() => onOpen(r)} style={{ textAlign: 'left', fontSize: 14, fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>{r.title}</button>
            <span className="muted" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>
              {r.kind === 'link' ? r.url?.replace(/^https?:\/\//, '') : `${r.mime_type?.split('/')[1]?.toUpperCase() ?? 'file'} · ${formatBytes(r.size_bytes)}`} · {timeAgo(r.created_at)}
            </span>
            {r.notes && <span className="small" style={{ lineHeight: 1.4 }}>{r.notes}</span>}
          </span>
          <span style={{ display: 'grid', gap: 6, justifyItems: 'end', flex: 'none' }}>
            <span className="tag tag-neutral">{cat(r.category)}</span>
            <span className="row" style={{ gap: 8 }}>
              <button className="link-btn small" onClick={() => onOpen(r)}>{r.kind === 'link' ? 'Open' : 'Download'}</button>
              <button className="link-btn small" disabled={busy} onClick={() => { if (confirm(`Delete "${r.title}"?`)) void run(() => api.deleteResource(r)); }}>Delete</button>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function CategoryPicker({ value, onChange }: { value: ResourceCategory; onChange: (c: ResourceCategory) => void }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span className="label-sm">Category</span>
      <div className="row" style={{ gap: 6 }}>
        {RESOURCE_CATEGORIES.map(([k, label, hint]) => <button key={k} type="button" title={hint} className={`chip${value === k ? ' on' : ''}`} aria-pressed={value === k} style={{ padding: '8px 14px' }} onClick={() => onChange(k)}>{label}</button>)}
      </div>
    </div>
  );
}

function LinkCard({ onDone }: { onDone: () => void }) {
  const { api } = useStore();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<ResourceCategory>('project');
  const { busy, error, run } = useAsync();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const href = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    void run(async () => { await api.addLink({ title: title.trim(), url: href, category, notes: notes.trim() || undefined }); onDone(); });
  };
  return (
    <form className="card pad" style={{ gap: 'var(--space-3)', border: '2px solid var(--color-accent)' }} onSubmit={submit}>
      <div className="card-kicker">Save a link</div>
      <div className="form-grid">
        <Field label="Title"><input className="input" required value={title} onChange={e => setTitle(e.target.value)} placeholder="Rae Lakes permit page" autoFocus /></Field>
        <Field label="URL"><input className="input" required value={url} onChange={e => setUrl(e.target.value)} placeholder="recreation.gov/permits/…" inputMode="url" /></Field>
      </div>
      <Field label="Notes (optional)"><input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Apply by 1 March; lottery opens at 7am PT" /></Field>
      <CategoryPicker value={category} onChange={setCategory} />
      {error && <Notice kind="block">{error}</Notice>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !title.trim() || !url.trim()}>{busy ? 'Saving…' : 'Save link'}</button>
      </div>
    </form>
  );
}

function UploadCard({ onDone }: { onDone: () => void }) {
  const { api } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<ResourceCategory>('record');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, run, setError } = useAsync();

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_MB * 1048576) { setError(`That file is ${formatBytes(f.size)}; the limit is ${MAX_MB} MB.`); return; }
    setError(null); setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    void run(async () => { await api.uploadDocument(file, { title: title.trim() || file.name, category, notes: notes.trim() || undefined }); onDone(); });
  };

  return (
    <form className="card pad" style={{ gap: 'var(--space-3)', border: '2px solid var(--color-accent)' }} onSubmit={submit}>
      <div className="card-kicker">Upload a document</div>
      <div className={`drop${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop} onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}>
        <input ref={input} type="file" hidden onChange={e => pick(e.target.files?.[0])} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.heic,.txt,.md,.csv" />
        {file ? (
          <div style={{ display: 'grid', gap: 2 }}><strong>{file.name}</strong><span className="small muted">{formatBytes(file.size)} · click to choose a different file</span></div>
        ) : (
          <div style={{ display: 'grid', gap: 2 }}><strong>Drop a file here, or click to choose</strong><span className="small muted">PDF, Word, images, spreadsheets · up to {MAX_MB} MB · private to your account</span></div>
        )}
      </div>
      <div className="form-grid">
        <Field label="Title"><input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Signed validator form — Ray Okafor" /></Field>
        <Field label="Notes (optional)"><input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Covers Feb–Aug pantry shifts" /></Field>
      </div>
      <CategoryPicker value={category} onChange={setCategory} />
      {error && <Notice kind="block">{error}</Notice>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        {busy && <span className="spinner" aria-hidden="true" />}
        <button type="button" className="btn btn-secondary" onClick={onDone} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !file}>{busy ? 'Uploading…' : 'Upload'}</button>
      </div>
    </form>
  );
}
