# Award Ledger

A tracker for the Congressional Award: log hours across the three program areas, plan the expedition, keep goals and validators in one place, and see whether you and your friends are on pace.

Built with Vite + React + TypeScript on the front end and Supabase (Postgres + Auth) on the back end.

## Setup

1. **Create a Supabase project** at <https://supabase.com> (free tier is fine).
2. **Run the schema.** In the Supabase dashboard open *SQL Editor*, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it, then run each file in [`supabase/migrations/`](supabase/migrations/) in date order. Together they create the tables, storage buckets, row-level security policies and the functions the app calls. All are safe to re-run.
3. **Copy the API keys.** *Project Settings → API*: copy the *Project URL* and the *anon public* key.
4. **Configure the app:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. **Run it:**
   ```bash
   npm install
   npm run dev
   ```

While testing you may want to turn off *Authentication → Providers → Email → Confirm email* so new accounts can sign in without clicking a confirmation link. Turn it back on before sharing the app.

## Deploying

The app is deployed on Vercel at <https://award-ledger.vercel.app> (project `award-ledger`), connected to the GitHub repo `julianWidmer24/award-ledger`. Every push to `main` deploys to production automatically; pushes to other branches get preview URLs. To deploy by hand instead:

```bash
npx vercel deploy --prod
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set as Vercel environment variables (Production and Preview). The anon key is intentionally public — row-level security in Postgres is what protects the data.

In Supabase, *Authentication → URL Configuration* must list the deployed origin so confirmation and password-reset emails link back to the app: set *Site URL* to `https://award-ledger.vercel.app` and add `https://award-ledger.vercel.app/**` (plus `http://localhost:5173/**` for local testing) under *Redirect URLs*.

## Password reset

"Forgot password?" on the sign-in page calls `resetPasswordForEmail` with `redirectTo` set to the current origin. The emailed link returns the user to the app with a recovery session; Supabase fires `PASSWORD_RECOVERY`, the store flips `recovering`, and `App` shows `ResetPassword` until a new password is saved. Signed-in users can also change their password from Settings.

## Features at a glance

- **Log** sessions against activities with named validators; rules (paid work, private businesses, pre-registration dates) are checked before saving. Entries move Logged → Sent → Validated.
- **Dashboard** with rings / ledger / pace views, level ladder, time gate, deadline, derived to-dos, and a getting-started checklist for new accounts.
- **Goals** per program area with versions and advisor sign-off; **Expeditions** with itineraries, shared planning with friends (invites, members, per-person reflections); **Record book** preview with real blockers; **Resources** (official Congressional Award documents, private uploads, saved links).
- **Friends**: friend codes, profiles that show shared goals and logs (each with a sharing toggle), and a feed — posts with photos/videos attached to sessions or expeditions, kudos and comments. Media lives in a private bucket readable only by the poster's friends via signed URLs.
- Profile photos, password reset, a welcome tour, and a phone layout with a bottom tab bar.

## How data is protected

- Every table has row-level security: a signed-in user can read and write only rows where `user_id` is their own id.
- Friends never read each other's rows directly. `friend_summaries()` aggregates hours server-side and returns only what the friend's sharing toggles allow. Descriptions, validators and contact details are never returned.
- Friend requests go through `send_friend_request(code)`, so profiles cannot be listed or searched — you need someone's code.

## Layout

| Path | What it is |
| --- | --- |
| `supabase/schema.sql` | Database schema, policies and RPC functions |
| `src/data.ts` | Award rules: levels, program areas, static copy |
| `src/derive.ts` | Pure calculations: pace, ladder, time gates, log rules, record-book issues, derived tasks |
| `src/store.tsx` | Auth session, data loading and the write API |
| `src/auth/` | Sign in / create account |
| `src/onboarding/` | The welcome sequence for new accounts |
| `src/screens/` | One file per screen |
| `src/styles/organic.css` | The design system tokens and components (vendored from Claude Design) |
| `src/styles/app.css` | App-specific layout and the dark theme |
