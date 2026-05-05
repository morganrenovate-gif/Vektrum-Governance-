// src/lib/engine/authorization-token.ts
//
// Stage B1 of the patent-readiness work (memo candidate #1: rail-agnostic
// signed authorization token).
//
// `issueAuthorizationToken()` is invoked by POST /api/milestones/{id}/release
// AFTER funded-balance reservation succeeds and BEFORE rail dispatch. It
// writes a row into the authorization_tokens table whose token_hash is
// bound into the success-path funds_released audit row via the Tier A
// audit_log.token_hash column.
//
// Idempotency: when called twice for the same milestone with the same
// idempotency_key, the second call returns the existing row instead of
// inserting a duplicate. The partial unique index
// `authorization_tokens_active_per_milestone (milestone_id) WHERE status IN
// ('issued','delivered')` is the DB-layer backstop.
//
// Signature: ed25519 if VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE is set (PKCS8 PEM
// or base64-encoded PKCS8). When the env var is absent we still write the
// row (signature column is nullable) — the patent claim shape is captured
// even before key material is rotated in. Tier B step 2 (partner verifier)
// requires the key to be present.

import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sha256OfCanonicalJson } from '@/lib/engine/audit'
import { randomBytes, randomUUID, createSign, createPrivateKey } from 'node:crypto'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Stage B1 default TTL — 30 days for external rail; trimmed to 24h on Stripe rail. */
const DEFAULT_TTL_HOURS_EXTERNAL = 24 * 30
const DEFAULT_TTL_HOURS_STRIPE   = 24

/** Stage B1 policy version anchor. Bump when validateRelease() semantics change. */
export const RELEASE_POLICY_VERSION = '10-condition-gate.v1'

/** Token issuer identifier. Embedded in the canonical payload that's hashed/signed. */
const ISSUER = 'vektrum.io'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IssueAuthorizationTokenInput {
  /** Milestone the token authorizes. Drives the per-milestone uniqueness rule. */
  milestoneId:        string
  /** Parent deal id. Stored as draw_request_id (TEMPORARY MAPPING — see migration COMMENT). */
  dealId:             string
  /** Contractor id (the payee). Both payee_id and payee_scope. */
  payeeId:            string
  /** Funder id. */
  funderId:           string
  /** Rail scope. Must match the funder's disbursement_rail. */
  railScope:          'stripe' | 'external_rail'
  /** Net amount the contractor receives this release (post-retainage, pre-fee). */
  netToContractor:    number
  /** Gross authorized amount (milestone.amount). Used for total_amount. */
  grossAmount:        number
  /** Currency. Defaults to USD if not provided. */
  currency?:          string
  /** Idempotency key — same value across retries returns the same token row. */
  idempotencyKey:     string
  /** Funder user id who is issuing the authorization. Stored as issued_by. */
  issuedBy:           string
  /** Optional explicit expiry. Defaults based on rail. */
  expiresAt?:         Date
}

export interface IssueAuthorizationTokenResult {
  id:               string
  jti:              string
  tokenHash:        string
  status:           'issued' | 'delivered' | 'confirmed' | 'failed' | 'expired' | 'revoked'
  /** Sequence number on the milestone (1, 2, 3, ... per retry after failure). */
  sequenceIndex:    number
  expiresAt:        string
  signatureAlg:     string
  signature:        string | null
  /**
   * `false` when this call inserted a new row, `true` when an existing active
   * token was returned (idempotency). The route uses this to decide whether
   * to write a duplicate audit event.
   */
  alreadyIssued:    boolean
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Issues a rail-scoped authorization token for a milestone release.
 *
 * Behaviour:
 *   1. Look up an active token (status IN ('issued','delivered')) for this
 *      milestone whose idempotency_key matches the caller. If found, return
 *      it as-is (idempotent issue).
 *   2. Compute the canonical token payload, hash it (token_hash), sign it
 *      (best-effort), and insert one new authorization_tokens row.
 *   3. Return the new row's id, jti, token_hash, sequence_index, and expiry.
 *
 * Concurrency: this function relies on the partial unique index
 * `authorization_tokens_active_per_milestone` to reject a second concurrent
 * INSERT for the same milestone while one is still active. The caller's
 * upstream `reserve_release_funds` lock on the deal row already serialises
 * release attempts at the deal level; this is a per-milestone backstop.
 *
 * Errors are thrown — the caller must wrap in try/catch and cancel the
 * funded-balance reservation if issuance fails.
 */
export async function issueAuthorizationToken(
  input: IssueAuthorizationTokenInput,
): Promise<IssueAuthorizationTokenResult> {
  const admin = createSupabaseAdminClient()

  // ── Step 1: idempotent fast-path ─────────────────────────────────────────
  // Same idempotency key on the same milestone returns the existing token
  // without writing a second row. This mirrors Stripe's idempotency-key
  // semantics on the existing release route (idempotencyKey = "release_${id}").
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingActive } = await (admin as any)
    .from('authorization_tokens')
    .select('id, jti, token_hash, status, sequence_index, expires_at, signature_alg, signature, idempotency_key')
    .eq('milestone_id', input.milestoneId)
    .in('status', ['issued', 'delivered'])
    .maybeSingle()

  if (existingActive) {
    if (existingActive.idempotency_key === input.idempotencyKey) {
      return {
        id:            existingActive.id,
        jti:           existingActive.jti,
        tokenHash:     existingActive.token_hash,
        status:        existingActive.status,
        sequenceIndex: existingActive.sequence_index,
        expiresAt:     existingActive.expires_at,
        signatureAlg:  existingActive.signature_alg,
        signature:     existingActive.signature,
        alreadyIssued: true,
      }
    }
    // Different idempotency key but a token is still active — this is the
    // "second authorization while first is pending" guardrail. The DB partial
    // unique index would also reject the upcoming INSERT; surface a clear
    // application-level error so the route can return a meaningful status.
    throw new AuthorizationTokenConflictError(
      `An active authorization token already exists for milestone ${input.milestoneId} ` +
      `(token id ${existingActive.id}, status ${existingActive.status}). The previous ` +
      `authorization must reach a terminal state (confirmed | failed | expired | revoked) ` +
      `before a new one can be issued.`,
    )
  }

  // ── Step 2: compute next sequence_index for this milestone ───────────────
  // Sequence is monotonic across all tokens (active + terminal) for a milestone.
  // The (milestone_id, sequence_index) UNIQUE constraint is the DB backstop.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRow } = await (admin as any)
    .from('authorization_tokens')
    .select('sequence_index')
    .eq('milestone_id', input.milestoneId)
    .order('sequence_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sequenceIndex = (maxRow?.sequence_index ?? 0) + 1

  // ── Step 3: build the canonical payload ──────────────────────────────────
  const jti        = randomUUID()
  const nonce      = randomBytes(16).toString('hex')
  const notBefore  = new Date()
  const ttlHours   = input.expiresAt
    ? Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 3_600_000))
    : (input.railScope === 'stripe' ? DEFAULT_TTL_HOURS_STRIPE : DEFAULT_TTL_HOURS_EXTERNAL)
  const expiresAt  = input.expiresAt ?? new Date(Date.now() + ttlHours * 3_600_000)
  const currency   = input.currency ?? 'USD'

  // amount_vector — Stage B1 always writes a single-entry vector. Tier C
  // expands this to per-SOV-line entries.
  const amountVector = [
    { milestone_id: input.milestoneId, amount: input.netToContractor },
  ]

  // policy_hash — pin the policy version into a deterministic hash. Once Tier
  // C-or-later introduces dynamic policy bundles, this should hash the actual
  // policy JSON used by the gate at decision time.
  const policyHash = await sha256OfCanonicalJson({ version: RELEASE_POLICY_VERSION })

  // Canonical payload that is hashed and signed. Order-independent via
  // sha256OfCanonicalJson; positional semantics in arrays preserved.
  const canonicalPayload = {
    iss:              ISSUER,
    aud:              [input.railScope],
    jti,
    sub:              input.payeeId,
    draw_request_id:  input.dealId,            // TEMPORARY: equals deals.id until Tier C draw_requests
    milestone_id:     input.milestoneId,
    funder_id:        input.funderId,
    payee_scope:      input.payeeId,
    rail_scope:       input.railScope,
    amount_vector:    amountVector,
    total_amount:     input.netToContractor,
    gross_amount:     input.grossAmount,
    currency,
    policy_version:   RELEASE_POLICY_VERSION,
    policy_hash:      policyHash,
    graph_commitment: null,                    // Tier D produces this
    nonce,
    sequence_index:   sequenceIndex,
    idempotency_key:  input.idempotencyKey,
    not_before:       notBefore.toISOString(),
    expires_at:       expiresAt.toISOString(),
  }

  const tokenHash = await sha256OfCanonicalJson(canonicalPayload)

  // Sign — best-effort. If the signing key is missing the column stays NULL.
  const { signature, alg } = signCanonicalPayload(canonicalPayload)

  // ── Step 4: insert the row ───────────────────────────────────────────────
  // The partial unique index is the concurrency backstop here: if two callers
  // race past Step 1 simultaneously, only one INSERT will succeed; the other
  // gets a unique-constraint violation which we map to AuthorizationTokenConflictError.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertError } = await (admin as any)
    .from('authorization_tokens')
    .insert({
      jti,
      idempotency_key:  input.idempotencyKey,
      sequence_index:   sequenceIndex,
      draw_request_id:  input.dealId,
      milestone_id:     input.milestoneId,
      payee_id:         input.payeeId,
      funder_id:        input.funderId,
      rail_scope:       input.railScope,
      payee_scope:      input.payeeId,
      amount_vector:    amountVector,
      total_amount:     input.netToContractor,
      currency,
      policy_version:   RELEASE_POLICY_VERSION,
      policy_hash:      policyHash,
      graph_commitment: null,
      token_hash:       tokenHash,
      nonce,
      signature_alg:    alg,
      signature,
      not_before:       notBefore.toISOString(),
      expires_at:       expiresAt.toISOString(),
      status:           'issued',
      issued_by:        input.issuedBy,
    })
    .select('id, jti, token_hash, status, sequence_index, expires_at, signature_alg, signature')
    .single()

  if (insertError || !inserted) {
    // 23505 = unique_violation — most likely the partial unique index on milestone_id.
    if (insertError?.code === '23505') {
      throw new AuthorizationTokenConflictError(
        `Concurrent issuance for milestone ${input.milestoneId} — another active token ` +
        `was created in parallel. Retry the release request.`,
      )
    }
    throw new Error(
      `Failed to insert authorization token for milestone ${input.milestoneId}: ${insertError?.message ?? 'unknown error'}`,
    )
  }

  return {
    id:            inserted.id,
    jti:           inserted.jti,
    tokenHash:     inserted.token_hash,
    status:        inserted.status,
    sequenceIndex: inserted.sequence_index,
    expiresAt:     inserted.expires_at,
    signatureAlg:  inserted.signature_alg,
    signature:     inserted.signature,
    alreadyIssued: false,
  }
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Thrown when a second authorization is requested for a milestone whose first
 * authorization has not yet reached a terminal state. Routes should map this
 * to HTTP 409.
 */
export class AuthorizationTokenConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthorizationTokenConflictError'
  }
}

// ─── Internal: signing ────────────────────────────────────────────────────────

/**
 * Best-effort ed25519 signature over the canonical token payload.
 *
 * Reads VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE from the environment. The value
 * may be a PEM-encoded PKCS8 private key, OR a base64-encoded PKCS8 DER
 * blob. Other formats are rejected.
 *
 * Returns { signature: null, alg: 'unsigned' } when the env var is missing
 * so the row still inserts. Tier B step 2 (partner verifier endpoints) will
 * fail closed if a token's signature is null — that's the right place to
 * make the requirement hard.
 */
function signCanonicalPayload(payload: object): { signature: string | null; alg: string } {
  const raw = process.env.VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE
  if (!raw) return { signature: null, alg: 'unsigned' }

  try {
    const keyMaterial = raw.includes('BEGIN PRIVATE KEY')
      ? raw
      : Buffer.from(raw, 'base64')

    const key = createPrivateKey({
      key:    keyMaterial as string | Buffer,
      format: typeof keyMaterial === 'string' ? 'pem' : 'der',
      type:   'pkcs8',
    })

    if (key.asymmetricKeyType !== 'ed25519') {
      console.warn(
        '[authorization-token] VEKTRUM_TOKEN_SIGNING_KEY_PRIVATE is not an ed25519 key; ' +
        'token will be left unsigned. Set an ed25519 PKCS8 PEM/DER value.',
      )
      return { signature: null, alg: 'unsigned' }
    }

    // ed25519 uses Ed25519 (no separate hash). Sign the canonical JSON bytes.
    const canonical = canonicalJsonStringify(payload)
    const signer    = createSign('SHA256') // ignored for Ed25519 but required by API
    signer.update(canonical)
    signer.end()
    const sig = signer.sign(key)
    return { signature: sig.toString('base64'), alg: 'ed25519' }
  } catch (err) {
    console.warn(
      '[authorization-token] Failed to sign token; storing unsigned:',
      err instanceof Error ? err.message : err,
    )
    return { signature: null, alg: 'unsigned' }
  }
}

/**
 * Local copy of the canonicaliser used by sha256OfCanonicalJson. Kept
 * private here so signCanonicalPayload uses the SAME byte sequence the
 * verifier will recompute when checking signatures.
 */
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
