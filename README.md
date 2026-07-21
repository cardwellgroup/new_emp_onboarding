# Cardwell Leader Onboarding Tool

30/60/90 new-leader onboarding aligned to the OnePage — built as an extension of Connections Dialogs for individuals. v0.1, Cardwell as client zero.

**Pilot:** Dickens Aubourg (Leader) · Citlali Soberanis (New Leader, Operations & Enablement Lead)

## Stack

- Next.js 14 (App Router) on Vercel
- Supabase — Postgres + magic-link auth (project: `New Employee Onboarding`, `siriqhbbkqehbetuorqd`)
- Claude API for ad hoc item structuring (optional; heuristic fallback without it)

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | defaults to the pilot project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | defaults to the pilot publishable key (safe to expose) |
| `ANTHROPIC_API_KEY` | no | enables full AI structuring of ad hoc plan items |
| `ANTHROPIC_MODEL` | no | defaults to `claude-haiku-4-5-20251001` |

## Supabase configuration (one-time, dashboard)

Auth → URL Configuration: set **Site URL** to `https://emponboarding.vercel.app` and add it to Redirect URLs — magic links won't land back in the app otherwise. The built-in mailer is rate-limited (~2 emails/hr); wire custom SMTP before wider use.

## Access model

Magic-link email sign-in only. A database trigger rejects sign-up for any email not on a plan (manager_email / employee_email). Role is determined by which email you sign in with. Journal entries are RLS-protected to their author — the other party can never read them.

## Data model (Dialog-shaped, for future Connections sync)

`organizations` (OnePage + values) → `plans` → `plan_items` (phase 30/60/90 × track impact/acclimation, tagged P1–P4 / V1–V6, success measure, evidence) · `check_ins` + `check_in_items` (weekly status/confidence/notes — mirrors an individual Dialog) · `journal_entries` (private) · `phase_reviews` · `ad_hoc_requests` (AI-structured additions).

Schema lives in Supabase migrations: `onboarding_core_schema`, `rls_and_allowlist`, `security_hardening`.

## Develop

```bash
npm install
npm run dev
```

## Roadmap

v0.2 AI dialogue-prep summaries + phase-gate reviews · v0.3 scoring roll-ups · v1.0 multi-org (any client OnePage + JD) · then native Connections integration.
