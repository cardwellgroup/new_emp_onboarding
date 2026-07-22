# Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14.2.5 (App Router) | `app/` directory; one page + API routes |
| UI | React 18.3.1, plain CSS | Single client component `app/page.js`; global styles `app/globals.css` |
| Fonts | Inter (body/UI), Cormorant Garamond (display) | Loaded from Google Fonts in `app/layout.js` |
| Backend data | Supabase Postgres 17 | All app tables in `public` schema |
| Auth | Supabase Auth — passwordless magic link (OTP) | Email allowlist enforced by DB trigger |
| Storage | Supabase Storage | Private bucket `note-uploads` for note photos |
| AI | Anthropic Claude (`claude-haiku-4-5-20251001` default) | Called only from server API routes |
| Hosting | Vercel | Auto-deploy from GitHub `main` |

There is **no separate backend service** — Next.js API routes (serverless functions on Vercel) are the
only server code. The browser talks directly to Supabase via the JS client for all normal CRUD; RLS is
the security boundary.

## Runtime topology

```
Browser (React SPA, app/page.js)
   │
   ├── supabase-js  ──────────────►  Supabase  (Postgres + Auth + Storage)
   │      (anon key, user JWT)          ▲   RLS enforced per request via current_email()
   │                                     │
   └── fetch /api/*  ─────────────►  Vercel serverless routes
          ├── /api/structure     → Claude (structure 1..N items from text)
          ├── /api/transcript    → Claude (meeting transcript/link → items)
          ├── /api/ocr           → Claude vision (note photo → text)
          ├── /api/generate-plan → Claude (full 30/60/90 draft from role)
          └── /api/invite        → Supabase Admin API (service role) → invite link/email
```

The API routes do **not** touch app data tables (except `/api/invite`, which uses the Supabase **admin**
client only to create/invite an auth user). Plan/item writes all happen client-side through supabase-js
under RLS.

## File structure

```
app/
  layout.js                 Root layout: metadata, viewport, font <link>s
  globals.css               All styling (design tokens, components, print, mobile)
  page.js                   The entire client app (one 'use client' component tree)
  api/
    structure/route.js      POST → { items:[...] }  (AI-assist multi-item structuring)
    transcript/route.js     POST → { items:[...] }  (meeting transcript or link → items)
    ocr/route.js            POST → { text }          (photo → transcribed text)
    generate-plan/route.js  POST → { items:[...] }  (auto starter 30/60/90 for a new hire)
    invite/route.js         POST → { link, emailed } (provision employee login; SERVICE ROLE)
package.json, next.config.mjs, vercel.json
docs/                       This documentation
DEPLOY.md, README.md, SETUP-multi-employee.md
```

### `app/page.js` internals (component map)

`page.js` is intentionally a single file (matches the project's "one artifact" style). Key components:

- `Home` — reads the Supabase session; renders `Login` or `App`.
- `App` — loads data for all visible plans, decides **leader vs. employee**, renders the shell.
- `Login` — magic-link sign-in.
- `TeamOverview` — leader combined view across employees (filters: employee/status/phase).
- `AddEmployee` — leader modal: create plan → generate items → provision login.
- Per-plan views: `PlanView`, `CheckinView` (employee), `PrepView` (leader), `AddView`
  (`ItemForm` / `AiAssist` / `MeetingImport` / `Carousel`), `JournalView`, `ActivityView`,
  `DownloadView`, plus `ItemCard`, `CommentThread`, `AckGate`, `Mic` (Web Speech), `Logo`.
- Helpers: `flagFor` (NEW/UPDATED chips), `parseTags`, `current-email`-style `eq`, `PHASES`, `STATUSES`.

> Note on deployment: earlier updates were shipped by an esbuild-minified single-file bundle; the
> canonical source in git is the readable `app/page.js`. Vercel compiles JSX normally. If you edit,
> just push — no build step by hand.

## Auth & request flow

1. User enters email on the login screen → `supabase.auth.signInWithOtp` sends a magic link.
2. On first sign-in, Supabase inserts a row in `auth.users`. The **`allowlist_check`** trigger
   (`enforce_allowlist`) rejects the insert unless that email is on some `plans` row (as
   `manager_email` or `employee_email`). So a plan must exist before a person can log in.
3. Once authenticated, every DB call carries the user JWT. Postgres RLS calls `current_email()`
   (= `auth.jwt() ->> 'email'`) and the `is_plan_member/manager/employee(plan_id)` helpers to authorize
   each row. See `02-DATA-MODEL.md`.

## Environment variables (Vercel → Settings → Environment Variables)

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no (defaults in code) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no (defaults in code) | Publishable anon key (safe in browser) |
| `ANTHROPIC_API_KEY` | recommended | Enables all AI routes; without it they fall back to heuristics |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-haiku-4-5-20251001` |
| `SUPABASE_SERVICE_ROLE_KEY` | for invites | Server-only; used by `/api/invite` to create/invite users & mint links |

The Supabase URL and anon key are also hard-coded as fallbacks in `app/page.js` and the routes, so the
app runs even if the public env vars are unset. **Never** put the service-role key anywhere client-side.

## Deploy pipeline

- Push to `main` on GitHub → Vercel builds (`next build`) → promotes to production at
  `emponboarding.vercel.app`.
- Rollback: Vercel dashboard → Deployments → pick a previous "Ready" production build → Instant Rollback.
- Database migrations are applied directly to Supabase (see the migration list in `02-DATA-MODEL.md`);
  they are not run by the app or the Vercel build.
