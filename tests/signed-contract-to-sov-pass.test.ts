/**
 * tests/signed-contract-to-sov-pass.test.ts
 *
 * Pins the post-signing UX that bridges DocuSign completion → SOV setup:
 *
 *   1. Deal page derives `contractFullySigned` from BOTH timestamps
 *      (funder_signed_at AND contractor_signed_at). The status column is
 *      not used as the gate — the timestamps are the ground truth.
 *
 *   2. Contract Fully Executed card renders only when both timestamps
 *      exist AND no SOV line items exist yet.
 *      - Funder/admin: heading "Create Schedule of Values" + body with
 *        "source of truth" + DISABLED "Generate SOV from signed contract"
 *        chip (Coming soon, no live AI extraction backend) +
 *        "Enter SOV manually" anchor link to #sov + safety microcopy
 *        "Generated SOVs must be reviewed and approved before releases
 *        can proceed."
 *      - Contractor: read-only "Waiting for SOV setup" copy
 *
 *   3. Contractor next-required-step distinguishes the four states:
 *        no contract → Upload executed contract
 *        contract uploaded, signatures pending → Awaiting contract signatures
 *        fully signed, no SOV → Waiting for SOV setup
 *        SOV exists but not approved → Submit SOV for funder approval
 *
 *   4. Setup checklist includes "Contract fully signed" between
 *      "Contract uploaded" and "SOV created", driven by the same
 *      `contractFullySigned` derivation.
 *
 *   5. Return-from-DocuSign one-shot refresh:
 *      - ContractSigningSection reads useSearchParams
 *      - If event=signing_complete OR docusign=return AND envelopeId is
 *        set, fires ONE refresh-signing-status POST (guarded by useRef)
 *      - Strips the param afterwards so a reload doesn't re-fire
 *
 *   6. SOV anchor — `<div id="sov">` exists on the deal page so the
 *      "Enter SOV manually" link scrolls into view.
 *
 *   7. Banned product claims absent (no AI-creates-approved-SOV /
 *      autonomous release / Vektrum-moves-money / guarantees).
 *
 *   8. No payment / release / Stripe imports added by this pass.
 *
 * Run: npx tsx tests/signed-contract-to-sov-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const DEAL_PAGE   = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const SIGNING_UI  = 'src/components/deal/contract-signing-section.tsx'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

async function main() {
  console.log('\nsigned-contract-to-sov-pass.test.ts\n')

  const deal     = read(DEAL_PAGE)
  const dealCode = stripComments(deal)
  const signing  = read(SIGNING_UI)
  const pkg      = read(PACKAGE_JSON)

  // ── 1. contractFullySigned from BOTH timestamps ───────────────────────
  console.log('1. contractFullySigned derivation')
  check(
    /const\s+contractFullySigned\s*=\s*[\s\S]*?contract\?\.funder_signed_at[\s\S]*?contract\?\.contractor_signed_at/.test(dealCode),
    '  1a. derives contractFullySigned from contract.funder_signed_at AND contract.contractor_signed_at',
  )
  check(
    !/const\s+contractFullySigned\s*=\s*contract\.status\s*===\s*['"]signed['"]/.test(dealCode),
    '  1b. derivation is NOT based on contract.status === "signed" (timestamps are ground truth)',
  )
  check(
    /const\s+canCreateSovFromContract\s*=\s*contractFullySigned\s*&&\s*sovItems\.length\s*===\s*0/.test(dealCode),
    '  1c. canCreateSovFromContract = contractFullySigned && sovItems.length === 0',
  )

  // ── 2. Contract Fully Executed card ───────────────────────────────────
  console.log('\n2. Contract Fully Executed card')
  check(
    /\{canCreateSovFromContract\s*&&\s*\(/.test(deal),
    '  2a. card is gated on canCreateSovFromContract',
  )
  check(
    deal.includes('Contract fully executed'),
    '  2b. heading "Contract fully executed"',
  )
  check(
    deal.includes('Both parties have completed signing') &&
    deal.includes('Schedule of Values'),
    '  2c. body mentions "Both parties have completed signing" + Schedule of Values',
  )
  check(
    deal.includes('Next required step'),
    '  2d. card labelled "Next required step"',
  )

  // Funder/admin path: heading + CTAs + safety microcopy.
  //
  // The contract-release-rules pass broadened the SOV-only framing to a
  // release-rules framing — the heading is now "Create release rules" and
  // the generate CTA is real (no longer a "Coming soon" placeholder). We
  // accept either spelling so this older test plays nicely with the new
  // surface, and we relax the placeholder-specific assertions that no
  // longer apply once the live API is wired.
  check(
    deal.includes('Create Schedule of Values') ||
    deal.includes('Create release rules'),
    '  2e. funder/admin: heading "Create release rules" (or legacy "Create Schedule of Values")',
  )
  check(
    deal.includes('source of truth for line items') ||
    deal.includes('source of truth for draft SOV line'),
    '  2f. funder/admin: body uses "source of truth"',
  )
  check(
    deal.includes('Generate SOV from signed contract') ||
    deal.includes('Generate draft SOV & release rules'),
    '  2g. funder/admin: generate-from-contract CTA exists (any wording)',
  )
  // Manual entry CTA links to the SOV anchor. The JSX className is a long
  // Tailwind string so we allow generous distance between href and label.
  // The CTA text was also broadened from "Enter SOV manually" → "Enter manually".
  check(
    /href="#sov"[\s\S]*?Enter manually/.test(deal) ||
    /href="#sov"[\s\S]*?Enter SOV manually/.test(deal),
    '  2j. funder/admin: "Enter manually" link points to #sov anchor',
  )
  check(
    deal.includes('Generated SOVs must be reviewed and approved before releases') ||
    deal.includes('Draft rules must be reviewed and approved'),
    '  2k. funder/admin: safety microcopy preserves "must be reviewed and approved"',
  )
  check(
    deal.includes('deterministic release gate and funder authorization still control release'),
    '  2l. funder/admin: boundary copy "deterministic release gate and funder authorization still control release"',
  )

  // Contractor path
  check(
    deal.includes('Waiting for SOV setup') || deal.includes('Waiting for release-rule setup'),
    '  2m. contractor: heading "Waiting for SOV setup"',
  )
  check(
    deal.includes('The funder must create or approve the Schedule of Values'),
    '  2n. contractor: body mentions funder must create/approve',
  )

  // Role gate inside the card
  check(
    /typedProfile\.role\s*===\s*['"]funder['"]\s*\|\|\s*typedProfile\.role\s*===\s*['"]admin['"]/.test(dealCode),
    '  2o. role gate: funder/admin see CTAs; everyone else sees the contractor read-only block',
  )

  // ── 3. Contractor next-required-step ──────────────────────────────────
  console.log('\n3. Contractor next-required-step')
  check(
    deal.includes("'Awaiting contract signatures'"),
    '  3a. step "Awaiting contract signatures" present',
  )
  check(
    deal.includes("'Waiting for SOV setup'") ||
    deal.includes("'Waiting for release-rule setup'"),
    '  3b. step "Waiting for SOV setup" / "Waiting for release-rule setup" present',
  )
  // Awaiting-signatures step is gated on !contractFullySigned
  check(
    /!contractFullySigned\s*\)\s*\{[\s\S]{0,300}Awaiting contract signatures/.test(dealCode),
    '  3c. "Awaiting contract signatures" is gated on !contractFullySigned',
  )

  // ── 4. Setup checklist includes "Contract fully signed" ───────────────
  console.log('\n4. Setup checklist')
  check(
    deal.includes("'Contract fully signed'") || deal.includes('"Contract fully signed"'),
    '  4a. checklist includes "Contract fully signed"',
  )
  check(
    /['"]Contract fully signed['"][\s\S]{0,80}done:\s*contractFullySigned/.test(deal),
    '  4b. "Contract fully signed" done flag is contractFullySigned',
  )
  // Order: Contract uploaded → Contract fully signed → SOV created
  const idxUploaded = deal.indexOf('Contract uploaded')
  const idxSigned   = deal.indexOf('Contract fully signed')
  const idxSov      = deal.indexOf('SOV created')
  check(
    idxUploaded > -1 && idxSigned > idxUploaded && idxSov > idxSigned,
    '  4c. checklist order: Contract uploaded → Contract fully signed → SOV created',
  )

  // ── 5. Return-from-DocuSign one-shot refresh ──────────────────────────
  console.log('\n5. Return-from-DocuSign one-shot refresh')
  check(
    signing.includes('useSearchParams') &&
    signing.includes("from 'next/navigation'"),
    '  5a. ContractSigningSection imports useSearchParams from next/navigation',
  )
  check(
    /autoRefreshFired\s*=\s*useRef\(false\)/.test(signing),
    '  5b. one-shot refresh guarded by useRef(false)',
  )
  // Param detection covers both event=signing_complete and docusign=return
  check(
    /searchParams\?\.get\(['"]event['"]\)/.test(signing) &&
    /searchParams\?\.get\(['"]docusign['"]\)/.test(signing) &&
    signing.includes("'signing_complete'") &&
    signing.includes("'return'"),
    '  5c. detects event=signing_complete OR docusign=return',
  )
  check(
    /fetch\(\s*`\/api\/deals\/\$\{dealId\}\/contract\/refresh-signing-status`/.test(signing),
    '  5d. fires POST /api/deals/{dealId}/contract/refresh-signing-status',
  )
  // Param strip after firing
  check(
    /url\.searchParams\.delete\(['"]event['"]\)/.test(signing) &&
    /url\.searchParams\.delete\(['"]docusign['"]\)/.test(signing),
    '  5e. strips event/docusign params from the URL after refresh',
  )
  check(
    signing.includes('window.history.replaceState'),
    '  5f. uses replaceState (no extra history entry, no hard reload)',
  )
  // No polling — useEffect fires once, guarded by ref + envelope check
  check(
    /if\s*\(autoRefreshFired\.current\)\s*return/.test(signing),
    '  5g. early-return on autoRefreshFired.current === true (no polling)',
  )

  // ── 6. SOV scroll anchor ──────────────────────────────────────────────
  console.log('\n6. #sov anchor for "Enter SOV manually"')
  check(
    /id="sov"/.test(deal) || /id={"sov"}/.test(deal),
    '  6a. deal page renders id="sov" anchor element',
  )
  check(
    /scroll-mt-/.test(deal),
    '  6b. anchor uses scroll-mt-* utility so the sticky header doesn\'t obscure it',
  )

  // ── 7. Banned product claims absent ───────────────────────────────────
  console.log('\n7. Banned product claims absent on touched surfaces')
  const surfaces = (deal + '\n' + signing).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'ai approves release',
    'ai approved release',
    'ai approves',
    'ai creates approved sov',
    'vektrum approves the sov automatically',
    'funds are released automatically',
    'funds released automatically',
    'guaranteed extraction',
    'contract extraction is guaranteed',
    'legal terms are interpreted automatically',
    'guarantees compliance',
    'contractor authorizes release',
  ]) {
    check(!surfaces.includes(banned),
      `  7. banned: "${banned}" absent`)
  }

  // ── 8. No payment / release / Stripe imports added ────────────────────
  console.log('\n8. No payment / release / Stripe imports added')
  // The fully-executed card and the auto-refresh effect must not introduce
  // any release-execution or Stripe code paths.
  for (const forbidden of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!signing.includes(forbidden),
      `  8a. signing section does NOT import / call "${forbidden}"`)
  }

  // ── 9. Test wired into npm test ───────────────────────────────────────
  check(
    pkg.includes('signed-contract-to-sov-pass.test.ts'),
    '9. signed-contract-to-sov-pass.test.ts wired into npm test',
  )

  console.log('\n✓ All signed-contract-to-sov-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
