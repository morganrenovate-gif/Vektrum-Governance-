# Vektrum — Construction Payment Governance
### Operating Manual v3 · Updated 2026-04-24

---

## What is Vektrum?

The construction industry loses billions annually to payment disputes, draw fraud, and frozen funds. In a typical legacy scenario, a funder wires the full project amount to a contractor at deal start — when a dispute arises over one milestone, the entire capital freezes, halting work site-wide.

Vektrum replaces bulk upfront transfers with **milestone-conditional payment authorization**: capital is held by Stripe at deal creation, and each tranche releases only after passing a **10-condition server-side release gate** plus an AI precondition. Every action — from status changes to Stripe transfers to admin overrides — is written to a **hash-chained, append-only audit log** that cannot be modified or deleted.

### Core guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No release without all 10 conditions | Server-side `runReleaseGate()` — no UI bypass possible |
| No release without AI draw review | `checkAiPrecondition` runs before the 10-condition gate |
| No double-release | Condition 6 (idempotency guard) |
| No release on a voided contract | Deal freeze on void + gate hard-blocks frozen deals |
| No admin override without MFA | AAL2 check on every admin write endpoint |
| No audit manipulation | Hash-chained log + `deny_audit_modification` DB trigger (SQLSTATE 23001) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React Server Components) |
| Database + Auth | Supabase (Postgres 15, Row-Level Security, SSR auth) |
| Payments | Stripe Connect (direct contractor payouts) |
| Contract signing | DocuSign (envelope lifecycle via webhook) |
| Styling | Tailwind CSS (utility-first, dark fintech design system) |
| Language | TypeScript (strict mode throughout) |
| AI | Perplexity sonar-pro → Anthropic claude-sonnet → OpenAI gpt-4o (fallback chain) |

---

## Setup Instructions

### 1. Clone and install

```bash
git clone [your-repo-url]
cd vektrum
npm install
```

### 2. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run **all** migration files in order via **SQL Editor** or the Supabase CLI:
   ```
   supabase/migrations/
   ```
3. Copy your credentials from **Settings > API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon (public) key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Stripe setup

1. Create an account at [stripe.com](https://stripe.com)
2. Enable **Connect** under Settings > Connect
3. Copy your secret key from **Developers > API keys** → `STRIPE_SECRET_KEY`
4. Create a webhook endpoint pointing to `https://your-domain.com/api/webhooks/stripe`
5. Subscribe to these events:
   - `account.updated` — contractor onboarding / payout status changes
   - `payment_intent.succeeded` — deal funded
   - `transfer.created` — milestone payout confirmed
   - `transfer.failed` — milestone payout failed
   - `transfer.reversed` — milestone payout reversed
6. Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`

### 4. DocuSign setup

1. Create a developer account at [developers.docusign.com](https://developers.docusign.com)
2. Create an app and note your **Integration Key** and **Account ID**
3. Generate an RSA keypair; store the private key as `DOCUSIGN_PRIVATE_KEY`
4. Configure a Connect (webhook) endpoint pointing to `https://your-domain.com/api/webhooks/docusign`
5. Subscribe to these envelope events:
   - `recipient-completed`
   - `envelope-completed`
   - `envelope-voided`
   - `envelope-declined`
6. Fill in `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_WEBHOOK_SECRET`

### 5. AI providers

Draw review uses a three-provider fallback chain. Set at minimum `PERPLEXITY_API_KEY` for production; set all three to enable full fallback:

```
PERPLEXITY_API_KEY=pplx-...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

See `docs/ai-downtime-plan.md` for full failure-mode documentation.

### 6. Environment variables

```bash
cp .env.example .env.local
```

Full variable reference:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# DocuSign
DOCUSIGN_ACCOUNT_ID=...
DOCUSIGN_INTEGRATION_KEY=...
DOCUSIGN_USER_ID=...
DOCUSIGN_PRIVATE_KEY=...
DOCUSIGN_WEBHOOK_SECRET=...

# AI providers
PERPLEXITY_API_KEY=pplx-...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron auth
CRON_SECRET=...                           # shared secret Vercel sends on cron invocations

# Ops alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...  # Incoming Webhook URL (optional)
EMAIL_FROM=Vektrum <noreply@vektrum.io>   # sender address for ops alert emails
ADMIN_EMAIL=ops@vektrum.io,cto@vektrum.io # comma-separated alert recipients
RESEND_API_KEY=re_...                     # Resend API key for email delivery

# Reconciliation
RECONCILIATION_LOOKBACK_HOURS=72          # default: 72; overrides the 7-day default window

# Optional
AI_ADMIN_OVERRIDE_TTL_HOURS=4   # default: 4, min: 1
```

### 7. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 8. Create test users

1. **Contractor** — Sign up at `/auth/signup`, select "Contractor"
2. **Funder** — Sign up at `/auth/signup`, select "Funder"
3. **Admin** — Sign up normally, then in **Supabase Dashboard > Table Editor > profiles** set `role = 'admin'`. Admin is never self-selectable.

---

## System Architecture

### Role separation

| Role | Capabilities |
|------|-------------|
| **Contractor** | Create deals, add milestones, upload contract, start/submit milestone work |
| **Funder** | Fund deals, approve/reject milestones, trigger releases |
| **Admin** | Read all deals + audit logs; issue AI overrides (AAL2 required); unfreeze deals (AAL2 required); access Ops Dashboard |

> **Important:** Admins cannot release funds directly. The release is always triggered by the deal funder. Admin write actions require AAL2 MFA in the current session.

---

### Deal state machine

```
draft
  └─► active          (funder funds the deal)
        ├─► in_progress   (milestone work begins)
        ├─► completed     (all milestones released)
        ├─► disputed      (milestone dispute raised)
        │     └─► active  (dispute resolved)
        ├─► frozen        (contract voided after ≥1 release has occurred)
        │     └─► [prior] (admin unfreezes — restores frozen_from_status)
        └─► cancelled
```

**Frozen state** is set automatically by the DocuSign webhook handler when an `envelope-voided` or `envelope-declined` event arrives for a deal that already has at least one released milestone. This prevents any further releases on a deal whose signed agreement no longer exists. Only an admin with AAL2 MFA can unfreeze (`POST /api/admin/deals/:dealId/unfreeze`) after providing a written justification.

---

### Milestone state machine

```
not_started
  └─► in_progress         (contractor starts work)
        └─► ready_for_review  (contractor submits draw request)
              ├─► approved        (funder approves)
              │     └─► released  (funder releases payment — all gate conditions met)
              ├─► in_progress     (funder requests changes)
              └─► disputed
```

---

### The 10-condition release gate

`src/lib/engine/release-gate.ts` — `runReleaseGate()`

Before the gate runs, **`checkAiPrecondition()`** must pass (see below). If the deal is `frozen`, the gate returns an error immediately without checking any conditions.

All 10 conditions are evaluated atomically in a single server call:

| # | Condition | What it checks |
|---|-----------|---------------|
| 1 | **Milestone approved** | `milestone.status === 'approved'` |
| 2 | **Protection ready** | `milestone.protection_status === 'ready_for_release'` |
| 3 | **Sufficient funded balance** | Funded balance ≥ milestone amount |
| 4 | **Stripe payouts enabled** | `contractor.stripe_payouts_enabled === true` |
| 5 | **Contractor onboarding complete** | `contractor.onboarding_complete === true` |
| 6 | **No existing release** | No non-voided release row exists for this milestone |
| 7 | **No open change orders** | Zero unresolved change orders on the deal |
| 8 | **Signed contract** | A non-voided contract row exists for the deal |
| 9 | **Sequential ordering** | All prior-ordered milestones are in `released` status |
| 10 | **Approved lien waiver** | A conditional lien waiver is on file for this milestone |

Every condition failure returns a human-readable error string. The `ReleaseButton` component surfaces all unmet conditions so the funder knows exactly what is blocking.

---

### AI precondition & multi-provider chain

`src/lib/engine/release-gate.ts` — `checkAiPrecondition()`

An AI draw review must exist and be valid before the 10-condition gate runs. A review is valid when:
- `risk_level !== 'critical'`
- The review was written less than **48 hours** ago

**Draw review provider chain** (first successful response wins):

| Order | Provider | Model |
|-------|----------|-------|
| 1 | Perplexity | `sonar-pro` |
| 2 | Anthropic | `claude-sonnet-4-20250514` |
| 3 | OpenAI | `gpt-4o` |

**Malformed AI response** → synthetic assessment with `risk_level: 'critical'`, `score: 0`, `recommendation: 'hold'`. This **blocks** the release rather than silently passing — a deliberate security choice.

Contract analyzer and platform assistant use Perplexity only and are not on the release path.

Full failure-mode runbook: `docs/ai-downtime-plan.md`.

---

### Contract enforcement (DocuSign)

`src/app/api/webhooks/docusign/route.ts`

| Webhook event | Action |
|---------------|--------|
| `recipient-completed` | Early-return (individual signer step, not yet fully executed) |
| `envelope-completed` | Mark contract `status = 'signed'`; log `contract_signed` |
| `envelope-voided` | Mark contract `status = 'voided'`; run `freezeDealIfReleasesExist()` |
| `envelope-declined` | Mark contract `status = 'voided'` with decliner metadata; run freeze check |

**Contract uniqueness** — a partial unique index (`contracts_deal_active_unique`) prevents two active contracts per deal while allowing a new contract to be uploaded after a void:

```sql
CREATE UNIQUE INDEX contracts_deal_active_unique
  ON public.contracts (deal_id)
  WHERE status NOT IN ('voided');
```

**Release gate condition 8** queries only non-voided contracts, so a voided contract does not satisfy the gate.

---

### Deal freeze on void

When `freezeDealIfReleasesExist()` fires on `envelope-voided` or `envelope-declined`:

1. Checks for any milestone with `status = 'released'` on the deal.
2. If found — captures `deal.status` as `frozen_from_status`, sets `deal.status = 'frozen'` and `deal_freeze_on_void = true`.
3. Writes an `admin_audit_log` entry: `contract_voided_with_releases`.

The frozen banner on the deal detail page (`/dashboard/deals/:dealId`) shows:
- **Funder/Contractor view**: contact support email
- **Admin view**: the unfreeze API endpoint path for direct action

**Unfreeze endpoint**: `POST /api/admin/deals/:dealId/unfreeze`
- Requires: admin role + AAL2 MFA + `justification` (≥ 20 characters) + `restore_status` (optional override of `frozen_from_status`)
- Returns 409 if the deal is not frozen
- Dual-writes `admin_unfreeze_deal` to the admin audit log

---

### Audit log

`audit_log` table — append-only, hash-chained.

- Every state transition, payment event, and admin action writes an entry.
- Each entry contains: `entity_type`, `entity_id`, `action`, `actor_id`, `created_at`, `metadata` JSON, `previous_hash`, `entry_hash`.
- A `deny_audit_modification` DB trigger fires `RAISE EXCEPTION SQLSTATE '23001'` on any UPDATE or DELETE. There is no application-level path to modify audit entries.

---

### Admin audit log

`admin_audit_log` table — separate from the operational audit log; covers privileged write actions only.

Captured events include:

| Action | Trigger |
|--------|---------|
| `ai_review_admin_override` | Admin overrides AI precondition |
| `admin_unfreeze_deal` | Admin unfreezes a frozen deal |
| `contract_voided_with_releases` | DocuSign void fires with existing releases |
| `release_gate_override` | Admin overrides a gate condition (future) |

Fields: `actor_id`, `actor_role`, `actor_name`, `actor_email`, `admin_justification`, `authorization_reference`, `reviewed_by`, `reviewed_at`, `ip_address`, `old_values`, `new_values`, `metadata`.

The **Admin Audit Log panel** on the Ops Dashboard requires four-eyes review: entries without `reviewed_by` are flagged as "unreviewed."

---

### Ops Dashboard

`/dashboard/admin/ops` — admin-only, read-only monitoring.

Panels:

| Panel | What it surfaces |
|-------|-----------------|
| **Summary strip** | Stuck approvals, failed payouts, webhook health, open disputes |
| **Search** | Full-text across deals, users, and Stripe transfers |
| **Alert Feed** | All active operational signals sorted by severity (critical → high → medium → low) |
| **Release Health** | Milestones stuck in `approved` > 4 h; milestones with `payout_failed` status |
| **Webhook Health** | Stale pending transfers; last Stripe webhook timestamp; feed silence alerts |
| **Admin Audit Log** | Last 20 privileged write actions; unreviewed-count badge |

API routes powering the dashboard (`/api/admin/ops/*`) require admin role + AAL2 MFA. The page server-component forwards session cookies on its internal loopback fetches.

---

### Settings

`/dashboard/settings`

| Tab | Contents |
|-----|----------|
| **Profile** | Name, company, avatar |
| **Stripe Connect** | Link/unlink Stripe account (contractors only) |
| **Security** | Password change, MFA management |
| **Danger Zone** | Account deletion request (routes to support email) |

---

## Security model

### Authentication levels

- **Standard (AAL1)** — email link or password sign-in. Required for all authenticated routes.
- **MFA (AAL2)** — TOTP second factor. **Required** for all admin write actions. Non-MFA admin sessions are rejected at the middleware level with a 403.

### Row Level Security

All tables have RLS enabled. Key policies:

- **Deals**: visible only to their `contractor_id` and `funder_id` (plus admin via service role).
- **Milestones**: visible to deal participants only.
- **Audit log**: readable by deal participants; writable only by service role.
- **Admin audit log**: readable and writable by service role only.

### Audit log tamper protection

```sql
CREATE OR REPLACE FUNCTION deny_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION SQLSTATE '23001'
    USING MESSAGE = 'Audit log entries are immutable.';
END;
$$ LANGUAGE plpgsql;
```

This trigger fires on UPDATE and DELETE on both `audit_log` and `admin_audit_log`. No application-level path, migration, or role can bypass it without dropping the trigger first — which would itself be visible in Supabase's database event log.

---

## Reconciliation engine

`src/lib/engine/reconciliation.ts` — `runReconciliation(options)`

Runs five detection passes that compare the Vektrum database against live Stripe data and flag discrepancies as `reconciliation_issues` rows. Each issue is deduplicated by a stable `dedup_key` so re-runs update existing open issues rather than inserting duplicates.

### Detection passes

| Pass | Direction | What it detects |
|------|-----------|----------------|
| 1 | DB → Stripe | DB releases that have no matching Stripe transfer (`orphaned_transfer`, `amount_mismatch`, `metadata_mismatch`) |
| 2 | Billing records | Releases with no corresponding `billing_records` row (`missing_billing_record`) |
| 3 | Stripe → DB | Stripe transfers with no DB release (`stripe_transfer_not_found`) |
| 4 | Ledger arithmetic | `deal.released_amount` or `deal.fees_collected` does not match constituent rows (`ledger_drift`, `fee_ledger_drift`) |
| 5 | Funding confirmation | DB `funded_amount` vs sum of bank-confirmed Stripe PaymentIntents (`funding_phantom_balance`, `funding_missing_webhook`) |

### Lookback window

The reconciliation window defaults to **72 hours** and is controlled by three sources in priority order:

1. `windowHours` option passed to `runReconciliation()` directly
2. `RECONCILIATION_LOOKBACK_HOURS` environment variable
3. `windowDays` option (legacy; converted to hours) — fallback default is 7 days

Pass 5 applies the same window to PaymentIntent results (Stripe Search does not support date-range filters on metadata queries; results are filtered by `pi.created` after fetching).

### Issue severities

| Severity | Issue types |
|----------|------------|
| `critical` | `orphaned_transfer`, `missing_stripe_id`, `amount_mismatch`, `ledger_drift`, `funding_phantom_balance` |
| `high` | `stripe_transfer_not_found`, `missing_billing_record`, `fee_ledger_drift`, `funding_missing_webhook` |
| `medium` | `metadata_mismatch` |

### Auto-fixable issues

`ledger_drift`, `fee_ledger_drift`, and `missing_billing_record` can be auto-fixed from the Ops Dashboard (admin only). All other types require manual investigation.

---

## Operational alerting

`src/lib/engine/alerts.ts` — `sendSlackAlert(payload)`  
`src/lib/engine/notifications.ts` — `sendAdminAlert(opts)`

### Slack alerting (`alerts.ts`)

Structured Slack messages via Incoming Webhook (Block Kit + colour-coded `attachments` sidebar):

| Severity | Sidebar colour | When sent |
|----------|---------------|-----------|
| `critical` | Red `#EF4444` | Every occurrence — no batching |
| `warning` | Amber `#F59E0B` | Every occurrence via Slack; email is batched (see below) |

Each message includes: severity header with emoji, description, metadata fields, and a dashboard deep-link button (deal page or Ops Dashboard). Transport uses **exponential backoff** — 3 attempts at 1 s → 2 s → 4 s. Never throws; silently no-ops if `SLACK_WEBHOOK_URL` is not set.

### Admin email alerting (`notifications.ts`)

`sendAdminAlert()` sends HTML ops-alert emails to all `ADMIN_EMAIL` recipients via Resend:

- **Critical**: always sent immediately, no deduplication.
- **Warning**: module-level `Map<string, number>` tracks last-sent timestamp per `batchKey`. At most one warning email of each type is sent per hour per process. `batchKey` defaults to the alert title; set it explicitly (e.g. `'funding_phantom_balance'`) to batch by issue type rather than per-entity message.

---

## Cron job — hourly reconciliation

`/api/cron/reconcile` — `vercel.json` schedule: `0 * * * *` (every hour on the hour)

> **Note**: Sub-daily cron frequency requires the **Vercel Pro** plan.

Each invocation runs four phases in sequence:

### Phase 1 — Stuck-run detection

Queries `reconciliation_runs` for any row with `status = 'running'` and `created_at < NOW() - 2 hours`. For each stuck run:
- Updates `status → 'failed'` with an explanatory `error_message`
- Fires a **critical** Slack + email alert: `"Stuck reconciliation run detected"`

### Phase 2 — Reconciliation passes

Calls `runReconciliation({ windowHours })` where `windowHours` is read from `RECONCILIATION_LOOKBACK_HOURS` (default 72). Runs all five detection passes.

### Phase 3 — New-findings alerting

After the run completes, queries for issues that are:
- `run_id = currentRunId`
- `created_at >= runStart` — identifies first detection (upserts preserve the original `created_at`, so re-detected issues from prior runs do not satisfy this condition)
- `severity IN ('critical', 'high')`
- `status IN ('open', 'acknowledged')`

For each new finding, fires a per-issue Slack + email alert. Warning emails are batched by `issue_type` (one per hour per type).

### Phase 4 — SLA escalation

Queries for issues with `severity = 'critical'`, `status IN ('open', 'acknowledged')`, and `created_at < NOW() - 1 hour`. For each overdue issue fires a **critical** escalation:

```
UNRESOLVED CRITICAL: [issue_type] for [deal_id or entity]
```

Each overdue issue gets its own `batchKey` (`sla_escalation:<issue_id>`), so escalations fire on every cron invocation until the issue is resolved.

---

## Key API routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/webhooks/stripe` | POST | Stripe signature | Stripe event ingestion |
| `/api/webhooks/docusign` | POST | DocuSign signature | DocuSign envelope events |
| `/api/ai/draw-review` | POST | Authenticated user | Request AI draw review |
| `/api/admin/ops/alerts` | GET | Admin + AAL2 | Aggregated ops alert feed |
| `/api/admin/ops/release-health` | GET | Admin + AAL2 | Stuck releases + failed payouts |
| `/api/admin/ops/webhook-health` | GET | Admin + AAL2 | Stripe webhook pipeline health |
| `/api/admin/ops/search` | GET | Admin + AAL2 | Full-text ops search |
| `/api/admin/milestones/:id/override-ai-review` | POST | Admin + AAL2 | Emergency AI precondition override |
| `/api/admin/deals/:id/unfreeze` | POST | Admin + AAL2 | Unfreeze a contract-voided deal |
| `/api/cron/reconcile` | GET/POST | `CRON_SECRET` bearer | Hourly reconciliation cron (Vercel) |

---

## Database migrations

All migrations live in `supabase/migrations/` and must be run in filename order. Key recent migrations:

| File | What it adds |
|------|-------------|
| `20260424000010_contract_uniqueness.sql` | Partial unique index on active contracts; `deal_freeze_on_void`, `frozen_from_status` columns; `frozen` deal status enum value |

Run against a local Supabase instance:

```bash
supabase db reset   # applies all migrations from scratch
# or incrementally:
supabase db push
```

Run against production:

```bash
supabase db push --db-url postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

---

## Deployment

### Vercel (recommended)

1. Push your repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Add **all** environment variables from the reference above in the Vercel dashboard
4. Deploy

After deployment, update webhook endpoint URLs in Stripe and DocuSign dashboards to your production domain.

### Environment variable checklist

Before going live, confirm these are set in your production environment:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `DOCUSIGN_ACCOUNT_ID`
- [ ] `DOCUSIGN_INTEGRATION_KEY`
- [ ] `DOCUSIGN_USER_ID`
- [ ] `DOCUSIGN_PRIVATE_KEY`
- [ ] `DOCUSIGN_WEBHOOK_SECRET`
- [ ] `PERPLEXITY_API_KEY`
- [ ] `ANTHROPIC_API_KEY` _(recommended — draw review fallback)_
- [ ] `OPENAI_API_KEY` _(recommended — draw review fallback)_
- [ ] `NEXT_PUBLIC_APP_URL` _(must be the production domain)_
- [ ] `CRON_SECRET` _(required in production — Vercel cron auth token)_
- [ ] `RESEND_API_KEY` _(required for ops alert emails)_
- [ ] `ADMIN_EMAIL` _(comma-separated ops alert recipient addresses)_
- [ ] `SLACK_WEBHOOK_URL` _(recommended — Slack Incoming Webhook for real-time alerts)_
- [ ] `RECONCILIATION_LOOKBACK_HOURS` _(optional — default 72)_

---

## Related documents

| Document | Location |
|----------|----------|
| AI downtime plan | `docs/ai-downtime-plan.md` |
| Security audit report | `SECURITY_AUDIT_REPORT.md` |
| Design system | `.claude/design-system.md` |
| Pitch deck (web) | `/pitch` route |
| Pitch deck (PDF) | `public/vektrum-pitch.pdf` |

---

## Changelog

| Version | Date | Summary |
|---------|------|---------|
| v3 | 2026-04-24 | Reconciliation hardening: hourly Vercel cron (`0 * * * *`); `src/lib/engine/alerts.ts` — Slack Block Kit alerting with exponential backoff retry; `sendAdminAlert` in `notifications.ts` — HTML email with warning batching (1/hr/type via in-process Map); cron route rewrite — stuck-run detection + mark-failed, `RECONCILIATION_LOOKBACK_HOURS` env var (default 72 h), new-findings alerting (first-detection via `created_at >= runStart`), SLA escalation for unresolved critical issues > 1 h; `windowHours` option added to `ReconciliationRunOptions`; Pass 5 window applied to PaymentIntent results |
| v2 | 2026-04-24 | 10-condition gate; AI multi-provider chain; DocuSign webhook + contract enforcement; deal freeze on void; admin unfreeze endpoint; partial unique index on contracts; frozen deal state; contract status display on deal page; admin audit log + Ops Dashboard; ops API cookie-forwarding fix; Ops Dashboard dark background fix; settings contrast fixes; admin dashboard button contrast fixes; pitch deck (web + PDF) |
| v1 | _(initial)_ | 4-condition release gate; basic Stripe Connect; simple audit log |
