import { NextRequest, NextResponse } from 'next/server'
import { createPrivateKey, createPublicKey, verify as cryptoVerify } from 'node:crypto'
import { requirePartnerAuth } from '@/lib/auth/partner'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── POST /api/partner/tokens/verify ─────────────────────────────────────────
//
// Tier B step 2 — Token signature verification endpoint.
//
// Partners call this to cryptographically verify that a token payload they
// received was signed by Vektrum's ed25519 signing key.
//
// This endpoint does NOT require the token to be in the database — it only
// verifies the cryptographic signature. Use GET /api/partner/tokens/[jti]
// to check live token status.
//
// Authentication: Authorization: Bearer <partner_api_key>
//
// Request body:
//   {
//     payload:   object    -- the canonical token payload (as received)
//     signature: string    -- base64-encoded ed25519 signature
//   }
//
// Response:
//   {
//     valid:     boolean
//     alg:       'ed25519' | 'unsigned'
//     reason?:   string     -- present when valid=false
//   }
//
// The public key is read from VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC (PEM-encoded
// SPKI). When the env var is absent, all tokens are treated as unsigned and
// the response returns { valid: false, alg: 'unsigned', reason: 'no_public_key' }.

interface VerifyBody {
  payload?:   unknown
  signature?: string
}

export async function POST(request: NextRequest) {
  // Rate limit: partner_api scope
  const rl = await checkRateLimit(request, POLICIES.partner_api, 'partner-verify')
  if (!rl.allowed) {
    await logRateLimitViolation(request, 'partner_api', 'partner-verify')
    return rateLimitResponse(rl)
  }

  let partnerCtx
  try {
    partnerCtx = await requirePartnerAuth(request)
  } catch (err) {
    return err as NextResponse
  }
  void partnerCtx // authenticated; no per-deal scope check needed for sig verification

  let body: VerifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'payload is required and must be an object.' }, { status: 400 })
  }
  if (!body.signature || typeof body.signature !== 'string') {
    return NextResponse.json({ error: 'signature (base64) is required.' }, { status: 400 })
  }

  const rawPublicKey = process.env.VEKTRUM_TOKEN_SIGNING_KEY_PUBLIC
  if (!rawPublicKey) {
    return NextResponse.json({
      valid:   false,
      alg:     'unsigned',
      reason:  'no_public_key',
    })
  }

  try {
    const pubKey = createPublicKey({
      key:    rawPublicKey,
      format: 'pem',
      type:   'spki',
    })

    if (pubKey.asymmetricKeyType !== 'ed25519') {
      return NextResponse.json({
        valid:  false,
        alg:    'unsigned',
        reason: 'invalid_key_type',
      })
    }

    // Canonicalize the payload identically to authorization-token.ts
    const canonical = canonicalJsonStringify(body.payload)
    const sigBuf    = Buffer.from(body.signature, 'base64')

    // ed25519 uses no separate hash — pass null as the digest algorithm.
    // crypto.verify(null, data, key) is the correct Node.js API for Ed25519.
    const isValid = cryptoVerify(null, Buffer.from(canonical), pubKey, sigBuf)

    if (isValid) {
      return NextResponse.json({ valid: true, alg: 'ed25519' })
    }
    return NextResponse.json({ valid: false, alg: 'ed25519', reason: 'signature_mismatch' })
  } catch (err) {
    return NextResponse.json({
      valid:  false,
      alg:    'unsigned',
      reason: 'verification_error',
    })
  }
}

// ─── Canonical JSON ───────────────────────────────────────────────────────────
//
// Must match the canonicalizer in authorization-token.ts exactly so that
// the verifier produces the same byte sequence the signer hashed.

function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJsonStringify).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys
    .map(k => JSON.stringify(k) + ':' + canonicalJsonStringify(obj[k]))
    .join(',') + '}'
}
