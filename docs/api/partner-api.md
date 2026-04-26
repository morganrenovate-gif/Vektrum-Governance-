# Vektrum Partner API

**Version:** 1.0  
**Base URL:** `https://vektrum.io`  
**Partner inquiries:** operations@vektrum.io

---

## Overview

The Vektrum Partner API allows institutional partners (title companies, escrow companies, construction lenders, credit funds, treasury teams) to integrate with Vektrum's authorization layer without replacing their existing payment infrastructure.

Partners use this API to:
- View the status of a release after Vektrum authorizes it
- Confirm that an external payment was executed (and record the proof)
- Report that an external payment execution failed

The API does **not** allow partners to bypass the release gate, move funds, or perform any action outside their deal scope.

---

## Authentication

All requests must include a `Bearer` token in the `Authorization` header.

```
Authorization: Bearer vkp_live_<64hex>
```

**Key formats:**
- Live: `vkp_live_` followed by 64 lowercase hex characters (73 chars total)
- Test: `vkp_test_` followed by 64 lowercase hex characters (73 chars total)

API keys are provisioned by Vektrum. Each key is:
- Scoped to a single partner account
- Rate-limited per the `partner_api` policy
- Logged on every authenticated request
- SHA-256 hashed for storage — Vektrum cannot recover a key after issuance

**Error responses for invalid keys:**

Both "not found" and "inactive" return the same 401 to prevent key enumeration:

```json
{
  "error": "Unauthorized"
}
```

---

## Rate Limiting

Rate limiting is enforced per partner key. Requests that exceed the limit return `429 Too Many Requests`. Contact operations@vektrum.io if your integration requires higher throughput.

---

## Audit Logging

Every API call — successful or not — is written to Vektrum's append-only, hash-chained audit log. This is not optional and cannot be disabled. Log entries include the partner ID, action, release ID, and timestamp.

---

## Endpoints

### GET `/api/partner/releases/:id`

Retrieve the current status of a release.

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | The release ID |

**Response `200 OK`:**

> All amount fields are USD dollars. The platform fee is charged to the funder on top of the gross milestone amount — it is never deducted from contractor proceeds. `net_to_contractor` = gross minus retainage only.

```json
{
  "release": {
    "id": "uuid",
    "deal_id": "uuid",
    "deal_title": "Riverside Phase 2",
    "milestone_id": "uuid",
    "milestone_title": "Foundation Complete",
    "amount": 125000,
    "fee_amount": 1250,
    "retainage_amount": 6250,
    "net_to_contractor": 118750,
    "execution_status": "pending",
    "execution_rail": "external_manual",
    "execution_notes": null,
    "authorized_at": "2025-04-15T14:32:00.000Z"
  }
}
```

**`execution_status` values:**

| Value | Meaning |
|-------|---------|
| `pending` | Vektrum authorized the release; awaiting partner execution confirmation |
| `confirmed` | Partner confirmed payment execution |
| `failed` | Partner reported execution failure |

**`execution_rail` values:**

| Value | Meaning |
|-------|---------|
| `external_manual` | Payment executed by partner via wire, ACH, check, or other method |
| `stripe_connect` | Payment executed via Stripe Connect — not available for partner confirm/fail |

**Error responses:**

| Status | Condition |
|--------|-----------|
| `401` | Missing or invalid API key |
| `403` | Release exists but does not belong to this partner |
| `404` | Release not found |

---

### POST `/api/partner/releases/:id/confirm`

Confirm that an external payment was executed. Records the payment method, reference, actor, and timestamp in the Vektrum audit trail.

**Availability:** Only for releases where `execution_rail` is `external_manual` and `execution_status` is `pending`.

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | The release ID |

**Request body:**

```json
{
  "payment_method": "wire",
  "payment_reference": "FED-20250415-00123",
  "executed_at": "2025-04-15T16:00:00.000Z",
  "notes": "Confirmed by treasury at 4pm Eastern",
  "proof_document_id": "uuid"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `payment_method` | string | Yes | One of: `wire`, `ach`, `check`, `other` |
| `payment_reference` | string | Yes | Max 512 characters |
| `executed_at` | string (ISO-8601) | No | Defaults to current time. Cannot be a future timestamp. Cannot be more than 90 days in the past. |
| `notes` | string | No | Free text. Optional. |
| `proof_document_id` | string (UUID) | No | Must be a valid document UUID associated with the release's milestone. |

**Response `200 OK` (first confirmation):**

```json
{
  "success": true,
  "releaseId": "uuid",
  "execution_status": "confirmed",
  "execution_rail": "external_manual",
  "confirmed_by": "partner",
  "partner_id": "uuid",
  "external": {
    "payment_method": "wire",
    "payment_reference": "FED-20250415-00123",
    "executed_at": "2025-04-15T16:00:00.000Z",
    "notes": null,
    "proof_document_id": null
  },
  "billing": {
    "gross_amount": 125000,
    "fee_amount": 1250,
    "retainage_amount": 6250,
    "net_to_contractor": 118750,
    "billing_rate_bps": 100,
    "total_debit": 126250,
    "committed": true
  },
  "ledger_updated": true,
  "warnings": []
}
```

**Idempotency:** If a release has already been confirmed, calling this endpoint again returns `200` with `alreadyConfirmed: true`. It does not create a duplicate confirmation or return a `4xx`.

```json
{
  "success": true,
  "releaseId": "uuid",
  "alreadyConfirmed": true,
  "execution_status": "confirmed",
  "external_payment_reference": "FED-20250415-00123",
  "external_executed_at": "2025-04-15T16:00:00.000Z",
  "note": "This release has already been confirmed. No further action was taken."
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| `400` | Invalid request body (missing required fields, invalid `payment_method`, `executed_at` in the future or > 90 days past) |
| `401` | Missing or invalid API key |
| `403` | Release does not belong to this partner |
| `404` | Release not found |
| `409` | Concurrent state change in progress — retry after a short delay |
| `422` | Release is on a `stripe_connect` rail (only `external_manual` releases can be confirmed via this API) |
| `422` | Release `execution_status` is not `pending` and is not already `confirmed` (e.g., `failed`) |

---

### POST `/api/partner/releases/:id/fail`

Report that an external payment execution failed. Cancels the balance reservation and preserves audit visibility.

**Availability:** Only for releases where `execution_rail` is `external_manual` and `execution_status` is `pending`.

> **Important:** Reporting a failure does **not** revert the milestone. The milestone status remains `released`. A Vektrum admin must take further action if the milestone needs to be reverted.

**Path parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | The release ID |

**Request body:**

```json
{
  "reason": "Wire rejected by receiving bank — account number mismatch."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `reason` | string | Yes | Minimum 10 characters. Maximum 2000 characters. |

**Response `200 OK`:**

```json
{
  "success": true,
  "releaseId": "uuid",
  "execution_status": "failed",
  "execution_rail": "external_manual",
  "reason": "Wire rejected by receiving bank — account number mismatch.",
  "reservation_cancelled": true,
  "milestone_status_unchanged": true,
  "note": "Release marked failed and funded-balance reservation freed. Milestone remains in released state — contact Vektrum admin to revert if needed."
}
```

**Error responses:**

| Status | Condition |
|--------|-----------|
| `400` | Missing or invalid `reason` (too short, too long) |
| `401` | Missing or invalid API key |
| `403` | Release does not belong to this partner |
| `404` | Release not found |
| `409` | Concurrent state change in progress — retry after a short delay |
| `422` | Release is on a `stripe_connect` rail |
| `422` | Release `execution_status` is not `pending` |

---

## Security Characteristics

| Property | Detail |
|----------|--------|
| Transport | HTTPS only |
| Auth scheme | Bearer token — `Authorization: Bearer vkp_live_<64hex>` |
| Key storage | SHA-256 hashed — Vektrum cannot recover a key |
| Key scope | Partner-scoped — cannot access deals outside your partner account |
| Audit log | Every call written to append-only, hash-chained log |
| Rate limiting | Enforced per key per the `partner_api` policy |
| Fund movement | The Partner API does not move funds |

---

## Integration Checklist

- [ ] Receive API key from Vektrum
- [ ] Store key in your secrets manager (never in source code or logs)
- [ ] On each disbursement: call `GET /api/partner/releases/:id` before executing payment — verify `execution_status` is `pending` and `execution_rail` is `external_manual`
- [ ] After executing payment: call `POST /api/partner/releases/:id/confirm` with method, reference, and timestamp
- [ ] On payment failure: call `POST /api/partner/releases/:id/fail` with a clear reason string
- [ ] Handle `409` with a short retry delay (concurrent state changes resolve quickly)
- [ ] Handle `alreadyConfirmed: true` gracefully — it is a successful idempotent response, not an error
- [ ] **If webhooks enabled:** receive partner-specific signing secret (`whsec_<64hex>`) from Vektrum admin
- [ ] **If webhooks enabled:** verify `X-Vektrum-Signature` on each inbound delivery
- [ ] **If webhooks enabled:** enforce 5-minute timestamp tolerance to prevent replay attacks

---

## Webhooks (Outbound)

Outbound webhooks are optional and configured per integration. If a webhook URL is registered for your partner account, Vektrum delivers a signed `release.authorized` event when the 10-condition release gate passes on an external-rail deal. Partners without a configured webhook URL can poll `GET /api/partner/releases/:id` instead.

When webhooks are enabled, each delivery is signed with a partner-specific `whsec_<64hex>` secret. The secret is issued alongside your API key during onboarding and is rotatable on demand via the Vektrum admin dashboard. If outbound webhooks are not part of your integration, no signing secret is required.

---

## Support

- Partner integration: operations@vektrum.io
- Schedule a call: vektrum.io/partners/placement
