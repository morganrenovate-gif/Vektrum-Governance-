# Vektrum Full-Codebase Audit & Repair Plan

**Audit date:** 2026-05-07  
**Branch audited:** `claude/lucid-dubinsky-5f21ed` (merged to `main`)  
**Agents:** Backend/DB/Payments · Product/Frontend/QA · Security/Compliance/Patent  
**Scope:** Read-only reconnaissance. No edits, no commits, no PRs.

---

## Executive Verdict

Vektrum is **production-capable for a controlled funder pilot on the Stripe rail** with a targeted set of pre-launch fixes. The core release gate (10 conditions), authorization token issuance (B1–B3), hash-chained audit ledger (Tier A), and Stripe rail execution are all correctly implemented and gated. The funder, contractor, and admin flows are substantially complete.

**Three findings must be fixed before any production traffic of any kind:**

1. **P0-SEC-01**: MFA check on the audit-chain-health admin endpoint is silently bypassed due to a wrong-argument call to `requireMFA()`. Any admin with an AAL1 session can reach this endpoint without MFA challenge.
2. **P0-BACK-01**: The `authorize-external` route does not issue authorization tokens. Releases through this path have `authorization_token_id = NULL`, breaking the audit chain for all external-rail releases that go through the user-session path (as opposed to the `/release` route).
3. **P0-BACK-02**: The retainage release route permits admin role to execute a Stripe transfer, violating the non-negotiable that admins cannot move funds.

**Before external-rail go-live, four additional P1 issues must be resolved:** optional token signing voids the patent claim, rate limiting is fail-open on DB errors, `/api/cron/*` is publicly unauthenticated, and silent audit log write failures are unobservable.

The external-rail pilot readiness is **conditional** — the Stripe rail is ready, the external rail has the above gaps. The marketing site, demo system, and partner docs are clean.

---

## Full Route Inventory

### API Routes (`src/app/api/`)

| Route | Methods | Auth Guard | Rate Limit | Status | Issues |
|---|---|---|---|---|---|
| `admin/audit-chain-health` | GET, POST | admin+**MFA (broken)** | N | Complete | **P0**: requireMFA called with wrong args |
| `admin/audit-log/[id]/review` | PATCH | admin+MFA | N | Complete | No rate limit on admin write |
| `admin/audit-log` | GET | admin+MFA | N | Complete | No rate limit |
| `admin/deals/[dealId]/unfreeze` | POST | admin+MFA | Y | Complete | |
| `admin/env-health` | GET | admin+MFA | N | Complete | |
| `admin/invite` | POST | admin | Y | Complete | |
| `admin/milestones/[id]/override-ai-review` | POST | admin+MFA | Y | Complete | |
| `admin/ops/alerts` | GET | admin+MFA | N | Complete | |
| `admin/ops/external-releases` | GET | admin+MFA | N | Complete | |
| `admin/ops/release-health` | GET | admin+MFA | N | Complete | |
| `admin/ops/search` | GET | admin+MFA | N | Complete | P3: scans 300 user emails client-side |
| `admin/ops/webhook-health` | GET | admin+MFA | N | Complete | |
| `admin/partners/[id]/deals` | GET, POST, DELETE | admin+MFA | Y | Complete | |
| `admin/partners/[id]` | GET, PATCH | admin+MFA | Y | Complete | |
| `admin/partners` | GET, POST | admin+MFA | Y | Complete | |
| `admin/promote` | POST | admin+MFA | Y | Complete | Disabled by `ADMIN_PROMOTION_ENABLED` env gate |
| `admin/reconciliation/[id]` | PATCH | admin | Y | Complete | |
| `admin/reconciliation` | GET, POST | admin | N | Complete | |
| `admin/stripe/duplicates` | GET | admin+MFA | N | Complete | |
| `admin/subscriptions/[id]/tier` | POST | admin+MFA | Y | Complete | |
| `ai/draw-review` | GET, POST | auth+role | Y | Complete | |
| `analyze-contract` | POST | auth | Y | Complete | |
| `assistant` | POST | auth (no role guard) | N | **Partial** | No role guard, no rate limit |
| `auth/webhook` | POST | SUPABASE_AUTH_WEBHOOK_SECRET | N | Complete | Fail-open if secret absent in dev |
| `change-orders/[id]` | PATCH | auth | N | Complete | No rate limit |
| `change-orders` | POST | auth | N | Complete | No rate limit |
| `contractor/stripe/status/refresh` | POST | auth | N | Complete | |
| `cron/audit-chain-health` | GET, POST | **none (public)** | N | Complete | **P1**: no cron secret auth |
| `cron/reconcile` | GET, POST | **none (public)** | N | Complete | **P1**: no cron secret auth |
| `deals/[dealId]/audit-packet` | GET | auth | N | Complete | P2: actor email exposed to funders |
| `deals/[dealId]/audit/export` | GET | auth | N | Complete | |
| `deals/[dealId]/billing/export` | GET | auth | N | Complete | |
| `deals/[dealId]/billing` | GET | auth | N | Complete | |
| `deals/[dealId]/contract/refresh-signing-status` | POST | auth | N | Complete | |
| `deals/[dealId]/contract` | GET, POST | auth | N | Complete | |
| `deals/[dealId]/contract/send-envelope` | POST | auth | N | Complete | |
| `deals/[dealId]/contract/sign` | POST | auth | N | Complete | |
| `deals/[dealId]/fund` | POST | auth | Y | Complete | |
| `deals/[dealId]/milestones/[id]/lien-waiver` | POST | auth | N | Complete | No rate limit |
| `deals/[dealId]/milestones` | GET, POST | auth+role | N | Complete | |
| `deals/[dealId]/readiness` | GET | auth (no role guard) | N | Complete | Any authenticated user can read |
| `deals/[dealId]/release-rules/[id]` | PATCH | auth | N | Complete | |
| `deals/[dealId]/release-rules/generate-from-contract` | POST | auth | N | Complete | |
| `deals/[dealId]/retainage/release` | POST | funder\|**admin**+MFA | N | Complete | **P0**: admin can move funds; no rate limit |
| `deals/[dealId]/route` | GET, PATCH | auth | N | Complete | |
| `deals/[dealId]/sov/[itemId]` | PATCH | auth | N | Complete | TS type errors (string vs string[]) |
| `deals/[dealId]/sov` | GET, POST | auth | N | Complete | TS type errors |
| `deals` | GET, POST | auth+role | N | Complete | |
| `demo/reset` | POST | auth | N | **Stub** | Frontend-state only; no DB reset |
| `design-partner-applications` | POST | None (intentional) | N | Complete | Anti-abuse only |
| `disputes/[id]/resolve` | PATCH | auth | N | Complete | |
| `disputes` | POST, GET | auth | N | Complete | |
| `funder/disbursement-rail` | POST | auth | N | Complete | |
| `invites/[token]/accept` | POST | auth | N | Complete | notifyInviteAccepted not called |
| `invites/[token]` | GET | None (intentional) | N | Complete | |
| `invites` | POST, GET | auth+role | N | Complete | notifyFunderInvited not called |
| `lien-waivers/[id]/approve` | POST | auth | N | Complete | |
| `lien-waivers/[id]/reject` | POST | auth | N | Complete | |
| `lien-waivers/[id]/signed-url` | GET | auth | N | Complete | |
| `lien-waivers/[id]/upload` | POST | auth | N | Complete | |
| `milestones/[id]/authorize-external` | POST | funder+MFA | Y | **Partial** | **P0**: no authorization token issued |
| `milestones/[id]/documents` | GET, POST | auth | N | Complete | |
| `milestones/[id]/documents/upload` | POST | auth | N | Complete | |
| `milestones/[id]/release/retry` | POST | funder\|admin+MFA | N | Complete | Admin can reset milestone to approved |
| `milestones/[id]/release` | POST | funder+MFA | Y | Complete | Core release route — fully instrumented |
| `milestones/[id]/sov-links/[id]` | DELETE | auth | N | Complete | |
| `milestones/[id]/sov-links` | GET, POST | auth | N | Complete | |
| `milestones/[id]/transition` | POST | auth | N | Complete | |
| `notifications/mark-read` | POST | auth | N | Complete | |
| `notifications` | GET | auth | N | Complete | |
| `onboarding` | PATCH | auth | N | Complete | |
| `partner/releases/[id]/confirm` | POST | partner API key | Y | Complete | |
| `partner/releases/[id]/fail` | POST | partner API key | Y | Complete | |
| `partner/releases/[id]` | GET | partner API key | Y | Complete | |
| `releases/[id]/confirm-external` | POST | funder\|admin+MFA | Y | Complete | P2: proof_document_id unvalidated; RPC uses user client |
| `releases/[id]/expire-if-stale` | POST | funder\|admin | N | Complete | **P2**: no MFA; no rate limit |
| `releases/[id]/mark-external-failed` | POST | funder\|admin+MFA | Y | Complete | |
| `releases/[id]/receipt/resend` | POST | auth | N | Complete | |
| `releases/[id]/receipt` | GET | auth | N | Complete | |
| `stripe/connect` | POST | auth | N | Complete | |
| `stripe/diagnose` | GET | auth | N | Complete | |
| `stripe/webhook` | POST | Stripe HMAC | N | Complete | HMAC verified; Stripe dedup present |
| `webhooks/docusign` | POST | HMAC | N | Complete | No event dedup; 2 TODO email notifications |

### App Pages (`src/app/`)

| Path | Role Access | Status | Issues |
|---|---|---|---|
| `/auth/login` | Public | Complete | |
| `/auth/signup` | Public | Complete | "Funds held by Stripe" trust copy inaccurate for external rail |
| `/auth/mfa/enroll` | Authenticated | Complete | |
| `/auth/mfa/verify` | Authenticated | Complete | |
| `/auth/reset-password` | Public | Complete | |
| `/auth/logout` | Authenticated | Complete | Previously was 404; now fixed |
| `/auth/callback` | Public | Complete | |
| `/invite/[token]` | Public | Complete | |
| `/dashboard` | All auth | Complete | Role-conditional routing |
| `/dashboard/deals/new` | Funder/Contractor | Complete | |
| `/dashboard/deals/[dealId]` | Deal participants | Complete | No confirm-external button for external rail funders |
| `/dashboard/funder/onboarding` | Funder | Complete | |
| `/dashboard/contractor/onboarding` | Contractor | Complete | |
| `/dashboard/contractor/payments` | Contractor | Complete | |
| `/dashboard/contractor/documents` | Contractor | Complete | |
| `/dashboard/audit` | Admin | Complete | |
| `/dashboard/notifications` | All auth | Complete | |
| `/dashboard/billing` | Funder | Complete | |
| `/dashboard/settings` | All auth | Complete | |
| `/dashboard/receipts/[id]` | Deal participants | Complete | **P0**: unauthenticated redirect goes to `/login` (no route) not `/auth/login` |
| `/dashboard/receipts/[id]/print` | Deal participants | Complete | |
| `/dashboard/admin` | Admin | Complete | No standalone admin deals list |
| `/dashboard/admin/ops` | Admin | Complete | |
| `/dashboard/admin/users/[userId]` | Admin | Complete | |
| `/dashboard/admin/partners` | Admin | Complete | |
| `/dashboard/admin/subscriptions` | Admin | Partial | Limited data display |
| `/dashboard/admin/design-partner-applications` | Admin | Complete | |
| `/pitch` | Public | Complete | PDF download fixed (20-slide deck) |
| `/` (homepage) | Public | Complete | ISR |
| `/funders`, `/contractors`, `/pricing`, `/about` etc. | Public | Complete | ISR |
| `/demo-live/*` | Public | Complete | Full 3-role interactive demo |
| `/partners/docs` | Public | Complete | Outbound webhooks correctly caveatted |
| `/resources/construction-dispute-isolation` | Public | Partial | 6 `TODO(canonical-url)` HTML comments (not visible to users) |

---

## Feature Implementation Matrix

| Feature | API | UI | DB | Tests | Status |
|---|---|---|---|---|---|
| Funder signup + MFA | ✅ | ✅ | ✅ | ✅ | Complete |
| Funder rail choice (Stripe / external) | ✅ | ✅ | ✅ | ✅ | Complete |
| Deal creation | ✅ | ✅ | ✅ | partial | Complete |
| Deal funding | ✅ | ✅ | ✅ | partial | Complete |
| Contractor invite | ✅ | ✅ | ✅ | ✅ | Complete — notification not wired |
| Contractor Stripe Connect onboarding | ✅ | ✅ | ✅ | ✅ | Complete |
| Contract (DocuSign) | ✅ | ✅ | ✅ | ✅ | Complete |
| Schedule of Values | ✅ | ✅ | ✅ | partial | Complete |
| Milestone submission / transition | ✅ | ✅ | ✅ | partial | Complete |
| AI draw review | ✅ | ✅ | ✅ | ✅ | Complete |
| Lien waiver upload + approval | ✅ | ✅ | ✅ | ✅ | Complete — request notification not wired |
| Change orders | ✅ | ✅ | ✅ | partial | Complete — approve/reject notifications not wired |
| 10-condition release gate | ✅ | ✅ | ✅ | ✅ | Complete |
| Stripe rail release | ✅ | ✅ | ✅ | ✅ | Complete |
| Authorization tokens (B1) | ✅ | N/A | ✅ | ✅ | Complete on `/release`; **missing on `/authorize-external`** |
| Rail adapter (B2) | ✅ | N/A | N/A | ✅ | Complete |
| External-rail authorize-only (B3) | ✅ | partial | ✅ | ✅ | API complete; no confirm-external UI button |
| Expire-if-stale (B3) | ✅ | N/A | ✅ | ✅ | No MFA; no rate limit |
| External confirmation (funder) | ✅ | ❌ | ✅ | partial | No dashboard UI; API only |
| Partner confirm/fail | ✅ | N/A | ✅ | ✅ | Complete |
| Hash-chained audit ledger (Tier A) | ✅ | ✅ | ✅ | ✅ | Complete |
| Token signing (ed25519) | ✅ | N/A | ✅ | partial | **Optional** — unsigned if key absent |
| Retainage hold + release | ✅ | ✅ | ✅ | ✅ | Complete — admin can initiate Stripe transfer (P0) |
| Transaction receipts | ✅ | ✅ | ✅ | partial | Complete |
| Dispute creation + resolution | ✅ | ✅ | ✅ | partial | Complete |
| Notifications (all channels) | ✅ | ✅ | ✅ | ✅ | 4 functions defined but not wired in routes |
| Partner API key lifecycle | ✅ | ✅ | ✅ | ✅ | Complete — admin-mediated only |
| Outbound partner webhooks | partial | N/A | partial | N/A | Implemented; no dead-letter; docs correctly caveat |
| Admin ops monitoring | ✅ | ✅ | ✅ | partial | Complete |
| Audit chain health cron | ✅ | ✅ | ✅ | partial | Publicly accessible (P1) |
| Demo system | ✅ | ✅ | N/A | ✅ | Complete; known contractor-state reset issue |
| Marketing site | ✅ | ✅ | N/A | ✅ | Complete; clean copy |

---

## Unfinished Route List

| Route | What's Missing | Severity |
|---|---|---|
| `milestones/[id]/authorize-external` | Does not call `issueAuthorizationToken()` — releases have `authorization_token_id = NULL` | P0 |
| `deals/[dealId]/retainage/release` | Admin allowed to trigger Stripe transfer — violates funds-can't-be-moved-by-admin invariant | P0 |
| `admin/audit-chain-health` | `requireMFA(authContext)` wrong-arg call — MFA check silently bypassed | P0 |
| `dashboard/receipts/[id]/page.tsx` | Unauthenticated redirect points to `/login` (no route) instead of `/auth/login` | P0 |
| `releases/[id]/expire-if-stale` | No MFA requirement; no rate limit on a financial operation | P2 |
| `invites` (POST) | Does not call `notifyFunderInvited()` | P1 |
| `invites/[token]/accept` | Does not call `notifyInviteAccepted()` | P1 |
| `change-orders` approve/reject paths | `notifyChangeOrderApproved()` / `notifyChangeOrderRejected()` not called | P1 |
| release gate failure path | `notifyLienWaiverRequested()` never called when gate blocks on lien waiver | P1 |
| `cron/*` | No cron-secret authentication | P1 |
| `demo/reset` | Frontend-state only; no actual DB reset (documented known gap) | P2 |
| `assistant` | No role guard, no rate limit on AI assistant | P2 |

---

## Partial Feature List

| Feature | What Works | What's Missing |
|---|---|---|
| Authorization token signing | Token issuance, hashing, DB storage | ed25519 signature is optional — unsigned if key absent; no startup enforcement |
| External rail confirm UI | API endpoint functional | No dashboard button for funder to confirm external payment |
| Demo contractor flow reset | Demo is isolated and safe | Contractor state may not fully reset (known issue) |
| Admin deals view | Visible through user-detail | No standalone `/dashboard/admin/deals` list page |
| Notification coverage | 18 of 22 notification functions wired | 4 not called: FunderInvited, InviteAccepted, ChangeOrderApproved, ChangeOrderRejected; LienWaiverRequested never wired |
| Outbound partner webhooks | 3-attempt delivery with backoff | No dead-letter queue; no delivery dashboard; no dedup table |
| DocuSign webhook idempotency | Events processed | No `docusign_processed_events` dedup table — duplicate delivery reprocesses state |
| Audit chain health | Verification RPC correct | Concurrency fork gap (parallel inserts); no real-time alert on chain break |

---

## P0 / P1 / P2 / P3 Repair Backlog

### P0 — Fix before any production traffic

| ID | Issue | File(s) | Fix |
|---|---|---|---|
| P0-SEC-01 | **MFA bypass on audit-chain-health** — `requireMFA(authContext)` passes `{user,profile}` as the `supabase` arg; MFA check silently fails | `src/app/api/admin/audit-chain-health/route.ts:27,48` | Create a Supabase client in the handler; call `requireMFA(supabase, authContext.profile)` |
| P0-BACK-01 | **`authorize-external` does not issue authorization tokens** — releases through this path have `authorization_token_id = NULL` | `src/app/api/milestones/[milestoneId]/authorize-external/route.ts` | Wire `issueAuthorizationToken()` before reservation; mirror `/release/route.ts` Stage B1 pattern |
| P0-BACK-02 | **Admin can execute Stripe retainage transfer** — violates core invariant that admins cannot move funds | `src/app/api/deals/[dealId]/retainage/release/route.ts:50` | Remove `admin` from role guard; restrict to funder only |
| P0-PROD-01 | **Receipt page unauthenticated redirect to `/login`** — no such route; produces 404 | `src/app/(app)/dashboard/receipts/[receiptId]/page.tsx:26,34` | Change redirect to `/auth/login` |

### P1 — Fix before controlled pilot launch

| ID | Issue | File(s) | Fix |
|---|---|---|---|
| P1-SEC-01 | **Token signing is optional** — absent `VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` issues `alg='unsigned'` tokens; patent claim #1 is void without cryptographic binding | `src/lib/engine/authorization-token.ts` | Add startup enforcement: throw in non-development if key is absent; generate keypair and set env before production deploy |
| P1-SEC-02 | **Rate limiting is fail-open** — `checkRateLimit()` returns `allowed: true` on any DB error | `src/lib/engine/rate-limit.ts` | Fail closed for financial write policies, or add an in-process fallback counter for DB-outage scenarios |
| P1-SEC-03 | **Audit log writes are fire-and-forget with no observability** — silent failures break the chain with zero alert | `src/lib/engine/audit.ts` | Emit structured error log (Sentry/DataDog) when `logAudit` catches internally; consider transactional outbox for critical events |
| P1-SEC-04 | **`/api/cron/*` is publicly accessible** — no cron secret enforced | `src/app/api/cron/audit-chain-health/route.ts`, `src/app/api/cron/reconcile/route.ts` | Verify `Authorization: Bearer <CRON_SECRET>` header; add to middleware or each handler |
| P1-BACK-01 | **Duplicate migration timestamps** — `20260425000003` and `20260429000001` each have two files; ordering is filesystem-dependent | `supabase/migrations/` | Rename one file in each duplicate pair to a unique sequential timestamp; test clean migration apply |
| P1-BACK-02 | **No cron job for token/reservation expiry** — stale pending external-rail releases hold `reserved_amount` indefinitely | `vercel.json` | Add Vercel cron calling `/api/releases/sweep-stale` (new route) or add a sweep pass to `/api/cron/reconcile` |
| P1-PROD-01 | **`notifyLienWaiverRequested()` not wired** — contractor not notified when release gate blocks on missing lien waiver | `src/lib/engine/notify.ts`, release gate | Call `notifyLienWaiverRequested(dealId, milestoneId, contractorId)` in gate failure handler when C10 fails |
| P1-PROD-02 | **No funder UI for confirming external payments** — `confirm-external` is API-only; pilot funder needs a button | `src/app/(app)/dashboard/deals/[dealId]/page.tsx` | Add a "Confirm Payment Received" button on the deal page for releases with `execution_status='pending'` |
| P1-PROD-03 | **`notifyFunderInvited()` and `notifyInviteAccepted()` not wired** — silent deal invitations | `src/app/api/invites/route.ts`, `src/app/api/invites/[token]/accept/route.ts` | Call notification functions at end of respective handlers |
| P1-PROD-04 | **`notifyChangeOrderApproved()` / `notifyChangeOrderRejected()` not wired** | `src/app/api/change-orders/[id]/route.ts` (PATCH) | Wire notification calls in approve/reject PATCH branches |
| P1-PROD-05 | **Outbound partner webhook has no dead-letter or delivery log** — docs may describe it as live | `src/lib/engine/partner-webhook.ts` | Add `partner_webhook_delivery_log` table; mark feature as beta in docs until dead-letter is in place |

### P2 — Fix before general availability

| ID | Issue | File(s) | Fix |
|---|---|---|---|
| P2-SEC-01 | **`expire-if-stale` requires no MFA** — funder can expire auth tokens at AAL1 | `src/app/api/releases/[releaseId]/expire-if-stale/route.ts:57` | Add `requireMFA(supabase, profile)` after role check |
| P2-SEC-02 | **DocuSign webhook has no deduplication** — duplicate delivery reprocesses state | `src/app/api/webhooks/docusign/route.ts` | Add `docusign_processed_events` table with unique `(envelope_id, event_type)` index |
| P2-SEC-03 | **Audit chain concurrency fork gap** — parallel inserts can form chain branches | `supabase/migrations/20260504000000_audit_chain_bind_external_hashes.sql` | Serialize audit inserts per-tenant using an advisory lock, or upgrade `verify_audit_chain` to distinguish forks from tampering |
| P2-SEC-04 | **Webhook signing secret stored plaintext in `partners` table** | `partners` table, `src/lib/engine/partner-webhook.ts` | Store in Supabase Vault or apply envelope encryption; never expose raw secret via API |
| P2-SEC-05 | **`proof_document_id` not validated against milestone scope** in confirm-external | `src/app/api/releases/[releaseId]/confirm-external/route.ts` | Verify `proof_document_id` belongs to the release's `milestone_id` before inserting billing record |
| P2-SEC-06 | **Admin confirms any release across all deals** — `requireDealAccess` always passes for admin | `confirm-external/route.ts` | Document this as intentional admin capability, or add an explicit admin audit row binding the confirmation to the admin's identity |
| P2-SEC-07 | **Actor email exposed in audit packet response** to funders | `src/app/api/deals/[dealId]/audit-packet/route.ts` | Strip or hash `actor_email` in the response; expose only `actor_role` and opaque `actor_id` |
| P2-SEC-08 | **`increment_deal_financials` called with user-session client** in confirm-external — RLS may fail for admin callers | `src/app/api/releases/[releaseId]/confirm-external/route.ts` | Use `adminClient.rpc(...)` for all financial RPCs, or verify RPC has `SECURITY DEFINER` |
| P2-SEC-09 | **`ADMIN_ALLOWED_IPS` is optional** — admin routes IP-unrestricted when env var absent | `src/middleware.ts` | Log a startup warning if absent; recommend configuring for production |
| P2-SEC-10 | **Service-role key in Edge middleware** for IP-block audit logging | `src/middleware.ts` | Move audit logging to a dedicated server-side API route; use a write-only scoped DB role |
| P2-BACK-01 | **`expire-if-stale` inline fee calculation** diverges from `calculateFee()` if fee floor changes | `src/app/api/releases/[releaseId]/expire-if-stale/route.ts:188` | Import and call `calculateFee()` from `billing.ts` |
| P2-BACK-02 | **`as any` type suppression** on releases queries in gate and confirm-external | `src/lib/engine/release-gate.ts:140`, `confirm-external/route.ts` | Regenerate Supabase TypeScript types via `supabase gen types typescript` |
| P2-BACK-03 | **`BillingRecord.stripe_transfer_id` typed `string` (non-nullable)** but external-rail records have `null` | `src/lib/types.ts` | Change to `stripe_transfer_id: string \| null` |
| P2-PROD-01 | **Client-side logout does not produce an audit event** — `supabase.auth.signOut()` bypasses `/auth/logout` route | `src/components/nav/user-menu.tsx:61`, `src/components/nav/mobile-nav.tsx:69` | Route logout through `/auth/logout` via router.push, or call `logAudit('user_logged_out')` in the client signOut handler |
| P2-PROD-02 | **`"Funds held by Stripe"` on signup** is inaccurate for external-rail funders | `src/app/auth/signup/page.tsx:17` | Update copy to "Funds held by your selected custody partner" |
| P2-PROD-03 | **Stripe webhook event idempotency not tested** — `stripe_processed_events` table exists but dedup path not test-covered | `tests/stripe-webhook-security.test.ts` | Add test asserting duplicate Stripe event IDs do not re-process |
| P2-PROD-04 | **No E2E integration tests** — all 106 tests are static/mock-based | `tests/` | Stand up a test Supabase project in CI; add at minimum one E2E happy-path test for release gate → Stripe release → audit chain verify |
| P2-PROD-05 | **Demo contractor state reset known gap** | `MASTER_CONTEXT.md`, `src/app/(marketing)/demo-live/` | Audit all contractor demo state and ensure reset button covers every interactive state variable |
| P2-PROD-06 | **Missing `004` in migration sequence** — gap between 003 and 005 | `supabase/migrations/` | Verify 005_schema_repairs covers all intended 004 changes; document the gap in a migration README |

### P3 — Harden in follow-up sprint

| ID | Issue | File(s) | Fix |
|---|---|---|---|
| P3-SEC-01 | Hardcoded public Supabase demo anon JWT in Edge Function | `supabase/functions/run-draw-preclearance/index.ts` | Replace with `Deno.env.get('SUPABASE_ANON_KEY')` |
| P3-SEC-02 | `pdf-parse` package has historical CVE exposure | `package.json` | Run `npm audit`; evaluate `pdfjs-dist` (already a dependency) as a drop-in replacement |
| P3-SEC-03 | Floating-point intermediate in fee calculation | `src/lib/engine/billing.ts:calculateFee` | Work in integer cents throughout: `Math.round(grossAmountCents * billingRateBps / 10000)` |
| P3-SEC-04 | Rate-limit violation audit fires at 3× limit, not 1× | `src/lib/engine/rate-limit.ts:logRateLimitViolation` | Log on first violation (remaining < 0) |
| P3-SEC-05 | Admin search fetches 300 user emails client-side | `src/app/api/admin/ops/search/route.ts` | Server-side filter via Supabase admin `listUsers` query |
| P3-SEC-06 | `signer_email` stored plaintext in DocuSign webhook audit metadata | `src/app/api/webhooks/docusign/route.ts` | Hash the email before storing; retain only the hash in metadata |
| P3-SEC-07 | No minimum net-to-contractor check before rail dispatch | `src/app/api/milestones/[milestoneId]/release/route.ts` | Add guard: `netToContractor >= 1.00` (or Stripe-rail minimum), return 422 if below |
| P3-BACK-01 | **Hardening issue #133** — expire-if-stale recomputes fee from current `billing_rate_bps` instead of persisting original reserved amounts | [GitHub #133](https://github.com/morganrenovate-gif/Vektrum-Governance-/issues/133) | Add `reserved_gross_amount`, `reserved_fee_amount` columns to `authorization_tokens`; write at issuance; read in expire-if-stale |
| P3-PROD-01 | No self-service partner signup | Admin dashboard | Add partner self-registration flow or document admin-mediated-only as intentional |
| P3-PROD-02 | No `/dashboard/admin/deals` list page | Admin dashboard | Add a deals overview page for admins (currently must navigate through user detail) |
| P3-PROD-03 | `InviteFunderButton` component name misleading — it invites contractors | `src/components/` | Rename to `InviteContractorButton` |
| P3-PROD-04 | 6 `TODO(canonical-url)` HTML comments in resources page | `src/app/(marketing)/resources/construction-dispute-isolation/page.tsx` | Verify and replace citation URLs; not user-visible but should be resolved |

---

## Security and Payment Risk Register

| ID | Finding | Severity | Exploit Path | File |
|---|---|---|---|---|
| SEC-01 | MFA bypass on audit-chain-health | **Critical** | Admin AAL1 session → reach audit integrity endpoints without challenge | `admin/audit-chain-health/route.ts:27,48` |
| SEC-02 | Rate limit fail-open on DB error | **High** | DB outage → all financial write rate limits disappear silently | `src/lib/engine/rate-limit.ts` |
| SEC-03 | `/api/cron/*` publicly accessible | **High** | External actor triggers reconcile or audit-chain cron on demand | `src/middleware.ts` |
| SEC-04 | Admin executes Stripe retainage transfer | **High** | Admin role calls retainage/release → Stripe transfer without funder explicit action | `deals/[dealId]/retainage/release/route.ts:50` |
| SEC-05 | Silent audit log write failures | **High** | Release succeeds, audit write fails silently → broken chain, no alert | `src/lib/engine/audit.ts` |
| SEC-06 | Token signing optional | **High** | Key absent → `alg='unsigned'`, `signature=null`; patent claim #1 void | `src/lib/engine/authorization-token.ts` |
| SEC-07 | `expire-if-stale` no MFA | **Medium** | Stolen AAL1 funder session → permanently fail a pending release | `releases/[id]/expire-if-stale/route.ts:57` |
| SEC-08 | Webhook signing secret plaintext in DB | **Medium** | Compromised DB read → all outbound webhook signing secrets exposed | `partners` table |
| SEC-09 | DocuSign webhook no dedup | **Medium** | Duplicate envelope delivery → double state flip | `webhooks/docusign/route.ts` |
| SEC-10 | Audit chain concurrency fork | **Medium** | Parallel inserts at same sequence point → false positive chain-break alerts | `migrations/20260504000000` |
| SEC-11 | `proof_document_id` unvalidated in confirm-external | **Medium** | Admin provides cross-deal document UUID → billing record references wrong document | `releases/[id]/confirm-external/route.ts` |
| SEC-12 | Actor email in audit packet response | **Medium** | Funder enumerates admin/contractor emails via audit packet API | `deals/[dealId]/audit-packet/route.ts` |
| SEC-13 | `increment_deal_financials` with user-session client | **Medium** | Admin confirm-external → RLS fails mid-settlement → partial state | `releases/[id]/confirm-external/route.ts` |
| SEC-14 | Middleware only enforces AAL2 for dashboard pages, not `/api/admin/*` | **Medium** | Any `/api/admin/*` route missing `requireMFA` call is role-only protected | `src/middleware.ts` |
| SEC-15 | Service-role key in Edge middleware | **Medium** | Increased exposure surface for most privileged credential | `src/middleware.ts` |
| SEC-16 | `ADMIN_ALLOWED_IPS` optional | **Low** | Admin routes IP-unrestricted when env var absent | `src/middleware.ts` |
| SEC-17 | Hardcoded Supabase anon JWT in Edge function | **Low** | Public key — hygiene/scanner issue | `supabase/functions/run-draw-preclearance/index.ts` |
| SEC-18 | Floating-point fee arithmetic | **Low** | Off-by-one-cent at rounding boundary | `src/lib/engine/billing.ts:calculateFee` |
| SEC-19 | Sub-minimum Stripe transfer if retainage is very high | **Low** | 99% retainage on $55 gross → 55-cent transfer → Stripe may reject | `release/route.ts`, `billing.ts` |
| SEC-20 | Rate-limit audit at 3× not 1× | **Low** | Systematic sub-threshold abuse generates no audit trace | `src/lib/engine/rate-limit.ts` |

---

## Database / RLS / Migration Repair Plan

### Migration issues

| Issue | Severity | Fix |
|---|---|---|
| `20260425000003` has two files: `releases_active_unique.sql` and `rls_bypass_fixes.sql` | HIGH | Rename one to `20260425000003a_...` and `20260425000003b_...` and re-verify migration order in a clean environment |
| `20260429000001` has two files: `pgcrypto_schema_fix.sql` and `sov.sql` | HIGH | Same renaming approach |
| Missing `004` in migration sequence | MEDIUM | Verify 005_schema_repairs covers all expected 004 changes; document gap |
| `reserve_release_funds()` redefined across 3 migrations — final form only correct if all 3 applied in sequence | MEDIUM | Ensure all migrations are applied in full sequence; add a migration README documenting the supersession chain |

### RLS gaps

| Table | Issue | Fix |
|---|---|---|
| `authorization_tokens` | INSERT via service role only (by design) — must be documented | Add an ADR noting this is intentional; the table is written only by server-side code |
| `billing_records` | `confirm-external` inserts via user client; RLS may reject admin caller mid-settlement | Use `adminClient.rpc()` for all financial writes in financial settlement paths |
| `audit_log` | `logAudit` silently ignores write failures; no monitoring | Add structured error logging when catch fires |

### Type drift

| Issue | Fix |
|---|---|
| `BillingRecord.stripe_transfer_id` typed `string` (non-nullable) — external-rail records have `null` | Change to `string \| null` in `types.ts` |
| `(supabase as any)` in `release-gate.ts` and `confirm-external/route.ts` | Run `supabase gen types typescript --local > src/lib/database.types.ts` and remove casts |
| `deals/[dealId]/page.tsx` — `signed_storage_path`, `storage_path` TS2339 errors | Add fields to contract type in `types.ts` |
| `release-gate.test.ts` funder fixture had missing Profile fields | Fixed in commit `307b1c5` |

---

## Manual QA Workflow — Full App

### Pre-QA environment checklist
- [ ] Non-production Supabase project
- [ ] `STRIPE_SECRET_KEY` starts with `sk_test_`
- [ ] All migrations applied through `20260504000001`
- [ ] `VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE` set (for token signing tests) OR documented as absent (G6–G8 path)
- [ ] Test funder (Stripe rail), test contractor (Stripe Connect enabled), funded deal with approved milestone

### Section A — Migration dry-run (SQL)
See `docs/qa/tier-b-release-token-manual-qa.md` Section A — run all 6 items.

### Section B–H — Tier B release token QA
See `docs/qa/tier-b-release-token-manual-qa.md` Sections B–H (Stripe regression, idempotency, external-rail authorize-only, settlement, expire-if-stale, signing, audit chain).

### Supplemental manual QA — full app flows

**Funder pilot flow:**
1. Sign up as a new funder → verify MFA enrollment prompt
2. Complete rail-choice wizard → select Stripe → verify `disbursement_rail='stripe'` in DB
3. Create a deal → verify deal appears in dashboard
4. Fund the deal → verify `funded_amount` incremented
5. Invite a contractor → verify invite email received (P1 gap: currently not sent)
6. Approve a milestone → verify status transitions
7. Submit release (Stripe) → verify B1–B10 checklist items
8. Verify receipt email received by funder and contractor

**External rail supplemental (after P0/P1 fixes):**
9. Repeat with `disbursement_rail='external_rail'` funder → verify D1–D10 checklist items
10. Confirm external payment via API (P1: no UI yet) → verify E1–E10 checklist items
11. Expire a stale token → verify F1–F8 checklist items

**Admin flow:**
12. Log in as admin → verify MFA step-up
13. Navigate to Users → view a user detail page → verify correct route (`/dashboard/admin/users/[id]`)
14. Navigate to Audit Log → verify entries present and hash-chain health shows green
15. Navigate to Ops → verify release health, webhook health, reconciliation panels load
16. Attempt to release a milestone as admin → verify 403 (gate blocks)
17. Attempt admin promotion → verify requires `ADMIN_PROMOTION_ENABLED=true`

**Contractor flow:**
18. Sign up as contractor → complete Stripe Connect onboarding
19. Accept deal invite → verify deal visible in dashboard
20. Transition milestone to `ready_for_review` → verify funder notification received
21. Upload evidence document → verify appears in milestone documents
22. Upload lien waiver → verify waiver appears; funder notified

**Partner flow:**
23. Admin creates a partner + API key → verify raw key shown once
24. `GET /api/partner/releases/{id}` with valid API key → verify response
25. `POST /api/partner/releases/{id}/confirm` → verify settlement flows; billing record inserted; token confirmed
26. Repeat confirm on same release → verify 409 idempotent response
27. `POST /api/partner/releases/{id}/fail` on a different pending release → verify cancellation; reservation freed

**Security spot-checks:**
28. Attempt `GET /api/admin/audit-chain-health` with admin AAL1 session → should fail (P0-SEC-01 fix required)
29. Attempt `POST /api/releases/{id}/expire-if-stale` as contractor → verify 403
30. Attempt `POST /api/milestones/{id}/release` as admin → verify 403
31. `POST /api/cron/reconcile` with no auth → should return 401 (P1-SEC-04 fix required)

---

## Implementation Roadmap

### Sprint 1 — Pre-production (before any live traffic) — ~3 days

Fix the 4 P0 items. All are surgical; none require architectural change.

1. `P0-SEC-01`: Fix `requireMFA(authContext)` → `requireMFA(supabase, profile)` in audit-chain-health
2. `P0-BACK-01`: Wire `issueAuthorizationToken()` into `authorize-external/route.ts`
3. `P0-BACK-02`: Remove admin from retainage release role guard
4. `P0-PROD-01`: Fix receipt page redirect to `/auth/login`

### Sprint 2 — Stripe rail pilot launch — ~5 days

Fix P1 items that affect the Stripe-rail pilot path.

5. `P1-SEC-01`: Generate ed25519 key; set `VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE`; add startup enforcement
6. `P1-SEC-02`: Harden rate-limit to fail closed for financial write policies
7. `P1-SEC-03`: Add structured error logging in `logAudit` catch
8. `P1-SEC-04`: Add cron secret verification to `/api/cron/*`
9. `P1-BACK-01`: Resolve duplicate migration timestamps
10. `P1-PROD-01`: Wire `notifyLienWaiverRequested()` in gate failure handler
11. `P1-PROD-03`: Wire `notifyFunderInvited()` and `notifyInviteAccepted()`
12. `P1-PROD-04`: Wire `notifyChangeOrderApproved()` / `notifyChangeOrderRejected()`

### Sprint 3 — External rail pilot launch — ~5 days

Fix P1 items specific to external rail, plus P2 security items.

13. `P1-BACK-02`: Add cron sweep for stale pending releases
14. `P1-PROD-02`: Add confirm-external button to funder deal dashboard
15. `P1-PROD-05`: Add `partner_webhook_delivery_log` table; mark webhooks as beta in docs
16. `P2-SEC-01`: Add MFA to `expire-if-stale`; add rate limit
17. `P2-SEC-02`: Add `docusign_processed_events` dedup table
18. `P2-BACK-01`: Fix `expire-if-stale` to call `calculateFee()` instead of inline formula
19. `P2-BACK-02 / P2-BACK-03`: Regenerate Supabase types; fix `BillingRecord.stripe_transfer_id`
20. `P3-BACK-01`: Implement GitHub issue #133 (persist reserved amounts on token)

### Sprint 4 — GA hardening — ~5 days

21. `P2-SEC-04`: Move webhook signing secret to Supabase Vault
22. `P2-SEC-07`: Strip actor email from audit packet response
23. `P2-SEC-08`: Standardize financial RPCs to use adminClient
24. `P2-SEC-09/10`: ADMIN_ALLOWED_IPS startup warning; move IP audit log out of middleware
25. `P2-PROD-01`: Route logout through `/auth/logout` for audit events
26. `P2-PROD-02`: Fix "Funds held by Stripe" copy
27. `P2-PROD-03/04`: Add Stripe webhook dedup test; add at least one E2E integration test
28. All P3 items as capacity allows

---

## Copy-Paste Claude Code Prompts for Each Repair Sprint

### Sprint 1 — P0 fixes

```
Fix four P0 issues in the Vektrum codebase. Read-first, then edit. Run tests after each fix. No new features.

1. src/app/api/admin/audit-chain-health/route.ts lines 27 and 48:
   `requireMFA(authContext)` is called with one argument but the function signature is
   `requireMFA(supabase: SupabaseClient, profile: Profile)`. Create a Supabase server
   client inside the handler and call `requireMFA(supabase, authContext.profile)` in both places.

2. src/app/api/milestones/[milestoneId]/authorize-external/route.ts:
   This route does NOT call `issueAuthorizationToken()`. Mirror the Stage B1 pattern from
   src/app/api/milestones/[milestoneId]/release/route.ts — call `issueAuthorizationToken()`
   after `reserve_release_funds()` succeeds, bind `authorization_token_id` on the release
   row insert, and update the audit row to include `token_hash`. Handle the
   `AuthorizationTokenConflictError` case with 409 + cancel_release_reservation.

3. src/app/api/deals/[dealId]/retainage/release/route.ts line 50:
   The role guard allows `profile.role === 'admin'`. Remove admin from the allowed roles.
   Only funders should be able to initiate retainage releases (which execute a Stripe transfer).

4. src/app/(app)/dashboard/receipts/[receiptId]/page.tsx lines 26 and 34:
   Unauthenticated redirects go to `/login` which does not exist. Change both to `/auth/login`.

After all four: run `npx tsc --noEmit` and `npm test`.
```

### Sprint 2 — Stripe rail pilot P1 fixes

```
Fix P1 issues for Stripe-rail pilot launch. Read-first, no new features, run tests after.

1. src/lib/engine/rate-limit.ts — checkRateLimit() catch block returns { allowed: true }.
   For policies where `policyKey` is 'financial_write' or 'admin_write', change fail behavior
   to return { allowed: false, remaining: 0 } on DB error. For other policies keep fail-open.

2. src/lib/engine/audit.ts — logAudit() catch block is silent.
   Add `console.error('[audit] logAudit failed:', JSON.stringify({action: params.action, error: String(err)}))`.
   Do not change the fire-and-forget pattern.

3. src/app/api/cron/audit-chain-health/route.ts and src/app/api/cron/reconcile/route.ts:
   Add cron secret verification at the top of each handler:
   ```
   const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '')
   if (cronSecret !== process.env.CRON_SECRET) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
   }
   ```

4. Wire missing notification functions (all are defined in src/lib/engine/notify.ts):
   a. src/app/api/invites/route.ts (POST handler): call notifyFunderInvited() after invite insert
   b. src/app/api/invites/[token]/accept/route.ts: call notifyInviteAccepted() after accept
   c. src/app/api/change-orders/[id]/route.ts (PATCH): call notifyChangeOrderApproved() or
      notifyChangeOrderRejected() based on the new status
   d. In the release gate failure path (src/lib/engine/release-gate.ts or the release route),
      when condition C10 (lien waiver required) fails, call notifyLienWaiverRequested()

5. Resolve duplicate migration timestamps:
   - Rename supabase/migrations/20260425000003_releases_active_unique.sql to 20260425000003_releases_active_unique.sql (keep, earlier in alphabet)
   - Rename supabase/migrations/20260425000003_rls_bypass_fixes.sql to 20260425000003b_rls_bypass_fixes.sql
   - Rename supabase/migrations/20260429000001_pgcrypto_schema_fix.sql to 20260429000001_pgcrypto_schema_fix.sql (keep)
   - Rename supabase/migrations/20260429000001_sov.sql to 20260429000001b_sov.sql
   Verify the renamed files apply correctly in migration order.

Run `npx tsc --noEmit` and `npm test` after all changes.
```

### Sprint 3 — External rail P1 + P2 fixes

```
Fix external-rail P1/P2 issues. Read-first, no new features, run tests after.

1. src/app/api/releases/[releaseId]/expire-if-stale/route.ts:
   a. Add `await requireMFA(supabase, profile)` after the role check (around line 57).
   b. Add a financial_write rate limit check using the existing rate-limit helper pattern
      from src/app/api/milestones/[milestoneId]/release/route.ts.
   c. Replace the inline fee calculation (around line 188) with an import and call to
      `calculateFee()` from src/lib/engine/billing.ts.

2. Add confirm-external UI button to the funder deal page:
   In src/app/(app)/dashboard/deals/[dealId]/page.tsx, find where releases are displayed.
   For any release with `execution_status === 'pending'` and `execution_rail === 'external_manual'`,
   add a "Confirm Payment Received" button that opens a modal and calls
   POST /api/releases/{releaseId}/confirm-external with { payment_method, payment_reference }.

3. DocuSign webhook deduplication:
   Create migration: supabase/migrations/20260507000000_docusign_processed_events.sql
   ```sql
   CREATE TABLE IF NOT EXISTS public.docusign_processed_events (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     envelope_id TEXT NOT NULL,
     event_type TEXT NOT NULL,
     processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE(envelope_id, event_type)
   );
   ```
   In src/app/api/webhooks/docusign/route.ts, check for existing row before processing,
   insert on process (catch 23505 unique violation for idempotent handling).

4. src/lib/types.ts — BillingRecord.stripe_transfer_id:
   Change from `stripe_transfer_id: string` to `stripe_transfer_id: string | null`.
   Fix any downstream uses that assume non-null.

5. Fix `(supabase as any)` casts:
   Run `supabase gen types typescript --local > src/lib/database.types.ts` then
   import the generated types in release-gate.ts and confirm-external/route.ts to remove
   the `as any` suppressions.

Run `npx tsc --noEmit` and `npm test` after all changes.
```

### Sprint 4 — GA hardening

```
GA hardening pass for Vektrum. Read-first, no new features, run tests after each item.

1. src/app/api/deals/[dealId]/audit-packet/route.ts:
   Strip actor_email from the response object. Keep actor_role and actor_id (UUID).
   Search for where audit rows are mapped and remove or hash the email field.

2. src/app/api/releases/[releaseId]/confirm-external/route.ts:
   The increment_deal_financials and increment_deal_retainage RPC calls use the user
   Supabase client. Switch these to use the adminClient (same pattern as the
   increment calls in the primary release route). Verify the RPCs don't have SECURITY
   DEFINER — if they do, the user client is fine and this item can be skipped.

3. src/components/nav/user-menu.tsx line 61 and src/components/nav/mobile-nav.tsx line 69:
   The signOut() call is a direct Supabase client call that doesn't hit the /auth/logout
   route and doesn't log an audit event. Replace with a router.push('/auth/logout') call
   so the server-side route handles both signout and audit logging.

4. src/app/auth/signup/page.tsx line 17:
   "Funds held by Stripe" — update to "Funds held by your selected custody partner
   (Stripe Connect or your institutional payment partner)".

5. src/app/api/releases/[releaseId]/confirm-external/route.ts:
   After fetching the release, add a scope check on proof_document_id if provided:
   verify that the document belongs to the release's milestone_id before inserting
   the billing record.

6. Add npm audit to CI pipeline and fix any high/critical advisories, particularly
   in the pdf-parse transitive dependency chain.

7. supabase/functions/run-draw-preclearance/index.ts:
   Replace the hardcoded Supabase anon JWT string with Deno.env.get('SUPABASE_ANON_KEY').

Run `npx tsc --noEmit` and `npm test` after all changes. Run `npm audit` and document
any remaining unfixed advisories with justification.
```

---

## Appendix — Migration Inventory

| Filename | What it adds |
|---|---|
| `001_schema.sql` | Core schema: profiles, deals, milestones, releases, audit_log, change_orders, disputes |
| `002_disputes_api.sql` | Disputes API, dispute_summary view |
| `003_funder_invites.sql` | Invites table |
| *(004 missing)* | Gap — verify 005 covers intended changes |
| `005_schema_repairs.sql` | Schema repairs |
| `006_audit_enhancements.sql` | Audit log enhancements |
| `007_fix_signup_trigger_fk.sql` | Fix signup trigger FK |
| `008_rename_position_to_order_index.sql` | `position` → `order_index` on milestones |
| `009_add_dispute_briefs.sql` | Dispute briefs column |
| `010_billing.sql` | billing_records table, increment_deal_financials() v1 |
| `011_contracts.sql` | contracts table, DocuSign envelope fields |
| `012_reconciliation.sql` | reconciliation_issues, reconciliation_runs |
| `013_transfer_failure.sql` | Payout failure; reverse_deal_financials() |
| `014_rls_hardening.sql` | RLS policy hardening |
| `015_stripe_account_unique.sql` | Unique constraint on stripe_account_id |
| `016_audit_compliance.sql` | Actor name/email/system_source on audit_log |
| `20260423000000` | transaction_receipts table |
| `20260423000001` | reserve_release_funds() v1; cancel_release_reservation(); increment_deal_financials() v2 with FOR UPDATE NOWAIT |
| `20260423000002` | receipt confirmed status enum |
| `20260423000003` | subscription_tier on profiles |
| `20260423000004` | governance_fee_bps, facility_total on deals |
| `20260424000001` | funds_pending_amount, funds_captured on deals |
| `20260424000002` | mfa_enrolled, mfa_enrolled_at on profiles |
| `20260424000004` | row_hash, chain_hash; compute_audit_hash() trigger; verify_audit_chain() v1 |
| `20260424000005` | sequential_release_required, milestone_prerequisites |
| `20260424000006` | retainage_percentage, retainage_held; reserve_release_funds() v3; increment_deal_retainage() |
| `20260424000007` | admin_audit_log table |
| `20260424000008` | lien_waivers table; lien_waiver_required on deals |
| `20260424000009` | billing_records fee floor at $2.50 (superseded) |
| `20260424000010` | Partial unique index on non-voided contracts; deal freeze columns |
| `20260425000000` | execution_rail, execution_status on releases; external confirmation fields |
| `20260425000001` | partners table, partner_api_keys table |
| `20260425000002` | Fee floor corrected to $50.00 |
| `20260425000003_releases_active_unique` | Partial unique index on active releases — **DUPLICATE TIMESTAMP** |
| `20260425000003_rls_bypass_fixes` | RLS bypass fixes — **DUPLICATE TIMESTAMP** |
| `20260425000004` | Audit hash timestamp serialization fix |
| `20260425000005` | stripe_processed_events dedup table |
| `20260425000006` | billing_records / releases cross-check constraint |
| `20260425000007` | Fee floor preflight check |
| `20260425000008` | reserve_release_funds() deal-status re-check inside FOR UPDATE lock (closes F-C1 race) |
| `20260425000009` | confirm_stripe_transfer() for webhook settlement |
| `20260425000010` | rate_limit_buckets table, check_rate_limit() |
| `20260425000011` | Partner scope, disbursement_rail on profiles |
| `20260427000000` | audit_chain_health_runs table |
| `20260428000000` | notifications table |
| `20260428000001` | milestone_documents table/bucket |
| `20260429000000` | Defensive signup audit |
| `20260429000001_pgcrypto_schema_fix` | pgcrypto schema fix; replace verify_audit_chain() — **DUPLICATE TIMESTAMP** |
| `20260429000001_sov` | sov_line_items, milestone_sov_links — **DUPLICATE TIMESTAMP** |
| `20260429000002` | Contracts storage bucket |
| `20260429000003` | notifications.read_at column |
| `20260430000000` | design_partner_applications table |
| `20260501000000` | contract_release_rule_drafts table |
| `20260502000000` | sov_source_draft_id column |
| `20260503000000` | disbursement_rail column on profiles |
| `20260504000000` | External evidence hash columns on audit_log; compute_audit_hash() v2; verify_audit_chain() v2 |
| `20260504000001` | authorization_tokens table; immutability trigger; RLS; FK from releases |

## Appendix — RPC Inventory

| RPC Name | Caller(s) | DB Function Exists |
|---|---|---|
| `reserve_release_funds` | release/route.ts, authorize-external/route.ts | ✅ (final: 20260425000008) |
| `cancel_release_reservation` | release/route.ts, authorize-external/route.ts, expire-if-stale/route.ts, mark-external-failed/route.ts, partner/fail/route.ts | ✅ |
| `increment_deal_financials` | release/route.ts, confirm-external/route.ts, partner/confirm/route.ts | ✅ |
| `increment_deal_retainage` | release/route.ts, confirm-external/route.ts, partner/confirm/route.ts | ✅ |
| `increment_deal_retainage_released` | deals/retainage/release/route.ts | ✅ |
| `confirm_stripe_transfer` | stripe/webhook/route.ts | ✅ |
| `reverse_deal_financials` | stripe/webhook/route.ts | ✅ |
| `verify_audit_chain` | audit.ts, audit-chain-health.ts | ✅ (final: 20260504000000) |
| `check_rate_limit` | rate-limit.ts | ✅ |
| `audit_stripe_account_duplicates` | admin/stripe/duplicates/route.ts | ✅ |

All RPCs have corresponding DB functions. No orphaned RPC calls.

## Appendix — Patent-Readiness Scorecard

| Candidate | Description | % Complete | Primary Gap |
|---|---|---|---|
| #1 | Rail-scoped signed authorization tokens | 75% | Signing is optional — key absent → `alg='unsigned'`; no startup enforcement; no verifier endpoint |
| #2 | 10-condition deterministic release gate | 90% | No automated test mapping each condition to a failing case; C10 depth needs verification |
| #3 | Hash-chained tamper-evident audit ledger | 85% | Concurrency fork gap; no real-time chain-break alert; no verifiable export bundle |
| #4 | Rail-agnostic authorization/execution separation | 95% | No formal multi-rail routing test; `authorize-external` missing token issuance |
| #5 | Reserve-release funding model | 90% | Lock contention surfaces as opaque 500; no dead-letter for failed reservations |
| #6 | Partner-controlled external execution proof | 80% | Outbound webhooks have no dead-letter; proof_document_id unvalidated |
| #7 | AI-informed (not AI-approved) release gate | 90% | AI override TTL not verified to expire; no test that `critical` risk specifically blocks |

---

*Report generated from three parallel read-only audit agents. All findings are based on source code analysis; live database and Stripe integration behavior should be verified against the manual QA checklist at `docs/qa/tier-b-release-token-manual-qa.md`.*
