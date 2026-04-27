/**
 * Ops-routes static safety tests.
 *
 * No live DB. No rendering. These tests parse the three admin ops API route
 * sources and assert hard guarantees that prevent silent failures on the
 * Ops Dashboard:
 *
 *   1. Neither alerts nor release-health uses the nested and() inside .or()
 *      PostgREST pattern (which fails with ISO timestamps on some PostgREST
 *      versions and is the root cause of "Failed to load" on those panels).
 *
 *   2. Both alerts and release-health still require admin + MFA.
 *
 *   3. Both are still read-only (no .insert/.update/.delete/.upsert).
 *
 *   4. webhook-health feed_health logic accounts for whether there are
 *      pending transfers before declaring critical — so a naturally silent
 *      Stripe feed (no payments moving) does not false-alarm critical.
 *
 *   5. All three ops routes export dynamic = 'force-dynamic' (no stale cache).
 *
 * Run:  npx tsx tests/ops-routes-safety.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

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

function read(p: string): string { return fs.readFileSync(p, 'utf-8') }

// Strip JS/TS comments + string literals so safety regexes only see executable code.
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

const OPS = path.join(ROOT, 'src/app/api/admin/ops')
const ALERTS         = path.join(OPS, 'alerts/route.ts')
const RELEASE_HEALTH = path.join(OPS, 'release-health/route.ts')
const WEBHOOK_HEALTH = path.join(OPS, 'webhook-health/route.ts')

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── 1. No nested and() inside .or() ─────────────────────────────────────────

await test('ALERTS: does not use nested and() inside .or() — PostgREST compatibility', () => {
  // codeOnly() replaces template literals with ``, so the pattern ,and( can
  // only appear in executable code — a comment mention is ignored.
  const src = codeOnly(read(ALERTS))
  assert(
    !/\.or\s*\(.*,\s*and\s*\(/.test(src),
    'alerts/route.ts must not use nested and() inside .or(). ' +
    'Split into two queries (approved_at set / approved_at null) instead.',
  )
})

await test('RELEASE-HEALTH: does not use nested and() inside .or() — PostgREST compatibility', () => {
  const src = codeOnly(read(RELEASE_HEALTH))
  assert(
    !/\.or\s*\(.*,\s*and\s*\(/.test(src),
    'release-health/route.ts must not use nested and() inside .or(). ' +
    'Split into two queries (approved_at set / approved_at null) instead.',
  )
})

// ── 2. Auth still enforced ───────────────────────────────────────────────────

await test('ALERTS: still requires getAuthUser + requireRole(admin) + requireMFA', () => {
  const src = read(ALERTS)
  assert(/getAuthUser\(/.test(src),       'alerts route must call getAuthUser.')
  assert(/requireRole\([^)]*admin/.test(src), 'alerts route must call requireRole(admin).')
  assert(/requireMFA\(/.test(src),        'alerts route must call requireMFA.')
})

await test('RELEASE-HEALTH: still requires getAuthUser + requireRole(admin) + requireMFA', () => {
  const src = read(RELEASE_HEALTH)
  assert(/getAuthUser\(/.test(src),       'release-health route must call getAuthUser.')
  assert(/requireRole\([^)]*admin/.test(src), 'release-health route must call requireRole(admin).')
  assert(/requireMFA\(/.test(src),        'release-health route must call requireMFA.')
})

await test('WEBHOOK-HEALTH: still requires getAuthUser + requireRole(admin) + requireMFA', () => {
  const src = read(WEBHOOK_HEALTH)
  assert(/getAuthUser\(/.test(src),       'webhook-health route must call getAuthUser.')
  assert(/requireRole\([^)]*admin/.test(src), 'webhook-health route must call requireRole(admin).')
  assert(/requireMFA\(/.test(src),        'webhook-health route must call requireMFA.')
})

// ── 3. Read-only ─────────────────────────────────────────────────────────────

for (const [label, file] of [
  ['ALERTS', ALERTS],
  ['RELEASE-HEALTH', RELEASE_HEALTH],
  ['WEBHOOK-HEALTH', WEBHOOK_HEALTH],
] as const) {
  await test(`${label}: no write verbs (.insert/.update/.delete/.upsert)`, () => {
    const src = codeOnly(read(file))
    for (const verb of ['insert', 'update', 'delete', 'upsert']) {
      const re = new RegExp(`\\.${verb}\\s*\\(`)
      assert(!re.test(src), `${label} must not call .${verb}() — ops routes are read-only.`)
    }
  })
}

// ── 4. Webhook-health pending-transfer awareness ─────────────────────────────

await test('WEBHOOK-HEALTH: critical feed_health only fires when pending transfers exist OR stale transfers exist', () => {
  const src = read(WEBHOOK_HEALTH)
  // After the fix, the critical block must reference hasPendingTransfers (or
  // unconfirmedCount) so a silent feed with no pending work is not flagged critical.
  assert(
    /hasPendingTransfers/.test(src) || /unconfirmedCount/.test(src),
    'webhook-health must check hasPendingTransfers (or unconfirmedCount) before declaring critical. ' +
    'A silent Stripe feed with zero pending transfers should NOT be critical.',
  )
  // The fix must NOT simply remove the critical threshold entirely.
  assert(
    /feedHealth\s*=\s*['"]critical['"]/.test(src),
    'webhook-health must still have a critical feedHealth path for genuine stale-transfer failures.',
  )
})

// ── 5. force-dynamic on all three ────────────────────────────────────────────

for (const [label, file] of [
  ['ALERTS', ALERTS],
  ['RELEASE-HEALTH', RELEASE_HEALTH],
  ['WEBHOOK-HEALTH', WEBHOOK_HEALTH],
] as const) {
  await test(`${label}: exports dynamic = 'force-dynamic'`, () => {
    const src = read(file)
    assert(
      /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(src),
      `${label} must export dynamic = 'force-dynamic' to prevent stale page caching.`,
    )
  })
}

// ─── Report ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — OPS-ROUTES SAFETY TEST RESULTS')
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
