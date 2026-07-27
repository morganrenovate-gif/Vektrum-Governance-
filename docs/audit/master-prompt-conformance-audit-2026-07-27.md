# Master System Prompt — Code Conformance Audit

**Date:** 2026-07-27 · **Scope:** every verifiable claim in `docs/ai/VEKTRUM_MASTER_SYSTEM_PROMPT.md` (v1.1) checked against the codebase · **Result:** v1.2 issued with 8 corrections; 1 code-side deviation flagged (not fixed — requires approval per §13.4/§15.2).

**Method:** direct code inspection (routes, engine, migrations, auth middleware) + targeted test runs. No production code was modified. Verdicts: ✅ verified · ✏️ corrected in v1.2 · ⚠️ code deviation flagged.

## Claim-by-claim results

### Prime directive & architecture (§2, §5)

| Claim | Verdict | Evidence |
|---|---|---|
| Authorization separated from execution; rails behind adapter | ✅ / ⚠️ one deviation | `src/lib/engine/rail-adapter.ts`; release route dispatches via `getRailAdapter`. **Deviation:** `src/app/api/deals/[dealId]/retainage/release/route.ts:175` calls `stripe.transfers.create` inline — flagged in v1.2 §13.5 + backlog §17.2 |
| Vektrum holds no funds; custody external | ✅ | No custody accounts anywhere in schema; rails are Stripe Connect or partner-confirmed external |
| Token: `jti`, `token_hash`, `rail_scope`, ed25519-or-unsigned, amounts locked at issuance | ✅ | `src/lib/engine/authorization-token.ts` (`feeAmount` required; `reserved_gross_amount`/`reserved_fee_amount`) |
| Token status flow issued → delivered → confirmed/failed/expired/revoked | ✅ | CHECK constraint, migration `20260504000001` line 111 |
| Token TTL 24 h Stripe / 30 days external | ✅ | `DEFAULT_TTL_HOURS_STRIPE = 24`, `DEFAULT_TTL_HOURS_EXTERNAL = 24*30` |
| Audit: `row_hash`, `chain_hash`, `token_hash`, `partner_ack_hash`, `hash_schema_version` | ✅ | Migrations `001` (base hashes), `20260504000000` (5 hash cols, schema v2) |
| Audit log append-only (no update/delete) | ✅ | `20260424000004_audit_log_immutability.sql` — BEFORE UPDATE OR DELETE trigger raises |
| Authorization tokens immutable | ✅ | `20260504000001` Part 3 BEFORE UPDATE trigger |

### Release gate (§6)

| Claim | Verdict | Evidence |
|---|---|---|
| Exactly 10 conditions, labels as documented, in order | ✅ | `release-gate.ts` `CONDITION 1`–`CONDITION 10` comments/logic match the public labels |
| Condition 4 skipped on external rail | ✅ | Rail-aware branch, lines 21/46/244-252 |
| Condition 8 requires contract `status='signed'` | ✅ | Line 323 |
| Condition 6 duplicate protection + DB uniqueness | ✅ | `releases_milestone_unique` (`001_schema.sql:231`) + `20260425000003_releases_active_unique.sql` |
| `reserve_release_funds()` re-checks under row lock | ✅ | `SELECT FOR UPDATE NOWAIT` per `20260425000008` / `20260423000001` |
| AI precondition: current + no critical risk; AI never decides | ✅ | `checkAiPrecondition()`; critical → blocked, no override possible over critical |
| "Current" AI review window | ✏️ was unstated | 48 h in code — now stated in v1.2 §6.1 |
| AI-precondition admin override | ✏️ was undocumented | `override-ai-review` route: admin + AAL2 + justification ≥ 20 chars + rate limit; never over critical; TTL default 4 h; audit-logged; gate conditions untouched. Documented in v1.2 §6.3/§7.2 |
| Funder-only trigger with MFA; contractor/admin/partner/AI cannot release | ✅ | `requireMFA` at release route line 75 (funder+admin roles enforced, contractors exempt); admin-safety tests 8/8; partner-scope tests 6/6 |
| Gate tests | ✅ | `release-gate.test.ts` 55/55 (run 2026-07-27) |

### Security (§7)

| Claim | Verdict | Evidence |
|---|---|---|
| Admin promotion default off; 403 | ✅ | `promote/route.ts:59` — `!== 'true'` → 403; justification ≥ 20 chars |
| API keys SHA-256 hashed, raw once | ✅ | `partners` schema; admin-partner-lifecycle tests 30/30 |
| Rate-limit policy table | ✏️ corrected | Real policies: `financial_write`, `admin_write`, `partner_api`, `ai_analysis`, `ai_draw_review`, `deal_fund`, `cron`. Only first two fail closed (`FAIL_CLOSED_POLICIES`). v1.1's `ai_review`/`funding` names and "funding fail closed" were wrong |
| `check_rate_limit` RPC | ✅ | `20260425000010_rate_limit_buckets.sql` |
| Stripe webhook HMAC + dedupe + idempotent | ✅ | webhook route: raw-body `constructEvent`, `stripe_processed_events`; stripe-webhook-security tests 11/11 |
| MFA (AAL2) on financial writes for funders/admins | ✅ | `requireMFA` in middleware; 29 API routes call it, incl. release + admin writes |
| No service-role/Stripe secrets in frontend | ✅ | Only `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/APP_URL` public; single grep hit is a comment; RLS regression tests 37/37 |
| RLS on all tables | ✏️ tightened | All **31** created tables have `ENABLE ROW LEVEL SECURITY` (was "25+") |

### Partner API (§8)

| Claim | Verdict | Evidence |
|---|---|---|
| Endpoints as listed (get/confirm/fail/list/introspect) | ✅ | Route files present; cross-partner introspection 403 (`tokens/[jti]/route.ts:94`) |
| Confirm idempotent: 200 `alreadyConfirmed` | ✅ | `confirm/route.ts:170` |
| Fail idempotent: 200 `alreadyFailed` | ✏️ corrected | Second fail returns **400 validation error** ("only 'pending' can be marked failed"); state-safe but not the documented shape. v1.2 states actual behavior |
| `partner_ack_hash` + `token_hash` bound to audit | ✅ | Confirm route + migration `20260504000000` |
| Outbound webhooks | ✏️ status updated | Now **implemented and tested**: `deliverPartnerWebhook` sends signed `release.authorized` on external authorization; test 15/15. v1.1 backlog said "needs verification" — resolved |
| Partner cannot bypass gate / create releases / cross-scope | ✅ | Partner-scope isolation tests 6/6; no partner create-release route |

### Admin, demo, Procore (§9, §10, §18)

| Claim | Verdict | Evidence |
|---|---|---|
| Admin dashboard route table | ✏️ corrected | Real routes: overview (with user list + audit entries), `users/[userId]`, `partners`, `ops` (reconciliation/audit/search), `subscriptions`, `design-partner-applications`. No `/admin/audit`, `/admin/reconciliation`, or `/admin/users` list pages — v1.2 table matches reality |
| Demo reset production-gated | ✅ | `DEMO_RESET_ENABLED === 'true'` required in production (`demo/reset/route.ts:34-36`) |
| Demo routes incl. `/demo-live/procore` | ✅ | Route tree verified; Procore demo disclosure verbatim, test-enforced |
| §18 Procore invariants (sandbox-only, read-only, funder-gated, AES-256-GCM, RLS server-only, kill switch, audited, metadata-only) | ✅ | Verified in the 2026-07-24 audit; re-confirmed: `test:procore` 3/3 suites, demo prototype 70/70 |

### Technical-reviewer facts (§12.5)

| Claim | Verdict | Evidence |
|---|---|---|
| Next.js 15, React 19 | ✅ | `package.json`: next ^15.1.0 |
| AI chain sonar-pro → claude-sonnet → gpt-4o | ✅ | `draw-review/route.ts:101` (claude-sonnet-4-20250514) |
| "100+ automated tests" | ✏️ tightened | 117 test files (116 wired into `npm test` + procore suites) — v1.2 states 117 |
| `calculateFee()` billing | ✅ | `src/lib/engine/billing.ts:120` |

## Corrections applied in v1.2

1. §6.1 — 48 h AI-review freshness window stated.
2. §6.3 — admin AI-precondition override documented with its exact guards; explicit statement that the 10 conditions can never be overridden.
3. §7.2 — admin capability table updated to match (override capability added; "cannot override gate conditions" added).
4. §7.4 — rate-limit policy table rewritten to actual names, limits, and fail behaviors.
5. §8.4 — fail-endpoint repeat behavior corrected to the real 400 state-safe rejection.
6. §8.5 / §17.1 — outbound partner webhook status updated to implemented + tested.
7. §9.1 — admin route table corrected.
8. §12.5 — 31 RLS tables, 117 test files, token/audit details tightened.

## Code deviation flagged (not fixed — requires approval)

- **Retainage release bypasses the rail adapter.** `src/app/api/deals/[dealId]/retainage/release/route.ts:175` calls `stripe.transfers.create` inline, contrary to §13.5. Not modified in this audit (financial code, §13.4 CRITICAL). Tracked in §17.2; recommended fix: dispatch through `getRailAdapter('stripe_connect')` with regression tests.

## Tests run for this audit (all passed)

`release-gate` 55/55 · `partner-scope-isolation` 6/6 · `admin-safety` 8/8 · `admin-partner-lifecycle` 30/30 · `stripe-webhook-security` 11/11 · `rls-regression` 37/37 · `partner-webhook-test-event` 15/15 · `tier-b1-authorization-token` pass · `audit-chain-health` 28/28 · `demo-dispute-resolution` 24/24 · `test:procore` 3/3 suites · `demo-procore-prototype` 70/70

Claims **not** independently re-verifiable here and left unchanged as doctrine/positioning (not fact claims): market-size framing (§12.1, internal doctrine), ICP definitions (§4.2), category language (§4.1).
