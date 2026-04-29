/**
 * tests/pitch-alignment.test.ts
 *
 * Static source-parse checks verifying /pitch copy is aligned with:
 *  - Current Vektrum positioning (conditional authorization infrastructure)
 *  - Actual validateRelease() 10-condition gate
 *  - Implemented product capabilities (DocuSign, SOV, lien waiver, AI brief)
 *  - Non-custody language and banned-claim guards
 *
 *  1.  Cover: "Conditional authorization infrastructure"
 *  2.  Cover: "for construction disbursements"
 *  3.  Cover: "Enforce release conditions before capital moves"
 *  4.  Problem: lien waiver language present
 *  5.  Problem: change order language present
 *  6.  Problem: audit trail / weak audit problem language
 *  7.  Workflow slide: DocuSign step present
 *  8.  Workflow slide: Schedule of Values step present
 *  9.  Workflow slide: Evidence + lien waiver step present
 * 10.  Workflow slide: AI Draw Control Brief step present
 * 11.  Workflow slide: Release Readiness gate step present
 * 12.  Workflow slide: Funder authorizes step present
 * 13.  Solution: DocuSign mentioned
 * 14.  Solution: Schedule of Values mentioned
 * 15.  Solution: lien waiver mentioned
 * 16.  Solution: "Vektrum does not move money" / authorization framing
 * 17.  Gate slide: condition 1 — "Milestone approved"
 * 18.  Gate slide: condition 3 — "Sufficient funded balance"
 * 19.  Gate slide: condition 8 — "Signed contract"
 * 20.  Gate slide: condition 10 — "Approved lien waiver"
 * 21.  AI slide: "AI informs" language
 * 22.  AI slide: "gate decides" language
 * 23.  AI slide: no "AI approves" claim
 * 24.  Demo story slide: "Harbor Draw #3" reference
 * 25.  Demo story slide: link to /demo-live/deal/harbor
 * 26.  What-not slide: "Not a bank" present
 * 27.  What-not slide: "Not escrow" present
 * 28.  What-not slide: "Not a money transmitter" present
 * 29.  Traction: DocuSign in built list
 * 30.  Traction: Schedule of Values in built list
 * 31.  Traction: lien waiver in built list
 * 32.  Non-custody disclaimer in closing
 * 33.  No "Vektrum moves money" claim
 * 34.  No "Tamper-proof" (use "tamper-evident")
 * 35.  No "Stripe required" / "Stripe is required"
 * 36.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/pitch-alignment.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT         = path.resolve(process.cwd())
const PITCH        = 'src/app/pitch/page.tsx'
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
  console.log('\npitch-alignment.test.ts\n')

  const pitch = read(PITCH)
  const pkg   = read(PACKAGE_JSON)

  // ── 1–3: Cover positioning ───────────────────────────────────────────────────
  console.log('Cover — positioning')

  check(pitch.includes('Conditional authorization infrastructure'),          ' 1. Cover: conditional authorization infrastructure')
  check(pitch.includes('for construction disbursements'),                    ' 2. Cover: for construction disbursements')
  check(pitch.includes('Enforce release conditions before capital moves'),   ' 3. Cover: enforce release conditions subline')

  // ── 4–6: Problem ─────────────────────────────────────────────────────────────
  console.log('\nProblem slide')

  check(pitch.includes('lien waiver') || pitch.includes('lien waivers'),    ' 4. Problem: lien waiver language')
  check(pitch.includes('change order') || pitch.includes('change orders'),  ' 5. Problem: change order language')
  check(pitch.includes('audit trail') || pitch.includes('audit record'),    ' 6. Problem: audit trail language')

  // ── 7–12: Workflow spine ──────────────────────────────────────────────────────
  console.log('\nWorkflow slide')

  check(pitch.includes('DocuSign executed') || pitch.includes('DocuSign'),  ' 7. Workflow: DocuSign step present')
  check(pitch.includes('Schedule of Values'),                               ' 8. Workflow: Schedule of Values step present')
  check(
    pitch.includes('Evidence + lien waiver') || pitch.includes('lien waiver'),
    ' 9. Workflow: evidence + lien waiver step present',
  )
  check(pitch.includes('AI Draw Control Brief'),                            '10. Workflow: AI Draw Control Brief step present')
  check(pitch.includes('Release Readiness'),                                '11. Workflow: Release Readiness gate step present')
  check(pitch.includes('Funder authorizes'),                                '12. Workflow: Funder authorizes step present')

  // ── 13–16: Solution ───────────────────────────────────────────────────────────
  console.log('\nSolution slide')

  check(pitch.includes('DocuSign'),                                         '13. Solution: DocuSign mentioned')
  check(pitch.includes('Schedule of Values'),                               '14. Solution: Schedule of Values mentioned')
  check(pitch.includes('lien waiver'),                                      '15. Solution: lien waiver mentioned')
  check(
    pitch.includes('does not move money') || pitch.includes('does not hold') || pitch.includes('governs authorization'),
    '16. Solution: authorization framing (not movement)',
  )

  // ── 17–20: Gate conditions ────────────────────────────────────────────────────
  console.log('\nRelease Gate slide — 10 conditions')

  check(pitch.includes('Milestone approved'),                               '17. Gate: condition 1 — milestone approved')
  check(pitch.includes('Sufficient funded balance'),                        '18. Gate: condition 3 — sufficient funded balance')
  check(pitch.includes('Signed contract'),                                  '19. Gate: condition 8 — signed contract')
  check(pitch.includes('Approved lien waiver'),                             '20. Gate: condition 10 — approved lien waiver')

  // ── 21–23: AI framing ─────────────────────────────────────────────────────────
  console.log('\nAI Precondition slide')

  check(pitch.includes('AI informs'),                                       '21. AI: "AI informs" language')
  check(pitch.includes('gate decides') || pitch.includes('The gate decides'), '22. AI: "gate decides" language')
  check(!pitch.includes('AI approves'),                                     '23. AI: no "AI approves" claim')

  // ── 24–25: Demo story ─────────────────────────────────────────────────────────
  console.log('\nDemo story slide')

  check(pitch.includes('Harbor Draw #3'),                                   '24. Demo: Harbor Draw #3 reference')
  check(pitch.includes('/demo-live/deal/harbor'),                           '25. Demo: link to /demo-live/deal/harbor')

  // ── 26–28: What Vektrum is not ────────────────────────────────────────────────
  console.log('\nWhat-not slide')

  check(pitch.includes('Not a bank'),                                       '26. What-not: not a bank')
  check(pitch.includes('Not escrow'),                                       '27. What-not: not escrow')
  check(pitch.includes('Not a money transmitter'),                          '28. What-not: not a money transmitter')

  // ── 29–31: Traction built list ───────────────────────────────────────────────
  console.log('\nTraction slide — built list')

  check(pitch.includes('DocuSign contract execution'),                      '29. Traction: DocuSign in built list')
  check(pitch.includes('Schedule of Values'),                               '30. Traction: SOV in built list')
  check(pitch.includes('lien waiver'),                                      '31. Traction: lien waiver in built list')

  // ── 32: Non-custody disclaimer ────────────────────────────────────────────────
  console.log('\nNon-custody disclaimer')

  check(
    pitch.includes('not a bank') && pitch.includes('not hold or custody funds'),
    '32. Non-custody disclaimer in closing',
  )

  // ── 33–35: Banned claims ──────────────────────────────────────────────────────
  console.log('\nBanned claims — absent')

  check(!pitch.includes('Vektrum moves money'),      '33. No "Vektrum moves money"')
  check(!pitch.toLowerCase().includes('tamper-proof'), '34. No "tamper-proof" (use tamper-evident)')
  check(
    !pitch.includes('Stripe is required') && !pitch.includes('Stripe required'),
    '35. No "Stripe required" claim',
  )

  // ── 36: package.json ─────────────────────────────────────────────────────────
  check(pkg.includes('pitch-alignment.test.ts'), '36. Test wired into npm test in package.json')

  console.log('\n✓ All pitch-alignment tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
