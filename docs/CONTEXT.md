# CONTEXT — primer for a new engineer or AI coding assistant

Read this first before editing. It captures the conventions and gotchas that aren't obvious from the code.

## What/why
Cardwell Leader Onboarding Tool: 30/60/90-day onboarding plans for new leaders, aligned to the Cardwell
OnePage strategy + values. Multi-employee, per-employee logins, combined leader view. Next.js on Vercel,
Supabase for data/auth/storage, Claude for AI. Meant to eventually fold into the Connections platform
(see `05-CONNECTIONS-INTEGRATION.md`).

## Mental model
- One `plans` row = one employee's onboarding, linked to a manager by `manager_email`. "A manager's
  team" = all plans with that `manager_email`. This is how multi-employee works with no join table.
- Security is **Row Level Security**, keyed on `current_email()` (the JWT email) via
  `is_plan_member/manager/employee(plan_id)`. The UI trusts RLS; do not add data leaks by bypassing it.
- Items are `plan_items`: phase (30/60/90) × track (impact/acclimation), tagged with priority codes
  `P1..P4` and value codes `V1..V6` that come from `organizations.one_page` / `core_values`.

## Conventions / gotchas
- **`app/page.js` is one big client component** on purpose. Keep it a single file unless you deliberately
  split it. Components are plain functions; state via hooks; no state library.
- **`current_email()` returns `''`, not null**, when there's no JWT (e.g. service role). The content-edit
  guard treats empty as "trusted backend." Don't reintroduce a `is not null` check there.
- **Content vs. status edits.** Editing item *content* (title/description/success_measure/phase/track/
  tags) bumps `content_version` and is restricted to creator/leader by `plan_items_content_guard`.
  Status/evidence/priority/acknowledgment changes are allowed for any member. This split keeps check-ins
  working while protecting content — preserve it.
- **Priority cap**: max 2 non-`done` `phase_critical` items per (plan, phase), enforced by a DB trigger.
  Handle the `two active priorities` error message in the UI (already done).
- **Allowlist**: a person can only sign in if their email is already on a plan (trigger
  `enforce_allowlist` on `auth.users`). So **create the plan row before** provisioning/inviting.
- **AI routes degrade gracefully** without `ANTHROPIC_API_KEY` (heuristic fallbacks). `/api/invite`
  degrades without `SUPABASE_SERVICE_ROLE_KEY` (employee self-serves magic link). Don't hard-fail.
- **Storage path** for note photos is `<plan_id>/<uuid>.jpg`; storage RLS parses the first path segment
  as the plan id — keep that convention or update the storage policies.
- **First-login baseline**: on a user's first load, the app writes `item_acknowledgements` for all their
  current items so NEW/UPDATED chips only fire on future changes. Employee "must-acknowledge" gate is
  only for `source='manager_added'` items.
- **Deploys**: push to `main` → Vercel builds. Migrations are applied directly to Supabase, not by the
  build. Prefer additive migrations.

## Where to change common things
| Want to… | Edit |
|---|---|
| Add/relabel a status | `STATUSES` in `page.js` **and** the `item_status` enum (migration) |
| Change phase questions/labels | `PHASES` in `page.js` |
| Change AI behavior | the relevant `app/api/*/route.js` prompt |
| Change who can see/do what | RLS policies + `is_plan_*` functions (migration), see `02-DATA-MODEL.md` |
| Tune the generated starter plan | `app/api/generate-plan/route.js` prompt / fallback set |
| Style / layout | `app/globals.css` (design tokens at top; component sections; print + mobile at bottom) |

## Don't
- Don't put `SUPABASE_SERVICE_ROLE_KEY` in any client code or `NEXT_PUBLIC_*` var.
- Don't rely on the UI for isolation — always check/keep RLS.
- Don't ship a build missing `app/page.js` (a partial deploy once caused a homepage 404).

## Key IDs
- Supabase project ref: `siriqhbbkqehbetuorqd`
- Vercel: team **Cardwell**, project **emp_onboarding** (`prj_prNlnTV6O5W3S6NPMZobWjc2rw9C`)
- Repo: `github.com/cardwellgroup/new_emp_onboarding` (`main`)
- Live: `https://emponboarding.vercel.app`
