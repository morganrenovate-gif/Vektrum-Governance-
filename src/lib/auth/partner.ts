import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

// ─── Partner Auth ─────────────────────────────────────────────────────────────
//
// Authenticates inbound requests from institutional execution-rail partners
// (escrow companies, construction loan servicers, title companies).
//
// Authentication scheme: Bearer token in Authorization header.
//   Authorization: Bearer vkp_<hex>
//
// Lookup strategy:
//   1. Parse Bearer token from Authorization header.
//   2. SHA-256 hash the token.
//   3. Look up in partners table by api_key_hash.
//   4. Confirm partner.is_active = true.
//   5. Return partner row, or throw a 401 NextResponse.
//
// The plaintext API key is never stored — only the hash. This means a
// compromised DB does not expose partner keys.

export interface PartnerAuthContext {
  partnerId:   string
  partnerName: string
  webhookUrl:  string | null
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
    .select('id, name, webhook_url, is_active')
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

  return {
    partnerId:   partner.id,
    partnerName: partner.name,
    webhookUrl:  partner.webhook_url ?? null,
  }
}

// ─── API Key Generation ───────────────────────────────────────────────────────

import { randomBytes } from 'crypto'

/**
 * Generates a new partner API key and its derived values.
 *
 * Returns:
 *   fullKey    — the plaintext key to show once and discard (vkp_<64 hex>)
 *   prefix     — first 12 chars for UI display (vkp_ABCD1234)
 *   hash       — SHA-256 of fullKey, stored in DB for lookup
 */
export function generatePartnerApiKey(): {
  fullKey: string
  prefix:  string
  hash:    string
} {
  const hex     = randomBytes(32).toString('hex')   // 64 hex chars
  const fullKey = `vkp_${hex}`
  const prefix  = fullKey.slice(0, 12)              // "vkp_" + 8 hex chars
  const hash    = createHash('sha256').update(fullKey).digest('hex')

  return { fullKey, prefix, hash }
}

/**
 * Generates a webhook signing secret for HMAC verification.
 *
 * The secret is stored plaintext in the DB (Vektrum signs with it).
 * Partners receive it once at setup to verify incoming webhooks.
 *
 * Format: whsec_<64 hex chars>
 */
export function generateWebhookSigningSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`
}
