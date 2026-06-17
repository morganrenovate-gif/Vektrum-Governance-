/**
 * tests/sov-balance-invariant.test.ts
 *
 * Proves that the single source of truth for SOV arithmetic (lib/engine/sov.ts)
 * is correct, that the three places which used to duplicate the formula all now
 * import from that module, and that the release route updates all derived fields
 * (not just previous_released).
 *
 * No live DB. No rendering. Pure arithmetic + source-grep.
 *
 * Invariants asserted:
 *   1.  revised_value = scheduled_value + approved_change_orders
 *   2.  balance_to_finish = max(0, revised_value - previous_released - current_requested)
 *   3.  percent_complete = clamp(0–100, (previous_released + current_requested) / revised_value × 100)
 *   4.  balance_to_finish ≥ 0 always
 *   5.  percent_complete ∈ [0, 100] always
 *   6.  After a partial draw, balance_to_finish decreases by exactly the draw amount
 *   7.  After a full draw, balance_to_finish = 0 and percent_complete = 100
 *   8.  released_amount + fees + reserved + retainage_held ≤ funded_amount (deal invariant)
 *   9.  deal balance invariant throws when committed > funded_amount
 *
 * Source-grep checks:
 *  10.  sov/route.ts (GET/POST) no longer contains a local computeSovFields definition
 *  11.  sov/[itemId]/route.ts (PATCH) no longer contains a local computeSovFields definition
 *  12.  Both SOV routes import from lib/engine/sov
 *  13.  The release route imports computeSovFields from lib/engine/sov
 *  14.  The release route updates balance_to_finish after a draw (not just previous_released)
 *  15.  The release route updates percent_complete after a draw
 *  16.  The release route SOV update is awaited (not fire-and-forget void)
 *  17.  money-summary.tsx uses fundedAmount for remaining (not totalAmount)
 *  18.  lib/engine/sov.ts exports computeSovFields and assertDealBalanceInvariant
 *  19.  Wired into npm test
 *
 * Run: npx tsx tests/sov-balance-invariant.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeSovFields, assertDealBalanceInvariant } from '../src/lib/engine/sov.js'

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

function approxEq(a: number, b: number, eps = 0.005): boolean {
  return Math.abs(a - b) <= eps
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

// ── Source paths ─────────────────────────────────────────────────────────────

const SOV_MODULE    = 'src/lib/engine/sov.ts'
const SOV_GET_POST  = 'src/app/api/deals/[dealId]/sov/route.ts'
const SOV_PATCH     = 'src/app/api/deals/[dealId]/sov/[itemId]/route.ts'
const RELEASE_RT    = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const MONEY_SUMMARY = 'src/components/deal/money-summary.tsx'
const PKG           = 'package.json'

// ─────────────────────────────────────────────────────────────────────────────

async function main() {

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — Pure arithmetic invariants
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section A: SOV arithmetic invariants ────────────────────────────')

// 1. revised_value
await test('1. revised_value = scheduled_value + approved_change_orders', () => {
  const { revised_value } = computeSovFields(100_000, 20_000, 0, 0)
  assert(approxEq(revised_value, 120_000), `Expected 120000, got ${revised_value}`)
})

// 2. balance_to_finish with no prior releases or requests
await test('2. balance_to_finish = revised_value when nothing drawn', () => {
  const { balance_to_finish, revised_value } = computeSovFields(100_000, 0, 0, 0)
  assert(approxEq(balance_to_finish, revised_value), `Expected ${revised_value}, got ${balance_to_finish}`)
})

// 3. balance_to_finish accounts for previous_released + current_requested
await test('3. balance_to_finish = revised_value - previous_released - current_requested', () => {
  const sv = 100_000, co = 0, prev = 30_000, curr = 20_000
  const { balance_to_finish, revised_value } = computeSovFields(sv, co, prev, curr)
  const expected = revised_value - prev - curr
  assert(approxEq(balance_to_finish, expected), `Expected ${expected}, got ${balance_to_finish}`)
})

// 4. balance_to_finish never negative (even when draws exceed revised_value)
await test('4. balance_to_finish ≥ 0 even when draws exceed revised_value', () => {
  const { balance_to_finish } = computeSovFields(100_000, 0, 80_000, 40_000)
  assert(balance_to_finish >= 0, `Expected ≥ 0, got ${balance_to_finish}`)
})

// 5. percent_complete clamped to [0, 100]
await test('5. percent_complete clamped to [0, 100]', () => {
  const { percent_complete: pct1 } = computeSovFields(100_000, 0, 0, 0)
  assert(pct1 >= 0 && pct1 <= 100, `Expected [0,100], got ${pct1}`)
  const { percent_complete: pct2 } = computeSovFields(100_000, 0, 120_000, 0)
  assert(pct2 >= 0 && pct2 <= 100, `Expected [0,100], got ${pct2}`)
})

// 6. partial draw — balance decreases by draw amount
await test('6. partial draw: balance_to_finish decreases by draw amount', () => {
  const sv = 200_000, co = 0
  // Before: contractor has requested 50k (pending), no prior releases
  const before  = computeSovFields(sv, co, 0, 50_000)
  // After release: that 50k moves to previous_released; contractor requests next 50k
  const afterRelease = computeSovFields(sv, co, 50_000, 50_000)
  const delta = before.balance_to_finish - afterRelease.balance_to_finish
  assert(approxEq(delta, 50_000), `Expected delta 50000, got ${delta}`)
})

// 7. full draw — balance = 0 and percent = 100
await test('7. full draw: balance_to_finish = 0, percent_complete = 100', () => {
  const sv = 100_000, co = 0
  const { balance_to_finish, percent_complete } = computeSovFields(sv, co, 100_000, 0)
  assert(approxEq(balance_to_finish, 0), `Expected balance 0, got ${balance_to_finish}`)
  assert(approxEq(percent_complete, 100), `Expected pct 100, got ${percent_complete}`)
})

// 8. deal-level balance invariant — valid deal passes silently
await test('8. deal balance invariant: committed ≤ funded_amount passes', () => {
  assertDealBalanceInvariant({
    funded_amount:   1_000_000,
    released_amount: 300_000,
    fees_collected:  9_000,
    reserved_amount: 0,
    retainage_held:  30_000,
  })
})

// 9. deal-level balance invariant — violation throws
await test('9. deal balance invariant: throws when committed > funded', () => {
  let threw = false
  try {
    assertDealBalanceInvariant({
      funded_amount:   500_000,
      released_amount: 400_000,
      fees_collected:  50_000,
      reserved_amount: 100_000, // 400 + 50 + 100 = 550 > 500
      retainage_held:  0,
    })
  } catch {
    threw = true
  }
  assert(threw, 'Expected invariant violation to throw')
})

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — Source-grep checks
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── Section B: Source-grep checks ───────────────────────────────────')

// 10. sov/route.ts: no local computeSovFields definition
await test('10. sov/route.ts: no local computeSovFields definition', () => {
  const src = read(SOV_GET_POST)
  const localDef =
    /^function computeSovFields/m.test(src) ||
    /const computeSovFields\s*=/m.test(src)
  assert(!localDef, 'sov/route.ts still defines computeSovFields locally — remove the duplicate')
})

// 11. sov/[itemId]/route.ts: no local computeSovFields definition
await test('11. sov/[itemId]/route.ts: no local computeSovFields definition', () => {
  const src = read(SOV_PATCH)
  const localDef =
    /^function computeSovFields/m.test(src) ||
    /const computeSovFields\s*=/m.test(src)
  assert(!localDef, 'sov/[itemId]/route.ts still defines computeSovFields locally — remove the duplicate')
})

// 12. Both SOV routes import from lib/engine/sov
await test('12a. sov/route.ts: imports from lib/engine/sov', () => {
  const src = read(SOV_GET_POST)
  assert(
    src.includes("from '@/lib/engine/sov'") || src.includes('from "@/lib/engine/sov"'),
    'sov/route.ts must import computeSovFields from lib/engine/sov',
  )
})

await test('12b. sov/[itemId]/route.ts: imports from lib/engine/sov', () => {
  const src = read(SOV_PATCH)
  assert(
    src.includes("from '@/lib/engine/sov'") || src.includes('from "@/lib/engine/sov"'),
    'sov/[itemId]/route.ts must import computeSovFields from lib/engine/sov',
  )
})

// 13. Release route imports computeSovFields
await test('13. release route: imports computeSovFields from lib/engine/sov', () => {
  const src = read(RELEASE_RT)
  assert(
    src.includes("from '@/lib/engine/sov'") || src.includes('from "@/lib/engine/sov"'),
    'release/route.ts must import computeSovFields from lib/engine/sov',
  )
})

// 14. Release route writes balance_to_finish on SOV update
await test('14. release route: writes balance_to_finish on SOV update', () => {
  const src = read(RELEASE_RT)
  assert(
    src.includes('balance_to_finish'),
    'release/route.ts must write balance_to_finish when updating sov_line_items after a draw',
  )
})

// 15. Release route writes percent_complete on SOV update
await test('15. release route: writes percent_complete on SOV update', () => {
  const src = read(RELEASE_RT)
  assert(
    src.includes('percent_complete'),
    'release/route.ts must write percent_complete when updating sov_line_items after a draw',
  )
})

// 16. Release route SOV update is not a fire-and-forget void IIFE
await test('16. release route: SOV update is awaited, not fire-and-forget', () => {
  const src = read(RELEASE_RT)
  // The old bug: `void (async () => { ... sov_line_items ... })()`
  const hasVoidFireForget =
    /void\s*\(\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]{0,600}sov_line_items/.test(src)
  assert(
    !hasVoidFireForget,
    'release/route.ts still has a fire-and-forget void IIFE wrapping the SOV update',
  )
})

// 17. money-summary.tsx uses fundedAmount for remaining
await test('17. money-summary.tsx: remaining = fundedAmount - releasedAmount (not totalAmount)', () => {
  const src = read(MONEY_SUMMARY)
  const phantom =
    /const\s+remaining\s*=\s*Math\.max\s*\(\s*0\s*,\s*totalAmount\s*-\s*releasedAmount\s*\)/.test(src)
  assert(!phantom, 'money-summary.tsx still uses totalAmount − releasedAmount (phantom balance bug)')
  assert(
    src.includes('fundedAmount - releasedAmount'),
    'money-summary.tsx must compute remaining = max(0, fundedAmount - releasedAmount)',
  )
})

// 18. sov.ts exports both named functions
await test('18. lib/engine/sov.ts: exports computeSovFields and assertDealBalanceInvariant', () => {
  const src = read(SOV_MODULE)
  assert(src.includes('export function computeSovFields'),         'sov.ts must export computeSovFields')
  assert(src.includes('export function assertDealBalanceInvariant'), 'sov.ts must export assertDealBalanceInvariant')
})

// 19. Wired into npm test
await test('19. sov-balance-invariant.test.ts is wired into npm test', () => {
  const pkg = read(PKG)
  assert(pkg.includes('sov-balance-invariant.test.ts'), 'package.json test script must include sov-balance-invariant.test.ts')
})

// ═══════════════════════════════════════════════════════════════════════════════
// Results
// ═══════════════════════════════════════════════════════════════════════════════

console.log()
let failures = 0
for (const r of results) {
  if (r.passed) {
    console.log(`  ✓  ${r.name}`)
  } else {
    console.error(`  ✗  ${r.name}`)
    console.error(`       ${r.error}`)
    failures++
  }
}

console.log()
if (failures > 0) {
  console.error(`sov-balance-invariant: ${failures} check(s) failed\n`)
  process.exit(1)
} else {
  console.log('✅  sov-balance-invariant: all checks passed\n')
}

} // end main()

main().catch(err => { console.error(err); process.exit(1) })
