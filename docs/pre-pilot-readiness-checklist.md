# Pre-Pilot Readiness Checklist

**Version:** 1.0 — April 2026 (pre-pilot gate)
**Author:** Engineering / Security / Product
**Status:** DRAFT — requires sign-off from Legal, Engineering Lead, and Compliance before launch

This checklist is executable, not aspirational. Every item references real code, real files, and real tests. Nothing here is generic. Each section has a PASS/FAIL verdict derived from the April 2026 audit.

---

## 1. Claim Validation Matrix

Claims made in public marketing copy validated against codebase evidence.

| # | Claim | Code Location | Status | Notes |
|---|-------|--------------|--------|-------|
| 1 | "10-condition server-side release gate" | `src/lib/engine/release-gate.ts:76–459` | **PASS** | All 10 conditions enforced with accumulated errors. No bypass path exists. |
| 2 | "Vektrum does not hold funds directly" | Stripe Connect for `stripe_connect` rail; external institution for `external_manual` rail | **PASS** | Corrected from "never holds" — see language audit section below. |
| 3 | "Append-only, hash-chained audit log" | `supabase/migrations/20260424000004_audit_log_immutability.sql`, `src/lib/engine/audit.ts:321–391` | **PASS WITH CAVEAT** | Tamper protection is 4-layer. Hash-chain has a known concurrent-insert branching gap (migration comment lines 120–127). `verifyAuditChain()` does not flag branches. Document this limitation before launch. |
| 4 | "MFA required for funders and admins" | `src/lib/auth/middleware.ts:121–172` — `requireMFA()` checks `aal2` | **PASS** | MFA_REQUIRED_ROLES = ['funder', 'admin']. DB tracks enrollment via `profiles.mfa_enrolled`. |
| 5 | "Admin accounts cannot trigger releases" | `src/lib/engine/release-gate.ts:76–84` | **PASS** | Admin role returns `{ allowed: false }` immediately. Error message explicitly names admin restriction. Tests confirmed in `tests/run-tests.mjs`. |
| 6 | "Hourly reconciliation" | `vercel.json` schedule `0 * * * *`, `src/app/api/cron/reconcile/route.ts` | **PASS** | 6-pass reconciliation covering Stripe↔DB, ledger arithmetic, external rail hygiene. Stuck-run detection included. |
| 7 | "Two-phase funding model" | `src/app/api/stripe/webhook/route.ts` — `handlePaymentIntentSucceeded` increments `funded_amount` only on `payment_intent.succeeded` | **PASS** | `funded_amount` never incremented on PI creation. PI-level reserve risk is contained. |
| 8 | "Platform fee minimum $50 per release" | `src/lib/engine/billing.ts:23` — `MINIMUM_FEE = 50` | **PASS (post-fix)** | DB constraint was $2.50 (mismatch). Fixed by migration `20260425000002_minimum_fee_floor_correction.sql`. |
| 9 | "Atomic balance reservation prevents double-spend" | `supabase/migrations/20260423000001_release_concurrency_fix.sql` — `reserve_release_funds()` RPC with `FOR UPDATE NOWAIT` | **PASS** | Row-level lock + `reserved_amount` column. 55P03 lock conflict → 409 response. |
| 10 | "Partner API keys are never stored in plaintext" | `src/lib/auth/partner.ts:64` — SHA-256 hash stored, plaintext discarded | **PASS** | Same error for not-found vs. inactive (no enumeration). |

**Remaining phrases for legal counsel review:**
- `src/app/layout.tsx:300` — "Funds are held in Stripe Connect managed accounts, not by Vektrum." (rail-specific; true for Stripe rail but not external rail)
- `src/app/about/page.tsx:74` — section title "Governance, not custody" — semantically appropriate, not a legal claim; confirm with counsel
- `src/app/security/page.tsx:100,102` — "What Vektrum never stores" — refers to data storage, not fund custody; review for completeness

---

## 2. End-to-End Test Scenarios (≥10)

All scenarios must be executed against a staging environment with real Stripe test-mode keys before pilot launch.

### Happy Path

**E2E-01 — Full Stripe release from contract to payout**
1. Create deal with signed contract, `billing_rate_bps = 100`
2. Deposit via Stripe payment intent; confirm `payment_intent.succeeded` webhook fires and `funded_amount` increments
3. Contractor marks milestone `in_progress → ready_for_review`
4. Funder (AAL2 session) approves: `ready_for_review → approved`
5. AI precondition passes (≤48h, non-critical risk level)
6. Call `POST /api/milestones/:id/release` with funder bearer token
7. Assert: Stripe transfer fires, release record created, milestone → `released`, billing record inserted, audit entry present, `increment_deal_financials` called
8. Assert: fee = `MAX($50, gross * rate_bps / 10000)` matches billing record

**E2E-02 — External-rail full cycle (wire)**
1. Create deal; authorize external release: `POST /api/milestones/:id/authorize-external`
2. Assert: milestone → `released`, release row `execution_rail='external_manual'`, `execution_status='pending'`, no Stripe transfer, no billing record yet
3. Funder confirms: `POST /api/releases/:id/confirm-external` with `payment_method='wire'`, `payment_reference='REF-001'`, `executed_at=<valid past timestamp>`
4. Assert: `execution_status → 'confirmed'`, billing record inserted, `increment_deal_financials` called, audit entry present

**E2E-03 — Retainage withheld and released separately**
1. Create deal with `retainage_bps = 1000` (10%)
2. Release milestone; confirm retainage amount withheld from contractor payout
3. Funder explicitly releases retainage; confirm `increment_deal_retainage` RPC called and retainage record updated

### Gate Enforcement

**E2E-04 — Each of the 10 conditions blocked individually**
For each condition 1–10, set up a scenario that fails ONLY that condition and confirm:
- HTTP 422 returned (not 500)
- Error message is human-readable, not a stack trace
- No Stripe transfer initiated
- `reserved_amount` not incremented (gate fires before `reserve_release_funds`)

Key scenarios to test:
- COND 3: `funded_amount = milestone.amount - 1` (insufficient balance by $1)
- COND 4: `stripe_payouts_enabled = false` (external rail should skip this)
- COND 8: Contract voided post-funding → `status = 'voided'`
- COND 9: Milestone with `order_index = 2` attempted before `order_index = 1` is released
- COND 10: `lien_waiver_required = true`, no approved lien waiver on file

**E2E-05 — AI precondition blocks release (critical risk)**
1. Insert AI review with `risk_level = 'critical'` for the milestone
2. Attempt release — confirm 422 with AI risk explanation
3. Admin creates `ai_review_admin_override` audit entry
4. Reattempt release within TTL window — confirm proceeds to gate
5. Wait for TTL to expire; confirm release blocked again

**E2E-06 — Concurrent release race condition**
1. Two simultaneous requests to release different milestones on same deal (funded_amount barely covers one)
2. Confirm only one succeeds; the other gets 409 (55P03 lock conflict)
3. Confirm `reserved_amount` is correct after both complete
4. Confirm no Stripe transfer for the rejected request

**E2E-07 — Duplicate release prevention (idempotency)**
1. Complete a Stripe release
2. Retry the same `POST /api/milestones/:id/release` with same idempotency key `release_${milestoneId}`
3. Confirm Stripe returns the same transfer object (not a new transfer)
4. Confirm application returns appropriate response; milestone not double-released

### Error Recovery

**E2E-08 — Stripe transfer fails after reservation**
1. Trigger release; intercept Stripe transfer step (test mode: use a Stripe error simulation)
2. Confirm `cancel_release_reservation()` called; `reserved_amount` decremented to original
3. Confirm milestone remains `approved`, no release record created
4. Confirm re-attempt succeeds on next valid try

**E2E-09 — Reconciliation detects ledger drift**
1. Manually set `released_amount` on a deal to a value that doesn't match Stripe transfer history
2. Run reconciliation pass 4 (ledger arithmetic)
3. Confirm `ledger_drift` issue created with severity `critical`
4. Confirm Slack alert and admin notification fired

**E2E-10 — External rail overdue confirmation escalation**
1. Create external release with `executed_at = now() - 8 days`
2. Do not confirm
3. Run reconciliation pass 6
4. Confirm `external_confirmation_overdue` issue created
5. Confirm SLA escalation fires after 1 hour if unresolved

**E2E-11 — Frozen deal blocks all releases**
1. Void a contract on a funded deal that has prior releases
2. Confirm deal `status = 'frozen'`
3. Attempt any milestone release on that deal
4. Confirm 422 with "frozen deal" error message (fires before the 10 numbered conditions)

**E2E-12 — MFA enforcement gate**
1. Log in as funder with only AAL1 session (no TOTP factor verified)
2. Attempt release — confirm 403 with MFA required message
3. Complete TOTP enrollment, re-authenticate (AAL2 session)
4. Re-attempt release — confirm proceeds to release gate

---

## 3. Abuse and Attack Testing

### 3A. Authentication & Authorization

| Test | Expected Result | Code Reference |
|------|----------------|----------------|
| Call release endpoint with contractor JWT | 403 (requireRole check) | `src/lib/auth/middleware.ts:82–93` |
| Call release endpoint with admin JWT | 403 (requireMFA) if no AAL2, then 422 (role check in gate) | `release-gate.ts:76–84`, `middleware.ts:121–172` |
| Call release endpoint with anon key | 401 (session missing) | Route session extraction |
| Call reconcile cron with wrong CRON_SECRET | 401 | `src/app/api/cron/reconcile/route.ts:44–59` |
| Partner endpoint with inactive key | 401 — same error as not-found | `src/lib/auth/partner.ts:84–88` |
| Replay of a valid JWT after logout | Should fail if Supabase session invalidated | Test Supabase session revocation |
| Call confirm-external as contractor | 403 (requireRole check) | `authorize-external/route.ts` |

### 3B. Parameter Manipulation

| Test | Expected Result |
|------|----------------|
| Pass `milestoneId` for a milestone on a deal the caller doesn't own | 403 (`requireDealAccess` check) |
| Pass `fee_amount = 0` in any API input | Server ignores client fee — fee always computed server-side (`billing.ts:131–132`) |
| Pass `executed_at` 100 days in the past (external confirm) | 422 — clamped to 90-day max (`confirm-external/route.ts:119–138`) |
| Pass `executed_at` in the future | 422 — future dates rejected |
| Pass negative `p_gross` to `reserve_release_funds` | DB constraint catches; `reserved_amount >= 0` enforced |
| Attempt to set `milestone.status = 'released'` via PATCH | Blocked by `enforce_milestone_status_transition()` DB trigger (only `service_role` can set `released`) |

### 3C. Injection and Input Validation

| Test | Expected Result |
|------|----------------|
| SQL injection in any query parameter | Not applicable — all queries use Supabase parameterized client |
| XSS payload in `admin_justification` field | Server stores as text; UI must escape on render; confirm no dangerouslySetInnerHTML |
| Oversized payload in request body (e.g., 10MB JSON) | Should be rejected by Next.js/Vercel body size limits before route handler |
| HMAC bypass: send partner webhook without `X-Vektrum-Signature` | Signature verification must reject — confirm partner webhook handler validates HMAC |

### 3D. Rate Limiting and Abuse

| Test | Expected Result |
|------|----------------|
| Rapid fire 100 release requests on same milestone | Gate blocks all after first; Stripe idempotency key deduplicates at Stripe layer |
| 1000 requests/minute to any API route | Confirm Vercel/CDN rate limiting in place, or document that it's a gap |
| Concurrent admin override creation (TTL bypass) | Each override logged separately; audit chain preserved |

---

## 4. Security Hardening Verification

### 4A. Confirmed in Code

| Control | Status | Evidence |
|---------|--------|----------|
| All sensitive routes behind `requireMFA()` | PASS | Fund, release, admin, contract sign endpoints — `middleware.ts:121–172` |
| Admin actions dual-written to `admin_audit_log` | PASS | `src/lib/engine/audit.ts:482–548`, `requireAdminAudit()` wrapper |
| Audit log immutable (UPDATE/DELETE blocked for all roles) | PASS | `deny_audit_modification()` trigger in `20260424000004` — SQLSTATE 23001 |
| Stripe webhook signature verified on raw body | PASS | `stripe.webhooks.constructEvent(rawBodyBuffer, sig, secret)` — `webhook/route.ts:61` |
| Partner API keys stored as SHA-256 hash only | PASS | `src/lib/auth/partner.ts:64` — plaintext discarded after generation |
| DB functions run as SECURITY DEFINER | PASS | All RPCs (`reserve_release_funds`, `increment_deal_financials`, etc.) |
| RLS policies on all public schema tables | PASS | `014_rls_hardening.sql` — service_role bypasses for admin operations |
| Contractor cannot approve own change orders | PASS | `WITH CHECK (status != 'approved')` on change_orders for contractor role |

### 4B. Known Gaps (must resolve before launch)

| Gap | Severity | File / Location | Mitigation |
|-----|----------|----------------|------------|
| Audit chain concurrent-insert branching | Medium | `20260424000004_audit_log_immutability.sql:120–127` | Document in runbook; `verifyAuditChain()` detects linear breaks; add branch detection before pilot |
| Admin override TTL has no upper cap | Medium | `release-gate.ts:505` — `Math.max(1, TTL ?? 4)` | Set `AI_ADMIN_OVERRIDE_TTL_HOURS` env var; add a hard cap (e.g., 24h) in code |
| External rail confirmation is self-attested | High | `confirm-external/route.ts` | No independent wire/ACH verification. Document this clearly in partner contracts. Add bank confirmation evidence upload requirement for pilot. |
| No rate limiting configured at application layer | Medium | No middleware found | Implement `@upstash/ratelimit` or Vercel Edge Config rate limiting before launch |
| `verifyAuditChain()` not called on a schedule | Medium | `src/lib/engine/audit.ts:321` | Add periodic chain verification call to reconciliation cron |

---

## 5. Reconciliation Validation

### 5A. Architecture Confirmed

The reconciliation engine (`src/lib/engine/reconciliation.ts`) runs 6 passes per hourly cron:

| Pass | What It Checks | Severity of Issues |
|------|---------------|-------------------|
| 1 | DB releases → Stripe (missing Stripe transfers) | critical/high |
| 2 | Release → billing record completeness | high |
| 3 | Stripe → DB (orphaned transfers not in DB) | critical |
| 4 | Deal ledger arithmetic (all active deals) | critical |
| 5 | `funded_amount` vs. Stripe PaymentIntent Search API | critical |
| 6 | External rail hygiene (overdue, missing reference, missing proof) | low–high |

### 5B. Validation Checklist

- [ ] **Cron fires hourly in production** — verify via Vercel dashboard that `0 * * * *` schedule is active
- [ ] **CRON_SECRET set in production** — absence causes 500 refusal (confirmed in route handler)
- [ ] **Stuck-run detection** — 2h threshold; forcibly marks stuck runs as failed with Slack alert
- [ ] **Alert delivery** — test that `sendSlackAlert` and `sendAdminAlert` reach live channels in staging
- [ ] **Issue deduplication** — upsert by `(issue_type, deal_id, milestone_id)` — confirm no duplicate alerts
- [ ] **SLA escalation** — critical issues open > 1h escalated; test this in staging
- [ ] **Pass 4 (ledger)** — `reserved_amount` included in consistency check: `released + fees + reserved <= funded`
- [ ] **Pass 6 covers external rail** — confirm all 6 external-rail hygiene checks fire correctly

---

## 6. Red Team Checklist

The following scenarios must be attempted before pilot launch, ideally by a team member who was not the author of the relevant code:

### Privilege Escalation
- [ ] Can an admin JWT call the release endpoint and bypass the funder-only gate? (Expected: blocked by `release-gate.ts:76–84`)
- [ ] Can an admin set `milestone.status = 'released'` via direct DB call through the API? (Expected: blocked by RLS + trigger)
- [ ] Can a contractor mark their own change order as `approved`? (Expected: blocked by `WITH CHECK (status != 'approved')`)
- [ ] Can a funder modify another funder's deal? (Expected: blocked by `requireDealAccess`)

### Financial Manipulation
- [ ] Can fee_amount be set to $0 by passing it in the request body? (Expected: ignored — server always calculates fee)
- [ ] Can a release be submitted for an amount > `funded_amount`? (Expected: blocked by Condition 3 + DB constraint)
- [ ] Can `reserved_amount` be negative? (Expected: `GREATEST(0, ...)` guard in all decrement operations)
- [ ] Can a milestone be released twice? (Expected: Condition 6 + DB unique constraint on confirmed releases)

### Audit Tampering
- [ ] Can any authenticated user UPDATE an audit_log row? (Expected: `deny_audit_modification()` trigger raises exception)
- [ ] Can any authenticated user DELETE an audit_log row? (Expected: same trigger, same exception)
- [ ] Can `event_sequence` or `chain_hash` be manually set at INSERT? (Expected: `compute_audit_hash()` BEFORE INSERT trigger overwrites these)
- [ ] Can `created_at` be backdated? (Expected: DB sets `DEFAULT NOW()` — confirm it's NOT in insert payload)

### External Rail Abuse
- [ ] Can a contractor call `confirm-external` to self-confirm their own payment? (Expected: 403 — funder/admin only)
- [ ] Can a future `executed_at` be submitted as confirmation evidence? (Expected: 422)
- [ ] Can the same release be confirmed twice? (Expected: conditional UPDATE `.eq('execution_status', 'pending')` prevents second confirmation)

---

## 7. Launch Gate Criteria

All items below must be PASS or ACCEPTED RISK with documented mitigation before the first pilot partner is onboarded.

### Hard Blockers (must be PASS)

- [x] **Test suite passes** — `node tests/run-tests.mjs` exits 0 with 26/26 tests passing
- [x] **Fee floor DB constraint matches code** — migration `20260425000002_minimum_fee_floor_correction.sql` applied; both use $50
- [x] **Admin release gate** — admin role blocked by `release-gate.ts:76–84`; confirmed in tests
- [x] **MFA enforcement** — `requireMFA()` guards all fund-movement endpoints
- [x] **Custody language corrected** — "never holds" removed; legally precise language deployed
- [ ] **Production Stripe keys confirmed** — not test-mode keys
- [ ] **CRON_SECRET set in Vercel production env** — confirm in Vercel dashboard
- [ ] **Webhook signing secret configured** — `STRIPE_WEBHOOK_SECRET` in production env
- [ ] **Supabase RLS confirmed enabled** — verify no `DISABLE ROW LEVEL SECURITY` in any public schema table
- [ ] **All database migrations applied in order** — run `supabase db status` and confirm no pending migrations
- [ ] **E2E-01 through E2E-12 executed in staging** — all pass with documented results

### Accepted Risks (document before launch)

- [ ] **Audit chain branching under concurrent load** — document known limitation; mitigation = add sequential guarantee (e.g., pg_advisory_lock) in next sprint
- [ ] **External rail is self-attested** — document in partner contract; require bank statement or SWIFT confirmation within 5 business days of confirmation
- [ ] **No application-layer rate limiting** — document; mitigate with Vercel/CDN limits; add upstash/ratelimit in sprint +1
- [ ] **Admin override TTL has no hard cap** — set `AI_ADMIN_OVERRIDE_TTL_HOURS = 4` in production; add hard 24h cap in code

### Recommended (not blocking)

- [ ] Audit chain verification added to hourly reconciliation cron
- [ ] `verifyAuditChain()` alert on branch detection
- [ ] Rate limiting middleware on release, fund, and admin endpoints
- [ ] Bank evidence upload required for external rail confirmation (pilot v2)

---

## Audit Trail

| Date | Action | Author |
|------|--------|--------|
| 2026-04-25 | Initial audit executed against codebase | Engineering / Security |
| 2026-04-25 | Fee floor migration created (`$2.50 → $50`) | Engineering |
| 2026-04-25 | Admin release gate test fixed in test suite | Engineering |
| 2026-04-25 | Custody language updated across 6 files | Engineering |
| — | Legal review of public copy | Pending — counsel |
| — | Red team exercise | Pending — security |
| — | Sign-off and pilot launch | Pending |
