# Cardwell Leader Onboarding Tool — v0.3

30/60/90 new-leader onboarding aligned to the OnePage — built as an extension of Connections Dialogs.
Now supports multiple employees with per-employee logins and a combined leader view.

**Pilot:** Dickens Aubourg (Leader) · Citlali Soberanis (New Leader)

## 📚 Full documentation → `docs/`

Start with **`docs/00-HANDOFF.md`**, then:
`01-ARCHITECTURE.md` · `02-DATA-MODEL.md` · `03-FEATURES.md` · `04-OPERATIONS-RUNBOOK.md` ·
`05-CONNECTIONS-INTEGRATION.md` · `CONTEXT.md` (engineer/AI primer).
See also `SETUP-multi-employee.md` and `DEPLOY.md`.

## Stack

- Next.js 14 (App Router) on Vercel
- Supabase — Postgres + magic-link auth + Storage (project `New Employee Onboarding`, `siriqhbbkqehbetuorqd`)
- Claude API for item structuring, meeting-transcript extraction, and note-photo OCR (optional; heuristic fallback without it)

## What's new in v0.2

1. **Collapsible 30/60/90 stages** (state remembered per browser).
2. **Sticky top bar** + collapsible OnePage header.
3. **Filters** — by status, by "priorities only," and by priority tag (P1–P4).
4. **Left-hand navigation** (collapses to a drawer on mobile).
5. **Richer add form** — phase titles in the dropdown, multi-select strategic priorities and core values, phase-priority flag.
6. **Cardwell branding** — inline SVG logomark + wordmark. Drop an official PNG into `public/` and swap the `<Logo>` component to use it.
7. **Add items from a meeting** — paste a Fireflies link + transcript; candidate items are extracted for review/approval.
8. **Edit & delete** — creators edit/delete their own items; the leader edits/deletes everything. Enforced in the database.
9. **Speech-to-text** — mic button on every text field (Chrome/Safari Web Speech API).
10. **NEW / UPDATED chips** + a top notice; a **deleted-items log** in the Activity tab.
11. **Phase priorities** — either party can flag an item as a phase priority; max 2 active (non-Done) per phase, enforced by a DB trigger.
12. **Acknowledgment gate** — the new leader must acknowledge new leader-added items before using the plan (the leader already approves employee items).
13. **Comments** on every item, shared across both parties; marking a comment private routes it to the author's Journal.
14. **Downloadable plan** — print/save-to-PDF view with a Notes section, plus mobile photo upload of handwritten notes (OCR → text you can add to the plan).
15. **Mobile responsive** — streamlined layout, drawer nav, camera capture.

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | no | defaults to the pilot project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | defaults to the pilot publishable key |
| `ANTHROPIC_API_KEY` | **recommended** | enables AI item structuring, transcript extraction, and note-photo OCR. Without it these fall back to heuristics / manual entry. |
| `ANTHROPIC_MODEL` | no | defaults to `claude-haiku-4-5-20251001` |

## Backend

All schema for v0.2 is already applied to Supabase via migrations:
`v02_feature_columns_and_tables`, `v02_triggers_versioning_cap_audit`,
`v02_rls_new_tables_and_delete`, `v02_fix_empty_email_handling`, `v02_storage_note_uploads`.

New tables: `comments`, `item_acknowledgements`, `plan_item_events`, `note_uploads`.
New `plan_items` columns: `content_version`, `content_updated_at`, `content_updated_by`.
Storage bucket: `note-uploads` (private, path convention `<plan_id>/<file>`), RLS-scoped to plan members.

## Deploy

```bash
npm install
npm run dev      # local
```

Push to the connected GitHub repo (`cardwellgroup/new_emp_onboarding`) and Vercel will build. Add `ANTHROPIC_API_KEY` in Vercel to turn on the AI features.

## Notes on behavior

- On a user's first login, everything currently on the plan is marked "seen," so NEW/UPDATED chips and the acknowledgment gate only fire for changes made from that point forward.
- Editing an item's *content* (title, phase, track, tags, success measure) bumps its version and flags it UPDATED; changing status does not.
