import { Logo } from '../components/ui';
/** Shown when .env.local has no Supabase credentials yet. */
export function Setup() {
  return (
    <div className="auth-wrap" style={{ gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 720 }}>
      <div className="card" style={{ padding: 'var(--space-6)', gap: 'var(--space-3)' }}>
        <div className="nav-brand"><Logo size={26} /></div>
        <h2 style={{ margin: 0 }}>Connect a Supabase project</h2>
        <p className="text-muted" style={{ margin: 0 }}>The app needs a database before anyone can sign in. This takes about five minutes.</p>
        <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 10, fontSize: 14.5, lineHeight: 1.5 }}>
          <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.</li>
          <li>Open <strong>SQL Editor</strong>, paste the contents of <code>supabase/schema.sql</code> from this repo, and run it.</li>
          <li>Go to <strong>Project Settings → API</strong> and copy the <em>Project URL</em> and <em>anon public</em> key.</li>
          <li>Copy <code>.env.example</code> to <code>.env.local</code>, fill in both values, and restart <code>npm run dev</code>.</li>
        </ol>
        <p className="small muted" style={{ margin: 0 }}>
          Optional while testing: in <strong>Authentication → Providers → Email</strong>, turn off “Confirm email” so new accounts can sign in without clicking a link.
        </p>
      </div>
    </div>
  );
}
