# Cardwell Leader Onboarding Tool — Handoff (v0.3)

**Prepared for:** Jake & team
**Owner (product / client zero):** Dickens Aubourg
**Status:** Live in production, pilot stage

---

## 1. What this is

A web app that builds and runs **30/60/90-day onboarding plans** for new leaders, aligned to the
Cardwell **OnePage** strategy and **company values**. It started as a single-plan pilot (Dickens →
Citlali) and now supports **many employees under a manager**, each with their own login and plan, plus a
combined leader view. It is intended as an extension of **Connections Dialogs for individuals** and is
designed to eventually fold into the Connections platform (see `05-CONNECTIONS-INTEGRATION.md`).

## 2. Where everything lives

| Thing | Location |
|---|---|
| Live app | https://emponboarding.vercel.app |
| Source repo | https://github.com/cardwellgroup/new_emp_onboarding (public, `main`) |
| Hosting | Vercel — team **Cardwell**, project **emp_onboarding** (`prj_prNlnTV6O5W3S6NPMZobWjc2rw9C`). Auto-deploys on push to `main`. |
| Database / Auth / Storage | Supabase — project **New Employee Onboarding**, ref **`siriqhbbkqehbetuorqd`**, region `us-east-1`, Postgres 17 |
| AI | Anthropic Claude API (Haiku) — used by the API routes for structuring/generation/OCR |

## 3. Tech at a glance

- **Next.js 14** (App Router) + **React 18**, deployed on Vercel.
- **Supabase**: Postgres (data), Auth (passwordless magic link), Storage (note photos).
- Frontend is one client component (`app/page.js`) + one stylesheet (`app/globals.css`).
- Five serverless API routes under `app/api/*` call Claude and (for invites) the Supabase admin API.
- Full detail in `01-ARCHITECTURE.md` and `02-DATA-MODEL.md`.

## 4. Current data (pilot)

1 organization (Cardwell), 1 plan (Citlali Soberanis, manager Dickens), 22 plan items, 42
acknowledgements, 2 audit events, 2 ad-hoc requests, 1 journal entry. No check-ins, comments, notes, or
phase reviews recorded yet.

## 5. Roles & access model (short version)

- **Leader/manager** signs in and sees **all employees reporting to them** (Team Overview + drill-in).
- **Employee** signs in and sees **only their own plan**. Enforced in the database with Row Level
  Security, not just the UI.
- A person's email must already appear on a plan (as manager or employee) before they can sign in — a
  database trigger enforces this allowlist.

## 6. What's done vs. not

**Done:** single + multi-employee plans, magic-link auth with per-employee isolation, auto-generated
starter plans, combined filterable leader view, weekly check-ins, dialogue prep, comments/journal,
priority flags, activity/audit log, meeting-transcript import, note-photo OCR, printable/downloadable
plan, Cardwell branding, mobile-responsive layout.

**Not yet / known limits (see `04-OPERATIONS-RUNBOOK.md` and `05-CONNECTIONS-INTEGRATION.md`):**
- Single tenant (one `organizations` row). No `tenant_id` scoping yet.
- OnePage/values are stored in this DB, not read from Connections.
- Auth is standalone Supabase magic link (no SSO with Connections).
- Default Supabase mailer is rate-limited (~2–3/hr); no custom SMTP.
- "Universal/mandatory tenant items" are a planned next phase (leader adds mandatory items manually today).
- No automated tests or CI beyond Vercel's build.

## 7. Transition checklist for Jake & team

1. Get added to the **Cardwell Vercel team** and the **GitHub repo** (admin: Dickens).
2. Get access to the **Supabase project** `siriqhbbkqehbetuorqd`.
3. Read `01-ARCHITECTURE.md` → `02-DATA-MODEL.md` → `04-OPERATIONS-RUNBOOK.md`.
4. Confirm the env vars in Vercel (Section in `04`): `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   optional `ANTHROPIC_MODEL`, and the public Supabase URL/anon key.
5. Clone, `npm install`, `npm run dev`, and sign in with an allowlisted email to see it locally.
6. When planning Connections integration, start from `05-CONNECTIONS-INTEGRATION.md`.

## 8. Document index

- `01-ARCHITECTURE.md` — system design, request/auth flow, files, API routes, deploy pipeline.
- `02-DATA-MODEL.md` — every table, column, enum, relationship, RLS policy, trigger, function, storage.
- `03-FEATURES.md` — each feature mapped to the code and tables that implement it.
- `04-OPERATIONS-RUNBOOK.md` — env vars, deploy, add-employee/provisioning, Supabase config, troubleshooting.
- `05-CONNECTIONS-INTEGRATION.md` — how to fold this into the Connections platform (concept mapping, SSO, multi-tenant, API surface, migration).
- `CONTEXT.md` — a concise primer (for a new engineer or an AI coding assistant) of conventions and gotchas.
