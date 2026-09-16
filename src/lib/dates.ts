export const DAY_MS = 864e5;

// Fixed three-letter months: ICU versions disagree on "Sep" vs "Sept".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const fmtDayMonth = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
export const fmtDate = (d: Date) => `${fmtDayMonth(d)} ${d.getFullYear()}`;
export const fmtMonth = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
export const fmtWeekday = (d: Date) => `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;

export const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() - (b.getDate() < a.getDate() ? 1 : 0);

export const addMonths = (d: Date, m: number) => new Date(d.getFullYear(), d.getMonth() + m, d.getDate());
export const addYears = (d: Date, y: number) => new Date(d.getFullYear() + y, d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Parse a YYYY-MM-DD value as a local date (Date's own parser treats it as UTC). */
export function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fmtISO = (s: string | null | undefined, fallback = '—') => {
  const d = parseISODate(s);
  return d ? fmtDate(d) : fallback;
};

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** "2 d ago", "1 wk ago", "just now" */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 6e4);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w} wk ago`;
  return fmtDayMonth(new Date(iso));
}
