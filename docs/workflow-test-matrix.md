# Vektrum Workflow Test Matrix

**Version:** 1.0 — April 2026
**Status:** Authoritative — derived from April 2026 codebase audit
**Source:** `/Users/adammorgan/Vektrum-Governance-`

---

## How to Use This Document

Each workflow traces the full end-to-end path through pages, API routes, DB mutations, external services, and audit events. Use it to:
- Write integration and E2E tests
- Trace bugs across layers
- Verify that security controls fire at the correct points

---

## Workflow 1: User Signup

**Actor:** New user (contractor or funder)

1. Visit `/auth/signup`
2. Submit email, password, role selection
3. Supabase creates `auth.users` record + fires `auth.webhook` → `POST /api/auth/webhook` → `audit_log: user_signup`
4. Supabase `handle_new_user` trigger creates `profiles` row with selected role
5. User redirected to `/dashboard`

**Funder additional step:** `/dashboard/funder/onboarding` prompts for MFA enrollment

**Test scenarios:**
- Signup as contractor → no MFA required → access `/dashboard`
- Signup as funder → MFA enrollment prompt appears → without MFA, fund/release actions blocked
- Duplicate email → Supabase returns error → signup form shows error
- Invalid role value → server-side validation rejects

---

## Workflow 2: MFA Enrollment and Verification

**Actor:** Funder or admin

1. Visit `/auth/mfa/enroll` → displays TOTP QR code (Supabase `enrollMFA`)
2. User scans with authenticator app, enters 6-digit code → Supabase `verifyMFA` → session upgraded to AAL2
3. Redirected back to dashboard

**Session upgrade path:**
- User signs in at AAL1 → tries to access an AAL2-gated action (e.g. release milestone)
- `requireMFA()` returns 403 with "MFA required"
- Frontend redirects to `/auth/mfa/verify`
- User enters TOTP → session upgraded → original action retried

**Test scenarios:**
- Funder with no MFA attempts release → 403
- Funder with MFA at AAL1 only → 403 → upgrade → retry succeeds
- Admin without MFA attempts admin API → 403
- Incorrect TOTP → Supabase returns error → verify page shows error

---

## Workflow 3: Deal Creation

**Actor:** Funder (AAL2 required)

1. `/dashboard/deals/new` → funder fills deal form (title, total_amount, contractor, settings)
2. `POST /api/deals` → role: funder, MFA: yes
3. Deal created with `status = 'draft'`
4. `audit_log: deal_created`
5. Funder redirected to deal detail page `/dashboard/deals/[dealId]`

**Required before funding:** Contract must be created and signed (DocuSign).

**Test scenarios:**
- Contractor attempts `POST /api/deals` → 403
- Missing required fields → 400
- Funder creates deal with `lien_waiver_required = true` → lien waiver gate activates on release
- Funder creates deal with `sequential_release_required = true` → sequential gate activates

---

## Workflow 4: Contract Signing

**Actor:** Funder

1. On deal detail page, funder uploads contract PDF
2. `POST /api/deals/[dealId]/contract` → creates `contracts` row, `status = 'pending'`
3. Funder triggers signing: `POST /api/deals/[dealId]/contract/sign` → DocuSign envelope sent to signatories
4. DocuSign sends `envelope-completed` webhook → `POST /api/webhooks/docusign` (HMAC verified)
5. `contracts.status = 'signed'` → `audit_log: contract_signed`

**Release gate dependency:** Condition 8 — signed, non-voided contract required.

**Contract void after releases (deal freeze path):**
1. DocuSign sends `envelope-voided` webhook
2. If milestones already released → `deal.status = 'frozen'`, `deal_freeze_on_void = true`
3. All further releases blocked (pre-condition fast-path in release gate)
4. Admin must review and unfreeze via `POST /api/admin/deals/[dealId]/unfreeze`

**Test scenarios:**
- Release attempt without signed contract → gate blocks (Condition 8)
- DocuSign webhook with invalid HMAC → rejected before any DB mutation
- Void webhook with no prior releases → contract voided, deal NOT frozen
- Void webhook after 1+ releases → deal frozen
- Admin unfreeze without justification → 400
- Admin unfreeze → deal restored to prior status → releases resume

---

## Workflow 5: Deal Funding (Stripe PaymentIntent)

**Actor:** Funder (AAL2 required)

1. On deal detail page, funder clicks Fund
2. `POST /api/deals/[dealId]/fund` → rate limit: `deal_fund` (5/300 s)
3. Stripe PaymentIntent created for `deal.total_amount`
4. `deal.funded_amount` updated via SECURITY DEFINER RPC
5. Funder completes payment in Stripe UI (or via saved payment method)
6. Stripe fires `payment_intent.succeeded` → `POST /api/stripe/webhook`
7. `deal.status → active` if previously draft; `audit_log: deal_funded`

**Test scenarios:**
- Fund with amount < total_amount → Condition 3 blocks release until fully funded
- Stripe webhook missing signature → 400 before any DB action
- Duplicate PaymentIntent (retry) → Stripe deduplication via idempotency key
- Rate limit hit on fund → 429

---

## Workflow 6: Milestone Lifecycle (Stripe Connect Rail)

**Actor:** Contractor advances; funder approves and releases

1. Contractor: `POST /api/milestones/[milestoneId]/transition` `{ new_status: "in_progress" }`
2. Contractor uploads documents: `POST /api/milestones/[milestoneId]/documents`
3. Contractor: transition to `ready_for_review`
4. Funder reviews → runs AI draw review: `POST /api/ai/draw-review` → result stored
5. Funder: transition to `approved`
6. Funder: `POST /api/milestones/[milestoneId]/release` (AAL2 required)
   - AI precondition checked (review ≤ 48h, not critical)
   - `validateRelease()` runs all 10 conditions
   - Stripe Connect transfer executed
   - DB: milestone `status = 'released'`, release record created, ledger updated
   - `audit_log: milestone_released`
7. Stripe fires `transfer.succeeded` → `POST /api/stripe/webhook`
   - Release confirmed, transaction receipt created

**Test scenarios:**
- Contractor attempts transition to `approved` → 403 (state machine: only funder)
- Funder attempts transition `approved → released` via /transition → 400 (system-only)
- Release without AI review → gate blocks (pre-condition)
- Release with critical AI risk → gate blocks (pre-condition)
- Release with AI review > 48h old → gate blocks
- Any of 10 conditions fails → gate returns all failure messages
- Admin attempts release → 403 (role check at route level AND gate level)
- Stripe transfer fails → `transfer.failed` webhook → milestone → `payout_failed`
- Retry `payout_failed` → `POST /api/milestones/[milestoneId]/release/retry` → re-runs gate

---

## Workflow 7: Milestone Lifecycle (External Manual Rail)

**Actor:** Funder authorizes; external party executes

1. Funder: `POST /api/milestones/[milestoneId]/authorize-external` (AAL2, `financial_write` rate limit)
   - Passes 10-condition gate (Condition 4 — Stripe payouts — skipped for external rail)
   - Creates `releases` record with `status = 'pending'`, `execution_rail = 'external_manual'`
2. External execution occurs (wire/ACH/check) outside Vektrum
3. **Funder confirms** via UI: `POST /api/releases/[releaseId]/confirm-external`
   OR **Partner confirms** via API: `POST /api/partner/releases/[releaseId]/confirm`
4. Ledger settled: `deal.released_amount` updated, `billing_records` created
5. `audit_log: external_release_confirmed`

**Test scenarios:**
- External authorize without signed contract → gate blocks (Condition 8)
- Partner confirms release for deal not assigned to their partner_id → 403
- Confirm already-confirmed release → 200 `{ alreadyConfirmed: true }` (idempotent)
- Mark external failed → reservation reversed, milestone back to `approved`
- Reconciliation cron: overdue external release (no confirmation after threshold) → flagged as issue

---

## Workflow 8: Lien Waiver Flow

**Prerequisite:** `deal.lien_waiver_required = true`

1. Contractor uploads waiver: `POST /api/lien-waivers/[waiverId]/upload`
2. Funder reviews and approves: `POST /api/lien-waivers/[waiverId]/approve` (AAL2 required)
   OR rejects: `POST /api/lien-waivers/[waiverId]/reject`
3. If approved: `lien_waivers.status = 'conditional_progress'`
4. Release gate Condition 10 passes

**Test scenarios:**
- Release with `lien_waiver_required = true` and no approved waiver → gate blocks (Condition 10)
- Funder rejects waiver → contractor uploads revised → funder approves → release proceeds
- Release with `lien_waiver_required = false` → Condition 10 skipped

---

## Workflow 9: Change Order Flow

1. Contractor or funder creates change order: `POST /api/change-orders`
2. Change order is `status = 'open'`
3. Open change order blocks release: Condition 7 of release gate
4. Funder approves: `PATCH /api/change-orders/[changeOrderId]` → milestone amount updated
   OR rejects: same endpoint → change order closed
5. Once all change orders closed, Condition 7 passes

**Test scenarios:**
- Release with open change order → gate blocks (Condition 7)
- Approve change order → milestone amount increases → Condition 3 re-evaluated
- Reject change order → order closed, original amount unchanged

---

## Workflow 10: Dispute Flow

1. Contractor or funder opens dispute: `POST /api/disputes`
2. Milestone status → `disputed`
3. Milestone in `disputed` status is a terminal state — no further transitions via `/transition`
4. Admin reviews and resolves: `POST /api/disputes/[disputeId]/resolve` (AAL2, justification required)
5. Admin sets outcome, milestone status restored (or closed)
6. `audit_log + admin_audit_log: dispute_resolved` (dual-write)

**Test scenarios:**
- Transition out of `disputed` via `/transition` → blocked by state machine
- Admin resolves without justification → 400
- Contractor attempts to resolve dispute → 403

---

## Workflow 11: AI Draw Review and Override

**Normal path:**
1. Funder requests AI review: `POST /api/ai/draw-review`
2. Provider chain tried: Perplexity → Anthropic → OpenAI
3. Result stored with `risk_level`, timestamp
4. Release precondition: review ≤ 48h old AND `risk_level ≠ 'critical'`

**Emergency override path (all AI providers down):**
1. Admin: `POST /api/admin/milestones/[milestoneId]/override-ai-review`
2. Body must include justification ≥ 20 chars and `override_risk_level` (not `critical`)
3. Override record created with TTL (default 4h, set via `AI_ADMIN_OVERRIDE_TTL_HOURS`)
4. `checkAiPrecondition()` sees override, allows release if not expired
5. Override logged to both `audit_log` and `admin_audit_log`

**Test scenarios:**
- All 3 AI providers timeout → draw review fails → release blocked
- Admin override created → release proceeds within TTL
- Admin override expired → release blocked again
- Admin override with `override_risk_level = 'critical'` → 400 (blocked)
- AI review `risk_level = 'critical'` (real assessment) → override cannot unblock
- Review exactly 48h old → blocked (off-by-one: must be < 48h)

---

## Workflow 12: Partner API Integration

1. Admin creates partner record: `POST /api/admin/partners` → returns plaintext API key once
2. Admin assigns deal to partner: `POST /api/admin/partners/[partnerId]/deals`
3. Funder authorizes external release (Workflow 7, step 1)
4. Partner execution system calls: `POST /api/partner/releases/[releaseId]/confirm`
   - Bearer token auth
   - Partner scope check: `deal.partner_id === partnerCtx.partnerId`
   - Ledger settled
5. If payment fails: `POST /api/partner/releases/[releaseId]/fail`

**Test scenarios:**
- Partner uses wrong API key → 401
- Partner confirms release for deal belonging to another partner → 403
- Partner confirms already-confirmed release → 200 `{ alreadyConfirmed: true }`
- Rotate partner API key via admin: `PATCH /api/admin/partners/[partnerId]` → old key invalidated immediately
- API key not stored in plaintext — only hash persisted; if lost, must rotate

---

## Workflow 13: Reconciliation Cron

**Trigger:** Vercel Cron `0 * * * *` → `POST /api/cron/reconcile` with `CRON_SECRET`

6 passes run sequentially:

| Pass | What it checks | If issue found |
|---|---|---|
| 0 | Stripe transfers stuck > `STRIPE_TRANSFER_STUCK_HOURS` (default 4h) | Opens `reconciliation_issue`, Slack alert |
| 1 | DB releases vs Stripe transfers (amount + metadata mismatch) | Opens issue, Slack alert |
| 2 | Missing `billing_record` for completed release | Auto-creates billing record |
| 3 | Stripe transfers with no matching DB release (orphaned) | Opens issue |
| 4 | Deal ledger arithmetic (`released_amount`, `fees_collected`, `reserved_amount`) | Auto-corrects with audit trail |
| 5 | `funded_amount` vs Stripe PaymentIntent history | Opens issue |
| 6 | External-rail hygiene (overdue, missing reference/proof/actor, amount mismatch) | Opens issue |

**Test scenarios:**
- Cron called without `CRON_SECRET` → 401
- Cron called twice in same minute (> 3 times) → rate limited
- Ledger drift detected → auto-corrected in Pass 4 → `audit_log: ledger_drift_corrected`
- Stuck transfer > 4h → opens issue → Slack alert fires
- Orphaned Stripe transfer (DB write failed after Stripe success) → Pass 3 detects → issue opened for manual reconciliation

---

## Verification Priority Matrix

Items that should be verified before merging to main, ranked by impact:

### CRITICAL (blocks launch)

| # | Item | Where | Test |
|---|---|---|---|
| 1 | Release gate: all 10 conditions enforced | `release-gate.ts`, `/api/milestones/[id]/release` | Individually fail each condition; gate must block |
| 2 | Admin cannot release funds | `release-gate.ts:76-84`, release route | POST release as admin → 403 |
| 3 | Stripe webhook signature verification | `/api/stripe/webhook` | Send unsigned request → 400 before any DB action |
| 4 | DocuSign webhook HMAC verification | `/api/webhooks/docusign` | Send unsigned void event → rejected |
| 5 | MFA gate on fund/release routes | Funder routes with `requireMFA` | AAL1 session → 403; AAL2 session → proceeds |
| 6 | Partner scope isolation | `/api/partner/releases/[id]/confirm` | Partner confirms release for another partner's deal → 403 |

### HIGH (security or data integrity)

| # | Item | Where | Test |
|---|---|---|---|
| 7 | ADMIN_PROMOTION_ENABLED defaults false | `/api/admin/promote` | Call without env var → 403 |
| 8 | Audit log immutability (trigger) | `deny_audit_modification()` DB trigger | Attempt UPDATE/DELETE on audit_log → fails |
| 9 | AI override cannot bypass critical risk | `/api/admin/milestones/[id]/override-ai-review` | `override_risk_level: 'critical'` → 400 |
| 10 | Deal freeze on void-after-release | DocuSign webhook handler | Void envelope with released milestones → `deal.status = 'frozen'` |
| 11 | Idempotency key prevents duplicate Stripe transfers | Release route | Retry release on same milestone → Stripe deduplication |
| 12 | External release partner scope check | `/api/partner/releases/[id]/confirm` | Confirmed at correct scope level |

### MEDIUM (reliability)

| # | Item | Where | Test |
|---|---|---|---|
| 13 | AI provider fallback chain | `/api/ai/draw-review` | Mock Perplexity timeout → Anthropic called; mock both → OpenAI called |
| 14 | Reconciliation cron all 6 passes complete | `/api/cron/reconcile` | Inject synthetic issues for each pass type |
| 15 | Rate limits enforce correct policies | `rate-limit.ts` | Exceed `financial_write` (5 in 60s) → 429 |
| 16 | Sequential release ordering | release gate Condition 9 | Release milestone 2 before milestone 1 approved → blocked |

### LOW (UX / operational)

| # | Item | Where | Test |
|---|---|---|---|
| 17 | Admin user detail page renders all deals | `/dashboard/admin/users/[userId]` | User with deals as contractor AND funder — both shown, deduplicated |
| 18 | Receipt resend uses Resend API | `/api/releases/[id]/receipt/resend` | Triggers email; verify `RESEND_API_KEY` configured |

---

## Related Docs

- `docs/api-inventory.md` — all API routes with auth/rate-limit details
- `docs/role-permission-matrix.md` — what each role can/cannot do
- `docs/security-controls-map.md` — security controls and env vars
- `docs/system-map.md` — release gate details and reconciliation passes
