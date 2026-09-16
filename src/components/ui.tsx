import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { AREAS, type AreaKey } from '../data';
import type { Activity } from '../types';
import { errorMessage } from '../lib/supabase';

// Lucide icons at the design system's heavier 2.75 stroke.
const Icon = ({ size = 16, stroke = 'currentColor', children, style }: { size?: number; stroke?: string; children: ReactNode; style?: CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    {children}
  </svg>
);

export const SunIcon = () => (
  <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Icon>
);
export const MoonIcon = () => <Icon><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Icon>;
export const CheckIcon = ({ size = 16, stroke = 'var(--color-accent-2-600)' }: { size?: number; stroke?: string }) => (
  <Icon size={size} stroke={stroke}><path d="M20 6 9 17l-5-5" /></Icon>
);
export const AlertIcon = () => (
  <Icon size={18} style={{ flex: 'none', marginTop: 1 }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4M12 17h.01" /></Icon>
);
export const ArrowIcon = () => <Icon size={14}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;

export const pct = (n: number) => `${Math.round(n)}%`;

/** False on the first paint, true one frame later — lets CSS transitions animate values in from zero. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(id); }, []);
  return m;
}

/** Counts from 0 (or the previous value) to `value` over ~700 ms; respects reduced-motion. */
export function useCountUp(value: number, decimals = 0): string {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); return; }
    const start = performance.now(), begin = from.current, dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
      setShown(begin + (value - begin) * e);
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown.toFixed(decimals);
}

export function Bar({ value, color, thick, track, children }: { value: number; color?: string; thick?: boolean; track?: string; children?: ReactNode }) {
  const mounted = useMounted();
  return (
    <div className={thick ? 'bar thick' : 'bar'} style={track ? { background: track } : undefined} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="fill" style={{ '--pct': pct(mounted ? value : 0), '--fill': color } as CSSProperties} />
      {children}
    </div>
  );
}

export function Avatar({ name, url, size = 44, style, className = '' }: { name: string; url?: string | null; size?: number; style?: CSSProperties; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  return (
    <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36), ...style }} aria-label={name} role="img">
      {url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : initialsOf(name)}
    </span>
  );
}

export const paceColor = (onPace: boolean) => (onPace ? 'var(--color-accent-2-700)' : 'var(--color-bad)');
export const ringColor = (onPace: boolean) => (onPace ? 'var(--color-accent-2)' : 'var(--color-accent)');

export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span className="label-sm">{label}</span>
      {children}
      {hint && <span className="small muted" style={{ lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'block' | 'ok'; children: ReactNode }) {
  return (
    <div className={`warning ${kind}`} role={kind === 'block' ? 'alert' : 'status'}>
      {kind === 'ok' ? <CheckIcon /> : <AlertIcon />}
      <span>{children}</span>
    </div>
  );
}

/** Wraps an async action with pending + error state for a form. */
export function useAsync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); return true; } catch (e) { setError(errorMessage(e)); return false; } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
}

export interface ActivityDraft { area: AreaKey; name: string; validator_name: string; validator_title: string; validator_contact: string }

export const emptyActivity = (area: AreaKey = 'vps'): ActivityDraft => ({ area, name: '', validator_name: '', validator_title: '', validator_contact: '' });

export const draftFrom = (a: Activity): ActivityDraft => ({
  area: a.area, name: a.name, validator_name: a.validator_name ?? '', validator_title: a.validator_title ?? '', validator_contact: a.validator_contact ?? '',
});

/** Activity + validator form shared by onboarding, the log screen and settings. */
export function ActivityForm({ initial, lockArea, onSubmit, onCancel, submitLabel = 'Save activity' }: {
  initial: ActivityDraft; lockArea?: boolean; onSubmit: (d: ActivityDraft) => Promise<unknown>; onCancel?: () => void; submitLabel?: string;
}) {
  const [d, setD] = useState(initial);
  const { busy, error, run } = useAsync();
  const set = (patch: Partial<ActivityDraft>) => setD(x => ({ ...x, ...patch }));
  const submit = (e: FormEvent) => { e.preventDefault(); void run(() => onSubmit({ ...d, name: d.name.trim() })); };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      {!lockArea && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="label-sm">Program area</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {AREAS.map(a => (
              <button key={a.key} type="button" className={`chip${d.area === a.key ? ' on' : ''}`} aria-pressed={d.area === a.key} onClick={() => set({ area: a.key })}>{a.label}</button>
            ))}
          </div>
        </div>
      )}
      <Field label="Activity name" hint="What you do and where, e.g. “ED volunteering — Alta Bates Summit”.">
        <input className="input" required value={d.name} onChange={e => set({ name: e.target.value })} placeholder="Climbing — Berkeley Ironworks" autoFocus />
      </Field>
      <div style={{ display: 'grid', gap: 8 }}>
        <span className="label-sm">Validator <span className="muted">— an adult who supervises this activity and is not a relative</span></span>
        <input className="input" value={d.validator_name} onChange={e => set({ validator_name: e.target.value })} placeholder="Full name" aria-label="Validator name" />
        <input className="input" value={d.validator_title} onChange={e => set({ validator_title: e.target.value })} placeholder="Title · organization" aria-label="Validator title and organization" />
        <input className="input" value={d.validator_contact} onChange={e => set({ validator_contact: e.target.value })} placeholder="Email or phone" aria-label="Validator contact" />
      </div>
      {error && <Notice kind="block">{error}</Notice>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" disabled={busy || !d.name.trim()}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}

export const cleanDraft = (d: ActivityDraft) => ({
  area: d.area, name: d.name.trim(),
  validator_name: d.validator_name.trim() || null, validator_title: d.validator_title.trim() || null, validator_contact: d.validator_contact.trim() || null,
});
