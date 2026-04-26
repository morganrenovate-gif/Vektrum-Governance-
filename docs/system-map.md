# Vektrum System Map

**Version:** 1.0 — April 2026
**Status:** Authoritative — derived from April 2026 codebase audit
**Source:** `/Users/adammorgan/Vektrum-Governance-`

---

## What Vektrum Is

Vektrum is **authorization infrastructure** for construction disbursements. It enforces milestone-based payment governance using a 10-condition server-side release gate, AI-assisted draw review, and an immutable hash-chained audit trail. Vektrum does not hold funds directly — payment execution runs through Stripe Connect (for automated releases) or the funder's institutional payment process (for external-rail releases).

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router (server components + API routes) |
| Database | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth (email/password + TOTP MFA) |
| Payments | Stripe Connect (for `stripe_connect` rail) |
| AI draw review | Perplexity `sonar-pro` → Anthropic `claude-sonnet-4-20250514` → OpenAI `gpt-4o` (fallback chain) |
| Email | Resend |
| Contract signing | DocuSign eSign |
| Analytics | Vercel Analytics |
| Hosting | Vercel |
| Cron | Vercel Cron (`0 * * * *`) |

---

## Architecture Overview

```
Browser / Client
    │
    ├── Public marketing pages (no auth)
    ├── Demo pages (no auth, frontend-state only)
    ├── Auth pages (Supabase session)
    └── Dashboard pages (Supabase session + role gate + MFA gate)
            │
            ├── /dashboard          ← contractor/funder home
            ├── /dashboard/admin    ← admin only (AAL2 required)
            └── /dashboard/admin/partners ← partner/API key management

Next.js API Routes
    │
    ├── /api/deals/*               ← deal + milestone lifecycle
    ├── /api/milestones/*          ← release gate + transition
    ├── /api/releases/*            ← external-rail confirm/fail
    ├── /api/partner/*             ← partner API key auth
    ├── /api/admin/*               ← admin-only mutations
    ├── /api/ai/*                  ← draw review + contract analysis
    ├── /api/stripe/*              ← Stripe Connect + webhooks
    ├── /api/webhooks/docusign     ← DocuSign envelope events
    ├── /api/auth/webhook          ← Supabase auth events
    ├── /api/cron/reconcile        ← hourly reconciliation
    └── /api/demo/reset            ← demo state signal (no-op in prod)

Supabase (Postgres)
    │
    ├── RLS policies on all tables
    ├── Immutable audit_log + admin_audit_log (hash-chained)
    ├── SECURITY DEFINER RPCs (reserve/release/increment funds)
    ├── DB triggers (enforce transitions, prevent tampering)
    └── rate_limit_buckets (server-side rate limiting)

External Services
    ├── Stripe Connect (fund escrow + transfer execution)
    ├── Perplexity / Anthropic / OpenAI (AI draw review)
    ├── Resend (transactional email)
    ├── DocuSign (contract signing + void events)
    └── Slack (ops alerts via SLACK_WEBHOOK_URL)
```

---

## User Roles

| Role | Created via | MFA required | Can release funds |
|---|---|---|---|
| `contractor` | Self-signup | No | No |
| `funder` | Self-signup | Yes (AAL2) | Yes (via release gate) |
| `admin` | Owner-controlled (`ADMIN_PROMOTION_ENABLED`) | Yes (AAL2) | No — explicitly blocked at release gate |
| Partner API key | Admin creates via `/dashboard/admin/partners` | N/A (key auth) | No — can only confirm/fail external releases |

---

## Payment Rails

| Rail | Execution | Funds held by | Stripe required |
|---|---|---|---|
| `stripe_connect` | Automated via Stripe transfer | Stripe-managed account | Yes |
| `external_manual` | Executed outside Vektrum (wire/ACH/check) | Funder's institution | No |

See `docs/payment-rails.md` for full rail lifecycle.

---

## Release Gate (10 Conditions)

All must pass simultaneously. File: `src/lib/engine/release-gate.ts`.

1. `milestone.status = 'approved'`
2. `milestone.protection_status = 'ready_for_release'`
3. Available balance ≥ milestone amount + platform fee
4. Contractor `stripe_payouts_enabled = true` *(skipped on external_manual rail)*
5. Contractor `onboarding_complete = true`
6. No existing pending/confirmed release for this milestone
7. No open change orders on this milestone
8. A signed (non-voided) contract exists for this deal
9. Sequential-release ordering satisfied (if `deal.sequential_release_required`)
10. Approved `conditional_progress` lien waiver on file (if `deal.lien_waiver_required`)

**Pre-condition (separate from numbered gate):** AI draw review must exist, be ≤ 48 hours old, and not be `risk_level = 'critical'`. Admin override (`ai_review_admin_override`) with `AI_ADMIN_OVERRIDE_TTL_HOURS` TTL (default 4h) can unblock a blocked precondition.

**Admin cannot release:** `release-gate.ts:76–84` explicitly returns `{ allowed: false }` if the caller role is `admin`.

**Frozen deal fast-path:** If `deal.status = 'frozen'` (triggered by DocuSign void-after-release), all releases are blocked before the 10-condition check.

---

## Audit Trail

- **`audit_log`**: system-wide immutable event log. `event_sequence` auto-incremented, `chain_hash` SHA-256 of row + previous hash. UPDATE/DELETE blocked by `deny_audit_modification()` DB trigger.
- **`admin_audit_log`**: admin-specific, dual-written by `requireAdminAudit()`. Includes `admin_justification` (≥ 20 chars), `authorization_reference`, `reviewed_by/at`.
- `verify_audit_chain(entity_type, entity_id)` recomputes hashes for verification.
- **Known limitation**: concurrent inserts can create hash-chain branches (two rows with same `prev_hash`). `verifyAuditChain()` detects linear breaks but not branches. Documented in `20260424000004_audit_log_immutability.sql:120–127`.

---

## Reconciliation

Hourly cron (`/api/cron/reconcile`). 6 passes:

| Pass | Checks | Auto-fixable |
|---|---|---|
| 0 | Stuck Stripe transfers (> `STRIPE_TRANSFER_STUCK_HOURS`, default 4h) | No |
| 1 | DB releases → Stripe transfers (amount + metadata) | No |
| 2 | Release → billing_record completeness | Yes (`missing_billing_record`) |
| 3 | Stripe → DB (orphaned transfers) | No |
| 4 | Deal ledger arithmetic (`released_amount`, `fees_collected`, `reserved_amount`) | Yes (`ledger_drift`, `fee_ledger_drift`) |
| 5 | `funded_amount` vs Stripe PaymentIntent history | No |
| 6 | External-rail hygiene (overdue, missing reference/proof/actor, mismatch) | No |

---

## Demo System

All demo content (`/demo-live/*`) is **frontend-state only**. No database writes. State resets on page navigation. `POST /api/demo/reset` is a no-op acknowledgment (blocked in production unless `DEMO_RESET_ENABLED=true`). Demo data defined in `src/lib/demo-data/index.ts`.

---

## Environment Variables

Full list in `docs/security-controls-map.md` and `docs/security-controls-map.md#environment-variables`. Key variables:
- `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS; never expose to client
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `ADMIN_PROMOTION_ENABLED` — defaults to false; must be explicitly enabled
- `ADMIN_ALLOWED_IPS` — optional IP allowlist for admin routes
- `CRON_SECRET` — required for reconciliation cron authentication

---

## Related Docs

| Document | Purpose |
|---|---|
| `docs/payment-rails.md` | Full rail lifecycle, schema, reconciliation details |
| `docs/route-inventory.md` | Every page with access level, data, actions |
| `docs/api-inventory.md` | Every API route with auth, rate limits, audit actions |
| `docs/workflow-test-matrix.md` | End-to-end workflow traces and test scenarios |
| `docs/role-permission-matrix.md` | What each role can and cannot do |
| `docs/security-controls-map.md` | Security controls, env vars, dangerous operations |
| `docs/pre-pilot-readiness-checklist.md` | Launch gate criteria and red team checklist |
| `docs/ai-downtime-plan.md` | AI provider failure runbook |
| `docs/api/partner-api.md` | Partner API reference |
