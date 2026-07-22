# Data Model (Supabase Postgres, schema `public`)

Project ref: `siriqhbbkqehbetuorqd`. All app tables have **Row Level Security enabled**. Identity is by
email (`citext`), matched against `current_email()` from the JWT.

## Entity relationships

```
organizations (1)
   └─< plans (many)                      one plan = one employee's onboarding, under a manager
         ├─< plan_items (many)           the 30/60/90 items
         │      └─< comments             shared per item
         │      └─< item_acknowledgements (per user, per item)
         ├─< check_ins ─< check_in_items weekly employee status updates
         ├─< ad_hoc_requests             employee-proposed items awaiting leader approval
         ├─< journal_entries             private to author (incl. "private comments")
         ├─< phase_reviews               phase-gate reviews (scaffolded, unused so far)
         ├─< note_uploads                photo-of-notes → OCR text
         └── plan_item_events            audit log (created/edited/deleted); survives item deletion
```

"Employees reporting to a manager" = all `plans` where `manager_email` = that manager. This supports
multiple managers later with no schema change.

## Enums

| Enum | Values |
|---|---|
| `item_status` | `not_started`, `on_track`, `at_risk`, `blocked`, `done` |
| `item_source` | `jd_seeded`, `ai_suggested`, `manager_added`, `employee_proposed` |
| `track_type` | `impact` (strategic priorities), `acclimation` (team/culture/values) |
| `plan_status` | `draft`, `active`, `completed`, `archived` |
| `adhoc_status` | `pending`, `approved`, `rejected` |

Phases are the smallint values **30 / 60 / 90** (checked, not an enum). Tags are a `text[]` of codes
`P1..P4` (priorities) and `V1..V6` (values) that reference the org's OnePage/values.

## Tables & columns

### organizations  (1 row: Cardwell)
`id uuid pk` · `name text` · `one_page jsonb` · `core_values jsonb` · `created_at timestamptz`
- `one_page` shape: `{ pinnacle, core_purpose, fiscal_year, priorities:[{code:"P1",title,bullets:[]}] }`
- `core_values` shape: `[{ code:"V1", name, description }]`
- Read-only to all authenticated users (`org_read: using true`). The single shared strategy context.

### plans  (one per employee)
`id uuid pk` · `org_id uuid → organizations` · `manager_email citext` · `employee_email citext` ·
`manager_name text?` · `employee_name text?` · `role_title text` · `role_description text?` (v0.3) ·
`start_date date?` · `status plan_status = active` · `notes text?` · `created_at timestamptz`
- **The manager relationship.** `manager_email` = who the employee reports to.
- `role_description` feeds `/api/generate-plan` when auto-creating a new plan.
- `notes` is the free-text block that prints on the downloadable plan.

### plan_items  (the 30/60/90 items)
`id` · `plan_id → plans` · `phase smallint (30|60|90)` · `track track_type` · `tags text[]` ·
`title text` · `description text?` · `success_measure text` · `status item_status = not_started` ·
`phase_critical bool = false` (the ★ "priority for the phase") · `evidence text?` · `evidence_url text?` ·
`source item_source = manager_added` · `created_by citext?` · `sort_order int` · `created_at` ·
`updated_at` · `content_version int = 1` · `content_updated_at` · `content_updated_by citext?`
- **Versioning:** `content_version` increments only when *content* fields change (title, description,
  success_measure, phase, track, tags) — not on status changes. Drives the NEW/UPDATED chips.
- **Priority cap:** at most **2** `phase_critical` items that are not `done` per (plan, phase) — enforced
  by trigger.

### comments  (shared per item)
`id` · `plan_id` · `plan_item_id → plan_items` · `author_email citext` · `body text` ·
`private bool = false` · `created_at`
- Non-private comments are visible to both plan members. "Private" comments are written instead to
  `journal_entries` (source `private_comment`) — see the app logic.

### item_acknowledgements  (per user "seen"/ack state)
PK (`plan_item_id`, `user_email`) · `plan_id` · `ack_version int` · `acknowledged_at`
- Powers NEW (no ack row) / UPDATED (ack_version < content_version) chips, and the employee
  acknowledgment gate for leader-added items. On first login the app baselines all current items as seen.

### plan_item_events  (audit log)
`id` · `plan_id` · `plan_item_id uuid?` (no FK — survives deletion) · `event_type text`
(`created`|`edited`|`deleted`) · `actor_email citext?` · `title_snapshot text?` · `detail jsonb` ·
`created_at`. Written by a SECURITY DEFINER trigger; read-only to plan members.

### check_ins / check_in_items  (weekly employee updates)
`check_ins`: `id` · `plan_id` · `week_of date` · `submitted_at?`.
`check_in_items`: `id` · `check_in_id` · `plan_item_id` · `status item_status` · `confidence smallint 1..5?`
· `note text?` · `shared bool`. Only the **employee** can create/update; both can read.

### ad_hoc_requests  (employee proposals → leader approval)
`id` · `plan_id` · `raw_text text` · `ai_suggestion jsonb?` · `status adhoc_status = pending` ·
`requested_by citext` · `approved_by citext?` · `resolved_item_id uuid?` · `created_at` ·
`source_type text = 'text'` (`text|fireflies|transcript|voice`) · `source_url text?`.
- Insert by any plan member (as themselves); **update (approve/reject) is manager-only**.

### journal_entries  (private to author)
`id` · `plan_id` · `author_email citext` · `body text` · `plan_item_id uuid?` · `source text = 'journal'`
(`journal|private_comment`) · `created_at`.
- Policy `journal_all`: a row is only ever visible/writable by its author. The other party can never read
  it — enforced in the database.

### note_uploads  (photo-of-notes → OCR)
`id` · `plan_id` · `storage_path text` · `extracted_text text?` · `status text = 'uploaded'`
(`uploaded|processed|added|discarded`) · `created_by citext?` · `created_at`.
- Image bytes live in Storage bucket `note-uploads`; this table holds the metadata + extracted text.

### phase_reviews  (scaffolded, unused)
`id` · `plan_id` · `phase smallint` · `scorecard jsonb` · `wins?` · `misses?` · `next_phase_notes?` ·
`created_at`. Reserved for phase-gate reviews (roadmap).

## Helper functions (all `SET search_path=public`)

| Function | Security | Returns |
|---|---|---|
| `current_email()` | invoker | `auth.jwt() ->> 'email'` as citext, `''` if none |
| `is_plan_member(uuid)` | definer | true if current_email is the plan's manager or employee |
| `is_plan_manager(uuid)` | definer | true if current_email = plan.manager_email |
| `is_plan_employee(uuid)` | definer | true if current_email = plan.employee_email |
| `enforce_allowlist()` | definer | trigger on `auth.users`: block sign-up unless email is on a plan |
| `plan_items_content_guard()` | invoker | BEFORE ins/upd: version bump + only creator/leader may edit content |
| `enforce_phase_priority_cap()` | invoker | BEFORE ins/upd: max 2 non-done priorities per (plan,phase) |
| `log_plan_item_event()` | definer | AFTER ins/upd/del: write `plan_item_events` |

## Triggers

- `auth.users` → `allowlist_check` (enforce_allowlist).
- `public.plan_items` → `plan_items_touch` (updated_at), `trg_items_before_ins` / `trg_items_before_upd`
  (content guard + versioning), `trg_items_cap_ins` / `trg_items_cap_upd` (priority cap),
  `trg_items_audit` (event log).

## RLS policy summary (the security boundary)

| Table | Read | Insert | Update | Delete |
|---|---|---|---|---|
| organizations | all authenticated | — | — | — |
| plans | manager or employee of the row | `current_email = manager_email` | manager only | — |
| plan_items | plan member | plan member | plan member¹ | manager **or** creator |
| comments | member & (not private or author) | member & author=self | author or manager | author or manager |
| item_acknowledgements | member | member & user=self | user=self | — |
| plan_item_events | member | (writes via trigger only) | — | — |
| check_ins | member | employee | employee | — |
| check_in_items | member (via check_in) | employee | employee | — |
| ad_hoc_requests | member | member & requested_by=self | **manager only** | — |
| journal_entries | author only | author only | author only | author only |
| note_uploads | member | member & created_by=self | member | created_by or manager |
| phase_reviews | member | member | member | — |
| storage `note-uploads` | member of plan in path | member | — | member |

¹ `plan_items` UPDATE is allowed for any plan member at the policy level, but `plan_items_content_guard`
additionally blocks a non-creator/non-manager from changing *content* fields (they can still change
status/evidence/acknowledgment). This keeps the check-in flow working while protecting item content.

**Net effect:** a manager reads/writes across all their employees' plans; an employee is confined to
their own plan; neither can touch another employee's data even by calling the API directly.

## Storage

- Bucket `note-uploads` (private). Object path convention: `<plan_id>/<uuid>.jpg`.
- Storage RLS (`storage.objects`, policies `note_uploads_read/insert/delete`) authorizes access when the
  first path segment (`plan_id`) belongs to a plan the caller is a member of.

## Migration history (`supabase_migrations.schema_migrations`)

1. `onboarding_core_schema` — organizations, plans, plan_items, check_ins/items, journal, phase_reviews, ad_hoc_requests, enums.
2. `rls_and_allowlist` — RLS policies + helper functions + `auth.users` allowlist trigger.
3. `security_hardening` — search_path / definer hardening.
4. `v02_feature_columns_and_tables` — plan_items versioning cols; `comments`, `item_acknowledgements`, `plan_item_events`, `note_uploads`; `plans.notes`; ad_hoc `source_type/url`; journal `plan_item_id/source`.
5. `v02_triggers_versioning_cap_audit` — content guard, priority cap, audit log triggers.
6. `v02_rls_new_tables_and_delete` — RLS for the new tables; loosened `plan_items` delete to creator-or-manager.
7. `v02_storage_note_uploads` — private bucket + storage RLS.
8. `v02_fix_empty_email_handling` — treat empty `current_email()` as "no user" in the content guard/audit.
9. `v03_add_role_description` — `plans.role_description` for multi-employee auto-generation.
