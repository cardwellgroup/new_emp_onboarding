# v0.3 — Multiple employees, employee logins, combined leader view

## What's in this version

- **Add Employee** (leader): captures name, work email, role title, and a job role description, then
  auto-generates a starter 30/60/90 plan from the shared Cardwell OnePage + values + that role
  (via `/api/generate-plan`). It's a draft you both refine; add any mandatory items yourself.
- **Employee logins + isolation**: each employee gets their own magic-link login and sees ONLY their
  own plan/items. Enforced at the database level by the existing Row Level Security (each employee =
  one `plans` row; `is_plan_member/manager/employee` scope every read/write).
- **Combined leader view (Team Overview)**: all employees reporting to you, grouped by phase (30/60/90),
  filterable and combinable by Employee, Status, and Phase. Click an employee (or "Open →") to drill
  into their full plan with the existing tabs (Plan, Dialogue Prep, Add to Plan, Journal, Activity, Download).
- Status set and the approval/acknowledgment workflow are unchanged from before, as requested.

## Backend — already applied to Supabase (nothing to run)

- Added `plans.role_description` (migration `v03_add_role_description`).
- No new tables or RLS needed: multiple employees are just multiple `plans` rows under your
  `manager_email`. RLS already isolates employees and lets a manager read all their plans. The manager
  relationship lives on `plans.manager_email`, which supports other managers later.

## Setup you need to do

1. **Provisioning env var (recommended).** To have "Add Employee" send an invite email *and* show you a
   copyable sign-in link, add a secret in Vercel → Settings → Environment Variables:
   - `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service-role key (Supabase → Project Settings → API →
     `service_role` secret). Server-side only; never exposed to the browser.
   - Without it, Add Employee still works — it just won't email or generate a link; the employee signs in
     themselves (see below).

2. **How a new employee first logs in.** Their `plans` row (created by Add Employee) authorizes their
   email via the existing allowlist trigger, so:
   - If the service-role key is set: they get an invite email, or you copy the link the dialog shows and
     send it to them.
   - Either way, they can also just open **https://emponboarding.vercel.app**, enter their email, and
     click "Email me a sign-in link" — first click creates their account (passwordless).

3. **Supabase Auth redirect URLs.** Confirm `https://emponboarding.vercel.app` is in Auth → URL
   Configuration (Site URL + Redirect URLs). It already is for the pilot.

4. **Email volume.** The built-in Supabase mailer is rate-limited (~2–3/hr). For onboarding a couple of
   people that's fine; wire custom SMTP before larger rollouts.

## Assumptions made

- Each employee has exactly one active onboarding plan; you (Dickens) are leader-only with no plan of
  your own (you'll add yourself as a test employee).
- Citlali's existing plan and its items are folded in as your first employee automatically — she already
  has a `plans` row with you as `manager_email`, so she appears under Team Overview with no migration.
- Auto-generated items start at "Not started", source `ai_suggested`, and are NOT gated for the employee
  (only leader-*added* items require employee acknowledgment, unchanged).
- Combined view is leader-only; employees never see it or each other (DB-enforced).

## Why this ships via git (not the one-click connector)

The app's client bundle is now ~50 KB; the direct deploy connector I used for earlier updates can't
transmit a build this size in one call. Push this source to `cardwellgroup/new_emp_onboarding` and Vercel
builds it automatically (see DEPLOY.md). It compiled clean locally and in a Vercel-style build.
