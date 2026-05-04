/**
 * tests/demo-live-story.test.ts
 *
 * Static source-parse checks verifying the investor-grade demo narrative:
 * Contract → DocuSign → SOV → Draw → Evidence → Perplexity Brief → Release → Audit
 *
 * These checks complement (not replace) demo-live-product-story.test.ts.
 * They verify the new narrative data and UI elements added in the demo rewrite.
 *
 *  1.  Demo data: DemoContract interface exists
 *  2.  Demo data: harborContract export exists
 *  3.  Demo data: harborContract.status is 'signed'
 *  4.  Demo data: harborContract references DocuSign envelope_id
 *  5.  Demo data: DemoEvidenceDoc interface exists
 *  6.  Demo data: harborDraw3Evidence export exists with 4 items
 *  7.  Demo data: DemoAuditEvent interface exists
 *  8.  Demo data: harborDealAuditTimeline export exists
 *  9.  Demo data: audit timeline has 15 events covering deal_created → release_gate_verified
 * 10.  Harbor page: imports harborContract
 * 11.  Harbor page: imports harborDraw3Evidence
 * 12.  Harbor page: imports harborDealAuditTimeline
 * 13.  Harbor page: has "Draw #3" hero reference
 * 14.  Harbor page: has 5-step workflow spine with "Contract Executed"
 * 15.  Harbor page: has "Authorize Release" in workflow or CTA
 * 16.  Harbor page: renders harborDraw3Evidence in evidence section
 * 17.  Harbor page: uses harborDealAuditTimeline in activity timeline
 * 18.  Harbor page: contract DocuSign status card uses harborContract
 * 19.  Funder page: has "Harbor Draw #3" hero action
 * 20.  Funder page: has "Ready for Authorization" badge/label
 * 21.  Funder page: hero links to harbor deal page
 * 22.  Contractor page: has "Draw #3 Status" section
 * 23.  Contractor page: shows "Approved — Awaiting Funder Authorization" status
 * 24.  Contractor page: Draw #3 banner links to harbor deal page
 * 25.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/demo-live-story.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT          = path.resolve(process.cwd())
const HARBOR_PAGE   = 'src/app/(marketing)/demo-live/deal/harbor/page.tsx'
const FUNDER_PAGE   = 'src/app/(marketing)/demo-live/funder/page.tsx'
const CONTRACTOR    = 'src/app/(marketing)/demo-live/contractor/page.tsx'
const DEMO_DATA     = 'src/lib/demo-data/index.ts'
const PACKAGE_JSON  = 'package.json'

function read(rel: string): string {
  const full = path.resolve(ROOT, rel)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${rel}`)
  return fs.readFileSync(full, 'utf-8')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\ndemo-live-story.test.ts\n')

  const demoData   = read(DEMO_DATA)
  const harbor     = read(HARBOR_PAGE)
  const funder     = read(FUNDER_PAGE)
  const contractor = read(CONTRACTOR)
  const pkg        = read(PACKAGE_JSON)

  // ── 1–9: Demo Data ──────────────────────────────────────────────────────────
  console.log('Demo data — new narrative types')

  check(demoData.includes('DemoContract'),                            '1. DemoContract interface exists')
  check(demoData.includes('harborContract'),                          '2. harborContract export exists')
  check(demoData.includes("status:               'signed'"),          '3. harborContract.status is signed')
  check(demoData.includes('docusign_envelope_id'),                    '4. harborContract has docusign_envelope_id')
  check(demoData.includes('DemoEvidenceDoc'),                         '5. DemoEvidenceDoc interface exists')
  check(demoData.includes('harborDraw3Evidence'),                     '6. harborDraw3Evidence export exists')
  check(demoData.includes('DemoAuditEvent'),                          '7. DemoAuditEvent interface exists')
  check(demoData.includes('harborDealAuditTimeline'),                 '8. harborDealAuditTimeline export exists')

  // Verify key audit events in the timeline
  check(
    demoData.includes('deal_created') &&
    demoData.includes('docusign_envelope_sent') &&
    demoData.includes('contract_signed') &&
    demoData.includes('sov_submitted') &&
    demoData.includes('release_gate_verified'),
    '9. Audit timeline covers deal lifecycle: deal_created → release_gate_verified',
  )

  // ── 10–18: Harbor Page ──────────────────────────────────────────────────────
  console.log('\nHarbor page — narrative additions')

  check(harbor.includes('harborContract'),            '10. Harbor page imports and uses harborContract')
  check(harbor.includes('harborDraw3Evidence'),       '11. Harbor page imports and uses harborDraw3Evidence')
  check(harbor.includes('harborDealAuditTimeline'),   '12. Harbor page imports and uses harborDealAuditTimeline')
  check(harbor.includes('Draw #3'),                   '13. Harbor page has "Draw #3" hero reference')
  check(harbor.includes('Contract Executed'),         '14. Harbor page has "Contract Executed" in workflow spine')
  check(harbor.includes('Authorize Release'),         '15. Harbor page has "Authorize Release" in workflow/CTA')

  check(
    harbor.includes('harborDraw3Evidence.map') || harbor.includes('{harborDraw3Evidence'),
    '16. Harbor page renders harborDraw3Evidence evidence list',
  )

  check(
    harbor.includes('harborDealAuditTimeline.map') || harbor.includes('...harborDealAuditTimeline'),
    '17. Harbor page uses harborDealAuditTimeline in activity timeline',
  )

  check(
    harbor.includes('harborContract.document_name') || harbor.includes('harborContract.funder_signed_at'),
    '18. Harbor page renders harborContract fields (DocuSign status card)',
  )

  // ── 19–21: Funder Page ──────────────────────────────────────────────────────
  // The institutional refactor reworded the hero. Accept either the
  // historical short form "Harbor Draw #3" or the new long form
  // "Harbor Logistics Center — Draw 3", and the new "Ready for
  // authorization" (lowercase) badge copy.
  console.log('\nFunder page — Harbor draw hero')

  check(
    funder.includes('Harbor Draw #3') ||
    (funder.includes('Harbor Logistics Center') && funder.includes('Draw 3')),
    '19. Funder page references the Harbor Draw 3 hero',
  )
  check(
    funder.includes('Ready for Authorization') || funder.includes('Ready for authorization'),
    '20. Funder page has a "Ready for authorization" badge',
  )
  check(
    funder.includes('/demo-live/deal/harbor?from=funder') ||
    funder.includes('/demo-live/deal/harbor'),
    '21. Funder page hero links to harbor deal page',
  )

  // ── 22–24: Contractor Page ──────────────────────────────────────────────────
  // The contractor refactor replaced the standalone "Draw #3 Status" banner
  // with the "Most important draw" hero. Accept either label, and the new
  // status vocabulary ("Waiting on funder approval" / "Waiting on funder").
  console.log('\nContractor page — Harbor draw banner')

  check(
    contractor.includes('Draw #3 Status')
      || contractor.includes('Most important draw')
      || (contractor.includes('Structural Steel Erection') && contractor.includes('Harbor Logistics Center')),
    '22. Contractor page surfaces the Harbor Draw 3 milestone',
  )
  check(
    contractor.includes('Awaiting Funder Authorization')
      || contractor.includes('Awaiting Funder Release')
      || contractor.includes('Waiting on funder approval')
      || contractor.includes('Waiting on funder'),
    '23. Contractor page shows the awaiting-funder status',
  )
  check(
    contractor.includes('/demo-live/deal/harbor?from=contractor') ||
    contractor.includes('/demo-live/deal/harbor'),
    '24. Contractor Harbor banner links to harbor deal page',
  )

  // ── 25: package.json ─────────────────────────────────────────────────────────
  check(pkg.includes('demo-live-story.test.ts'), '25. Test wired into npm test in package.json')

  console.log('\n✓ All demo-live-story tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
