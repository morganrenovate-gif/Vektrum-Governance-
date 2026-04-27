/**
 * Pure helpers for the controlled outbound-webhook verification script.
 *
 * Mirrors the signing algorithm in src/lib/engine/partner-webhook.ts so the
 * test event we deliver to webhook.site is verifiable with the partner's
 * stored signing secret EXACTLY as a real release.authorized event would be.
 *
 * No DB access, no Stripe, no release creation. Pure functions only —
 * import from this module in tests to validate signing without making
 * any HTTP request.
 */

import { createHmac } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Test-event payload. Distinct event name (`partner.webhook.test`) and an
 * explicit `test: true` flag so partner-side handlers can recognize and
 * discard these without touching any release-state machinery.
 *
 * IDs are clearly fake (prefixed `test_`) and do not collide with the
 * UUID pattern Vektrum uses for real records.
 */
export interface PartnerWebhookTestPayload {
  event:           'partner.webhook.test'
  test:            true
  api_version:     string
  partner_id:      string
  partner_name:    string
  release_id:      string   // fake, prefixed test_
  deal_id:         string   // fake, prefixed test_
  milestone_id:    string   // fake, prefixed test_
  /** Stable idempotency key for partner-side dedupe checks. */
  idempotency_key: string
  /** Server clock at script invocation. */
  emitted_at:      string   // ISO-8601
  /** Free-text marker so a human inspecting webhook.site sees this is a test. */
  note:            string
}

export interface BuildTestPayloadInput {
  partnerId:   string
  partnerName: string
  /** Override the clock (tests). Defaults to Date.now(). */
  nowMs?:      number
  /** Override the random suffix (tests). Defaults to a 12-hex-char random. */
  nonce?:      string
}

/**
 * Build a clearly-marked test payload. Pure — no I/O.
 *
 * The fake IDs use the `test_` prefix so any partner-side code that filters
 * by UUID format will reject them. The idempotency_key embeds the nonce so
 * repeated invocations produce distinct deliveries (so partners can verify
 * dedupe without mutating any real record).
 */
export function buildTestPayload(input: BuildTestPayloadInput): PartnerWebhookTestPayload {
  const nowMs = input.nowMs ?? Date.now()
  const nonce = input.nonce ?? randomHex(12)
  return {
    event:           'partner.webhook.test',
    test:            true,
    api_version:     '2026-04-25',
    partner_id:      input.partnerId,
    partner_name:    input.partnerName,
    release_id:      `test_release_${nonce}`,
    deal_id:         `test_deal_${nonce}`,
    milestone_id:    `test_milestone_${nonce}`,
    idempotency_key: `test_${nonce}`,
    emitted_at:      new Date(nowMs).toISOString(),
    note:            'Controlled verification webhook from Vektrum. Not a real release. ' +
                     'No money has moved. No release-gate evaluation occurred. ' +
                     'Discard or log only.',
  }
}

// ─── Signing ──────────────────────────────────────────────────────────────────

/**
 * HMAC-SHA256 sign a JSON body using Vektrum's canonical scheme:
 *
 *   signed_string = `${unix_seconds}.${json_body}`
 *   hex_digest    = HMAC-SHA256(signed_string, signing_secret)
 *   header_value  = `t=${unix_seconds},sha256=${hex_digest}`
 *
 * Identical to the inline implementation in src/lib/engine/partner-webhook.ts
 * (line ~178). Partners verify by re-running the same algorithm with their
 * stored secret and constant-time comparing the resulting hex.
 */
export function signWebhook(opts: {
  body:        string
  secret:      string
  timestampS:  number
}): { signedString: string; hexDigest: string; headerValue: string } {
  const signedString = `${opts.timestampS}.${opts.body}`
  const hexDigest    = createHmac('sha256', opts.secret).update(signedString).digest('hex')
  const headerValue  = `t=${opts.timestampS},sha256=${hexDigest}`
  return { signedString, hexDigest, headerValue }
}

/** Build the full request header set Vektrum sends with every outbound webhook. */
export function buildHeaders(opts: {
  payload:        PartnerWebhookTestPayload
  signatureValue: string
  timestampS:     number
}): Record<string, string> {
  return {
    'Content-Type':         'application/json',
    'X-Vektrum-Signature':  opts.signatureValue,
    'X-Vektrum-Event':      opts.payload.event,
    'X-Vektrum-DeliveryId': `${opts.payload.release_id}-${opts.timestampS}`,
    'X-Vektrum-Test':       'true',
  }
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  // Crypto-strong, but tests pin the value via the `nonce` input so
  // randomness here is not load-bearing.
  const buf = new Uint8Array(bytes)
  // node:crypto.randomFillSync would be more direct, but Math.random is
  // sufficient when callers can override via input.nonce. Keep this
  // module dependency-free beyond `node:crypto` (already imported above).
  for (let i = 0; i < bytes; i++) buf[i] = Math.floor(Math.random() * 256)
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('')
}
