# Features → where they live

Each feature and the code + tables that implement it. Component names are in `app/page.js` unless noted.

## v0.4 additions
- **Employee Info module** (leader; nav tab "Employee Info"): edit employee name/email/role, employee
  start date, **plan start date**, and a **calendar vs business days (M–F)** toggle (`plans.plan_start_date`,
  `plans.day_mode`). Phase end dates computed by `addPlanDays`/`phaseEndLabel` and shown in each phase header.
- **Simplified tiles + detail drawer**: `ItemTile` shows #ref, ★, title, status; clicking opens
  `ItemDrawer` (slides from right) with status, tags, done-means, evidence, edit, delete, comments.
- **Employee edit → approval** (`pending_edit` jsonb): employees can edit any item; edits to items they
  didn't create apply immediately but carry an APPROVAL PENDING badge with the prior content stored;
  leader approves (keeps) or declines (reverts + optional comment). `onSave`/`onResolveEdit`.
- **Reference numbers**: `plan_items.ref_no`, per-plan sequential, assigned by DB trigger, never reused.
- **Ordering**: starred items pinned on top (fixed, by ref); non-starred drag-and-drop within each
  phase+track, persisted to `sort_order` (`onReorder`).
- **Request review**: employee proposals open in an editable form (`RequestRow`) so the leader can modify
  before approving; decline takes an optional comment (stored in `ai_suggestion.denial_comment`).
- **Autosave drafts**: AI-assist, transcript, build-it form, journal, and comment inputs persist locally
  (`draftGet/Set/Clear`, keys `cw_draft_*`) until the explicit save/submit.

## Multi-employee & roles (v0.3)
- **Add Employee** (leader): `AddEmployee` modal → inserts a `plans` row → `POST /api/generate-plan`
  inserts starter `plan_items` (source `ai_suggested`) → `POST /api/invite` provisions the login.
- **Team Overview** (leader home): `TeamOverview` — all items across the manager's plans, grouped by
  phase, filterable by employee/status/phase (combinable). "Open →" drills into a plan.
- **Drill-in**: `App` sets `view = <plan id>`; renders the per-plan tabs for that employee.
- **Employee view**: `App` (`!isManager`) renders only that employee's plan and tabs.
- **Isolation**: RLS via `is_plan_member/manager/employee` (see `02-DATA-MODEL.md`).

## The 30/60/90 plan
- Phases 30/60/90 × tracks Impact/Acclimation. `PlanView` renders collapsible phase sections
  (collapse state persisted in `localStorage`), each with the two tracks and `ItemCard`s.
- **Filters**: status + "priorities only" + priority tag, in `PlanView`.
- **OnePage header**: collapsible strategy banner from `organizations.one_page` / `core_values`.

## Items
- **Create/edit/delete**: `ItemForm` + handlers `addItem` / `onSave` / `onDelete`. Creator or leader can
  edit content (enforced by `plan_items_content_guard`); anyone (member) can change status.
- **Statuses**: `not_started / on_track / at_risk / blocked / done` (`item_status`). Marking `done`
  prompts for evidence.
- **Priority for the phase (★)**: `phase_critical`; max 2 non-done per phase (`enforce_phase_priority_cap`).
- **Tags**: P1–P4 (priorities) and V1–V6 (values), multi-select in `ItemForm`.
- **NEW / UPDATED chips**: `flagFor` compares `item_acknowledgements.ack_version` to
  `plan_items.content_version`. "Got it" / "Mark all as seen" acknowledge.

## Add to Plan (three modes) — `AddView`
- **Build it**: manual `ItemForm`.
- **AI assist**: `AiAssist` → `POST /api/structure` returns **multiple** structured items from a numbered
  list; shown in a `Carousel` to review/edit/add each.
- **From a meeting**: `MeetingImport` → `POST /api/transcript` from a pasted transcript **or** a meeting
  link (server fetches & strips the link); candidates shown in the same carousel.
- **Smart-list typing** (`smartListKeyDown`): the AI-assist box and the meeting Transcript box
  auto-continue lists — pressing Enter after `1. …`/`* …`/`- …` inserts the next number/bullet, an empty
  marker line exits the list, and Shift+Enter is a plain line break.
- Leader additions land directly (source `manager_added`, then employee must acknowledge). Employee
  additions become `ad_hoc_requests` (pending) for leader approval.

## Approvals & acknowledgments
- **Approvals**: employee proposals in `ad_hoc_requests`; leader approves/rejects (`resolveReq`,
  `adhoc_update` is manager-only). Approval creates a `plan_items` row (source `employee_proposed`).
- **Acknowledgment gate** (`AckGate`): an employee must acknowledge new *leader-added* items before using
  the plan. Auto-generated (`ai_suggested`) items are not gated.

## Weekly check-in & dialogue prep
- **Check-in** (employee): `CheckinView` writes `check_ins` + `check_in_items` (status, 1–5 confidence,
  note, shared flag).
- **Dialogue prep** (leader): `PrepView` assembles the latest submitted check-in (flags, shared notes,
  average confidence).

## Comments & journal — `CommentThread`, `JournalView`
- Per-item comments shared across the two plan members. Marking a comment **private** writes it to the
  author's `journal_entries` (source `private_comment`) instead. Journal is author-only (DB-enforced).

## Activity / audit — `ActivityView`
- Reads `plan_item_events`. Shows a deleted-items log (survives deletion via `title_snapshot`) plus
  recent created/edited/deleted events.

## Download & note capture — `DownloadView`
- Printable/downloadable plan (`window.print()` with print CSS) including a Notes section
  (`plans.notes`). Mobile **photo of notes** → uploads to Storage → `POST /api/ocr` (Claude vision) →
  `note_uploads.extracted_text`.

## Voice input — `Mic`
- Web Speech API dictation on text fields (Chrome/Safari). No server component.

## Branding & layout
- Cardwell logo pulled from the cardwellgroup.com CDN at runtime (`Logo`), inline SVG fallback.
- Navy/blue palette + Inter/Cormorant in `globals.css`; sticky header, left-nav, mobile drawer,
  print styles.

## AI routes (server) — summary
| Route | Input | Output | Fallback without `ANTHROPIC_API_KEY` |
|---|---|---|---|
| `/api/structure` | free text (list) | `{items:[…]}` | keyword heuristic per line |
| `/api/transcript` | transcript and/or link | `{items:[…]}` | keyword line extraction (fetches link server-side) |
| `/api/generate-plan` | role title + description | `{items:[…]}` full 30/60/90 | fixed starter set |
| `/api/ocr` | base64 image | `{text}` | returns note to type manually |
| `/api/invite` | email, redirect | `{link, emailed}` | asks employee to self-serve magic link |
