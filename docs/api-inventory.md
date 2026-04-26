# Vektrum API Inventory

**Version:** 1.0 — April 2026
**Status:** Authoritative — derived from April 2026 codebase audit
**Source:** `/Users/adammorgan/Vektrum-Governance-`

---

## Auth Conventions

Every authenticated route follows this order:
1. `getAuthUser(request)` — validates Supabase session cookie → `{ user, profile }` or 401
2. `requireRole(profile, ...)` — checks `profile.role` → 403 if wrong role
3. `requireMFA(supabase, profile)` — verifies AAL2 for roles that require it → 403 if not
4. Rate limit check → 429 if exceeded
5. Body/parameter validation → 400 if invalid
6. Business logic → DB writes → audit log

**Partner API routes** use `requirePartnerAuth(request)` (Bearer token, SHA-256 hash vs `partners.api_key_hash`) instead of cookie-based auth.

**Webhook routes** (`/api/stripe/webhook`, `/api/webhooks/docusign`) use signature verification instead of session auth.

**Cron routes** use `CRON_SECRET` header verification.

---

## Rate Limit Policies

All limits are per authenticated user (keyed by `user.id`) unless noted. Configurable via env vars.

| Policy name | Default limit | Window | Used by |
|---|---|---|---|
| `financial_write` | 5 req | 60 s | release, authorize-external, confirm-external, mark-failed |
| `admin_write` | 20 req | 60 s | all `/api/admin/*` write routes |
| `partner_api` | 60 req | 60 s | all `/api/partner/*` routes (keyed by partner ID) |
| `ai_analysis` | 10 req | 3600 s | `/api/analyze-contract`, `/api/assistant` |
| `ai_draw_review` | 15 req | 300 s | `/api/ai/draw-review` |
| `deal_fund` | 5 req | 300 s | `/api/deals/[dealId]/fund` |
| `cron` | 3 req | 60 s | `/api/cron/reconcile` |

**Fail-open policy:** if the rate-limit DB call fails, the request is allowed. Rate limiting is best-effort; auth and business logic are the primary controls.

---

## Deal Routes

### `GET /api/deals`
- **Auth:** session | **Role:** any | **MFA:** no | **Rate limit:** none
- **Purpose:** List deals for the caller. Contractor → own deals. Funder → own deals. Admin → all deals.
- **DB tables:** `deals` (RLS-filtered for contractor/funder; admin sees all)
- **Audit:** none

### `POST /api/deals`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** none
- **Purpose:** Create a new deal.
- **Body:** `{ title, description, total_amount, contractor_id?, sequential_release_required?, lien_waiver_required?, billing_rate_bps?, payment_rail? }`
- **DB tables:** `deals` (insert), `audit_log`
- **Audit:** `deal_created`

### `GET /api/deals/[dealId]`
- **Auth:** session | **Role:** any (deal participant or admin) | **MFA:** no | **Rate limit:** none
- **Purpose:** Fetch full deal detail including milestones, releases, contract status.
- **Auth check:** `requireDealAccess(profile, deal)` — contractor/funder must be a participant.
- **DB tables:** `deals`, `milestones`, `releases`, `contracts`, `change_orders`, `lien_waivers`
- **Audit:** none

### `PATCH /api/deals/[dealId]`
- **Auth:** session | **Role:** funder (deal owner) | **MFA:** yes | **Rate limit:** none
- **Purpose:** Update deal metadata (title, description, settings).
- **DB tables:** `deals`, `audit_log`
- **Audit:** `deal_updated`

### `GET /api/deals/[dealId]/readiness`
- **Auth:** session | **Role:** funder (deal owner) | **MFA:** no | **Rate limit:** none
- **Purpose:** Returns structured readiness report: which milestones are release-ready, which are blocked and why.
- **DB tables:** `deals`, `milestones`, `releases`, `contracts`, `lien_waivers`
- **Audit:** none

### `POST /api/deals/[dealId]/fund`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** `deal_fund` (5/300 s)
- **Purpose:** Fund a deal by creating a Stripe PaymentIntent and reserving the amount.
- **DB tables:** `deals` (update funded_amount via SECURITY DEFINER RPC), `audit_log`
- **Audit:** `deal_funded`
- **Risk:** Stripe PaymentIntent creation — amount passed to Stripe must equal `deal.total_amount`.

### `GET /api/deals/[dealId]/billing`
- **Auth:** session | **Role:** funder (deal owner) | **MFA:** no | **Rate limit:** none
- **Purpose:** Billing records for a deal.
- **DB tables:** `billing_records`
- **Audit:** none

### `GET /api/deals/[dealId]/billing/export`
- **Auth:** session | **Role:** funder | **MFA:** no | **Rate limit:** none
- **Purpose:** CSV export of billing records.
- **DB tables:** `billing_records`
- **Audit:** none

### `GET /api/deals/[dealId]/audit/export`
- **Auth:** session | **Role:** admin | **MFA:** yes | **Rate limit:** none
- **Purpose:** CSV export of audit_log entries for a specific deal.
- **DB tables:** `audit_log`
- **Audit:** none

### `GET /api/deals/[dealId]/contract`
- **Auth:** session | **Role:** deal participant or admin | **MFA:** no | **Rate limit:** none
- **Purpose:** Fetch contract metadata and signing status.
- **DB tables:** `contracts`
- **Audit:** none

### `POST /api/deals/[dealId]/contract`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** none
- **Purpose:** Upload/create a contract for signing via DocuSign.
- **DB tables:** `contracts`, `audit_log`
- **Audit:** `contract_created`

### `POST /api/deals/[dealId]/contract/sign`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** none
- **Purpose:** Trigger DocuSign envelope send for the deal contract.
- **DB tables:** `contracts`, `audit_log`
- **Audit:** `contract_signing_initiated`

### `POST /api/deals/[dealId]/retainage/release`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** `financial_write`
- **Purpose:** Release held retainage at project completion.
- **DB tables:** `deals`, `releases`, `billing_records`, `audit_log`
- **Audit:** `retainage_released`

---

## Milestone Routes

### `GET /api/deals/[dealId]/milestones`
- **Auth:** session | **Role:** deal participant or admin | **MFA:** no | **Rate limit:** none
- **Purpose:** List all milestones for a deal.
- **DB tables:** `milestones`

### `POST /api/deals/[dealId]/milestones`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** none
- **Purpose:** Create a new milestone on an existing deal.
- **DB tables:** `milestones`, `audit_log`
- **Audit:** `milestone_created`

### `POST /api/milestones/[milestoneId]/transition`
- **Auth:** session | **Role:** contractor or funder (role enforced by state machine) | **MFA:** no | **Rate limit:** none
- **Purpose:** Transition milestone status per the state machine.
- **State machine:** `src/lib/engine/state-machine.ts`. The `approved → released` transition is **system-only** — blocked here; use `/release` instead.
- **Legal transitions:**
  - `not_started → in_progress` (contractor)
  - `in_progress → ready_for_review` (contractor)
  - `ready_for_review → approved` (funder)
  - `ready_for_review → in_progress` (funder — sends back)
- **DB tables:** `milestones`, `audit_log`
- **Audit:** `milestone_status_changed`

### `POST /api/milestones/[milestoneId]/release` ⚠️ CRITICAL
- **Auth:** session | **Role:** funder only (admin explicitly blocked) | **MFA:** yes (AAL2) | **Rate limit:** `financial_write` (5/60 s)
- **Purpose:** The critical payment-release endpoint. Passes the 10-condition gate + AI precondition, then executes a Stripe Connect transfer.
- **Pre-condition:** AI draw review must exist, be ≤ 48 hours old, and not be `risk_level = 'critical'`.
- **Gate:** `validateRelease()` in `src/lib/engine/release-gate.ts` — all 10 conditions checked in a single pass.
- **Idempotency:** Stripe transfer uses `idempotencyKey = milestoneId`.
- **Safety:** Stripe transfer happens BEFORE DB writes. If DB write fails after a successful transfer, 500 is returned with Stripe transfer ID for reconciliation.
- **DB tables:** `milestones` (status → released), `releases` (insert), `deals` (update ledger via SECURITY DEFINER RPC), `billing_records`, `audit_log`
- **Audit:** `milestone_released`, `billing_record_created`

### `POST /api/milestones/[milestoneId]/release/retry`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** `financial_write`
- **Purpose:** Retry a `payout_failed` milestone. Resets to `approved` and re-triggers release gate.
- **DB tables:** `milestones`, `releases`, `audit_log`
- **Audit:** `milestone_release_retried`

### `POST /api/milestones/[milestoneId]/authorize-external`
- **Auth:** session | **Role:** funder only | **MFA:** yes | **Rate limit:** `financial_write`
- **Purpose:** Authorize an external-rail release (creates a `pending` release record for external execution). Also passes the 10-condition gate.
- **DB tables:** `milestones`, `releases`, `audit_log`
- **Audit:** `external_release_authorized`

### `POST /api/milestones/[milestoneId]/documents`
- **Auth:** session | **Role:** contractor (deal participant) | **MFA:** no | **Rate limit:** none
- **Purpose:** Upload supporting documents for a milestone draw request.
- **DB tables:** `milestone_documents`
- **Audit:** `milestone_document_uploaded`

### `POST /api/deals/[dealId]/milestones/[milestoneId]/lien-waiver`
- **Auth:** session | **Role:** contractor | **MFA:** no | **Rate limit:** none
- **Purpose:** Upload a lien waiver for a milestone.
- **DB tables:** `lien_waivers`
- **Audit:** `lien_waiver_uploaded`

---

## Release Routes

### `POST /api/releases/[releaseId]/confirm-external`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** `financial_write`
- **Purpose:** Funder confirms that external payment (wire/ACH/check) was executed. Settles ledger.
- **Body:** `{ payment_method, payment_reference, executed_at?, notes?, proof_document_id? }`
- **DB tables:** `releases`, `deals` (update ledger), `billing_records`, `audit_log`
- **Audit:** `external_release_confirmed`

### `POST /api/releases/[releaseId]/mark-external-failed`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** `financial_write`
- **Purpose:** Marks an external release as failed; reverses reservation.
- **DB tables:** `releases`, `milestones`, `deals` (reverse reservation), `audit_log`
- **Audit:** `external_release_failed`

### `GET /api/releases/[releaseId]/receipt`
- **Auth:** session | **Role:** funder (deal owner) | **MFA:** no | **Rate limit:** none
- **Purpose:** Fetch transaction receipt for a release.
- **DB tables:** `releases`, `billing_records`, `transaction_receipts`
- **Audit:** none

### `POST /api/releases/[releaseId]/receipt/resend`
- **Auth:** session | **Role:** funder | **MFA:** no | **Rate limit:** none
- **Purpose:** Resend receipt email via Resend.
- **External:** Resend API
- **Audit:** `receipt_email_resent`

---

## Partner API Routes

All partner routes authenticate via `Authorization: Bearer <api_key>` — SHA-256 hashed and compared against `partners.api_key_hash`. No session cookies.

### `GET /api/partner/releases/[releaseId]`
- **Auth:** partner API key | **Rate limit:** `partner_api` (60/60 s, keyed by partner ID)
- **Purpose:** Get status of a specific external release. Partner must own the deal (`deal.partner_id === partnerCtx.partnerId`).
- **DB tables:** `releases`, `deals`

### `POST /api/partner/releases/[releaseId]/confirm`
- **Auth:** partner API key | **Rate limit:** `partner_api`
- **Purpose:** Machine-to-machine equivalent of confirm-external. Partner execution system records that payment was sent.
- **Body:** `{ payment_method, payment_reference, executed_at?, notes?, proof_document_id? }`
- **DB tables:** `releases`, `deals`, `billing_records`, `audit_log`
- **Audit:** `partner_external_release_confirmed`
- **Idempotency:** Already-confirmed releases return `200 { alreadyConfirmed: true }`.

### `POST /api/partner/releases/[releaseId]/fail`
- **Auth:** partner API key | **Rate limit:** `partner_api`
- **Purpose:** Partner reports that execution failed.
- **DB tables:** `releases`, `milestones`, `deals`, `audit_log`
- **Audit:** `partner_external_release_failed`

---

## Lien Waiver Routes

### `POST /api/lien-waivers/[waiverId]/approve`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** none
- **Purpose:** Approve a conditional_progress lien waiver.
- **DB tables:** `lien_waivers`, `audit_log`
- **Audit:** `lien_waiver_approved`

### `POST /api/lien-waivers/[waiverId]/reject`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** none
- **Purpose:** Reject a lien waiver (sends back for revision).
- **DB tables:** `lien_waivers`, `audit_log`
- **Audit:** `lien_waiver_rejected`

### `POST /api/lien-waivers/[waiverId]/upload`
- **Auth:** session | **Role:** contractor | **MFA:** no | **Rate limit:** none
- **Purpose:** Upload revised lien waiver document.
- **DB tables:** `lien_waivers`
- **Audit:** `lien_waiver_uploaded`

---

## Change Order Routes

### `POST /api/change-orders`
- **Auth:** session | **Role:** contractor or funder | **MFA:** no | **Rate limit:** none
- **Purpose:** Create a change order on a milestone.
- **DB tables:** `change_orders`, `audit_log`
- **Audit:** `change_order_created`
- **Gate effect:** Open change orders block milestone release (Condition 7 of release gate).

### `PATCH /api/change-orders/[changeOrderId]`
- **Auth:** session | **Role:** funder (to approve/reject) | **MFA:** no | **Rate limit:** none
- **Purpose:** Approve or reject a change order.
- **DB tables:** `change_orders`, `milestones` (update amount if approved), `audit_log`
- **Audit:** `change_order_approved` or `change_order_rejected`

---

## Dispute Routes

### `POST /api/disputes`
- **Auth:** session | **Role:** contractor or funder | **MFA:** no | **Rate limit:** none
- **Purpose:** Open a dispute on a milestone.
- **DB tables:** `disputes`, `milestones` (status → disputed), `audit_log`
- **Audit:** `dispute_opened`

### `POST /api/disputes/[disputeId]/resolve`
- **Auth:** session | **Role:** admin | **MFA:** yes | **Rate limit:** `admin_write`
- **Purpose:** Admin resolves a dispute with outcome and justification.
- **DB tables:** `disputes`, `milestones`, `audit_log`, `admin_audit_log`
- **Audit:** `dispute_resolved` (dual-write)

---

## Invite Routes

### `POST /api/invites`
- **Auth:** session | **Role:** funder (for contractor invite) | **MFA:** no | **Rate limit:** none
- **Purpose:** Funder invites a contractor to a deal by email. Creates an invite token.
- **DB tables:** `invites`, `audit_log`
- **External:** Resend (invite email)
- **Audit:** `invite_created`

### `GET /api/invites/[token]`
- **Auth:** none | **Rate limit:** none
- **Purpose:** Validate invite token and return invite metadata.
- **DB tables:** `invites`

### `POST /api/invites/[token]/accept`
- **Auth:** session (invitee) | **MFA:** no | **Rate limit:** none
- **Purpose:** Accept invite — links invitee to the deal as contractor.
- **DB tables:** `invites`, `deals`, `audit_log`
- **Audit:** `invite_accepted`

---

## Onboarding Route

### `POST /api/onboarding`
- **Auth:** session | **Role:** contractor | **MFA:** no | **Rate limit:** none
- **Purpose:** Mark contractor onboarding complete (`onboarding_complete = true`).
- **DB tables:** `profiles`, `audit_log`
- **Audit:** `contractor_onboarding_complete`

---

## AI Routes

### `POST /api/ai/draw-review`
- **Auth:** session | **Role:** funder | **MFA:** yes | **Rate limit:** `ai_draw_review` (15/300 s)
- **Purpose:** Trigger AI-assisted milestone draw review. Provider chain: Perplexity `sonar-pro` → Anthropic `claude-sonnet-4-20250514` → OpenAI `gpt-4o`.
- **Pre-condition for release:** Result must exist, be ≤ 48 hours old, and `risk_level ≠ 'critical'`.
- **DB tables:** `ai_draw_reviews`, `audit_log`
- **Audit:** `ai_draw_review_completed`

### `POST /api/analyze-contract`
- **Auth:** session | **Role:** any | **MFA:** no | **Rate limit:** `ai_analysis` (10/3600 s)
- **Purpose:** AI-assisted contract analysis (Perplexity or fallback).
- **External:** Perplexity / Anthropic / OpenAI (+ Supabase Edge Function `analyze-contract`)
- **Audit:** none

### `POST /api/assistant`
- **Auth:** session | **Role:** any | **MFA:** no | **Rate limit:** `ai_analysis`
- **Purpose:** Conversational AI assistant (deal/milestone context).
- **External:** AI provider chain
- **Audit:** none

---

## Stripe Routes

### `POST /api/stripe/connect`
- **Auth:** session | **Role:** contractor | **MFA:** no | **Rate limit:** none
- **Purpose:** Initiate Stripe Connect onboarding — returns Stripe account link URL.
- **External:** Stripe Connect API
- **DB tables:** `profiles` (update `stripe_account_id`)
- **Audit:** `stripe_connect_initiated`

### `GET /api/stripe/diagnose`
- **Auth:** session | **Role:** contractor | **MFA:** no | **Rate limit:** none
- **Purpose:** Returns Stripe account status for the contractor (payouts enabled, requirements).
- **External:** Stripe API (account retrieve)
- **DB tables:** none

### `POST /api/stripe/webhook`
- **Auth:** Stripe signature (`STRIPE_WEBHOOK_SECRET`) | **No session**
- **Purpose:** Handle Stripe events.
- **Events handled:**
  - `account.updated` → update `stripe_payouts_enabled` on contractor profile
  - `payment_intent.succeeded` → confirm deal funding (update `funded_amount`)
  - `transfer.succeeded` → mark release `confirmed`, mark receipt `confirmed`
  - `transfer.failed` → mark release/milestone `payout_failed`, reverse financials
  - `transfer.reversed` / `transfer.updated` (with reversal) → same as `transfer.failed`
- **DB tables:** `profiles`, `deals`, `releases`, `milestones`, `transaction_receipts`, `audit_log`
- **Audit:** `stripe_transfer_succeeded`, `stripe_transfer_failed`, etc.

---

## DocuSign Webhook

### `POST /api/webhooks/docusign`
- **Auth:** DocuSign HMAC signature (`DOCUSIGN_WEBHOOK_SECRET`) | **No session**
- **Purpose:** Handle DocuSign envelope events.
- **Events handled:**
  - `envelope-completed` → mark contract `signed`
  - `envelope-voided` → mark contract `voided`; if milestones were already released → freeze deal (`deal.status = 'frozen'`)
- **DB tables:** `contracts`, `deals`, `audit_log`
- **Audit:** `contract_signed`, `contract_voided`, `deal_frozen`
- **Security:** HMAC-verified before any DB action. No session required.

---

## Auth Webhook

### `POST /api/auth/webhook`
- **Auth:** Supabase webhook secret | **No session**
- **Purpose:** Capture auth events (signup, login, password change) for audit log.
- **DB tables:** `audit_log`
- **Audit:** `user_signup`, `user_login`, `password_changed`
- **Note:** Configure in Supabase: Database Webhooks → `auth.users` → POST `/api/auth/webhook`.

---

## Admin Routes (all: admin role + AAL2 MFA + `admin_write` rate limit)

### `POST /api/admin/invite`
- **Purpose:** Invite a new user and set their role to `admin` via `user_metadata.role`.
- **Body:** `{ email: string }`
- **DB tables:** `audit_log`, `admin_audit_log`
- **Audit:** `admin_user_invited` (dual-write)

### `POST /api/admin/promote`
- **Purpose:** Promote existing user to admin role.
- **Gate:** `ADMIN_PROMOTION_ENABLED=true` env var required (defaults false). Gate runs AFTER auth/role/MFA.
- **Body:** `{ userId, admin_justification, authorization_reference? }`
- **DB tables:** `profiles`, `audit_log`, `admin_audit_log`
- **Audit:** `admin_role_granted` (dual-write)
- **Restrictions:** Self-promotion blocked.

### `POST /api/admin/deals/[dealId]/unfreeze`
- **Purpose:** Unfreeze a deal frozen by DocuSign void-after-release.
- **Body:** `{ admin_justification, new_status? }`
- **DB tables:** `deals`, `audit_log`, `admin_audit_log`
- **Audit:** `admin_unfreeze_deal` (dual-write)

### `POST /api/admin/milestones/[milestoneId]/override-ai-review`
- **Purpose:** Emergency bypass of AI review precondition when all AI providers are unavailable.
- **Body:** `{ justification, override_risk_level: 'low'|'medium'|'high' }`
- **Restrictions:** Cannot override `critical` risk. TTL controlled by `AI_ADMIN_OVERRIDE_TTL_HOURS` (default 4 h).
- **DB tables:** `ai_review_admin_overrides`, `audit_log`, `admin_audit_log`
- **Audit:** `admin_ai_review_override` (dual-write)

### `GET /api/admin/audit-log`
- **Purpose:** Paginated admin audit log with filtering.
- **DB tables:** `audit_log`

### `POST /api/admin/audit-log/[id]/review`
- **Purpose:** Admin marks an audit log entry as reviewed with notes.
- **DB tables:** `admin_audit_log`
- **Audit:** `admin_audit_entry_reviewed`

### `GET /api/admin/partners`
- **Purpose:** List all partners with operational stats (deal_count, pending_confirmations, failed_releases). Never returns `api_key_hash` or `webhook_signing_secret`.
- **DB tables:** `partners` (with aggregates)

### `POST /api/admin/partners`
- **Purpose:** Create a new partner. Generates and returns plaintext API key once — never stored, only the SHA-256 hash is persisted.
- **DB tables:** `partners`, `audit_log`, `admin_audit_log`
- **Audit:** `partner_created` (dual-write)

### `GET /api/admin/partners/[partnerId]`
- **Purpose:** Fetch single partner detail.
- **DB tables:** `partners`

### `PATCH /api/admin/partners/[partnerId]`
- **Purpose:** Update partner metadata (name, webhook URL, rotate API key).
- **DB tables:** `partners`, `audit_log`, `admin_audit_log`
- **Audit:** `partner_updated` or `partner_key_rotated` (dual-write)

### `DELETE /api/admin/partners/[partnerId]`
- **Purpose:** Deactivate/delete a partner.
- **DB tables:** `partners`, `audit_log`, `admin_audit_log`
- **Audit:** `partner_deactivated` (dual-write)

### `GET /api/admin/partners/[partnerId]/deals`
- **Purpose:** List deals assigned to a partner.
- **DB tables:** `deals`

### `POST /api/admin/partners/[partnerId]/deals`
- **Purpose:** Assign a deal to a partner.
- **DB tables:** `deals`, `audit_log`, `admin_audit_log`
- **Audit:** `deal_partner_assigned` (dual-write)

### `POST /api/admin/subscriptions/[profileId]/tier`
- **Purpose:** Change a funder's subscription tier. Derives new `billing_rate_bps` from tier. Does NOT retroactively update existing deals.
- **Body:** `{ tier: 'standalone'|'institutional'|'enterprise', admin_justification }`
- **DB tables:** `profiles`, `audit_log`, `admin_audit_log`
- **Audit:** `subscription_tier_changed` (dual-write)

### `GET /api/admin/reconciliation`
- **Purpose:** Fetch open reconciliation issues.
- **DB tables:** `reconciliation_issues`

### `POST /api/admin/reconciliation/[issueId]`
- **Purpose:** Mark a reconciliation issue as resolved with admin notes.
- **DB tables:** `reconciliation_issues`, `admin_audit_log`
- **Audit:** `reconciliation_issue_resolved`

### `GET /api/admin/stripe/duplicates`
- **Purpose:** Detect duplicate Stripe transfers (same milestone, multiple transfers).
- **DB tables:** `releases`, Stripe API

### `GET /api/admin/ops/alerts`
- **Purpose:** Active operational alerts (stuck transfers, ledger drift, etc.).
- **DB tables:** `reconciliation_issues`, `releases`

### `GET /api/admin/ops/release-health`
- **Purpose:** Summary of release health: pending, confirmed, failed, stuck counts.
- **DB tables:** `releases`

### `GET /api/admin/ops/external-releases`
- **Purpose:** List external-rail releases with hygiene issues.
- **DB tables:** `releases`

### `GET /api/admin/ops/webhook-health`
- **Purpose:** DocuSign and Stripe webhook delivery health.
- **DB tables:** `audit_log` (webhook event entries)

### `GET /api/admin/ops/search`
- **Purpose:** Cross-entity search (deals, profiles, releases) by keyword.
- **DB tables:** `deals`, `profiles`, `releases`

---

## Cron Route

### `POST /api/cron/reconcile`
- **Auth:** `Authorization: Bearer CRON_SECRET` | **Rate limit:** `cron` (3/60 s)
- **Purpose:** Hourly reconciliation job (6 passes). See `docs/system-map.md#reconciliation` for pass details.
- **DB tables:** `releases`, `deals`, `billing_records`, `reconciliation_issues`
- **External:** Stripe API (pass 0, 2, 4)
- **Triggered by:** Vercel Cron `0 * * * *` (also callable manually with correct secret)

---

## Demo Route

### `POST /api/demo/reset`
- **Auth:** none | **Rate limit:** none
- **Purpose:** No-op acknowledgment for demo state resets. DB writes are blocked unless `DEMO_RESET_ENABLED=true`.
- **Returns:** `200 { acknowledged: true }`

---

## Security Risks and Failure Modes

| Route | Key Risk | Mitigation |
|---|---|---|
| `POST /api/milestones/[milestoneId]/release` | Double-spend if Stripe transfer succeeds but DB write fails | Returns 500 with Stripe transfer ID; cron reconciler detects orphaned transfers |
| `POST /api/stripe/webhook` | Replay attack | Stripe signature verified on every request; Stripe deduplicates by event ID |
| `POST /api/webhooks/docusign` | Forged void event freezes a deal | HMAC signature verified before any mutation |
| `POST /api/admin/promote` | Privilege escalation | Disabled by default (`ADMIN_PROMOTION_ENABLED`); self-promotion blocked; dual audit |
| `GET /api/deals` | Admin sees all deals | Intentional; admin audit log captures all admin data access |
| Rate limiting | Fail-open if DB unreachable | By design — auth and business logic are the real controls |
| AI draw review | All 3 providers down | Admin override available (4-hour TTL, logged, cannot override `critical`) |

---

## Related Docs

- `docs/route-inventory.md` — page routes
- `docs/security-controls-map.md` — env vars, dangerous operations, service-role usage
- `docs/workflow-test-matrix.md` — end-to-end flow traces
- `docs/system-map.md` — architecture overview
