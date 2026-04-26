# Vektrum Security Controls Map

**Version:** 1.0 — April 2026
**Status:** Authoritative — derived from April 2026 codebase audit
**Source:** `/Users/adammorgan/Vektrum-Governance-`

---

## Defence-in-Depth Layers

Vektrum uses layered security. Each layer is independent — a failure in one does not disable the others.

```
Layer 1 — Network / Edge:     IP allowlist (middleware, optional)
Layer 2 — Session:            Supabase auth session cookie (anon key, RLS-enforced)
Layer 3 — Role:               requireRole() — checks profile.role
Layer 4 — MFA assurance:      requireMFA() — enforces AAL2 for financial/admin ops
Layer 5 — Rate limiting:      checkRateLimit() — server-side, Postgres-backed
Layer 6 — Business logic:     validateRelease() — 10-condition gate (release only)
Layer 7 — Database:           RLS policies, SECURITY DEFINER RPCs, immutable audit trigger
```

---

## Layer 1: IP Allowlist (Admin Routes)

**File:** `src/middleware.ts`

- Applies to: `/dashboard/admin/*` and `/api/admin/*`
- Controlled by: `ADMIN_ALLOWED_IPS` env var (comma-separated CIDRs or exact IPs)
- Enforcement: Edge middleware, before any session check or route handler
- If `ADMIN_ALLOWED_IPS` is unset: all IPs allowed (no restriction)
- If set: only listed CIDRs can reach admin routes; all others receive `403 { error: "Admin access restricted by IP policy" }`
- Blocked attempts are fire-and-forget logged to `admin_audit_log` with action `admin_access_blocked_ip`
- IPv4 CIDR matching implemented in pure Edge-safe code (no Node.js `net` module)

**Risk if misconfigured:** Setting `ADMIN_ALLOWED_IPS` incorrectly can lock out all admins. Empty string = no restriction (safe default).

---

## Layer 2: Session Authentication

**File:** `src/lib/auth/middleware.ts` → `getAuthUser()`

- All `/dashboard/*` and `/api/*` routes (except webhooks and cron) require a valid Supabase session cookie
- `getAuthUser()` calls `supabase.auth.getUser()` — validates JWT against Supabase's auth server, not just locally decoded
- Fetches the caller's `profiles` row (role, MFA status, etc.)
- Returns `{ user, profile }` or throws a 401 NextResponse
- Session tokens are short-lived JWTs; Supabase refreshes them automatically via the middleware's `updateSession()` call

**What it does NOT do:** `getAuthUser()` does not log authentication events (would create one `user_login` audit entry per request). Auth events are captured at sign-in time via `POST /api/auth/webhook`.

**Webhook routes bypass session auth:** `/api/stripe/webhook`, `/api/webhooks/docusign`, and `/api/cron/reconcile` use their own signature/secret verification.

---

## Layer 3: Role Guards

**File:** `src/lib/auth/middleware.ts` → `requireRole()`

- Called immediately after `getAuthUser()` in every role-restricted route
- Reads `profile.role` which comes from the `profiles` table (set at signup via `handle_new_user` trigger)
- Roles: `contractor`, `funder`, `admin`
- Throws a 403 NextResponse with a human-readable explanation if the caller's role is not in the allowed list

**Critical role boundary:** Admin cannot release funds. This is enforced at two independent points:
1. Release route: `requireRole(profile, 'funder')` — admin gets 403 before anything runs
2. `validateRelease()` in `release-gate.ts:76-84`: if `callerProfile.role !== 'funder'` → `{ allowed: false }`, returns immediately without loading any deal data

Both checks are required; neither alone is sufficient.

---

## Layer 4: MFA / AAL2 Enforcement

**File:** `src/lib/auth/middleware.ts` → `requireMFA()`

Routes requiring AAL2:

| Route category | MFA enforced |
|---|---|
| `/api/milestones/[id]/release` | Yes |
| `/api/milestones/[id]/authorize-external` | Yes |
| `/api/releases/[id]/confirm-external` | Yes |
| `/api/releases/[id]/mark-external-failed` | Yes |
| `/api/deals` (POST — create deal) | Yes |
| `/api/deals/[id]/fund` | Yes |
| `/api/deals/[id]/contract/sign` | Yes |
| All `/api/admin/*` routes | Yes |
| `/dashboard/admin/*` pages | Yes (middleware + server-side check) |

**How it works:**
1. `requireMFA()` checks the Supabase session's `aal` claim (from the JWT)
2. AAL1 = password-only; AAL2 = password + TOTP verified
3. If AAL1 and user has MFA enrolled → 403 with "Please verify your MFA"
4. If AAL1 and user has no MFA enrolled → 403 with "Please enroll in MFA"
5. Funder self-signup flows prompt for MFA enrollment before financial actions are available

**Admin AAL2 in middleware (`src/middleware.ts`):**
For `/dashboard/admin/*` pages specifically, the middleware reads the JWT's `aal` claim edge-side (local decode, no network call) and redirects to `/auth/mfa/verify` or `/auth/mfa/enroll` before the page renders.

---

## Layer 5: Rate Limiting

**File:** `src/lib/engine/rate-limit.ts`

- Backed by Postgres `rate_limit_buckets` table (fixed-window counter, atomic increment)
- Aggregates across all Vercel serverless instances (DB-backed, not in-memory)
- Keyed by authenticated user ID or partner ID (not IP — unforgeable after auth)
- **Fail-open policy:** if the DB call fails, the request proceeds. Auth and business logic are the primary controls.

| Policy | Default | Window | Env var override |
|---|---|---|---|
| `financial_write` | 5 req | 60 s | `RATE_LIMIT_FINANCIAL_WRITE_MAX` |
| `admin_write` | 20 req | 60 s | `RATE_LIMIT_ADMIN_WRITE_MAX` |
| `partner_api` | 60 req | 60 s | `RATE_LIMIT_PARTNER_API_MAX` |
| `ai_analysis` | 10 req | 3600 s | `RATE_LIMIT_AI_ANALYSIS_MAX` |
| `ai_draw_review` | 15 req | 300 s | `RATE_LIMIT_AI_DRAW_REVIEW_MAX` |
| `deal_fund` | 5 req | 300 s | `RATE_LIMIT_DEAL_FUND_MAX` |
| `cron` | 3 req | 60 s | `RATE_LIMIT_CRON_MAX` |

**Violation logging:** All blocks emit `console.warn`. When a counter reaches 3× the limit (persistent violator), a fire-and-forget `audit_log` entry with `action = 'rate_limit_violation'` is written.

---

## Layer 6: Release Gate (10 Conditions)

**File:** `src/lib/engine/release-gate.ts` → `validateRelease()`

All 10 conditions evaluated in a single pass. ALL failures returned simultaneously.

**Pre-condition (separate from gate):** AI draw review must exist, be ≤ 48h old, and `risk_level ≠ 'critical'`. Evaluated by `checkAiPrecondition()` before `validateRelease()` is called.

| # | Condition | Can be bypassed? |
|---|---|---|
| 0 | Caller role is `funder` (admin explicitly blocked) | No |
| 1 | `milestone.status = 'approved'` | No |
| 2 | `milestone.protection_status = 'ready_for_release'` | No |
| 3 | Available balance ≥ milestone amount + platform fee | No |
| 4 | `contractor.stripe_payouts_enabled = true` *(skipped for external_manual)* | Skipped on external rail |
| 5 | `contractor.onboarding_complete = true` | No |
| 6 | No pending/confirmed release for this milestone | No |
| 7 | No open change orders on this milestone | No |
| 8 | Signed, non-voided contract exists for this deal | No |
| 9 | Sequential ordering satisfied (if `deal.sequential_release_required`) | Only if `sequential_release_required = false` |
| 10 | Approved `conditional_progress` lien waiver on file (if `deal.lien_waiver_required`) | Only if `lien_waiver_required = false` |

**Frozen deal fast-path:** If `deal.status = 'frozen'` (set by DocuSign void-after-release), all releases are blocked before any condition is evaluated. This is separate from the 10 conditions.

**Admin AI override:** Emergency bypass for when AI providers are unavailable. Cannot override `critical` risk assessments. TTL: `AI_ADMIN_OVERRIDE_TTL_HOURS` (default 4h). Requires MFA + written justification. Dual-written to both audit logs.

---

## Layer 7: Database Security

### Row-Level Security (RLS)

All tables have RLS enabled. The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — it is only used server-side in:
- `createSupabaseAdminClient()` — for admin routes, audit writes, rate limiting
- Never exposed to the browser or client-side code

Key RLS policies:
- `deals`: contractor can only see deals where `contractor_id = auth.uid()`; funder can only see deals where `funder_id = auth.uid()`
- `milestones`: inherit deal RLS via join
- `audit_log`: readable only by admins (no user can read another user's audit entries)
- `admin_audit_log`: admin-only read/write

### SECURITY DEFINER RPCs

Critical financial mutations use Postgres functions with `SECURITY DEFINER` (run as the function owner, bypass RLS):
- `reserve_funds(deal_id, amount)` — atomically reserves milestone funds
- `release_funds(deal_id, amount)` — atomically releases and settles ledger
- `increment_funded_amount(deal_id, amount)` — processes PaymentIntent confirmation

These run in the DB process; no amount manipulation is possible from the API layer.

### Immutable Audit Log

**Tables:** `audit_log`, `admin_audit_log`

- `deny_audit_modification()` DB trigger blocks UPDATE and DELETE on both tables
- Every row contains `chain_hash = SHA-256(row_data + prev_hash)` — hash-chained for tamper evidence
- `event_sequence` is auto-incremented (not user-supplied)
- `verify_audit_chain(entity_type, entity_id)` recomputes hashes for verification

**Known limitation:** Concurrent inserts can create hash-chain branches (two rows with the same `prev_hash`). `verifyAuditChain()` detects linear breaks but not concurrent branches. Documented in migration `20260424000004_audit_log_immutability.sql:120–127`.

### DB Triggers

- `deny_audit_modification()` — blocks audit log mutation (UPDATE/DELETE)
- `handle_new_user()` — creates `profiles` row on `auth.users` insert; reads `user_metadata.role`
- `enforce_milestone_transitions()` — (if present) prevents status bypasses at DB level
- `20260425000008_reserve_release_funds_status_check` — validates deal status before fund reservation/release

---

## Webhook Security

### Stripe Webhook (`POST /api/stripe/webhook`)

- Validates `Stripe-Signature` header using `stripe.webhooks.constructEvent()` against `STRIPE_WEBHOOK_SECRET`
- Raw body read as `Buffer` before any parsing — signature is verified on the exact byte sequence Stripe signed
- Missing signature → 400 before any DB action
- Invalid signature → 400 before any DB action
- Missing `STRIPE_WEBHOOK_SECRET` → 500 (misconfiguration; no processing)
- Stripe deduplicates events by event ID; Vektrum also has `stripe_processed_events` table (migration `20260425000005`) to prevent replay

### DocuSign Webhook (`POST /api/webhooks/docusign`)

- Validates DocuSign HMAC signature against `DOCUSIGN_WEBHOOK_SECRET`
- No DB mutation before signature verification
- Void events that attempt to freeze an already-frozen deal are idempotent

---

## Partner API Key Security

**File:** `src/lib/auth/partner.ts`

- API keys are generated as 32-byte random values, hex-encoded
- Only the SHA-256 hash (`api_key_hash`) is stored in the `partners` table — plaintext is never persisted
- Plaintext is returned to admin exactly once at creation time; if lost, the key must be rotated
- All partner routes: `Authorization: Bearer <api_key>` → `SHA-256(key)` compared against stored hash
- Partner scope isolation: `deal.partner_id === partnerCtx.partnerId` enforced on every partner API call
- Key rotation: admin calls `PATCH /api/admin/partners/[partnerId]` → old hash replaced → old key immediately invalidated

---

## Dangerous Operations Inventory

Operations that, if triggered incorrectly, cause significant harm:

| Operation | Risk | Controls |
|---|---|---|
| `POST /api/milestones/[id]/release` | Real Stripe money movement | 10-condition gate, funder-only, MFA, rate limit, idempotency key |
| `POST /api/stripe/webhook` `transfer.failed` | Reverses financial settlement | Stripe signature required; atomic DB update |
| `POST /api/webhooks/docusign` `envelope-voided` | Freezes a live deal | DocuSign HMAC required; only fires if `deal_freeze_on_void = true` AND milestones released |
| `POST /api/admin/deals/[id]/unfreeze` | Resumes releases on a frozen deal | Admin + MFA + justification ≥ 20 chars; dual-write audit |
| `POST /api/admin/promote` | Grants admin role | Disabled by default; self-promotion blocked; all existing controls remain active |
| `POST /api/admin/milestones/[id]/override-ai-review` | Bypasses AI draw review | Cannot bypass `critical` risk; short TTL (4h); MFA + justification; dual-write audit |
| `SUPABASE_SERVICE_ROLE_KEY` usage | Bypasses all RLS | Server-side only; never sent to client; used in `createSupabaseAdminClient()` |
| `createSupabaseAdminClient()` | Full DB access | Only in: audit writes, rate limit, admin routes, reconciliation cron, partner webhook, admin pages |
| Reconciliation cron auto-correction (Pass 2, 4) | Modifies ledger values | Protected by `CRON_SECRET`; corrections logged to audit_log with action `ledger_drift_corrected` |

---

## Secret Exposure Points

All secrets are server-side only. None are exposed to the browser.

| Secret | Used by | Risk if leaked |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `createSupabaseAdminClient()` | Full DB access, bypasses all RLS |
| `STRIPE_SECRET_KEY` | `src/lib/stripe.ts` | Create/cancel transfers, access all Stripe data |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` | Forge Stripe events |
| `CRON_SECRET` | `/api/cron/reconcile` | Trigger reconciliation on demand |
| `DOCUSIGN_PRIVATE_KEY` | `src/lib/engine/docusign.ts` | Sign DocuSign JWTs, forge envelope operations |
| `DOCUSIGN_WEBHOOK_SECRET` | `/api/webhooks/docusign` | Forge DocuSign events (void/freeze deals) |
| `RESEND_API_KEY` | `src/lib/engine/notifications.ts` | Send email as Vektrum domain |
| `PERPLEXITY_API_KEY` | AI draw review | Billing abuse |
| `ANTHROPIC_API_KEY` | AI fallback | Billing abuse |
| `OPENAI_API_KEY` | AI fallback | Billing abuse |
| `ADMIN_ALLOWED_IPS` | `src/middleware.ts` | Leaking reveals admin IP range; not a credentials secret |
| `ADMIN_PROMOTION_ENABLED` | `/api/admin/promote` | Leaking reveals feature state; not a credentials secret |

---

## Environment Variables (Full List)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | — | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | — | Supabase anon key (public, RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Service role key (bypasses RLS — server only) |
| `NEXT_PUBLIC_APP_URL` | Yes | — | Base URL for redirect links |
| `STRIPE_SECRET_KEY` | Yes (stripe_connect rail) | — | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Yes (stripe_connect rail) | — | Stripe webhook signature secret |
| `RESEND_API_KEY` | Yes | — | Transactional email API key |
| `EMAIL_FROM` | Yes | — | Verified sender address for Resend |
| `ADMIN_EMAIL` | Yes | — | Comma-separated ops alert recipients |
| `CRON_SECRET` | Yes | — | Secret for `/api/cron/reconcile` authentication |
| `PERPLEXITY_API_KEY` | One of three required | — | Primary AI provider for draw review |
| `ANTHROPIC_API_KEY` | One of three required | — | First AI fallback |
| `OPENAI_API_KEY` | One of three required | — | Second AI fallback |
| `DOCUSIGN_INTEGRATION_KEY` | Yes (contract signing) | — | DocuSign app integration key |
| `DOCUSIGN_USER_ID` | Yes (contract signing) | — | DocuSign user UUID |
| `DOCUSIGN_ACCOUNT_ID` | Yes (contract signing) | — | DocuSign account UUID |
| `DOCUSIGN_PRIVATE_KEY` | Yes (contract signing) | — | RSA private key, base64-encoded |
| `DOCUSIGN_OAUTH_HOST` | Yes | `account-d.docusign.com` | DocuSign OAuth host (sandbox/prod) |
| `DOCUSIGN_BASE_PATH` | Yes | `https://demo.docusign.net/restapi` | DocuSign REST API base |
| `DOCUSIGN_WEBHOOK_SECRET` | Yes (contract signing) | — | HMAC secret for DocuSign webhook |
| `SLACK_WEBHOOK_URL` | No | — | Ops alerts (reconciliation, stuck transfers) |
| `ADMIN_ALLOWED_IPS` | No | — | Comma-separated CIDRs for admin IP allowlist |
| `ADMIN_PROMOTION_ENABLED` | No | `false` | Enable `POST /api/admin/promote` |
| `DEMO_RESET_ENABLED` | No | `false` | Enable `POST /api/demo/reset` in prod |
| `AI_PROVIDER_TIMEOUT_MS` | No | `10000` | Per-provider timeout before fallback (ms) |
| `AI_ADMIN_OVERRIDE_TTL_HOURS` | No | `4` | TTL for admin AI-review overrides |
| `STRIPE_TRANSFER_STUCK_HOURS` | No | `4` | Threshold for stuck transfer alert |
| `RATE_LIMIT_FINANCIAL_WRITE_MAX` | No | `5` | financial_write policy limit |
| `RATE_LIMIT_ADMIN_WRITE_MAX` | No | `20` | admin_write policy limit |
| `RATE_LIMIT_PARTNER_API_MAX` | No | `60` | partner_api policy limit |
| `RATE_LIMIT_AI_ANALYSIS_MAX` | No | `10` | ai_analysis policy limit |
| `RATE_LIMIT_AI_DRAW_REVIEW_MAX` | No | `15` | ai_draw_review policy limit |
| `RATE_LIMIT_DEAL_FUND_MAX` | No | `5` | deal_fund policy limit |
| `RATE_LIMIT_CRON_MAX` | No | `3` | cron policy limit |

**Note:** `PERPLEXITY_API_KEY` must also be set separately in Supabase Edge Function secrets (Settings → Edge Functions → Secrets) for the `analyze-contract` and `generate-dispute-brief` edge functions.

---

## Service-Role Client Usage Map

`createSupabaseAdminClient()` (bypasses RLS) is used in:

| Location | Why needed |
|---|---|
| `src/lib/engine/audit.ts` — `logAudit()` | Audit writes must bypass RLS (append-only cross-user writes) |
| `src/lib/engine/rate-limit.ts` — `checkRateLimit()` | Rate limit counters are shared across users |
| All `/api/admin/*` route handlers | Admin needs to read/write any user's data |
| `src/app/dashboard/admin/users/[userId]/page.tsx` | Server component reads any user's profile and deals |
| `src/app/api/cron/reconcile/route.ts` | Reconciliation reads all releases, deals, billing records |
| `src/app/api/partner/releases/*/route.ts` | Partner auth + release settlement cross-user |
| `src/app/api/auth/webhook/route.ts` | Auth events from Supabase trigger, not user session |
| `src/app/api/stripe/webhook/route.ts` | Stripe events are not user-scoped |
| `src/app/api/webhooks/docusign/route.ts` | DocuSign events cross-user |

---

## Known Gaps and Limitations

| Gap | Severity | Notes |
|---|---|---|
| Audit log hash-chain branching | Low | Concurrent inserts can create two rows with same `prev_hash`. `verifyAuditChain()` detects linear breaks but not concurrent branches. Documented in migration `20260424000004_audit_log_immutability.sql:120–127`. |
| Rate limiting is fail-open | Low | If `rate_limit_buckets` DB call fails, request is allowed. Auth and business logic remain active. By design. |
| `ADMIN_ALLOWED_IPS` unset = no IP restriction | Medium | Admin routes are reachable from any IP if env var is not set. Recommend setting in production. |
| No 2FA enforcement at DB level | Low | MFA is enforced at the API layer, not DB layer. Direct Supabase Dashboard access bypasses it. Mitigate by restricting Supabase Dashboard access. |
| `ADMIN_PROMOTION_ENABLED` defaults off | Low (by design) | If accidentally set to `true` in production and left on, admin creation is open to any admin-role user. Monitor this env var. |

---

## Related Docs

- `docs/system-map.md` — architecture overview and release gate conditions
- `docs/api-inventory.md` — per-route auth, rate limits, audit events
- `docs/role-permission-matrix.md` — what each role can/cannot do
- `docs/workflow-test-matrix.md` — verification priority matrix
