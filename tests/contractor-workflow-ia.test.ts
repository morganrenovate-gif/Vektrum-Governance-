/**
 * Contractor Workflow Information Architecture — Static Safety Tests
 *
 * Verifies the contractor deal page has a clear contract → SOV → draw workflow
 * with actionable guidance at each step, without breaking funder/admin views.
 *
 * Source-parse checks only — no live DB, no rendering, no env vars required.
 *
 * Checks:
 *  1.  "Next required step" card is present in page source
 *  2.  Next step card is gated to contractor role
 *  3.  "Upload executed contract" step text is present (no-contract state)
 *  4.  "Create Schedule of Values" step text is present (no-SOV state)
 *  5.  "Submit SOV for funder approval" step text is present (draft SOV state)
 *  6.  "Link milestones to SOV" step text is present (unlinked milestone state)
 *  7.  "Upload evidence and submit draw for review" step text is present (ready state)
 *  8.  "Setup checklist" heading is present
 *  9.  Checklist is gated to contractor role
 * 10.  Checklist includes "Funder assigned" item
 * 11.  Checklist includes "Contract uploaded" item
 * 12.  Checklist includes "SOV created" item
 * 13.  Checklist includes "SOV approved" item
 * 14.  Checklist includes "Milestones linked to SOV" item
 * 15.  Contractor milestone section label is "Draw Requests / Milestones"
 * 16.  Funder milestone label "Milestone Review & Release" is still present
 * 17.  "Release controls" label still present for funder
 * 18.  Add milestone section is labelled "Add Milestone Manually"
 * 19.  Add milestone helper text explains when to use manual milestones
 * 20.  SOV section still renders for all roles
 * 21.  Contract upload section still renders
 * 22.  Contract required setup card still renders for contractor + !hasContract
 * 23.  sovApproved computed value is present in page
 * 24.  allMilestonesLinked computed value is present in page
 * 25.  Release gate logic is unchanged (no SOV references added)
 * 26.  Stripe payment route is unchanged
 * 27.  Test file is wired into npm test in package.json
 *
 * Run: npx tsx tests/contractor-workflow-ia.test.ts
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

const PAGE         = 'src/app/dashboard/deals/[dealId]/page.tsx'
const GATE         = 'src/lib/engine/release-gate.ts'
const STRIPE_ROUTE = 'src/app/api/stripe/webhooks/route.ts'
const PACKAGE_JSON = 'package.json'

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── Next required step card ───────────────────────────────────────────────────

await test('1. "Next required step" card is present in page source', () => {
  const src = read(PAGE)
  assert(
    src.includes('Next required step'),
    `${PAGE} must render a "Next required step" card to guide contractors through the workflow.`,
  )
})

await test('2. Next step card is gated to contractor role', () => {
  const src = read(PAGE)
  const code = codeOnly(src)
  // The next-step block must be inside a contractor role check
  assert(
    src.includes('Next required step') &&
    (src.includes("role === \"contractor\"") || src.includes("role === 'contractor'")),
    `${PAGE} "Next required step" card must be gated to contractor role only.`,
  )
})

await test('3. "Upload executed contract" step text is present', () => {
  const src = read(PAGE)
  assert(
    src.includes('Upload executed contract'),
    `${PAGE} must show "Upload executed contract" as the first step when no contract is on file.`,
  )
})

await test('4. "Create Schedule of Values" step text is present', () => {
  const src = read(PAGE)
  assert(
    src.includes('Create Schedule of Values'),
    `${PAGE} must show "Create Schedule of Values" as the step when contract exists but no SOV items.`,
  )
})

await test('5. "Submit SOV for funder approval" step text is present', () => {
  const src = read(PAGE)
  assert(
    src.includes('Submit SOV for funder approval'),
    `${PAGE} must show "Submit SOV for funder approval" when SOV items exist but none are approved.`,
  )
})

await test('6. "Link milestones to SOV" step text is present', () => {
  const src = read(PAGE)
  assert(
    src.includes('Link milestones to SOV'),
    `${PAGE} must show "Link milestones to SOV" when milestones exist but are not linked.`,
  )
})

await test('7. "Upload evidence and submit draw for review" step text is present', () => {
  const src = read(PAGE)
  assert(
    src.includes('Upload evidence and submit draw for review'),
    `${PAGE} must show "Upload evidence and submit draw for review" as the final ready step.`,
  )
})

// ── Deal setup checklist ──────────────────────────────────────────────────────

await test('8. "Setup checklist" heading is present', () => {
  const src = read(PAGE)
  assert(
    src.includes('Setup checklist'),
    `${PAGE} must render a "Setup checklist" section showing contractor deal readiness.`,
  )
})

await test('9. Checklist is gated to contractor role', () => {
  const src = read(PAGE)
  assert(
    src.includes('Setup checklist') &&
    (src.includes("role === \"contractor\"") || src.includes("role === 'contractor'")),
    `${PAGE} setup checklist must be gated to contractor role only.`,
  )
})

await test('10. Checklist includes "Funder assigned" item', () => {
  const src = read(PAGE)
  assert(
    src.includes('Funder assigned'),
    `${PAGE} setup checklist must include a "Funder assigned" status item.`,
  )
})

await test('11. Checklist includes "Contract uploaded" item', () => {
  const src = read(PAGE)
  assert(
    src.includes('Contract uploaded'),
    `${PAGE} setup checklist must include a "Contract uploaded" status item.`,
  )
})

await test('12. Checklist includes "SOV created" item', () => {
  const src = read(PAGE)
  assert(
    src.includes('SOV created'),
    `${PAGE} setup checklist must include a "SOV created" status item.`,
  )
})

await test('13. Checklist includes "SOV approved" item', () => {
  const src = read(PAGE)
  assert(
    src.includes('SOV approved'),
    `${PAGE} setup checklist must include a "SOV approved" status item.`,
  )
})

await test('14. Checklist includes "Milestones linked to SOV" item', () => {
  const src = read(PAGE)
  assert(
    src.includes('Milestones linked to SOV'),
    `${PAGE} setup checklist must include a "Milestones linked to SOV" status item.`,
  )
})

// ── Section labels ────────────────────────────────────────────────────────────

await test('15. Contractor milestone section label is "Draw Requests / Milestones"', () => {
  const src = read(PAGE)
  assert(
    src.includes('Draw Requests / Milestones'),
    `${PAGE} must use "Draw Requests / Milestones" as the milestones section label for contractors.`,
  )
})

await test('16. Funder milestone label "Milestone Review & Release" is still present', () => {
  const src = read(PAGE)
  assert(
    src.includes('Milestone Review & Release'),
    `${PAGE} must still use "Milestone Review & Release" for the funder milestone section — do not change funder terminology.`,
  )
})

await test('17. "Release controls" label still present for funder', () => {
  const src = read(PAGE)
  assert(
    src.includes('Release controls'),
    `${PAGE} must still render the "Release controls" section label for funder-facing release buttons.`,
  )
})

// ── Add milestone de-prioritization ──────────────────────────────────────────

await test('18. Add milestone section is labelled "Add Milestone Manually"', () => {
  const src = read(PAGE)
  assert(
    src.includes('Add Milestone Manually'),
    `${PAGE} must label the add milestone form section "Add Milestone Manually" to signal it is secondary.`,
  )
})

await test('19. Add milestone helper text explains when to use manual milestones', () => {
  const src = read(PAGE)
  assert(
    src.includes('Use manual milestones only when your contract does not include a formal SOV'),
    `${PAGE} must include helper text explaining manual milestone form is a fallback when no formal SOV exists.`,
  )
})

// ── Core functionality preserved ──────────────────────────────────────────────

await test('20. SOV section still renders for all roles', () => {
  const src = read(PAGE)
  assert(
    src.includes('SovSection') && src.includes('sovItems'),
    `${PAGE} must still render <SovSection> with sovItems — SOV was not removed.`,
  )
})

await test('21. Contract upload section still renders', () => {
  const src = read(PAGE)
  assert(
    src.includes('ContractUploadSection'),
    `${PAGE} must still render <ContractUploadSection> — contract upload was not removed.`,
  )
})

await test('22. Contract required setup card still renders for contractor + !hasContract', () => {
  const src = read(PAGE)
  const code = codeOnly(src)
  assert(
    src.includes('Contract required'),
    `${PAGE} must still render the "Contract required" advisory card for contractors.`,
  )
  assert(
    code.includes('hasContract'),
    `${PAGE} contract required card must still be gated on hasContract.`,
  )
})

await test('23. sovApproved computed value is present in page', () => {
  const src = read(PAGE)
  assert(
    src.includes('sovApproved'),
    `${PAGE} must compute sovApproved (whether any SOV line item is approved) for checklist and next-step logic.`,
  )
})

await test('24. allMilestonesLinked computed value is present in page', () => {
  const src = read(PAGE)
  assert(
    src.includes('allMilestonesLinked'),
    `${PAGE} must compute allMilestonesLinked for checklist and next-step logic.`,
  )
})

// ── Safety: release gate and payment routes unchanged ─────────────────────────

await test('25. Release gate logic is unchanged (no SOV references added)', () => {
  if (!fs.existsSync(path.resolve(ROOT, GATE))) return
  const src = read(GATE)
  assert(
    !src.includes('sovApproved') && !src.includes('allMilestonesLinked'),
    `${GATE} must not reference sovApproved or allMilestonesLinked — SOV is advisory only, not a release condition.`,
  )
})

await test('26. Stripe payment route is unchanged', () => {
  if (!fs.existsSync(path.resolve(ROOT, STRIPE_ROUTE))) return
  const src = read(STRIPE_ROUTE)
  assert(
    !src.includes('sovApproved') && !src.includes('allMilestonesLinked') && !src.includes('Draw Requests'),
    `${STRIPE_ROUTE} must not reference contractor workflow IA additions — payment routes are unchanged.`,
  )
})

// ── Package.json ──────────────────────────────────────────────────────────────

await test('27. Test file is wired into npm test in package.json', () => {
  const src = read(PACKAGE_JSON)
  assert(
    src.includes('contractor-workflow-ia.test.ts'),
    `${PACKAGE_JSON} must include contractor-workflow-ia.test.ts in the test script.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — CONTRACTOR WORKFLOW IA')
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
