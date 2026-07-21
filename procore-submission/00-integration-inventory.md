# Vektrum ⇄ Procore — Integration Inventory (Step 1)

**Purpose.** Ground-truth of what Vektrum actually models and exposes today, so the
Procore Technology Partner feasibility diagram and deck are honest. Everything below
was verified by reading the repository (migrations, API routes, engine, auth libs).
Nothing here was invented. Competitive-sensitive internals (how the release gate
decides) are intentionally **not** described — only *what* data exists and *which
direction* it would flow.

**Method / what I read (read-only):**
- `supabase/migrations/*.sql` (57 migrations) — the real data model
- `src/app/api/**/route.ts` — the real read/write surface (94 routes)
- `src/lib/auth/partner.ts`, `src/lib/engine/*` — existing integration + gate scaffolding
- Marketing/pitch pages — only place the word "Procore" appears

---

## 0. Headline finding (read this first)

**There is no Procore integration in this codebase today.** No Procore OAuth client,
no Procore REST client, no Procore webhook receiver, no object-sync layer. The only
occurrences of "Procore" are positioning copy on marketing/pitch pages
(`src/app/(marketing)/*`, `src/app/pitch/page.tsx`). **Every Procore-specific
integration point in Steps 2–3 must therefore be labeled `[PROPOSED — not yet built]`.**

**However**, Vektrum already ships a working, generalized **Partner API + webhook
framework** (API-key auth, HMAC-signed webhooks, per-partner deal scoping, signed
authorization tokens). That is the real, verified foundation a Procore integration
would extend — so "feasible" is well-supported, "live" is not.

---

## 1. Vektrum data model → Procore object mapping

Every Vektrum entity below is verified in code (source cited). The Procore-object
column is the *proposed* mapping (Procore objects not present in this repo).

| Vektrum entity (verified) | Key fields (verified) | Source | Maps to Procore object `[PROPOSED]` |
|---|---|---|---|
| `deals` | contractor_id, funder_id, total/funded/released_amount, status, **execution_rail**, partner_id | `001_schema.sql:97`, `20260425000000_rail_abstraction.sql`, `20260425000001_partners.sql` | **Project** + the funding/loan envelope behind it |
| `milestones` | deal_id, amount, position, status, protection_status | `001_schema.sql:123` | Pay-application period / schedule phase (loose) |
| `sov_line_items` | item_number, scheduled_value, approved_change_orders, revised_value, previous_released, current_requested, retainage_amount, balance_to_finish, percent_complete | `..._retainage` / SOV migration | **Prime Contract SOV / Budget / Pay Application (AIA G702/G703)** — cleanest 1:1 mapping |
| `milestone_sov_links` | milestone_id ↔ sov_line_item_id | SOV migration | (join used to tie draws to SOV lines) |
| `change_orders` | milestone_id, deal_id, amount, status (submitted/approved/rejected/paid) | `001_schema.sql:169` | **Change Orders / Change Events** |
| `contracts` | deal_id, docusign_envelope_id, funder/contractor_signed_at, status | `011_contracts.sql:31` | **Prime Contract** (signed agreement) |
| `lien_waivers` | deal_id, milestone_id, waiver_type (`conditional_progress` …), status, waiver_amount, through_date | `20260424000008_lien_waivers.sql:88` | **Levelset lien waivers** (position *beside*, never on top) |
| `milestone_documents` | milestone_id, file_url, file_type (photo/document/change_order) | `001_schema.sql:149` | **Project Documents / Photos** (draw evidence) |
| `profiles` | role (contractor/funder/admin), company_name, stripe_account_id | `001_schema.sql:71` | **Vendors / Users** (partial — see §5 caveat) |
| `releases` | milestone_id (unique), amount, execution_rail/status, external_payment_reference, idempotency_key | `001_schema.sql:218`, `20260425000000_rail_abstraction.sql` | Disbursement record (Vektrum-owned; **not** Procore Pay) |
| `authorization_tokens` | jti, idempotency_key, sequence_index, rail_scope, payee_scope, funder_id | `20260504000001_authorization_tokens.sql:57` | Signed **disbursement-authorization** artifact (Vektrum-owned) |
| `audit_log` | entity_type/id, action, actor, old/new_values, **row_hash + chain_hash (SHA-256)** | `001_schema.sql:245`, `..._audit_log_immutability.sql` | Audit / compliance evidence (Vektrum-owned) |
| `disputes` | milestone_id, amount_in_dispute, status | `001_schema.sql:192` | (no direct Procore object; dispute isolation is Vektrum-specific) |
| `retainage_releases`, `billing_records`, `transaction_receipts`, `milestone_prerequisites` | — | later migrations | Retainage, fee ledger, receipts, sequential-release gating (Vektrum-owned) |

---

## 2. Integration scaffolding that ALREADY EXISTS (verified)

These are live and are the true basis for feasibility:

- **Partner API (outbound integration framework).** `src/lib/auth/partner.ts` +
  `src/app/api/partner/*`. Verified capabilities:
  - API-key auth: `api_key_hash` (hashed), `api_key_prefix`, per-partner `is_active`
    (`partners` table, `20260425000001_partners.sql:29`).
  - HMAC webhooks: `webhook_url` + `webhook_signing_secret` per partner.
  - Per-partner deal scoping: `deals.partner_id`; a partner can only read its own deals.
  - Verified partner verbs: `GET /api/partner/releases/[releaseId]` (read an authorized
    release: amounts, rail, status), `POST …/confirm`, `POST …/fail`,
    `POST /api/partner/tokens/verify`, `GET /api/partner/tokens/[jti]`.
  - **This is exactly the shape a Procore integration would use** — Procore (or a
    connector) becomes a scoped partner that reads authorization state and reports
    execution outcome back.
- **DocuSign** contract e-sign lifecycle: `src/lib/engine/docusign.ts`,
  `/api/webhooks/docusign`, `contracts.docusign_envelope_id`.
- **Stripe Connect** as one execution rail: `/api/stripe/webhook`, `/api/stripe/connect`
  (verified: idempotency, `stripe_processed_events` dedupe).
- **AI draw review** provider chain (Perplexity → Anthropic → OpenAI) as a *precondition*,
  `/api/ai/draw-review`, `supabase/functions/run-draw-preclearance`.
- **Supabase Auth** (`/auth/callback`, `/api/auth/webhook`) — this is user auth, **not**
  Procore OAuth. Do not present it as such.

---

## 3. Integration scaffolding that DOES NOT EXIST → `[PROPOSED]`

- ❌ Procore OAuth 2.0 app / token exchange
- ❌ Procore REST API client (Projects, Commitments, Budget, Invoicing, Change Orders)
- ❌ Procore webhook receiver / event subscriptions
- ❌ Object mapping/sync service (Procore ↔ Vektrum id resolution, dedupe, backfill)
- ❌ "Import project from Procore" or "push status to Procore" code paths

All of the above are feasible on top of §2 but are **not built**. Label as such.

---

## 4. Real read/write surface (what an integration would move, and which way)

Grounded in how the app actually works. Direction is from Vektrum's perspective.

### 4a. Procore → Vektrum (READ into Vektrum) `[PROPOSED]`
Vektrum's gate needs verified inputs it currently collects via its own UI/uploads.
A Procore integration would **read** these to pre-populate a Vektrum deal:

| Procore source `[PROPOSED]` | Populates Vektrum (verified target) | CRUD in Vektrum |
|---|---|---|
| Project | `deals` (title, parties) | Create/Update |
| Prime Contract SOV / Budget | `sov_line_items` (G702/G703 fields) | Create/Update |
| Commitments / Pay Applications | `milestones` + `milestone_sov_links` | Create/Update |
| Change Orders / Change Events | `change_orders` | Create/Update |
| Lien waivers (Levelset) | `lien_waivers` (status only — read, don't duplicate) | Read/Update |
| Project Documents / Photos | `milestone_documents` (draw evidence) | Create |
| Vendors | `profiles` (payee identity) | Create/Update |

### 4b. Vektrum → Procore (WRITE back to Procore) `[PROPOSED]`
Vektrum produces artifacts Procore does **not** generate. Write-back candidates
(direction only — no internal logic exposed):

| Vektrum output (verified it produces this) | Proposed write to Procore | Notes |
|---|---|---|
| Release-gate result (authorized / blocked + which condition failed) | Project-level status / custom field / note | Decision only, not the rule set |
| Disbursement authorization (`authorization_tokens`, `releases`) | Document or status: "draw verified & authorized" | Proves capital cleared to move |
| Audit packet / proof (`audit_log`, hash-chained) | Attach compliance PDF to project | `/api/deals/[dealId]/audit-packet` already emits this |
| Funding confirmation (`deals.funded_amount`) | "Funds confirmed at source" indicator | Capital-in governance signal |

**Boundary rule (critical for this audience):** Vektrum writes **governance state and
proof**, never a payment instruction. It governs capital *coming into* the project
(lender/owner → project, disbursement authorization, audit). It does **not** move
GC→sub money — that is Procore Pay's lane. Position beside Levelset (waivers) and Pay,
not on top.

---

## 5. Mapping caveats & where I am guessing (flagged honestly)

1. **Vektrum's `deals` model is single-contractor, single-funder** (`deals.contractor_id`,
   `deals.funder_id` — verified). It does **not** model a GC-with-many-subcontractors
   commitment tree. Mapping Vektrum `deals`→Procore `Commitments` is therefore **partial**;
   the cleaner mapping is Procore **Project + Prime Contract SOV**. **[GUESS on exact
   Procore object grain — founder/Procore to confirm.]**
2. **`authorization_tokens.draw_request_id` currently maps to `deals.id`** (a dedicated
   `draw_requests` table is noted as future "Tier C" in the migration comment). Draw =
   milestone-on-deal today. Flagged so we don't imply a richer draw object than exists.
3. **`profiles` has no email** (lives in `auth.users`) and models one contractor payee;
   Procore vendor sync would need an identity-resolution step that **does not exist yet**.
4. **"AI draw review" is a precondition, not an approver** — verified in code. Must never
   be presented to Procore as "AI approves payments."
5. **Retainage, sequential milestones, dispute isolation** are Vektrum-specific and have
   **no Procore counterpart** — present as additive, not as sync targets.

---

## 6. Open questions for founder before Step 2/3

1. Confirm the object grain for the diagram: map Vektrum deal to Procore **Project +
   Prime Contract SOV** (my recommendation) vs Commitments?
2. Is any Procore sandbox/OAuth app already registered outside this repo? (Nothing in
   code.) This changes whether OAuth is "in progress" vs "proposed."
3. For write-back, is the intended target a Procore **document attachment**, a **custom
   field/status**, or a Procore **Correspondence/tool** item? (Affects the CRUD labels.)
4. Any live mutual customer to name in outcomes, or keep all metrics as
   `[FOUNDER TO CONFIRM]`?

---

**Status: Step 1 complete. Stopping for your review before building the diagram (Step 2)
and deck (Step 3).** Please confirm: (a) the entity→Procore mapping in §1, (b) the
read/write directions in §4, and (c) answers to §6.
