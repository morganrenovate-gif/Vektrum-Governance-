/**
 * Retainage math and UI safety tests.
 *
 * No live DB. No rendering. Two categories:
 *
 * A. Pure-arithmetic assertions against calculateRetainage() from billing.ts.
 *    These prove the math is correct before any DB or UI is involved.
 *
 * B. Source-parse assertions against the contractor payments page and the
 *    funder retainage release route, locking in role-safety guarantees.
 *
 * Checks:
 *  1. 10% retainage on $100,000 = $10,000 withheld, $90,000 net.
 *  2. 5% retainage on $50,000 = $2,500 withheld, $47,500 net.
 *  3. 0% retainage = $0 withheld, full gross to contractor.
 *  4. Net = gross − retainage (invariant).
 *  5. Retainage rounds to 2 decimal places (matches DB ROUND(..., 2)).
 *  6. grossAmount ≤ 0 throws.
 *  7. retainagePercentage ≥ 100 throws.
 *  8. retainagePercentage < 0 throws.
 *  9. Contractor payments page fetches retainage_percentage field.
 * 10. Contractor payments page fetches retainage_held field.
 * 11. Contractor payments page fetches retainage_released field.
 * 12. Contractor payments page fetches billing_records with retainage_amount.
 * 13. Contractor payments page shows "Gross Earned" label.
 * 14. Contractor payments page shows "Retainage Withheld" label.
 * 15. Contractor payments page shows "Net Released" label.
 * 16. Contractor payments page shows "Retainage Released" label.
 * 17. Contractor payments page shows "Retainage Remaining" label.
 * 18. Contractor payments page has NO retainage release button or form.
 * 19. Funder retainage release route requires getAuthUser.
 * 20. Funder retainage release route blocks non-funder roles.
 * 21. Funder retainage release route requires MFA.
 * 22. Release gate file is unchanged (no retainage modification).
 * 23. Stripe webhook file is unchanged (no cross-contamination).
 *
 * Run:  npx tsx tests/retainage-math.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { calculateRetainage } from '../src/lib/engine/billing.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

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

function assertThrows(fn: () => unknown, msgContains: string) {
  let threw = false
  try { fn() } catch (e) {
    threw = true
    const msg = e instanceof Error ? e.message : String(e)
    assert(
      msg.includes(msgContains),
      `Expected error containing "${msgContains}" but got: "${msg}"`,
    )
  }
  if (!threw) throw new Error(`Expected an error containing "${msgContains}" but no error was thrown.`)
}

function read(p: string): string { return fs.readFileSync(path.resolve(ROOT, p), 'utf-8') }

/** Strip JS/TS comments and string literals — for write-verb safety checks only. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

const PAYMENTS_PAGE   = 'src/app/(app)/dashboard/contractor/payments/page.tsx'
const RETAINAGE_ROUTE = 'src/app/api/deals/[dealId]/retainage/release/route.ts'
const GATE            = 'src/lib/engine/release-gate.ts'
const STRIPE_WH       = 'src/app/api/stripe/webhook/route.ts'

async function main() {

// ─── A. Pure arithmetic ───────────────────────────────────────────────────────

await test('1. 10% on $100,000 = $10,000 withheld, $90,000 net', () => {
  const r = calculateRetainage(100_000, 10)
  assert(r.grossAmount        === 100_000, `grossAmount: expected 100000 got ${r.grossAmount}`)
  assert(r.retainageAmount    ===  10_000, `retainageAmount: expected 10000 got ${r.retainageAmount}`)
  assert(r.netToContractor    ===  90_000, `netToContractor: expected 90000 got ${r.netToContractor}`)
  assert(r.retainagePercentage ===     10, `retainagePercentage: expected 10 got ${r.retainagePercentage}`)
})

await test('2. 5% on $50,000 = $2,500 withheld, $47,500 net', () => {
  const r = calculateRetainage(50_000, 5)
  assert(r.retainageAmount === 2_500,  `retainageAmount: expected 2500 got ${r.retainageAmount}`)
  assert(r.netToContractor === 47_500, `netToContractor: expected 47500 got ${r.netToContractor}`)
})

await test('3. 0% retainage = $0 withheld, full gross to contractor', () => {
  const r = calculateRetainage(75_000, 0)
  assert(r.retainageAmount === 0,      `retainageAmount: expected 0 got ${r.retainageAmount}`)
  assert(r.netToContractor === 75_000, `netToContractor: expected 75000 got ${r.netToContractor}`)
})

await test('4. Net invariant: netToContractor === grossAmount − retainageAmount', () => {
  for (const [gross, pct] of [[12_500, 10], [88_000, 7.5], [1_000, 0], [250_000, 5]] as const) {
    const r = calculateRetainage(gross, pct)
    const expected = Math.round((gross - r.retainageAmount) * 100) / 100
    assert(
      Math.abs(r.netToContractor - expected) < 0.001,
      `Net invariant failed for gross=${gross} pct=${pct}: net=${r.netToContractor} expected=${expected}`,
    )
  }
})

await test('5. Retainage rounds to 2 decimal places (matches DB ROUND(..., 2))', () => {
  // 10% of $1,333.33 = $133.333 → rounded to $133.33
  const r = calculateRetainage(1_333.33, 10)
  const decimals = r.retainageAmount.toString().split('.')[1]?.length ?? 0
  assert(decimals <= 2, `retainageAmount has more than 2 decimal places: ${r.retainageAmount}`)
  // Also check the specific value
  assert(r.retainageAmount === 133.33, `Expected 133.33, got ${r.retainageAmount}`)
})

await test('6. grossAmount ≤ 0 throws', () => {
  assertThrows(() => calculateRetainage(0, 10),  'grossAmount must be > 0')
  assertThrows(() => calculateRetainage(-1, 10), 'grossAmount must be > 0')
})

await test('7. retainagePercentage ≥ 100 throws', () => {
  assertThrows(() => calculateRetainage(1000, 100), 'retainagePercentage must be in [0, 100)')
  assertThrows(() => calculateRetainage(1000, 150), 'retainagePercentage must be in [0, 100)')
})

await test('8. retainagePercentage < 0 throws', () => {
  assertThrows(() => calculateRetainage(1000, -1), 'retainagePercentage must be in [0, 100)')
})

// ─── B. Contractor payments page — data fetch ─────────────────────────────────

await test('9. Contractor payments page fetches retainage_percentage field', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('retainage_percentage'),
    'contractor/payments/page.tsx does not fetch retainage_percentage from deals. ' +
    'Add retainage_percentage to the deals select query.',
  )
})

await test('10. Contractor payments page fetches retainage_held field', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('retainage_held'),
    'contractor/payments/page.tsx does not fetch retainage_held from deals.',
  )
})

await test('11. Contractor payments page fetches retainage_released field', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('retainage_released'),
    'contractor/payments/page.tsx does not fetch retainage_released from deals.',
  )
})

await test('12. Contractor payments page fetches billing_records with retainage_amount', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('billing_records') && src.includes('retainage_amount'),
    'contractor/payments/page.tsx does not fetch billing_records.retainage_amount. ' +
    'This is needed to reconstruct gross per release (net + withheld).',
  )
})

// ─── C. Contractor payments page — UI labels ──────────────────────────────────

await test('13. Contractor payments page shows "Gross Earned" label', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('Gross Earned'),
    'contractor/payments/page.tsx does not show a "Gross Earned" stat block.',
  )
})

await test('14. Contractor payments page shows "Retainage Withheld" label', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('Retainage Withheld'),
    'contractor/payments/page.tsx does not show a "Retainage Withheld" stat block.',
  )
})

await test('15. Contractor payments page shows "Net Released" label', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('Net Released'),
    'contractor/payments/page.tsx does not show a "Net Released" stat block.',
  )
})

await test('16. Contractor payments page shows "Retainage Released" label', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('Retainage Released'),
    'contractor/payments/page.tsx does not show a "Retainage Released" stat block.',
  )
})

await test('17. Contractor payments page shows "Retainage Remaining" label', () => {
  const src = read(PAYMENTS_PAGE)
  assert(
    src.includes('Retainage Remaining'),
    'contractor/payments/page.tsx does not show a "Retainage Remaining" stat block.',
  )
})

// ─── D. Contractor payments page — no release action ─────────────────────────

await test('18. Contractor payments page has NO retainage release button or form', () => {
  const src = read(PAYMENTS_PAGE)
  // Check codeOnly so we don't false-positive on comments mentioning "release"
  const code = codeOnly(src)
  const retainageReleasePatterns = [
    /retainage.*release.*button/i,
    /release.*retainage.*button/i,
    /\/api\/deals\/.*\/retainage\/release/,
    /retainage.*release.*form/i,
  ]
  for (const pattern of retainageReleasePatterns) {
    assert(
      !pattern.test(code),
      `contractor/payments/page.tsx contains a retainage release control (${pattern}). ` +
      'Retainage release is funder-only — contractors must contact their funder.',
    )
  }
  // Also ensure no POST to the retainage release route
  assert(
    !code.includes('/retainage/release'),
    'contractor/payments/page.tsx calls /retainage/release — this is a funder-only action.',
  )
})

// ─── E. Funder retainage release route — auth guarantees ─────────────────────

await test('19. Funder retainage release route requires getAuthUser', () => {
  const src = read(RETAINAGE_ROUTE)
  assert(
    /getAuthUser\(/.test(src),
    'retainage/release/route.ts does not call getAuthUser — auth is not enforced.',
  )
})

await test('20. Funder retainage release route blocks non-funder roles', () => {
  const src = read(RETAINAGE_ROUTE)
  assert(
    src.includes('funder'),
    'retainage/release/route.ts does not check for funder role. ' +
    'Only funders (and admins) should be able to release retainage.',
  )
  // Confirm it explicitly rejects non-funders
  assert(
    /role\s*!==\s*["']funder["']/.test(src) || /requireRole\([^)]*funder/.test(src),
    'retainage/release/route.ts does not explicitly block non-funder roles.',
  )
})

await test('21. Funder retainage release route requires MFA', () => {
  const src = read(RETAINAGE_ROUTE)
  assert(
    /requireMFA\(/.test(src),
    'retainage/release/route.ts does not call requireMFA — MFA is required for financial writes.',
  )
})

// ─── F. Unchanged safety surfaces ─────────────────────────────────────────────

await test('22. Release gate file is unchanged (no retainage modification)', () => {
  const rawSrc  = read(GATE)
  const codeSrc = codeOnly(rawSrc)
  // Gate should still reference change_orders (Condition 7 check)
  assert(
    rawSrc.includes('change_orders'),
    'release-gate.ts no longer references change_orders — Condition 7 may have been removed.',
  )
  // Gate must remain read-only — no write verbs
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(codeSrc), `release-gate.ts calls .${verb}() — gate must remain read-only.`)
  }
})

await test('23. Stripe webhook file is unchanged (no cross-contamination)', () => {
  const src = read(STRIPE_WH)
  assert(
    !src.includes('retainage_percentage') && !src.includes('retainage_held'),
    'Stripe webhook route now references retainage fields — unexpected cross-contamination.',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — RETAINAGE MATH & UI SAFETY TEST RESULTS')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter((r) => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)

} // end main()

main()
