# Payment rails in Vektrum

Last updated: 2026-04-24 (Phase-1 landing)

## What this document is

Vektrum is **governance / authorisation infrastructure for construction
disbursements**. Vektrum never holds, collects, forwards, or transmits funds on
its own balance sheet. Every release of money to a contractor happens on a
**payment rail** that is separate from Vektrum's governance layer.

This document is the canonical reference for how rails are modeled, how the
release pipeline differs per rail, and where the legal boundaries are drawn.

## Supported rails

| Rail               | Execution                                                                 | Vektrum's role                                                                        |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `stripe_connect`   | Automated via Stripe Connect. Funds are held in a Stripe-managed account. | Runs the 10-condition release gate, triggers the Stripe transfer, records everything. |
| `external_manual`  | Executed outside Vektrum (wire / ACH / check / partner treasury).         | Runs the same release gate. Authorises release. Records confirmation evidence.        |

Only `stripe_connect` has existed historically. `external_manual` was added in
migration [`20260425000000_rail_abstraction.sql`](../supabase/migrations/20260425000000_rail_abstraction.sql).
All pre-existing releases are backfilled with `execution_rail='stripe_connect'`.

## The invariant Vektrum preserves across both rails

> **Vektrum governs authorization. Vektrum never holds funds.**

For `stripe_connect`: funds are held in Stripe-managed accounts. Vektrum
instructs Stripe when to transfer; Stripe controls movement.

For `external_manual`: funds never touch any Vektrum infrastructure at all.
Vektrum records an authorisation and later a confirmation; the funder (or their
escrow / title / treasury partner) executes payment outside Vektrum.

Public-facing copy must preserve both halves of that invariant.

## Schema (releases table)

Additive columns introduced in migration `20260425000000_rail_abstraction`:

| Column                         | Type        | Meaning                                                                            |
| ------------------------------ | ----------- | ---------------------------------------------------------------------------------- |
| `execution_rail`               | text        | `stripe_connect` \| `external_manual`. Default `stripe_connect`.                   |
| `execution_status`             | text        | `pending` \| `executing` \| `confirmed` \| `failed` \| `reversed`.                 |
| `external_payment_method`      | text        | `wire` \| `ach` \| `check` \| `other`. External rail only.                         |
| `external_payment_reference`   | text        | Bank IMAD/OMAD, ACH trace, check number, partner transfer id.                      |
| `external_executed_at`         | timestamptz | When the funder recorded external execution (not bank settlement time).            |
| `external_executed_by`         | uuid        | `auth.users.id` of the confirming actor.                                           |
| `external_execution_notes`     | text        | Free-form notes captured at confirmation.                                          |
| `proof_of_payment_document_id` | uuid        | Optional FK to `milestone_documents` — wire confirmation PDF, check image, etc.    |

### CHECK constraints (hard invariants)

- `releases_execution_rail_chk` — execution_rail ∈ {stripe_connect, external_manual}.
- `releases_execution_status_chk` — execution_status ∈ the five-state set or NULL (legacy).
- `releases_external_no_stripe_chk` — external_manual rows MUST NOT have a
  `stripe_transfer_id`. A release is executed on exactly one rail.
- `releases_external_confirmed_chk` — external_manual at `confirmed` requires
  method + reference + executed_at + executed_by.
- `releases_stripe_confirmed_chk` — stripe_connect at `confirmed` requires
  `stripe_transfer_id`. Codifies the existing runtime invariant.

### Indexes

- `releases_rail_status_idx (execution_rail, execution_status)` — used by ops
  dashboard and reconciliation.
- `releases_external_pending_idx` — partial index for `execution_rail='external_manual'
  AND execution_status='pending'`, ordered by created_at DESC.

## Release lifecycle (per rail)

### stripe_connect (unchanged from pre-Phase-1)

1. Funder clicks "Release".
2. `POST /api/milestones/[milestoneId]/release`
3. `getAuthUser` → `requireMFA` → `requireDealAccess`.
4. `checkAiPrecondition` (AI draw review).
5. `validateRelease(...)` — 10-condition gate. Condition 4 (contractor Stripe
   payouts enabled) applies.
6. `reserve_release_funds` RPC.
7. `stripe.transfers.create`.
8. Insert release row: `execution_rail='stripe_connect', execution_status='confirmed',
   stripe_transfer_id=<id>`.
9. Insert billing_records row.
10. Milestone `approved` → `released`.
11. `increment_deal_financials` + `increment_deal_retainage`.
12. Audit log `funds_released`.

### external_manual (new in Phase 1)

1. Funder clicks "Release" → picks "External / manual execution".
2. `POST /api/milestones/[milestoneId]/authorize-external`
3. Same auth/MFA/access path as stripe_connect.
4. `checkAiPrecondition`.
5. `validateRelease(..., { executionRail: 'external_manual' })` — same gate, but
   Condition 4 (Stripe payouts) is skipped. All other 9 conditions apply.
6. `reserve_release_funds` RPC — still required; prevents concurrent
   over-authorisation against the same funded balance.
7. **No Stripe call.**
8. Insert release row: `execution_rail='external_manual', execution_status='pending',
   stripe_transfer_id=NULL`.
9. **No billing row.**
10. Milestone `approved` → `released` (governance authorisation).
11. **No deal-financial increment.** Ledger remains truthful: reserved_amount is
    still held; released_amount / fees_collected / retainage_held are not yet
    increased.
12. Audit log `external_release_authorized`.
13. (Later) funder executes payment outside Vektrum.
14. (Later) `POST /api/releases/[releaseId]/confirm-external` with
    `payment_method`, `payment_reference`, optional `notes` and `proof_document_id`.
15. Release row: `execution_status → 'confirmed'`; external fields populated.
16. Insert billing_records row (the same shape as stripe_connect, minus
    `stripe_transfer_id`).
17. `increment_deal_financials` + `increment_deal_retainage` — settles the
    reservation.
18. Audit log `external_release_confirmed`. Admin actors dual-log to
    `admin_audit_log` via `requireAdminAudit` with justification ≥ 20 chars.

### Failure handling — external_manual

`POST /api/releases/[releaseId]/mark-external-failed` transitions
`execution_status: pending → failed`, frees the reservation via
`cancel_release_reservation`, and records the reason in
`external_execution_notes`. The **milestone remains in `released` state** — the
DB trigger `enforce_milestone_status_transition` blocks `released → approved`
for non-system callers by design. Admin action is required if the funder wants
to revert milestone status and re-authorise.

No auto-revert of `released → approved` is safe because a funder who typed the
wrong reference, then tried again and succeeded out of band, would otherwise
see the milestone flicker back to `approved`. Keep the milestone authoritative
and let admin resolve edge cases.

## Release-gate rail awareness

The 10-condition gate in [`src/lib/engine/release-gate.ts`](../src/lib/engine/release-gate.ts)
takes an optional `executionRail` option. Only Condition 4 changes by rail:

- `stripe_connect`: requires `contractorProfile.stripe_payouts_enabled = true`.
- `external_manual`: the contractor does not need a Stripe Connect account at
  all, because payment is not routed through Stripe. Condition 4 is skipped.

All other 9 conditions apply identically.

## Reconciliation: rail-aware passes

[`src/lib/engine/reconciliation.ts`](../src/lib/engine/reconciliation.ts) applies the
following rail filters:

- **Pass 1** (DB release → Stripe transfer consistency) — only iterates
  `execution_rail='stripe_connect'` (and legacy rows where the column is NULL).
- **Pass 2** (Release → billing_record completeness) — same filter as Pass 1.
  Confirmed external releases are checked separately in Pass 6.
- **Pass 4** (Deal ledger arithmetic) — `SUM(releases.amount)` only counts rows
  that have been ledger-settled: all stripe_connect rows, plus external_manual
  rows at `execution_status='confirmed'`.

### Pass 6 — external-rail hygiene

Five new issue types introduced:

| Type                              | Severity | Meaning                                                                      |
| --------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `external_rail_mismatch`          | critical | external_manual row with stripe_transfer_id set. CHECK constraint violation. |
| `external_confirmation_overdue`   | medium   | Pending for longer than SLA (default 72 h; `EXTERNAL_CONFIRMATION_SLA_HOURS`).|
| `external_reference_missing`      | high     | Confirmed without `external_payment_reference`.                              |
| `external_executed_without_actor` | high     | Confirmed without `external_executed_by`.                                    |
| `external_proof_missing`          | low      | Confirmed without proof-of-payment document. Ops-coachable.                  |

None of these are auto-fixable — each requires a human decision.

Confirmed external releases are also run through the billing-record
completeness check; missing rows surface as `missing_billing_record` with a
`missing_billing_record:external:<release_id>` dedup key distinct from the
Stripe-rail variant. External variants are **not** auto-fixable — because the
billing row requires a `stripe_transfer_id` in the Stripe-rail auto-fix
implementation, and external rows have none.

## Ops dashboard

The admin ops dashboard includes a new **External-Rail Releases** panel backed
by `GET /api/admin/ops/external-releases`:

- Awaiting confirmation (pending)
- Overdue (pending past SLA)
- Confirmed but missing payment reference
- Confirmed but missing proof attachment
- Rail mismatches (CHECK constraint violation — should always be empty)
- Failed external releases

## Audit actions added

- `external_release_authorized` — governance authorised external release.
- `external_release_reservation_failed` — reserve_release_funds failed.
- `external_release_insert_failed` — release row insert failed.
- `external_release_concurrent_conflict` — milestone flipped by a concurrent
  authorisation.
- `external_release_authorization_failed` — any error in the authorize-external
  try/catch block.
- `external_release_confirmed` — funder recorded external execution.
- `external_release_confirmed_by_admin` — admin confirmed on behalf of funder
  (dual-logged to `admin_audit_log` with justification).
- `external_billing_record_insert_failed` — billing insert after confirmation
  failed (release is still confirmed; requires reconciliation).
- `external_release_deal_financials_update_failed` — increment_deal_financials
  failed after confirmation.
- `external_release_retainage_increment_failed` — retainage increment failed.
- `external_release_marked_failed` — funder / admin marked the release failed.
- `external_release_marked_failed_by_admin` — admin variant (dual-logged).
- `external_release_reservation_cancel_failed` — cancel_release_reservation
  failed after mark-failed; reserved_amount has orphaned capacity.

## Public copy boundaries

Claims that remain safe:

- "Vektrum governs authorization. Vektrum never holds funds."
- "Funds are held in Stripe Connect managed accounts — not by Vektrum." (for
  Stripe-rail deals)
- "Append-only, hash-chained audit log."
- "10-condition server-side release gate."

Claims that must be qualified now that the external rail exists:

- Avoid "Vektrum automates every release" — true only for Stripe-rail deals.
- Avoid "funds release automatically via Stripe" as a universal claim — qualify
  with "on Stripe-rail deals" or describe both rails.
- Avoid "non-custodial" without rail context — on external_manual deals, funds
  do not touch Vektrum at all, which is stronger than non-custodial; on
  stripe_connect deals, custody is with Stripe, not Vektrum.

## Test plan

Manual QA for Phase 1:

1. Migration: apply `20260425000000_rail_abstraction.sql` on a staging copy with
   existing rows; verify all rows are backfilled to
   `execution_rail='stripe_connect'`, and CHECK constraints pass.
2. Stripe-rail regression: run an end-to-end Stripe release — confirm nothing
   has changed in behaviour, audit log, or billing records.
3. External authorise: hit `POST /authorize-external` as funder; verify
   - release row inserted with `execution_rail='external_manual', execution_status='pending'`
   - milestone is `released`
   - `reserved_amount` increased, `released_amount` unchanged
   - no billing_records row created
   - audit log `external_release_authorized` written
4. External confirm: hit `POST /confirm-external` with valid body; verify
   - release row updated to `confirmed`
   - billing_records row inserted with `stripe_transfer_id=null,
     billing_source='governance_layer'`
   - `released_amount` + `fees_collected` + `retainage_held` all incremented
   - audit log `external_release_confirmed` written
5. External idempotency: second `confirm-external` on the same release returns
   `alreadyConfirmed: true` and does not duplicate billing or ledger.
6. External mark-failed: hit `POST /mark-external-failed` on a pending release;
   verify execution_status='failed', reservation freed, milestone still
   `released`.
7. Reconciliation: run a cycle with a mixed dataset; verify
   - Stripe-rail issues unchanged
   - `external_confirmation_overdue` fires for pending rows older than the SLA
   - `external_reference_missing` fires for manually crafted confirmed rows
     without reference
   - `external_rail_mismatch` fires if a row is forced via direct SQL with both
     external_manual and a stripe_transfer_id (requires temporarily disabling
     the CHECK; do not ship this test data)
8. Admin ops dashboard: the new External-Rail Releases panel surfaces all
   buckets. Overdue count matches the reconciliation overdue count.
9. UI release button: rail picker appears for a funder with a release-eligible
   milestone. Stripe path shows "Payment released successfully" on success.
   External path shows "Approved for external execution — awaiting payment
   confirmation" and NEVER "released successfully" until confirmed.

## Risks still open

- The confirm-external route performs conditional update + billing insert +
  ledger increment as three separate statements. Under partial failure the
  release is confirmed but billing / ledger may lag. Reconciliation surfaces
  these via `missing_billing_record:external:*` and `ledger_drift`. A future
  iteration could wrap the whole post-confirmation section in a database
  function for atomicity.
- `mark-external-failed` does not revert milestone status. This is deliberate,
  but means the funder-facing UX of "I clicked wrong, fix it" is not wired
  through a self-service path — admin intervention is required.
- No fiduciary / compliance review yet of the public copy implications on
  `/pricing`, `/about`, `/how-it-works` pages with respect to the external
  rail. Phase-1 copy updates are minimal and targeted.
