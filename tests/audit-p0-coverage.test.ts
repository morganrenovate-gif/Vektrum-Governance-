/**
 * Audit logging — P0 coverage tests
 *
 * Pins three audit gaps that were closed:
 *
 *   A. RECEIPT RESEND
 *      A1. POST /api/releases/[releaseId]/receipt/resend imports logAudit
 *      A2. Calls logAudit with action 'receipt_resent'
 *      A3. Audit metadata uses recipient_count + delivery_channel — never raw email addresses
 *      A4. logAudit is invoked AFTER markReceiptEmailSent (only on success path)
 *
 *   B. CONTRACT SIGNING INITIATED
 *      B1. POST /api/deals/[dealId]/contract/sign imports logAudit
 *      B2. Calls logAudit with action 'contract_signing_initiated'
 *      B3. Audit metadata uses signer_role + signer_count — never the signer's raw email
 *      B4. logAudit is invoked AFTER getSigningUrl succeeds (only on success path)
 *
 *   C. ADMIN SUBSCRIPTION TIER DUAL-WRITE
 *      C1. POST /api/admin/subscriptions/[profileId]/tier imports logAdminAudit
 *      C2. No raw insert into 'admin_audit_log' table remains in this route
 *      C3. logAdminAudit invocation includes action 'subscription_tier_changed'
 *      C4. logAdminAudit invocation includes admin_justification
 *      C5. Both old_values and new_values are passed (preserves before/after capture)
 *
 *   D. SECRET / PII SAFETY (cross-cutting)
 *      D1. None of the three new audit metadata blocks reference plaintext
 *          API keys, webhook secrets, JWTs, session cookies, or Stripe secret keys.
 *      D2. None of the three new audit metadata blocks pass full email addresses
 *          (contractorEmail, funderEmail, signer.email, authUser.data.user.email)
 *          into the metadata literal.
 *
 * Run:  npx tsx tests/audit-p0-coverage.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function src(rel: string) {
  return readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

const RESEND_PATH = 'src/app/api/releases/[releaseId]/receipt/resend/route.ts'
const SIGN_PATH   = 'src/app/api/deals/[dealId]/contract/sign/route.ts'
const TIER_PATH   = 'src/app/api/admin/subscriptions/[profileId]/tier/route.ts'

const RESEND = src(RESEND_PATH)
const SIGN   = src(SIGN_PATH)
const TIER   = src(TIER_PATH)

const results: { name: string; passed: boolean; error?: string }[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

/**
 * Extracts the literal source of an audit call (logAudit({...}) or
 * logAdminAudit({...})) so individual fields can be asserted against the
 * arguments object only — not the rest of the file.
 */
function extractAuditCall(source: string, fnName: 'logAudit' | 'logAdminAudit'): string {
  const opener = `await ${fnName}(`
  const idx = source.indexOf(opener)
  if (idx === -1) throw new Error(`${fnName}( not found in source`)
  // Walk forward from after the opening paren, tracking nested braces/parens.
  let depth = 0
  let i = idx + opener.length
  for (; i < source.length; i++) {
    const ch = source[i]
    if (ch === '(' || ch === '{' || ch === '[') depth++
    else if (ch === ')' || ch === '}' || ch === ']') {
      if (depth === 0) break
      depth--
    }
  }
  return source.slice(idx, i + 1)
}

// ─── A. RECEIPT RESEND ───────────────────────────────────────────────────────

test('A1: receipt resend route imports logAudit', () => {
  assert(
    RESEND.includes("from '@/lib/engine/audit'") && RESEND.includes('logAudit'),
    'receipt resend route does not import logAudit',
  )
})

test('A2: receipt resend calls logAudit with action "receipt_resent"', () => {
  const call = extractAuditCall(RESEND, 'logAudit')
  assert(
    call.includes("action:") && call.includes("'receipt_resent'"),
    `logAudit call does not use action 'receipt_resent'. Got:\n${call}`,
  )
  assert(
    call.includes("entity_type:") && call.includes("'receipt'"),
    "logAudit call does not set entity_type 'receipt'",
  )
})

test('A3: receipt resend audit metadata uses recipient_count + delivery_channel (no raw emails)', () => {
  const call = extractAuditCall(RESEND, 'logAudit')
  assert(call.includes('recipient_count'), 'audit metadata is missing recipient_count')
  assert(call.includes('delivery_channel'), 'audit metadata is missing delivery_channel')
  // Must not stuff the raw email variables into the audit metadata block.
  assert(
    !call.includes('contractorEmail') && !call.includes('funderEmail'),
    'audit metadata includes raw contractorEmail or funderEmail — must use recipient_count instead',
  )
})

test('A4: logAudit is called AFTER markReceiptEmailSent (success path only)', () => {
  const auditIdx = RESEND.indexOf('logAudit(')
  const sentIdx  = RESEND.indexOf('markReceiptEmailSent(')
  assert(auditIdx > sentIdx && sentIdx > -1,
    'logAudit must be invoked after markReceiptEmailSent (success path)')
})

// ─── B. CONTRACT SIGNING INITIATED ──────────────────────────────────────────

test('B1: contract sign route imports logAudit', () => {
  assert(
    SIGN.includes("from '@/lib/engine/audit'") && SIGN.includes('logAudit'),
    'contract sign route does not import logAudit',
  )
})

test('B2: contract sign calls logAudit with action "contract_signing_initiated"', () => {
  const call = extractAuditCall(SIGN, 'logAudit')
  assert(
    call.includes("action:") && call.includes("'contract_signing_initiated'"),
    `logAudit call does not use action 'contract_signing_initiated'. Got:\n${call}`,
  )
  assert(
    call.includes("entity_type:") && call.includes("'contract'"),
    "logAudit call does not set entity_type 'contract'",
  )
})

test('B3: contract sign audit metadata uses signer_role + signer_count (no raw signer email)', () => {
  const call = extractAuditCall(SIGN, 'logAudit')
  assert(call.includes('signer_role'),  'audit metadata is missing signer_role')
  assert(call.includes('signer_count'), 'audit metadata is missing signer_count')
  // Must not include the signer's email address in the metadata literal.
  // The email is fetched via auth.admin.getUserById and bound to local
  // variables — none of those must appear inside the audit call.
  assert(
    !call.includes('signer.email') &&
    !call.includes('authUser.data.user.email') &&
    !call.includes('email:'),
    `audit metadata appears to log a raw signer email. Got:\n${call}`,
  )
})

test('B4: logAudit is called AFTER getSigningUrl succeeds (success path only)', () => {
  const auditIdx = SIGN.indexOf('logAudit(')
  const urlIdx   = SIGN.indexOf('await getSigningUrl(')
  assert(auditIdx > urlIdx && urlIdx > -1,
    'logAudit must be invoked after getSigningUrl succeeds (success path)')
})

// ─── C. ADMIN SUBSCRIPTION TIER DUAL-WRITE ───────────────────────────────────

test('C1: tier route imports logAdminAudit', () => {
  assert(
    TIER.includes("from '@/lib/engine/audit'") && TIER.includes('logAdminAudit'),
    'tier route does not import logAdminAudit',
  )
})

test('C2: tier route no longer performs a raw .from("admin_audit_log").insert', () => {
  // The previous version did:
  //   adminClient.from('admin_audit_log').insert({...})
  // bypassing the dual-write contract. Make sure nothing matching that
  // pattern survives in code.
  const codeLines = TIER
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
    })
    .join('\n')
  assert(
    !codeLines.includes("from('admin_audit_log')"),
    'tier route still contains a direct from("admin_audit_log") insert — must use logAdminAudit',
  )
})

test('C3: logAdminAudit invocation uses action "subscription_tier_changed"', () => {
  const call = extractAuditCall(TIER, 'logAdminAudit')
  assert(
    call.includes("action:") && call.includes("'subscription_tier_changed'"),
    `logAdminAudit call does not use action 'subscription_tier_changed'. Got:\n${call}`,
  )
  assert(
    call.includes("entity_type:") && call.includes("'profile'"),
    "logAdminAudit call does not set entity_type 'profile'",
  )
})

test('C4: logAdminAudit invocation includes admin_justification', () => {
  const call = extractAuditCall(TIER, 'logAdminAudit')
  assert(
    call.includes('admin_justification'),
    `logAdminAudit call does not include admin_justification — dual-write contract requires it. Got:\n${call}`,
  )
})

test('C5: logAdminAudit invocation captures both old_values and new_values', () => {
  const call = extractAuditCall(TIER, 'logAdminAudit')
  assert(
    call.includes('old_values:') && call.includes('new_values:'),
    'logAdminAudit call must pass both old_values and new_values for before/after capture',
  )
  // Each block should record subscription_tier and billing_rate_bps.
  assert(
    call.includes('subscription_tier:') && call.includes('billing_rate_bps:'),
    'logAdminAudit values must include subscription_tier and billing_rate_bps',
  )
})

// ─── D. SECRET / PII SAFETY ──────────────────────────────────────────────────

test('D1: no plaintext secrets/keys/tokens in any new audit metadata block', () => {
  const sources: { name: string; src: string; fn: 'logAudit' | 'logAdminAudit' }[] = [
    { name: 'receipt-resend',         src: RESEND, fn: 'logAudit' },
    { name: 'contract-sign',          src: SIGN,   fn: 'logAudit' },
    { name: 'admin-subscription-tier', src: TIER,   fn: 'logAdminAudit' },
  ]
  const forbidden = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'access_token',
    'session_id:',          // session_id is a top-level audit field, but it must
                            // never carry a literal access token value
    'webhook_secret',
    'api_key',
    'apiKey:',
    'Bearer ',
  ]
  for (const { name, src: s, fn } of sources) {
    const call = extractAuditCall(s, fn)
    for (const f of forbidden) {
      assert(
        !call.includes(f),
        `${name} audit call references forbidden token "${f}". Audit metadata must never contain secrets.`,
      )
    }
  }
})

test('D2: receipt-resend and contract-sign audit calls do not embed full email addresses', () => {
  // receipt-resend
  const resendCall = extractAuditCall(RESEND, 'logAudit')
  assert(
    !resendCall.includes('contractorEmail') &&
    !resendCall.includes('funderEmail') &&
    !resendCall.toLowerCase().includes('email:'),
    `receipt-resend audit call must not embed raw email addresses. Got:\n${resendCall}`,
  )
  // contract-sign
  const signCall = extractAuditCall(SIGN, 'logAudit')
  assert(
    !signCall.includes('signer.email') &&
    !signCall.includes('authUser.data.user.email') &&
    !signCall.toLowerCase().includes('email:'),
    `contract-sign audit call must not embed raw email addresses. Got:\n${signCall}`,
  )
})

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — AUDIT P0 COVERAGE TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
