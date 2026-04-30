/**
 * SOV contract-guided flow tests.
 *
 * Static source-parse checks — no live DB, no rendering.
 *
 * Covers:
 *  1.  Contract-required setup card appears in deal page when no contract.
 *  2.  Setup card copy says "Upload the executed contract before finalizing SOVs".
 *  3.  Empty SOV state explains contract/SOV relationship.
 *  4.  SOV empty state mentions approved contract.
 *  5.  "Import SOV from Contract" is present and marked coming soon (not live).
 *  6.  Scheduled value form uses parseFloat with >= 0 check (accepts 50000).
 *  7.  Scheduled value input strips commas before parsing (locale safety).
 *  8.  SOV line item creation still works (POST route unchanged).
 *  9.  Milestones without SOV links show advisory warning.
 * 10.  Milestone SOV advisory does NOT block release (no gate change).
 * 11.  SovSection receives hasContract prop from deal page.
 * 12.  Release gate logic is unchanged.
 * 13.  Stripe/payment routes unchanged.
 * 14.  Approved contract value label appears on scheduled value input.
 * 15.  Test file is wired into npm test in package.json.
 *
 * Run: npx tsx tests/sov-contract-flow.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ─── Runner ───────────────────────────────────────────────────────────────────

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

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8')
}

function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

// ─── File paths ───────────────────────────────────────────────────────────────

const PAGE            = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const SOV_SECTION     = 'src/components/deal/sov-section.tsx'
const SOV_ROUTE       = 'src/app/api/deals/[dealId]/sov/route.ts'
const RELEASE_GATE    = 'src/lib/engine/release-gate.ts'
const MILESTONE_CARD  = 'src/components/deal/milestone-card.tsx'
const STRIPE_ROUTE = 'src/app/api/stripe/webhooks/route.ts'
const PACKAGE_JSON = 'package.json'

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── Contract-required setup card ──────────────────────────────────────────────

await test('1. Contract-required setup card appears in deal page', () => {
  const src = read(PAGE)
  assert(
    src.includes('Contract required') || src.includes('contract required'),
    `${PAGE} must render a "Contract required" setup card for contractors without a contract`,
  )
})

await test('2. Setup card copy instructs to upload contract before SOV/release', () => {
  const src = read(PAGE)
  assert(
    src.includes('Upload the executed contract before finalizing SOVs') ||
    src.includes('before finalizing SOVs'),
    `${PAGE} must instruct contractors to upload the executed contract before finalizing SOVs`,
  )
})

await test('3. Setup card is gated to contractor role and no-contract state', () => {
  const src = read(PAGE)
  const code = codeOnly(src)
  // Must check contractor role and !hasContract (or contract absent)
  assert(
    code.includes('hasContract') || code.includes('contract'),
    `${PAGE} setup card must be conditional on the contract state`,
  )
  assert(
    src.includes("role === \"contractor\"") || src.includes("role === 'contractor'"),
    `${PAGE} setup card must be shown only to contractors`,
  )
})

// ── Empty SOV state ───────────────────────────────────────────────────────────

await test('4. SOV empty state explains contract/SOV relationship', () => {
  const src = read(SOV_SECTION)
  assert(
    src.includes('No Schedule of Values has been created yet'),
    `${SOV_SECTION} empty state must say "No Schedule of Values has been created yet"`,
  )
  assert(
    src.includes('approved contract') || src.includes('contract document'),
    `${SOV_SECTION} empty state must mention adding items from the approved contract`,
  )
})

await test('5. Import SOV from Contract action is present and marked coming soon', () => {
  const src = read(SOV_SECTION)
  assert(
    src.includes('Import SOV from Contract'),
    `${SOV_SECTION} must show "Import SOV from Contract" action`,
  )
  // Must be disabled/coming-soon — not a live action
  assert(
    src.includes('Coming soon') || src.includes('coming soon') || src.includes('disabled'),
    `${SOV_SECTION} "Import SOV from Contract" must be disabled/marked coming soon`,
  )
})

// ── Scheduled value form validation ──────────────────────────────────────────

await test('6. Scheduled value form uses parseFloat with >= 0 check (accepts 50000)', () => {
  const src = read(SOV_SECTION)
  const code = codeOnly(src)
  // Must use parseFloat or Number to parse the value
  assert(
    src.includes('parseFloat') || src.includes('Number('),
    `${SOV_SECTION} must use parseFloat or Number() to parse scheduled value`,
  )
  // Validation must use >= 0, not > 0 (so 0 is valid and 50000 is valid)
  assert(
    /sv\s*<\s*0|>=\s*0/.test(code),
    `${SOV_SECTION} must validate scheduled value with >= 0 (not > 0) to accept 50000`,
  )
})

await test('7. Scheduled value input strips locale commas before parsing', () => {
  const src = read(SOV_SECTION)
  assert(
    src.includes('.replace(/,/g') || src.includes("replace(/,/"),
    `${SOV_SECTION} must strip commas from the value string before parseFloat to handle locale formatting`,
  )
})

await test('14. Approved contract value label appears on scheduled value input', () => {
  const src = read(SOV_SECTION)
  assert(
    src.includes('Approved contract value allocated to this scope') ||
    src.includes('approved contract value'),
    `${SOV_SECTION} must label the scheduled value field as "Approved contract value allocated to this scope"`,
  )
})

// ── SOV creation unchanged ────────────────────────────────────────────────────

await test('8. SOV line item creation POST route still exists and validates negative values', () => {
  const src = read(SOV_ROUTE)
  assert(src.includes('export async function POST'), `${SOV_ROUTE} must still export POST`)
  const code = codeOnly(src)
  assert(
    /scheduled_value.*<\s*0|scheduled_value.*>=\s*0/.test(code.replace(/\s+/g, ' ')),
    `${SOV_ROUTE} must still validate scheduled_value >= 0`,
  )
})

// ── Milestone SOV advisory ────────────────────────────────────────────────────

await test('9. Milestones without SOV links show advisory warning', () => {
  // The advisory was moved from page.tsx into MilestoneCard so it renders
  // inline within the card panel rather than as a separate external element.
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('No SOV line items linked') || src.includes('not linked to'),
    `${MILESTONE_CARD} must show an advisory warning for milestones not linked to any SOV line item`,
  )
})

await test('10. Milestone SOV advisory does not block release (no gate change)', () => {
  // The advisory must not be in the release gate source
  if (!fs.existsSync(path.resolve(ROOT, RELEASE_GATE))) return
  const src = read(RELEASE_GATE)
  assert(
    !src.includes('sov_line_item') && !src.includes('milestone_sov_links'),
    `${RELEASE_GATE} must not reference SOV — SOV is advisory only, must not block release`,
  )
})

// ── hasContract prop ──────────────────────────────────────────────────────────

await test('11. SovSection receives hasContract prop from deal page', () => {
  const pageSrc = read(PAGE)
  assert(
    pageSrc.includes('hasContract'),
    `${PAGE} must pass hasContract prop to SovSection`,
  )
  const sectionSrc = read(SOV_SECTION)
  assert(
    sectionSrc.includes('hasContract'),
    `${SOV_SECTION} must accept hasContract prop`,
  )
})

// ── Safety: release gate and payment routes unchanged ─────────────────────────

await test('12. Release gate logic is unchanged', () => {
  if (!fs.existsSync(path.resolve(ROOT, RELEASE_GATE))) return
  const src = read(RELEASE_GATE)
  assert(
    !src.includes('sov_line_items') && !src.includes('hasContract'),
    `${RELEASE_GATE} must not reference SOV or hasContract — release logic is unchanged`,
  )
})

await test('13. Stripe/payment routes unchanged', () => {
  if (!fs.existsSync(path.resolve(ROOT, STRIPE_ROUTE))) return
  const src = read(STRIPE_ROUTE)
  assert(
    !src.includes('sov_line_items') && !src.includes('hasContract'),
    `${STRIPE_ROUTE} must not reference SOV — payment routes are unchanged`,
  )
})

// ── Package.json ──────────────────────────────────────────────────────────────

await test('15. Test file is wired into npm test in package.json', () => {
  const src = read(PACKAGE_JSON)
  assert(
    src.includes('sov-contract-flow.test.ts'),
    `${PACKAGE_JSON} must include sov-contract-flow.test.ts in the test script`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — SOV CONTRACT FLOW')
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
