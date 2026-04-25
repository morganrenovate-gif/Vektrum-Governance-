import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// ─── Partner Auth ─────────────────────────────────────────────────────────────
//
// Authenticates inbound requests from institutional execution-rail partners
// (escrow companies, construction loan servicers, title companies).
//
// Authentication scheme: Bearer token in Authorization header.
//   Authorization: Bearer vkp_live_<hex>  (live key)
//   Authorization: Bearer vkp_test_<hex>  (test key)
//
// Lookup strategy:
//   1. Parse Bearer token from Authorization header.
//   2. SHA-256 hash the token.
//   3. Look up in partners table by api_key_hash.
//   4. Confirm partner.is_active = true.
//   5. Fire-and-forget update of last_used_at.
//   6. Return partner context, or throw a 401 NextResponse.
//
// The plaintext API key is never stored — only the SHA-256 hash. A compromised
// DB does not expose partner keys.

export interface PartnerAuthContext {
  partnerId:      string
  partnerName:    string
  webhookUrl:     string | null
  keyEnvironment: 'test' | 'live'
}

/**
 * Extracts and validates the partner API key from the Authorization header.
 *
 * Throws a 401 NextResponse if:
 *   - No Authorization header is present
 *   - Header is not a Bearer token
 *   - Token does not match any active partner
 *
 * Never leaks whether a key exists vs. is inactive — both return the same
 * "Invalid or inactive partner API key" message.
 *
 * Side effect (non-blocking): updates last_used_at on successful auth.
 */
export async function requirePartnerAuth(
  request: NextRequest,
): Promise<PartnerAuthContext> {
  const authHeader = request.headers.get('authorization') ?? ''

  if (!authHeader.startsWith('Bearer ')) {
    throw NextResponse.json(
      {
        error:
          'Partner API key required. Provide your key as: Authorization: Bearer <api_key>',
      },
      { status: 401 },
    )
  }

  const rawKey = authHeader.slice('Bearer '.length).trim()

  if (!rawKey) {
    throw NextResponse.json(
      { error: 'Partner API key is empty.' },
      { status: 401 },
    )
  }

  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const admin = createSupabaseAdminClient()

  const { data: partner, error } = await admin
    .from('partners')
    .select('id, name, webhook_url, is_active, key_environment')
    .eq('api_key_hash', keyHash)
    .maybeSingle()

  if (error) {
    console.error('[partner-auth] DB lookup error:', error.message)
    throw NextResponse.json(
      { error: 'Partner authentication failed due to a server error. Please try again.' },
      { status: 500 },
    )
  }

  // Use identical error message for "not found" and "inactive" to avoid
  // leaking whether a key exists in the database.
  if (!partner || !partner.is_active) {
    throw NextResponse.json(
      { error: 'Invalid or inactive partner API key.' },
      { status: 401 },
    )
  }

  // ── Fire-and-forget: record last_used_at ───────────────────────────────────
  // Non-blocking — must not add latency to the partner API hot path.
  // Failure is logged but does not fail the request.
  admin
    .from('partners')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', partner.id)
    .then(({ error: updateErr }) => {
      if (updateErr) {
        console.error('[partner-auth] last_used_at update failed:', updateErr.message)
      }
    })

  return {
    partnerId:      partner.id,
    partnerName:    partner.name,
    webhookUrl:     partner.webhook_url ?? null,
    keyEnvironment: (partner.key_environment as 'test' | 'live') ?? 'live',
  }
}

// ─── API Key Generation ───────────────────────────────────────────────────────

/**
 * Generates a new partner API key and its derived values.
 *
 * Key format: vkp_<env>_<64 hex chars>
 *   vkp_live_<hex>  — production integration
 *   vkp_test_<hex>  — test/sandbox integration
 *
 * Returns:
 *   fullKey        — the plaintext key to show once and discard
 *   prefix         — first 17 chars for UI display (vkp_live_ABCDEF12)
 *   hash           — SHA-256 of fullKey, stored in DB for lookup
 *   keyEnvironment — 'test' | 'live'
 */
export function generatePartnerApiKey(env: 'test' | 'live' = 'live'): {
  fullKey:        string
  prefix:         string
  hash:           string
  keyEnvironment: 'test' | 'live'
} {
  const hex     = randomBytes(32).toString('hex')     // 64 hex chars = 256 bits
  const fullKey = `vkp_${env}_${hex}`
  // Prefix: "vkp_live_" (9) + 8 hex chars = 17 chars, e.g. "vkp_live_A1B2C3D4"
  //         "vkp_test_" (9) + 8 hex chars = 17 chars, e.g. "vkp_test_E5F6A7B8"
  const prefix  = fullKey.slice(0, 17)
  const hash    = createHash('sha256').update(fullKey).digest('hex')

  return { fullKey, prefix, hash, keyEnvironment: env }
}

/**
 * Generates a webhook signing secret for HMAC verification.
 *
 * The secret is stored plaintext in the DB (Vektrum signs outbound webhooks
 * with it). Partners receive it once at setup to verify incoming webhooks.
 *
 * Format: whsec_<64 hex chars>
 */
export function generateWebhookSigningSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`
}
