/**
 * Production env validator tests.
 *
 * The validator is a pure function — these tests pass synthetic env objects
 * and assert on the structured ValidationReport. No real env, no real secrets.
 *
 * Coverage:
 *   1. Local dev with empty config → no errors, only warnings (dev still usable).
 *   2. Production with full valid config → ok=true.
 *   3. Production with each critical var missing → ok=false, error logged.
 *   4. Malformed values (wrong prefix, bad URL, bad CIDR, sandbox in prod, etc.)
 *      → errors logged.
 *   5. ADMIN_PROMOTION_ENABLED='true' in production → error.
 *   6. Partial DocuSign config → error (all-or-nothing).
 *   7. Variables summary contains presence+length but never values.
 *   8. Validator never reads from process.env when an envOverride is passed.
 *
 * Run:  npx tsx tests/env-validation.test.ts
 */

import { validateProductionEnv } from '../src/lib/env/validate-production-env'

// ─── Test runner ──────────────────────────────────────────────────────────────

const results: { name: string; passed: boolean; error?: string }[] = []

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// A minimal "all valid" production env. Tests start from this and remove or
// mutate one key at a time.
function fullValidProdEnv(): Record<string, string> {
  return {
    NODE_ENV:                       'production',
    NEXT_PUBLIC_SUPABASE_URL:       'https://abcdefghij.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:  'a'.repeat(80),
    SUPABASE_SERVICE_ROLE_KEY:      'b'.repeat(80),
    SUPABASE_AUTH_WEBHOOK_SECRET:   'c'.repeat(40),
    STRIPE_SECRET_KEY:              'sk_live_' + 'x'.repeat(50),
    STRIPE_WEBHOOK_SECRET:          'whsec_' + 'y'.repeat(40),
    CRON_SECRET:                    'z'.repeat(48),
    APP_URL:                        'https://app.vektrum.co',
    NEXT_PUBLIC_APP_URL:            'https://app.vektrum.co',
    RESEND_API_KEY:                 're_' + 'q'.repeat(40),
    ANTHROPIC_API_KEY:              'sk-ant-' + 'a'.repeat(40),
    DOCUSIGN_INTEGRATION_KEY:       '11111111-2222-3333-4444-555555555555',
    DOCUSIGN_USER_ID:               '22222222-3333-4444-5555-666666666666',
    DOCUSIGN_ACCOUNT_ID:            '33333333-4444-5555-6666-777777777777',
    DOCUSIGN_PRIVATE_KEY:           'A'.repeat(2000),
    DOCUSIGN_BASE_PATH:             'https://www.docusign.net/restapi',
    DOCUSIGN_OAUTH_HOST:            'account.docusign.com',
    DOCUSIGN_WEBHOOK_SECRET:        'd'.repeat(48),
    ADMIN_ALLOWED_IPS:              '10.0.0.0/8,192.168.1.5,203.0.113.0/24',
    // ADMIN_PROMOTION_ENABLED intentionally unset (default-disabled)
  }
}

function findError(report: ReturnType<typeof validateProductionEnv>, variable: string): boolean {
  return report.errors.some(e => e.variable === variable)
}

function findWarning(report: ReturnType<typeof validateProductionEnv>, variable: string): boolean {
  return report.warnings.some(w => w.variable === variable)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── 1. Local dev with empty env → only warnings, never errors ────────────────

await test('LOCAL DEV: empty env with NODE_ENV=development produces 0 errors', () => {
  const r = validateProductionEnv({ NODE_ENV: 'development' })
  assert(r.environment === 'development', `expected environment=development, got ${r.environment}`)
  assert(r.errors.length === 0,
    `Local dev should not block on missing prod config. Got ${r.errors.length} errors: ${r.errors.map(e => e.variable).join(', ')}`)
  assert(r.warnings.length > 0,
    'Expected warnings for missing prod-critical vars in dev (Supabase, Stripe, etc.)')
})

await test('LOCAL DEV: ok=true even with empty env (warnings do not flip ok)', () => {
  const r = validateProductionEnv({ NODE_ENV: 'development' })
  assert(r.ok === true, 'ok must be true in dev with no errors, regardless of warning count.')
})

// ── 2. Full valid production env → no errors ─────────────────────────────────

await test('PROD HAPPY PATH: full valid config → ok=true, 0 errors', () => {
  const r = validateProductionEnv(fullValidProdEnv())
  assert(r.ok === true, `Expected ok=true. Errors: ${r.errors.map(e => `${e.variable}: ${e.message}`).join(' | ')}`)
  assert(r.errors.length === 0, `Expected 0 errors, got ${r.errors.length}.`)
})

// ── 3. Each critical var missing → error ─────────────────────────────────────

const criticalVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CRON_SECRET',
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_USER_ID',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_PRIVATE_KEY',
  'DOCUSIGN_BASE_PATH',
  'DOCUSIGN_OAUTH_HOST',
  'DOCUSIGN_WEBHOOK_SECRET',
] as const

for (const v of criticalVars) {
  await test(`PROD MISSING: ${v} unset → error and ok=false`, () => {
    const env = fullValidProdEnv()
    delete (env as Record<string, string | undefined>)[v]
    const r = validateProductionEnv(env)
    assert(findError(r, v), `Expected error for missing ${v}. Got errors: ${r.errors.map(e => e.variable).join(', ')}`)
    assert(r.ok === false, `Expected ok=false when ${v} is missing.`)
  })
}

// ── 4. Malformed values → error ──────────────────────────────────────────────

await test('PROD MALFORMED: STRIPE_SECRET_KEY without sk_ prefix → error', () => {
  const env = { ...fullValidProdEnv(), STRIPE_SECRET_KEY: 'pk_live_abc' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'STRIPE_SECRET_KEY'), 'Expected error for non-sk_ Stripe key.')
})

await test('PROD MALFORMED: STRIPE_SECRET_KEY=sk_test_* in production → error', () => {
  const env = { ...fullValidProdEnv(), STRIPE_SECRET_KEY: 'sk_test_' + 'x'.repeat(40) }
  const r = validateProductionEnv(env)
  assert(findError(r, 'STRIPE_SECRET_KEY'), 'Expected error for sk_test_* in production.')
})

await test('PROD MALFORMED: STRIPE_WEBHOOK_SECRET without whsec_ prefix → error', () => {
  const env = { ...fullValidProdEnv(), STRIPE_WEBHOOK_SECRET: 'abc123' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'STRIPE_WEBHOOK_SECRET'), 'Expected error for non-whsec_ Stripe webhook secret.')
})

await test('PROD MALFORMED: CRON_SECRET shorter than 24 chars → error', () => {
  const env = { ...fullValidProdEnv(), CRON_SECRET: 'short' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'CRON_SECRET'), 'Expected error for short CRON_SECRET.')
})

await test('PROD MALFORMED: SUPABASE_SERVICE_ROLE_KEY equal to anon key → error', () => {
  const sameKey = 'a'.repeat(80)
  const env = {
    ...fullValidProdEnv(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: sameKey,
    SUPABASE_SERVICE_ROLE_KEY:      sameKey,
  }
  const r = validateProductionEnv(env)
  assert(findError(r, 'SUPABASE_SERVICE_ROLE_KEY'),
    'Service-role key equal to anon key must be flagged — service-role privileges are not in effect.')
})

await test('PROD MALFORMED: DOCUSIGN_BASE_PATH points at sandbox in production → error', () => {
  const env = { ...fullValidProdEnv(), DOCUSIGN_BASE_PATH: 'https://demo.docusign.net/restapi' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'DOCUSIGN_BASE_PATH'), 'Production must not point at the DocuSign demo host.')
})

await test('PROD MALFORMED: DOCUSIGN_OAUTH_HOST as URL (not hostname) → error', () => {
  const env = { ...fullValidProdEnv(), DOCUSIGN_OAUTH_HOST: 'https://account.docusign.com/' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'DOCUSIGN_OAUTH_HOST'), 'OAUTH_HOST must be a hostname, not a URL.')
})

await test('PROD MALFORMED: DOCUSIGN_PRIVATE_KEY not base64-shaped → error', () => {
  const env = { ...fullValidProdEnv(), DOCUSIGN_PRIVATE_KEY: '-----BEGIN PRIVATE KEY----- garbage <not base64> ====' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'DOCUSIGN_PRIVATE_KEY'),
    'Raw PEM must be flagged so the operator knows to base64-encode it.')
})

await test('PROD MALFORMED: ADMIN_ALLOWED_IPS contains a non-IP entry → error', () => {
  const env = { ...fullValidProdEnv(), ADMIN_ALLOWED_IPS: '10.0.0.0/8,not-an-ip,203.0.113.5' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'ADMIN_ALLOWED_IPS'), 'Expected error for bad CIDR/IP entry.')
})

await test('PROD MALFORMED: ADMIN_ALLOWED_IPS with /33 prefix → error', () => {
  const env = { ...fullValidProdEnv(), ADMIN_ALLOWED_IPS: '10.0.0.0/33' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'ADMIN_ALLOWED_IPS'), 'Expected error for invalid CIDR prefix > 32.')
})

await test('PROD VALID: ADMIN_ALLOWED_IPS with whitespace + multi-entry parses cleanly', () => {
  const env = { ...fullValidProdEnv(), ADMIN_ALLOWED_IPS: ' 10.0.0.0/8 , 192.168.1.5 ,203.0.113.0/24' }
  const r = validateProductionEnv(env)
  assert(!findError(r, 'ADMIN_ALLOWED_IPS'), 'Whitespace-padded valid CIDRs should parse.')
})

await test('PROD VALID: ADMIN_ALLOWED_IPS unset is a warning, not an error', () => {
  const env = fullValidProdEnv()
  delete (env as Record<string, string | undefined>).ADMIN_ALLOWED_IPS
  const r = validateProductionEnv(env)
  assert(!findError(r, 'ADMIN_ALLOWED_IPS'), 'Unset ADMIN_ALLOWED_IPS must NOT be an error.')
  assert(findWarning(r, 'ADMIN_ALLOWED_IPS'), 'Unset ADMIN_ALLOWED_IPS in prod should be a warning.')
})

// ── 5. ADMIN_PROMOTION_ENABLED policy ────────────────────────────────────────

await test('PROD POLICY: ADMIN_PROMOTION_ENABLED unset → no error (default-disabled is correct)', () => {
  const r = validateProductionEnv(fullValidProdEnv())
  assert(!findError(r, 'ADMIN_PROMOTION_ENABLED'),
    'Unset ADMIN_PROMOTION_ENABLED is the desired production posture (admin promotion disabled by default).')
})

await test('PROD POLICY: ADMIN_PROMOTION_ENABLED="true" in production → error', () => {
  const env = { ...fullValidProdEnv(), ADMIN_PROMOTION_ENABLED: 'true' }
  const r = validateProductionEnv(env)
  assert(findError(r, 'ADMIN_PROMOTION_ENABLED'),
    'ADMIN_PROMOTION_ENABLED must not be left "true" in production.')
})

await test('DEV POLICY: ADMIN_PROMOTION_ENABLED="true" in dev → no error', () => {
  const r = validateProductionEnv({ NODE_ENV: 'development', ADMIN_PROMOTION_ENABLED: 'true' })
  assert(!findError(r, 'ADMIN_PROMOTION_ENABLED'),
    'Dev may keep ADMIN_PROMOTION_ENABLED=true; the rule is production-only.')
})

// ── 6. Partial DocuSign config → all-or-nothing error ────────────────────────

await test('DOCUSIGN: partial config in dev → DOCUSIGN_* error (all-or-nothing rule)', () => {
  const r = validateProductionEnv({
    NODE_ENV: 'development',
    DOCUSIGN_INTEGRATION_KEY: 'abc',
    // intentionally missing the other 6 vars
  })
  assert(findError(r, 'DOCUSIGN_*'),
    'Partial DocuSign config must produce a DOCUSIGN_* aggregate error so the operator knows to set all or none.')
})

// ── 7. Variables summary contains presence+length, never values ──────────────

await test('SAFETY: variables summary never contains the actual secret value', () => {
  const env = fullValidProdEnv()
  const r = validateProductionEnv(env)
  const json = JSON.stringify(r)
  // The Stripe secret in the fixture is 'sk_live_xxxxx...'. The full string must
  // NEVER appear in the report — only its length.
  assert(!json.includes(env.STRIPE_SECRET_KEY),
    'STRIPE_SECRET_KEY value leaked into the validation report — values must never be returned.')
  assert(!json.includes(env.SUPABASE_SERVICE_ROLE_KEY),
    'SUPABASE_SERVICE_ROLE_KEY value leaked into the validation report.')
  assert(!json.includes(env.DOCUSIGN_PRIVATE_KEY),
    'DOCUSIGN_PRIVATE_KEY value leaked into the validation report.')
  assert(!json.includes(env.CRON_SECRET),
    'CRON_SECRET value leaked into the validation report.')
})

await test('SAFETY: variables summary records length for present vars and 0 for missing', () => {
  const env = fullValidProdEnv()
  delete (env as Record<string, string | undefined>).RESEND_API_KEY
  const r = validateProductionEnv(env)
  assert(r.variables.STRIPE_SECRET_KEY.present === true,
    'STRIPE_SECRET_KEY should be marked present.')
  assert(r.variables.STRIPE_SECRET_KEY.length === env.STRIPE_SECRET_KEY.length,
    'Length should match the input string length.')
  assert(r.variables.RESEND_API_KEY.present === false,
    'RESEND_API_KEY should be marked absent.')
  assert(r.variables.RESEND_API_KEY.length === 0,
    'Length should be 0 for absent variables.')
})

// ── 8. Validator does not leak through to process.env when override given ────

await test('SAFETY: passing envOverride does NOT consult process.env for any tracked key', () => {
  // Stash a fake real value in process.env to prove it is ignored.
  const sentinel = '__SENTINEL_VALUE_THAT_MUST_NOT_APPEAR__'
  const prev = process.env.STRIPE_SECRET_KEY
  process.env.STRIPE_SECRET_KEY = sentinel
  try {
    const r = validateProductionEnv({ NODE_ENV: 'development' })
    const json = JSON.stringify(r)
    assert(!json.includes(sentinel),
      'Validator must read solely from envOverride when one is provided — process.env must be ignored.')
    assert(r.variables.STRIPE_SECRET_KEY.present === false,
      'STRIPE_SECRET_KEY in envOverride is unset; report must reflect the override, not process.env.')
  } finally {
    if (prev === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = prev
  }
})

// ── 9. NODE_ENV detection ────────────────────────────────────────────────────

await test('ENV: unknown NODE_ENV is treated as "unknown" (warnings only)', () => {
  const r = validateProductionEnv({ NODE_ENV: 'staging' })
  assert(r.environment === 'unknown', `expected environment=unknown, got ${r.environment}`)
  assert(r.errors.length === 0,
    'Unknown NODE_ENV must not error on missing prod vars (it is not production).')
})

// ── Report ───────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — PRODUCTION ENV VALIDATION TEST RESULTS')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter(r => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)
}

main()
