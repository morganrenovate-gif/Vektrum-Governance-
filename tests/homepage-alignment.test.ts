/**
 * tests/homepage-alignment.test.ts
 *
 * Static source-parse checks verifying the homepage copy is aligned with the
 * actual validateRelease() 10-condition gate and Vektrum's product truth.
 *
 *  1.  Condition 1:  "Milestone approved by funder"
 *  2.  Condition 2:  "Protection status cleared for release"
 *  3.  Condition 3:  "Funded balance covers disbursement and fee"
 *  4.  Condition 4:  "Contractor payment account verified for selected rail"
 *  5.  Condition 5:  "Contractor onboarding complete"
 *  6.  Condition 6:  "No existing active release on this milestone"
 *  7.  Condition 7:  "No unresolved change orders"
 *  8.  Condition 8:  "Signed contract on file"
 *  9.  Condition 9:  "Sequential milestone prerequisites satisfied"
 * 10.  Condition 10: "Approved conditional lien waiver on file where required"
 * 11.  Workflow spine: "Contract Executed" step present
 * 12.  Workflow spine: "Schedule of Values" step present
 * 13.  Workflow spine: "AI Draw Review" step present
 * 14.  Workflow spine: "Release Readiness" step present
 * 15.  Workflow spine: "Authorization Signal" step present
 * 16.  DocuSign mention: contract execution requires DocuSign
 * 17.  SOV mention: Schedule of Values maps contract values to milestones
 * 18.  Lien waiver mention: conditional lien waiver required where applicable
 * 19.  Non-custody: "does not replace title or escrow"
 * 20.  Non-custody: "does not execute wires"
 * 21.  Non-custody: "Existing payment rails remain in place"
 * 22.  Non-custody: "Stripe Connect is one supported rail"
 * 23.  No "CO-004" fictional change order reference
 * 24.  No "AI approves releases" overclaim
 * 25.  No "Vektrum moves money" overclaim
 * 26.  Hero gate card: no "No active dispute" as numbered condition
 * 27.  Hero gate card: no "Deal not frozen" as numbered condition
 * 28.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/homepage-alignment.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT         = path.resolve(process.cwd())
const HOMEPAGE     = 'src/app/(marketing)/page.tsx'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  const full = path.resolve(ROOT, rel)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${rel}`)
  return fs.readFileSync(full, 'utf-8')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\nhomepage-alignment.test.ts\n')

  const page = read(HOMEPAGE)
  const pkg  = read(PACKAGE_JSON)

  // ── 1–10: 10-condition gate accuracy ────────────────────────────────────────
  console.log('10-condition gate — matches validateRelease() exactly')

  check(page.includes('Milestone approved by funder'),                              ' 1. Condition 1: milestone approved by funder')
  check(page.includes('Protection status cleared for release'),                     ' 2. Condition 2: protection status cleared')
  check(page.includes('Funded balance covers disbursement and fee'),                ' 3. Condition 3: funded balance covers disbursement and fee')
  check(page.includes('Contractor payment account verified for selected rail'),     ' 4. Condition 4: contractor account verified for selected rail')
  check(page.includes('Contractor onboarding complete'),                            ' 5. Condition 5: contractor onboarding complete')
  check(page.includes('No existing active release on this milestone'),              ' 6. Condition 6: no existing active release')
  check(page.includes('No unresolved change orders'),                               ' 7. Condition 7: no unresolved change orders')
  check(page.includes('Signed contract on file'),                                   ' 8. Condition 8: signed contract on file')
  check(page.includes('Sequential milestone prerequisites satisfied'),              ' 9. Condition 9: sequential prerequisites satisfied')
  check(page.includes('Approved conditional lien waiver on file where required'),   '10. Condition 10: approved conditional lien waiver')

  // ── 11–15: Workflow spine ────────────────────────────────────────────────────
  console.log('\nWorkflow spine — release workflow section')

  check(page.includes('Contract Executed'),    '11. Workflow spine: Contract Executed step')
  check(page.includes('Schedule of Values'),   '12. Workflow spine: Schedule of Values step')
  check(page.includes('AI Draw Review'),       '13. Workflow spine: AI Draw Review step')
  check(page.includes('Release Readiness'),    '14. Workflow spine: Release Readiness step')
  check(page.includes('Authorization Signal'), '15. Workflow spine: Authorization Signal step')

  // ── 16–18: DocuSign / SOV / Lien Waiver ─────────────────────────────────────
  console.log('\nWorkflow documentation — DocuSign, SOV, lien waivers')

  check(
    page.includes('DocuSign') && page.includes('contract'),
    '16. DocuSign contract execution mentioned',
  )
  check(
    page.includes('SOV') || page.includes('Schedule of Values'),
    '17. Schedule of Values / SOV mentioned',
  )
  check(
    page.includes('lien waiver'),
    '18. Conditional lien waiver mentioned',
  )

  // ── 19–22: Non-custody language ──────────────────────────────────────────────
  console.log('\nNon-custody language — preserved')

  check(page.includes('does not replace title or escrow'),                          '19. "does not replace title or escrow"')
  check(page.includes('does not execute wires'),                                    '20. "does not execute wires"')
  check(page.includes('Existing payment rails remain in place'),                    '21. "Existing payment rails remain in place"')
  check(page.includes('Stripe Connect is one supported rail'),                      '22. "Stripe Connect is one supported rail"')

  // ── 23–27: No overclaims or inaccurate conditions ────────────────────────────
  console.log('\nOverclaim guards — banned language absent')

  check(!page.includes('CO-004'),                                                   '23. No "CO-004" fictional change order reference')
  check(!page.includes('AI approves releases'),                                     '24. No "AI approves releases" claim')
  check(!page.includes('Vektrum moves money'),                                      '25. No "Vektrum moves money" claim')
  check(
    !page.includes("label: 'No active dispute'") && !page.includes("'No active dispute on"),
    '26. "No active dispute" not listed as a numbered gate condition',
  )
  check(
    !page.includes("label: 'Deal not frozen'") && !page.includes("'Deal not frozen or"),
    '27. "Deal not frozen" not listed as a numbered gate condition',
  )

  // ── 28: package.json ─────────────────────────────────────────────────────────
  check(pkg.includes('homepage-alignment.test.ts'), '28. Test wired into npm test in package.json')

  console.log('\n✓ All homepage-alignment tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
