# Operations Runbook

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```
Sign in with an email that already exists on a plan (e.g. the manager or Citlali). To exercise the AI
routes locally, set `ANTHROPIC_API_KEY` (and optionally `SUPABASE_SERVICE_ROLE_KEY` for `/api/invite`)
in a `.env.local`. Without those keys the routes fall back to heuristics.

## Environment variables (Vercel → Project emp_onboarding → Settings → Environment Variables)

| Var | Scope | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Production (+ Preview) | Turns on AI structuring/generation/OCR |
| `ANTHROPIC_MODEL` | optional | Default `claude-haiku-4-5-20251001` |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | **Secret.** Server-only, used by `/api/invite`. Never expose. |
| `NEXT_PUBLIC_SUPABASE_URL` | optional | Defaults to the pilot project URL in code |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | Defaults to the publishable key in code |

After changing env vars, redeploy (Vercel → Deployments → Redeploy, or push a commit).

## Deploying

- **Normal path:** commit to `main` on GitHub → Vercel auto-builds and promotes to production.
- **Rollback:** Vercel → Deployments → choose a previous "Ready" production deployment → **Instant
  Rollback** (or "Promote to Production").
- The production domain is `emponboarding.vercel.app` (also `-git-main-cardwell` and team aliases).

## Supabase Auth configuration (one-time, dashboard)

- **Auth → URL Configuration:** Site URL = `https://emponboarding.vercel.app`; add it (and any preview
  URLs you use) to **Redirect URLs**, or magic links won't return to the app.
- **Email:** the built-in mailer is rate-limited (~2–3/hr). Wire **custom SMTP** (Auth → Email) before
  onboarding more than a couple of people at once.

## Adding an employee (the intended flow)

1. Leader signs in → **+ Add Employee** → enter name, work email, role title, role description.
2. The app: inserts a `plans` row (manager = you) → calls `/api/generate-plan` to draft a 30/60/90 plan
   → calls `/api/invite`.
3. **With `SUPABASE_SERVICE_ROLE_KEY` set:** an invite email is sent and a **copyable sign-in link** is
   shown in the dialog — send it to the employee if needed.
4. **Without it:** the plan is still created; the employee signs in themselves at
   `emponboarding.vercel.app` by entering their email (their new plan authorizes them via the allowlist).
5. First click of the magic link creates their `auth.users` row (passwordless) and logs them in.

### Manual provisioning fallback (if `/api/invite` fails)

Because the plan row authorizes the email, the employee can always self-serve: open the app, enter email,
"Email me a sign-in link." Admins can also invite from Supabase → Authentication → Users → **Invite**.

## Common tasks (SQL, via Supabase SQL editor)

- **List everyone under a manager:**
  `select employee_name, employee_email, role_title, status from plans where manager_email = 'daubourg@cardwellgroup.com';`
- **Archive a plan:** `update plans set status='archived' where id='…';`
- **Change who a plan reports to:** `update plans set manager_email='…' where id='…';` (RLS: run as
  service role / SQL editor).
- **Reset a person's "seen" baseline:** `delete from item_acknowledgements where user_email='…';`
  (they'll re-baseline on next login).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| "This email is not authorized" on login | No plan row for that email yet. Add the employee first (creates the plan), or add the email to a plan. |
| Magic link doesn't return to the app | Site URL / Redirect URLs not set in Supabase Auth. |
| Invite shows no email/link | `SUPABASE_SERVICE_ROLE_KEY` not set in Vercel — employee can self-serve login instead. |
| AI assist says "keyword matching" / OCR unavailable | `ANTHROPIC_API_KEY` missing or model error; features fall back to heuristics. |
| "Phase X already has two active priorities" | The 2-per-phase priority cap; mark one Done or unflag it. |
| "Only the item creator or the leader can edit this item" | Content-edit guard; status changes are still allowed for members. |
| Homepage 404 after a deploy | A build shipped without `app/page.js`. Roll back in Vercel, then redeploy the full source. |
| Employee sees another employee's data | Should be impossible (RLS). If seen, treat as a security bug — check policies in `02-DATA-MODEL.md` weren't altered. |

## Backups & safety

- Supabase provides automated Postgres backups (see project dashboard → Database → Backups).
- All schema changes are migrations (listed in `02-DATA-MODEL.md`); apply new ones as migrations so the
  history stays reproducible. Prefer additive changes; the app tolerates unknown columns.
- Treat `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` as secrets; rotate via the respective
  dashboards if exposed.
