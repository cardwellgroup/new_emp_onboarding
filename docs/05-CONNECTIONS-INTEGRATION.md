# Future: Integrating into the Connections platform

This tool was built as an **extension of Connections Dialogs for individuals**. Its data model was kept
deliberately "Dialog-shaped" so it can fold into Connections. This document is the starting point for
that work — concept mapping, the seams to cut, and a phased migration.

## 1. Concept mapping (this tool ↔ Connections)

| This tool | Connections concept | Notes |
|---|---|---|
| `organizations.one_page` / `core_values` | The OnePage (digitized one-page strategy) + company values | Today stored locally; should be **read from Connections** as the source of truth. |
| `plans` (one per employee) | An individual's onboarding **Dialog** | 30/60/90 framing; ties an employee to a manager. |
| `plan_items` (phase × track, tags P/V) | Dialog **projects / commitments** aligned to priorities & values | `tags` already reference OnePage priority (`P#`) and value (`V#`) codes. |
| `check_ins` / `check_in_items` | Weekly Dialog **updates** (status + confidence) | Same cadence/shape as Connections updates. |
| `phase_reviews` | Phase-gate / review moments | Scaffolded, not yet used. |
| `manager_email` on `plans` | Reporting relationship / org hierarchy | Replace email-based link with Connections user/org IDs. |
| Priority `P1..P4`, Value `V1..V6` | Strategic priorities & core values | Keyed by code; map to Connections IDs. |

## 2. The three seams to cut

Integration is mostly about replacing three standalone pieces with Connections-native ones:

1. **Identity / auth.** Today: standalone Supabase magic-link + an email allowlist trigger.
   Target: **SSO with Connections** (OIDC/SAML or shared Supabase project). Employees and managers are
   Connections users; `manager_email`/`employee_email` become Connections user IDs, and the allowlist
   trigger is replaced by Connections membership.
2. **Strategy context.** Today: `organizations.one_page` + `core_values` are hand-seeded here.
   Target: read the OnePage and values from Connections (API or shared schema) so there is one source of
   truth, versioned by fiscal year.
3. **Tenancy.** Today: a single `organizations` row (Cardwell). Target: **multi-tenant** — every plan and
   org scoped by `tenant_id`, with RLS keyed to tenant membership (see §4).

## 3. Recommended integration approaches (pick per Connections' architecture)

- **A. Embed as a module inside Connections** (tightest): move these tables into the Connections
  database (namespaced), reuse Connections auth and org model, and render the 30/60/90 UI as a
  Connections view. RLS/authorization becomes Connections' own.
- **B. Standalone service with SSO + sync** (looser, faster): keep this app/DB, add SSO, and sync
  OnePage/values and the user/org graph from Connections via API or scheduled jobs. Expose a small API
  (below) so Connections can read onboarding status.
- **C. Data-layer share** (middle): both apps point at the same Supabase project; Connections owns
  users/orgs/OnePage; this app owns the onboarding tables and joins to Connections' identity/org tables
  in its RLS helpers.

The current code makes **B** easiest short-term and **A/C** the clean long-term end state.

## 4. Multi-tenant readiness (do this first regardless of approach)

Today everything hangs off one `organizations` row. To support many clients:

- Add `tenant_id` (or reuse `org_id`) to the top-level tables and scope RLS by **tenant membership**
  rather than a per-plan email match. Introduce a `memberships(user, tenant, role)` table (or read it
  from Connections).
- Change `is_plan_member/manager` to also check tenant, and change `plans_read` so a manager sees plans
  within their tenant/hierarchy.
- Keep OnePage/values per tenant (already per-`organizations`), versioned by fiscal year.
- The "tenant-specific universal/mandatory plan items" the product roadmap calls for become a
  `tenant_item_templates` table that seeds every new plan (the current `/api/generate-plan` output would
  be merged with these mandatory items).

## 5. Suggested API surface (for approach B/C)

Minimal endpoints Connections would consume or this app would expose:

- `GET  /api/plans?manager=<id>` — plans + rollup status for a manager's reports.
- `GET  /api/plans/:id` — one plan with items, statuses, check-ins.
- `POST /api/plans` — create a plan for an employee (replaces Add Employee).
- `POST /api/plans/:id/items` — add/generate items.
- `GET  /api/onepage?tenant=<id>` — the strategy context (or read directly from Connections).
- Webhooks/events: emit on item status change and plan completion so Connections dashboards update.

`plan_item_events` already captures created/edited/deleted; extend it (or add outbound webhooks) to feed
Connections analytics.

## 6. Migration path (incremental, low-risk)

1. **Tenant scoping** (schema + RLS) while still single-tenant — no behavior change, future-proofs data.
2. **Strategy source of truth**: point OnePage/values reads at Connections (feature-flag; fall back to
   local `organizations`).
3. **Identity**: introduce SSO alongside magic link; map Connections users to `manager_email`/
   `employee_email`; then retire the allowlist trigger.
4. **Expose/consume API**: surface onboarding status in Connections; optionally move item creation to a
   server API.
5. **Consolidate**: either embed the UI in Connections (A) or keep it as a linked module (B/C).

## 7. Things to preserve during integration

- **RLS-first isolation** — never rely on the UI alone; keep per-user/tenant row security.
- **The 30/60/90 × Impact/Acclimation structure** and the P#/V# tagging — this is the product's core and
  maps directly to Connections priorities/values.
- **Audit trail** (`plan_item_events`) and the **acknowledgment/approval** workflows — these encode the
  manager/employee interaction model Connections will want.
- **AI seams** are already isolated in `app/api/*`; they can be re-pointed at a shared AI service without
  touching the UI.
