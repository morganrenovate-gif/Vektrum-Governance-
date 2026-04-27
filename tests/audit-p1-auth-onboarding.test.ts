/**
 * Audit logging — P1 commit 1: auth_logout + onboarding_completed
 *
 * Pins two audit gaps that were closed in this commit. P0 audit work
 * (receipt_resent, contract_signing_initiated, subscription_tier_changed
 * dual-write) lives in audit-p0-coverage.test.ts and is not duplicated here.
 *
 *   A. AUTH LOGOUT
 *      A1. /auth/logout imports logAudit
 *      A2. Calls logAudit with action 'auth_logout'
 *      A3. Audit metadata is minimal — no cookies/tokens/session/headers
 *      A4. The audit call is gated on a successful getUser() (anonymous
 *          requests must NOT produce an audit row)
 *      A5. Audit precedes signOut so user.id is captured before the session
 *          cookie is cleared
 *
 *   B. ONBOARDING COMPLETED
 *      B1. /api/onboarding imports logAudit
 *      B2. Calls logAudit with action 'onboarding_completed'
 *      B3. Audit is invoked AFTER the profile update succeeds (success path)
 *      B4. Audit metadata does not include raw bank/Stripe/token payloads
 *
 *   C. CROSS-CUTTING SAFETY
 *      C1. No plaintext secrets / bearer tokens / session ids / cookie names
 *          appear in either new audit metadata block.
 *
 * Run:  npx tsx tests/audit-p1-auth-onboarding.test.ts
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

const LOGOUT_PATH     = 'src/app/auth/logout/route.ts'
const ONBOARDING_PATH = 'src/app/api/onboarding/route.ts'

const LOGOUT     = src(LOGOUT_PATH)
const ONBOARDING = src(ONBOARDING_PATH)

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
 * Extracts the literal source of an audit call (`await logAudit({...})`)
 * so individual fields can be asserted against the arguments object only.
 */
function extractAuditCall(source: string, fnName: 'logAudit' | 'logAdminAudit'): string {
  const opener = `await ${fnName}(`
  const idx = source.indexOf(opener)
  if (idx === -1) throw new Error(`${fnName}( not found in source`)
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

// ─── A. AUTH LOGOUT ──────────────────────────────────────────────────────────

test('A1: logout route imports logAudit', () => {
  assert(
    LOGOUT.includes("from '@/lib/engine/audit'") && LOGOUT.includes('logAudit'),
    'logout route does not import logAudit',
  )
})

test('A2: logout calls logAudit with action "auth_logout"', () => {
  const call = extractAuditCall(LOGOUT, 'logAudit')
  assert(
    call.includes("action:") && call.includes("'auth_logout'"),
    `logout audit call does not use action 'auth_logout'. Got:\n${call}`,
  )
  assert(
    call.includes("entity_type:") && call.includes("'profile'"),
    "logout audit call does not set entity_type 'profile'",
  )
})

test('A3: logout audit metadata is minimal — no cookies/tokens/session/headers', () => {
  const call = extractAuditCall(LOGOUT, 'logAudit')
  // Forbid any reference to common session/header identifiers in the metadata
  // block. The audit row must carry only the user id and a static route tag.
  const forbidden = [
    'cookie',
    'cookies',
    'set-cookie',
    'authorization',
    'access_token',
    'refresh_token',
    'session_token',
    'session_id:',
    'Bearer',
    'request.headers',
    'headers.get',
    'JWT',
    'jwt',
  ]
  for (const f of forbidden) {
    assert(
      !call.toLowerCase().includes(f.toLowerCase()) ||
        // permit the literal route string itself which contains the word `auth`
        // but no token material
        f === 'authorization' && !call.toLowerCase().includes('authorization'),
      `logout audit metadata appears to reference "${f}". Audit metadata must not capture session/header data.`,
    )
  }
  // Positive shape check
  assert(call.includes('route:'), 'logout audit metadata should include a static route tag')
})

test('A4: logout audit call is gated on a successful getUser()', () => {
  // The audit invocation must sit inside an `if (user)` (or equivalent)
  // guard so anonymous requests do not produce a phantom audit row.
  const auditIdx = LOGOUT.indexOf('logAudit(')
  const userGate = LOGOUT.indexOf('if (user)')
  assert(userGate > -1, 'logout route does not gate audit on `if (user)`')
  assert(
    userGate < auditIdx,
    'logout route invokes logAudit before checking that a user exists — anonymous requests would generate empty audit rows',
  )
})

test('A5: logout audit precedes signOut (captures user before session cookie is cleared)', () => {
  // The header JSDoc references `supabase.auth.signOut()` in prose. Strip
  // comment lines before indexing so we measure only executable code.
  const codeOnly = LOGOUT
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
    })
    .join('\n')

  const auditIdx   = codeOnly.indexOf('logAudit(')
  const signOutIdx = codeOnly.indexOf('supabase.auth.signOut(')
  assert(auditIdx > -1 && signOutIdx > -1, 'expected both logAudit and signOut to be present in executable code')
  assert(
    auditIdx < signOutIdx,
    'logAudit must run before signOut so user.id is captured before the session is cleared',
  )
})

// ─── B. ONBOARDING COMPLETED ─────────────────────────────────────────────────

test('B1: onboarding route imports logAudit', () => {
  assert(
    ONBOARDING.includes("from '@/lib/engine/audit'") && ONBOARDING.includes('logAudit'),
    'onboarding route does not import logAudit',
  )
})

test('B2: onboarding calls logAudit with action "onboarding_completed"', () => {
  const call = extractAuditCall(ONBOARDING, 'logAudit')
  assert(
    call.includes("action:") && call.includes("'onboarding_completed'"),
    `onboarding audit call does not use action 'onboarding_completed'. Got:\n${call}`,
  )
  assert(
    call.includes("entity_type:") && call.includes("'profile'"),
    "onboarding audit call does not set entity_type 'profile'",
  )
  // new_values should record the irreversible boolean transition.
  assert(
    call.includes('new_values:') && call.includes('onboarding_complete: true'),
    `onboarding audit call must record new_values.onboarding_complete = true. Got:\n${call}`,
  )
})

test('B3: logAudit is invoked AFTER the profile update (success path only)', () => {
  // The route currently checks `if (updateError)` and returns early. The
  // audit must come after that guard so failed updates never produce a
  // phantom "completed" audit row.
  const updateIdx = ONBOARDING.indexOf("update({ onboarding_complete: true")
  const guardIdx  = ONBOARDING.indexOf('if (updateError)')
  const auditIdx  = ONBOARDING.indexOf('logAudit(')
  assert(updateIdx > -1 && guardIdx > -1 && auditIdx > -1,
    'expected the profile update, error guard, and logAudit call all to exist')
  assert(
    auditIdx > guardIdx && guardIdx > updateIdx,
    'logAudit must execute after the update + error guard so failed updates do not log a completed event',
  )
})

test('B4: onboarding audit metadata does not include sensitive payloads', () => {
  const call = extractAuditCall(ONBOARDING, 'logAudit')
  const forbidden = [
    // Stripe / bank
    'stripe_account',
    'stripe_secret',
    'STRIPE_SECRET_KEY',
    'routing_number',
    'account_number',
    'iban',
    'bank_account',
    // Tokens
    'access_token',
    'refresh_token',
    'jwt',
    'Bearer',
    // Raw form payloads
    'request.json',
    'await req.json',
  ]
  for (const f of forbidden) {
    assert(
      !call.toLowerCase().includes(f.toLowerCase()),
      `onboarding audit call references forbidden token "${f}". Audit must not include sensitive payloads.`,
    )
  }
})

// ─── C. CROSS-CUTTING SAFETY ─────────────────────────────────────────────────

test('C1: no plaintext secrets/keys/tokens in either new audit metadata block', () => {
  const sources: { name: string; src: string }[] = [
    { name: 'auth-logout',       src: LOGOUT },
    { name: 'onboarding',        src: ONBOARDING },
  ]
  const forbidden = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'webhook_secret',
    'apiKey:',
    'api_key:',
  ]
  for (const { name, src: s } of sources) {
    const call = extractAuditCall(s, 'logAudit')
    for (const f of forbidden) {
      assert(
        !call.includes(f),
        `${name} audit call references forbidden token "${f}". Audit metadata must never carry secrets.`,
      )
    }
  }
})

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — AUDIT P1 AUTH+ONBOARDING TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
