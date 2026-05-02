/**
 * tests/contractor-deal-form-copy.test.ts
 *
 * Static source-parse checks proving that the contractor-facing new deal form
 * uses role-appropriate copy and that the funder/admin view is unchanged.
 *
 * Root cause of the bug:
 *   new-deal-form.tsx contained contractor-facing copy that:
 *   - Headed the advisory card "Invite your funder to govern this deal" —
 *     implying the contractor governs the deal rather than submitting for review.
 *   - Said "Your partner rail executes" — jargon not meaningful to contractors.
 *   - Used "Deal Title" and "Total Contract Amount (USD)" — funder framing.
 *   - Said "Require milestones to be released in order" — a funder governance
 *     control, not a contractor suggestion.
 *
 * After the fix, contractor-facing copy:
 *   - Advisory heading: "Submit project information for funder review"
 *   - Advisory body explains funder must verify, funder's selected payment rail executes
 *   - Field label: "Project Name" (not "Deal Title")
 *   - Field label: "Proposed Contract Amount (USD)"
 *   - Sequential toggle label: "Suggested milestone sequence"
 *   - Retainage heading: "Proposed Retainage Term"
 *   - Eyebrow: "Project Submission"
 *
 * Funder/admin view is unchanged:
 *   - "Create governed deal", "Start from the contract", "Import from contract",
 *     "Recommended", "Enter details below", "Deal Title", "Total Contract Amount (USD)"
 *
 * Checks:
 *  1.  Contractor advisory heading is "Submit project information for funder review"
 *  2.  Contractor advisory does NOT say "Invite your funder to govern this deal"
 *  3.  Contractor advisory body contains "funder must verify"
 *  4.  Contractor advisory body contains "funder's selected payment rail executes"
 *         (rendered as HTML entity: funder&rsquo;s)
 *  5.  Contractor advisory does NOT say "Your partner rail executes"
 *  6.  Contractor form uses "Project Name" label
 *  7.  Contractor form uses "Proposed Contract Amount"
 *  8.  Contractor form uses "Proposed Retainage Term"
 *  9.  Contractor eyebrow is "Project Submission" (not "New Deal")
 * 10.  Contractor form uses "Suggested milestone sequence"
 * 11.  Contractor copy does NOT say "Your partner rail executes" anywhere in source
 * 12.  Funder block still contains "Create governed deal"
 * 13.  Funder block still contains "Start from the contract"
 * 14.  Funder block still contains "Import from contract"
 * 15.  Funder block still contains "Recommended"
 * 16.  Funder block still contains "Enter details below"
 * 17.  No forbidden contractor-facing AI/payment claims in source
 * 18.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/contractor-deal-form-copy.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

function read(rel: string): string {
  const full = path.resolve(ROOT, rel)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${rel}`)
  return fs.readFileSync(full, 'utf-8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

const FORM         = 'src/app/(app)/dashboard/deals/new/new-deal-form.tsx'
const PACKAGE_JSON = 'package.json'

async function main() {
  console.log('\ncontractor-deal-form-copy.test.ts\n')

  check(exists(FORM), 'new-deal-form.tsx exists')

  const src = read(FORM)

  // Use the contractor advisory block as a landmark.
  // The block starts at "isContractor && (" for the contractor advisory.
  // We scope contractor-only checks to that section where possible.
  const contractorAdvisoryStart = src.indexOf('Submit project information for funder review')
  const funderAdvisoryStart     = src.indexOf('Start from the contract')

  // ── 1. Contractor advisory heading updated ────────────────────────────────
  check(
    src.includes('Submit project information for funder review'),
    '1. Contractor advisory heading is "Submit project information for funder review"',
  )

  // ── 2. Old heading removed ────────────────────────────────────────────────
  check(
    !src.includes('Invite your funder to govern this deal'),
    '2. Old contractor advisory heading "Invite your funder to govern this deal" is removed',
  )

  // ── 3. Advisory body says funder must verify ──────────────────────────────
  // Collapse whitespace for multi-line JSX matching
  const collapsed = src.replace(/\s+/g, ' ')
  check(
    collapsed.toLowerCase().includes('funder must verify'),
    '3. Contractor advisory body contains "funder must verify"',
  )

  // ── 4. Advisory body mentions funder's selected payment rail ─────────────
  // HTML entity &rsquo; or plain apostrophe — check both
  check(
    collapsed.includes("funder's selected payment rail") ||
    collapsed.includes('funder&rsquo;s selected payment rail') ||
    collapsed.includes("funder’s selected payment rail"),
    "4. Contractor advisory body says \"funder's selected payment rail executes\"",
  )

  // ── 5. Old body copy "Your partner rail executes" removed ─────────────────
  check(
    !src.includes('Your partner rail executes'),
    '5. Old copy "Your partner rail executes" is removed from source',
  )

  // ── 6. Contractor label: "Project Name" ───────────────────────────────────
  check(
    src.includes('"Project Name"') || src.includes("'Project Name'"),
    '6. Contractor form uses "Project Name" field label',
  )

  // ── 7. Contractor label: "Proposed Contract Amount" ───────────────────────
  check(
    src.includes('Proposed Contract Amount'),
    '7. Contractor form uses "Proposed Contract Amount" label',
  )

  // ── 8. Contractor retainage heading: "Proposed Retainage Term" ────────────
  check(
    src.includes('Proposed Retainage Term'),
    '8. Contractor retainage heading is "Proposed Retainage Term"',
  )

  // ── 9. Contractor eyebrow: "Project Submission" ───────────────────────────
  check(
    src.includes('"Project Submission"') || src.includes("'Project Submission'"),
    '9. Contractor eyebrow label is "Project Submission"',
  )

  // ── 10. Sequential toggle label: "Suggested milestone sequence" ────────────
  check(
    src.includes('Suggested milestone sequence'),
    '10. Contractor sequential toggle label is "Suggested milestone sequence"',
  )

  // ── 11. "Your partner rail executes" not in source at all ─────────────────
  check(
    !src.includes('Your partner rail executes'),
    '11. "Your partner rail executes" is completely removed from source',
  )

  // ── 12–16. Funder block unchanged ─────────────────────────────────────────
  // Locate the funder advisory block (starts with the "Start from the contract" section)
  const funderBlock = funderAdvisoryStart >= 0 ? src.slice(funderAdvisoryStart) : src

  check(
    src.includes('Create governed deal'),
    '12. Funder block still contains "Create governed deal" heading',
  )
  check(
    funderBlock.includes('Start from the contract'),
    '13. Funder block still contains "Start from the contract" advisory',
  )
  check(
    funderBlock.includes('Import from contract'),
    '14. Funder block still contains "Import from contract" action',
  )
  check(
    funderBlock.includes('Recommended'),
    '15. Funder block still contains "Recommended" label',
  )
  // Manual-entry option label was renamed during the contract/funder setup
  // polish pass to match the spec ("Enter deal details manually"). Either
  // phrasing satisfies the intent: a clearly-labeled secondary manual path.
  check(
    funderBlock.includes('Enter deal details manually') ||
    funderBlock.includes('Enter details below'),
    '16. Funder block contains a manual-entry secondary path label',
  )

  // ── 17. No forbidden AI/payment claims ───────────────────────────────────
  const lower = src.toLowerCase()
  check(
    !lower.includes('ai approves') &&
    !lower.includes('vektrum moves money') &&
    !lower.includes('contractor authorizes') &&
    !lower.includes('automatic payment'),
    '17. No forbidden AI/payment/contractor-authority claims in source',
  )

  // ── 18. Test wired into package.json ──────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('contractor-deal-form-copy.test.ts'),
    '18. This test file is wired into npm test in package.json',
  )

  console.log('\n✓ All contractor-deal-form-copy tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
