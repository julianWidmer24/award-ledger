import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until .env.local carries the project URL and anon key; the app shows setup help instead. */
export const isConfigured = Boolean(url && anonKey && !url.includes('your-project-ref'));

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Turn a Supabase/Postgres error into something a person can read. */
export function errorMessage(e: unknown): string {
  if (!e) return 'Something went wrong.';
  if (typeof e === 'string') return e;
  const err = e as { message?: string; details?: string };
  const msg = err.message || err.details || 'Something went wrong.';
  // Supabase's built-in mailer allows only a couple of auth emails per hour per project.
  if (/rate limit/i.test(msg) && /email/i.test(msg)) {
    return 'Too many sign-up or reset emails have gone out in the last hour, so the email service is pausing. Please try again in about an hour.';
  }
  return msg;
}
