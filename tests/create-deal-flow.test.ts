/**
 * Create Deal Flow — UX Redesign Regression Tests
 *
 * Verifies that the "Create New Deal" page correctly positions "Import from
 * contract" as the recommended primary path and manual setup as secondary.
 *
 * Background:
 *   A signed contract on file is a real release gate condition. The page must
 *   teach users that the contract is the source of truth for parties, value,
 *   milestones, and release conditions. Previously, "Import from contract" was
 *   buried at the bottom-right of the form as a small secondary action.
 *
 * Checks (static source-parse, no DB, no env vars):
 *  1.  New deal page file exists at the correct (app) path.
 *  2.  Page heading is "Create governed deal" (not "Create New Deal").
 *  3.  Page contains "Start from the contract" advisory copy.
 *  4.  "Import from contract" action appears in the source.
 *  5.  "Recommended" label appears near the import path.
 *  6.  "Import from contract" appears before the manual submit button.
 *  7.  Manual path includes a note about contract execution requirement.
 *  8.  Submit button uses "Save deal details" (or equivalent manual-path label).
 *  9.  Post-creation note about uploading or sending the contract is present.
 * 10.  ContractImportFlow is still imported (not removed).
 * 11.  All original form fields are still present (title, description, total_amount, retainage).
 * 12.  Release gate logic is not modified (API route still POSTs to /api/deals).
 * 13.  No payment/fund-movement claims on the page.
 * 14.  No "AI approves" or "automated payments" claims on the page.
 * 15.  Test file is wired into npm test in package.json.
 * 16.  Contractor path has "Submit project information" heading.
 * 17.  Contractor path includes "Invite your funder" guidance.
 * 18.  Contractor-created deal copy mentions draft / pending funder verification.
 * 19.  Page does not imply contractor controls or authorizes release conditions.
 * 20.  Page includes "funder verifies" or "funder authorizes" role-clarity copy.
 *
 * Role-awareness (checks 16–20) is verified by static source parse: both the
 * funder/admin and contractor JSX branches live in the same source file (role
 * switching is client-side via useState), so all strings are present in source.
 *
 * Run:  npx tsx tests/create-deal-flow.test.ts
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

const NEW_DEAL_PAGE = 'src/app/(app)/dashboard/deals/new/page.tsx'
const PKG           = 'package.json'

async function main() {

// ─── 1. Page exists ───────────────────────────────────────────────────────────

await test('1. New deal page exists at the correct (app) route path', () => {
  assert(
    exists(NEW_DEAL_PAGE),
    `${NEW_DEAL_PAGE} must exist. The create deal page lives inside the (app) route group.`,
  )
})

// ─── 2. Heading updated to "Create governed deal" ────────────────────────────

await test('2. Page heading is "Create governed deal"', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Create governed deal'),
    `${NEW_DEAL_PAGE}: h1 heading must be "Create governed deal". ` +
    `This sets the correct frame: this is a governance action, not a generic project form.`,
  )
})

// ─── 3. Advisory copy: "Start from the contract" ─────────────────────────────

await test('3. Page contains "Start from the contract" advisory copy', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Start from the contract'),
    `${NEW_DEAL_PAGE}: must include the advisory copy "Start from the contract". ` +
    `This teaches users that the contract is the source of truth for parties, value, ` +
    `milestones, and release conditions.`,
  )
})

// ─── 4. Import from contract action present ───────────────────────────────────

await test('4. "Import from contract" action is present on the page', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Import from contract'),
    `${NEW_DEAL_PAGE}: must include an "Import from contract" action. ` +
    `This is the primary recommended path and must not be removed.`,
  )
})

// ─── 5. "Recommended" label visible ──────────────────────────────────────────

await test('5. "Recommended" label appears near the import path', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Recommended') || src.includes('recommended'),
    `${NEW_DEAL_PAGE}: must label the import path as "Recommended" so users ` +
    `understand it is the preferred way to create a governed deal.`,
  )
})

// ─── 6. Import appears before manual submit ───────────────────────────────────

await test('6. "Import from contract" appears before the manual submit button in source order', () => {
  const src = read(NEW_DEAL_PAGE)
  const importIdx  = src.indexOf('Import from contract')
  const submitIdx  = src.indexOf('type="submit"')
  assert(
    importIdx !== -1,
    `${NEW_DEAL_PAGE}: "Import from contract" text not found.`,
  )
  assert(
    submitIdx !== -1,
    `${NEW_DEAL_PAGE}: submit button not found.`,
  )
  assert(
    importIdx < submitIdx,
    `${NEW_DEAL_PAGE}: "Import from contract" (line position ${importIdx}) must appear ` +
    `before the manual submit button (position ${submitIdx}) in source order. ` +
    `The recommended path must be above the form, not buried below it.`,
  )
})

// ─── 7. Manual path explains contract execution requirement ───────────────────

await test('7. Manual path includes a note about contract execution requirement before release', () => {
  const src = read(NEW_DEAL_PAGE)
  const hasContractRequired =
    src.includes('contract execution') ||
    src.includes('contract is required') ||
    src.includes('signed contract') ||
    src.includes('upload') && src.includes('contract') && src.includes('release')
  assert(
    hasContractRequired,
    `${NEW_DEAL_PAGE}: must explain that a signed contract/contract execution is ` +
    `required before release authorization. Without this, users creating deals manually ` +
    `do not understand that the gate will block releases until a contract is on file.`,
  )
})

// ─── 8. Submit button uses manual-path label ─────────────────────────────────

await test('8. Submit button uses "Save deal details" or equivalent manual-path label', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Save deal details') ||
    src.includes('Create manual deal') ||
    src.includes('Save details') ||
    src.includes('Continue with manual setup'),
    `${NEW_DEAL_PAGE}: the manual form submit button must use a label that clarifies ` +
    `this is the manual path (e.g. "Save deal details", "Create manual deal"). ` +
    `A generic "Create Deal" label obscures that the contract path is preferred.`,
  )
})

// ─── 9. Post-creation next-step note ─────────────────────────────────────────

await test('9. Post-creation note about uploading or sending the contract is present', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('upload') || src.includes('Upload') || src.includes('send the contract'),
    `${NEW_DEAL_PAGE}: must include a note about what comes next after manual deal creation ` +
    `(upload or send the contract for execution). Without this, users don't know why ` +
    `the release gate will be blocked.`,
  )
})

// ─── 10. ContractImportFlow still imported ───────────────────────────────────

await test('10. ContractImportFlow is still imported (not removed)', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('ContractImportFlow'),
    `${NEW_DEAL_PAGE}: ContractImportFlow must still be imported and used. ` +
    `The import path is the recommended workflow — it must not be removed.`,
  )
})

// ─── 11. All original form fields still present ───────────────────────────────

await test('11. All original form fields still present (title, description, total_amount, retainage)', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('form.title') || src.includes('"title"'),
    `${NEW_DEAL_PAGE}: Deal Title field must still be present.`,
  )
  assert(
    src.includes('form.description') || src.includes('"description"'),
    `${NEW_DEAL_PAGE}: Description field must still be present.`,
  )
  assert(
    src.includes('total_amount'),
    `${NEW_DEAL_PAGE}: Total Contract Amount field must still be present.`,
  )
  assert(
    src.includes('retainage_percentage'),
    `${NEW_DEAL_PAGE}: Retainage Percentage field must still be present.`,
  )
})

// ─── 12. Deal creation still POSTs to /api/deals ─────────────────────────────

await test('12. Deal creation still POSTs to /api/deals (release gate logic unchanged)', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('"/api/deals"') || src.includes("'/api/deals'"),
    `${NEW_DEAL_PAGE}: form submission must still POST to "/api/deals". ` +
    `The release gate, deal creation logic, and API contract must not be changed.`,
  )
})

// ─── 13. No payment/fund-movement claims ─────────────────────────────────────

await test('13. No fund-movement or payment-execution claims on the page', () => {
  const lower = read(NEW_DEAL_PAGE).toLowerCase()
  assert(
    !lower.includes('vektrum moves money') &&
    !lower.includes('moves funds') &&
    !lower.includes('automated payment') &&
    !lower.includes('vektrum transfers'),
    `${NEW_DEAL_PAGE}: must not contain fund-movement claims. ` +
    `Vektrum is authorization infrastructure; the customer rail executes.`,
  )
})

// ─── 14. No "AI approves" claims ─────────────────────────────────────────────

await test('14. No "AI approves" or "automated payments" claims on the page', () => {
  const lower = read(NEW_DEAL_PAGE).toLowerCase()
  assert(
    !lower.includes('ai approves') &&
    !lower.includes('ai-powered payment') &&
    !lower.includes('ai payment approval'),
    `${NEW_DEAL_PAGE}: must not claim AI approves releases or payments. ` +
    `AI informs; the gate decides; the funder authorizes.`,
  )
})

// ─── 15. Wired into npm test ──────────────────────────────────────────────────

await test('15. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('create-deal-flow.test.ts'),
    `package.json npm test script must include 'create-deal-flow.test.ts'.`,
  )
})

// ─── 16. Contractor path heading ─────────────────────────────────────────────

await test('16. Contractor path heading is "Submit project information"', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Submit project information'),
    `${NEW_DEAL_PAGE}: must include "Submit project information" for the contractor path. ` +
    `Contractors submit project data; funders verify and authorize. ` +
    `The page must not imply contractors can govern their own release conditions.`,
  )
})

// ─── 17. Contractor guidance: "Invite your funder" ───────────────────────────

await test('17. Contractor path includes "Invite your funder" guidance', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Invite your funder') || src.includes('invite your funder'),
    `${NEW_DEAL_PAGE}: must include "Invite your funder" guidance for the contractor path. ` +
    `Contractors must understand they need a funder to verify terms and authorize releases.`,
  )
})

// ─── 18. Contractor deal marked draft / pending funder verification ───────────

await test('18. Contractor-created deal is marked as draft pending funder verification', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('draft') || src.includes('pending funder verification'),
    `${NEW_DEAL_PAGE}: must state that contractor-created deals are draft / pending ` +
    `funder verification. Without this, contractors may not understand why the release ` +
    `gate blocks them until the funder has authorized.`,
  )
})

// ─── 19. No text implying contractor controls release ────────────────────────

await test('19. Page does not imply contractor controls or authorizes release conditions', () => {
  const lower = read(NEW_DEAL_PAGE).toLowerCase()
  assert(
    !lower.includes('contractor authorizes') &&
    !lower.includes('contractor controls release') &&
    !lower.includes('contractor can release'),
    `${NEW_DEAL_PAGE}: must not imply contractors authorize or control release conditions. ` +
    `Contractors submit; funders verify and authorize; Vektrum enforces the gate.`,
  )
})

// ─── 20. "Funder verifies" / "funder authorizes" copy present ─────────────────

await test('20. Page includes "funder verifies" or "funder authorizes" role-clarity copy', () => {
  const lower = read(NEW_DEAL_PAGE).toLowerCase()
  assert(
    lower.includes('funder verifies') || lower.includes('funder authorizes'),
    `${NEW_DEAL_PAGE}: must include copy clarifying that the funder verifies and/or ` +
    `authorizes releases. This educates all roles on the hierarchy: ` +
    `contractor submits, funder authorizes, Vektrum enforces, rail executes.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

  console.log('')
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log('  VEKTRUM — Create Deal Flow UX Tests (20 checks)')
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

} // end main()

main().catch(e => { console.error(e); process.exit(1) })
