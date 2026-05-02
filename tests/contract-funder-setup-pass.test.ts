/**
 * tests/contract-funder-setup-pass.test.ts
 *
 * Pins the contract / funder setup-flow polish pass:
 *   1. Funder create flow
 *      - heading "Create governed deal"
 *      - advisory "Start from the contract or funding documents"
 *      - body references "governing documents" / "source of truth"
 *      - import card "Import from contract or funding documents"
 *      - manual card "Enter deal details manually" + "Manual entry still
 *        requires verified governing documents before release authorization"
 *      - submit button "Create governed deal"
 *
 *   2. Contractor create flow
 *      - eyebrow "PROJECT SUBMISSION"
 *      - heading "Submit project for funder review"
 *      - advisory body references funder verification + Vektrum enforces gate
 *        + "selected payment rail executes"
 *      - draft note "draft until a funder verifies the deal"
 *      - submit button "Submit project information"
 *      - banned: "Create governed deal", "Authorize release", "Release funds",
 *        "Your partner rail executes"
 *
 *   3. Contract upload section
 *      - role-aware: funder copy mentions governing contract / funding documents
 *      - role-aware: contractor copy mentions funder verification
 *      - admin copy is neutral
 *      - role prop wired through from deal page
 *
 *   4. Contract signing section
 *      - "Contract uploaded — signatures not sent" copy
 *      - "Send for DocuSign Signatures" button when no envelope
 *      - "Funder: Signed" / "Contractor: Pending" via SignerRow
 *      - "It's your turn to sign." cue
 *      - "Open DocuSign to Sign" button
 *
 *   5. Banned product claims absent across the touched surfaces.
 *
 * Run: npx tsx tests/contract-funder-setup-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const NEW_DEAL_FORM = 'src/app/(app)/dashboard/deals/new/new-deal-form.tsx'
const UPLOAD_SECTION = 'src/components/deal/contract-upload-section.tsx'
const SIGNING_SECTION = 'src/components/deal/contract-signing-section.tsx'
const DEAL_PAGE       = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const PACKAGE_JSON    = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// Slice the new-deal form into the contractor-only and funder-only blocks
// so banned-phrase guards can target the correct branch. The form uses
// `isContractor ? <contractor> : <funder>` ternaries plus dedicated
// `{!isContractor && (...)}` and `{isContractor && (...)}` blocks. We
// concatenate every appearance of each branch.
function sliceBranches(src: string): {
  contractorBranch: string
  funderBranch:     string
} {
  const ternaries = [...src.matchAll(/isContractor\s*\?\s*([\s\S]*?)\s*:\s*([\s\S]*?)(?=\}|,|\))/g)]
  let contractor = ''
  let funder = ''
  for (const m of ternaries) {
    contractor += '\n' + (m[1] ?? '')
    funder     += '\n' + (m[2] ?? '')
  }

  // Whole-block conditionals
  const contractorBlocks = [...src.matchAll(/\{\s*isContractor\s*&&\s*\(([\s\S]*?)\)\s*\}/g)]
  for (const m of contractorBlocks) contractor += '\n' + (m[1] ?? '')

  const funderBlocks = [...src.matchAll(/\{\s*!isContractor\s*&&\s*\(([\s\S]*?)\)\s*\}/g)]
  for (const m of funderBlocks) funder += '\n' + (m[1] ?? '')

  return { contractorBranch: contractor, funderBranch: funder }
}

async function main() {
  console.log('\ncontract-funder-setup-pass.test.ts\n')

  const form    = read(NEW_DEAL_FORM)
  const upload  = read(UPLOAD_SECTION)
  const signing = read(SIGNING_SECTION)
  const dealPage = read(DEAL_PAGE)
  const pkg     = read(PACKAGE_JSON)

  const { contractorBranch, funderBranch } = sliceBranches(form)

  // ── 1. Funder create flow ──────────────────────────────────────────────
  console.log('1. Funder create flow')
  check(funderBranch.includes('Create governed deal'),
    '  1a. funder heading / submit "Create governed deal" present in funder branch')
  check(form.includes('Start from the contract or funding documents'),
    '  1b. funder advisory: "Start from the contract or funding documents"')
  check(form.includes('governing documents define parties'),
    '  1c. funder body: "governing documents define parties..."')
  check(
    form.includes('source of truth'),
    '  1d. funder body reinforces "source of truth"',
  )
  check(
    form.includes('Import from contract or funding documents'),
    '  1e. funder import card: "Import from contract or funding documents"',
  )
  check(
    form.includes('Enter deal details manually'),
    '  1f. funder manual card label: "Enter deal details manually"',
  )
  // JSX text wraps "before release\nauthorization." across two lines —
  // collapse whitespace before substring match.
  const formCollapsed = form.replace(/\s+/g, ' ')
  check(
    formCollapsed.includes('Manual entry still requires verified governing documents before release authorization'),
    '  1g. funder manual helper: "Manual entry still requires verified governing documents before release authorization"',
  )
  // Submit button — appears in source as the funder branch of the loading ternary
  check(
    /:\s*"Create governed deal"\s*}/.test(form) ||
    /:\s*'Create governed deal'\s*}/.test(form),
    '  1h. funder submit button defaults to "Create governed deal"',
  )

  // ── 2. Contractor create flow ──────────────────────────────────────────
  console.log('\n2. Contractor create flow')
  check(form.includes('"Project Submission"') || form.includes("'Project Submission'"),
    '  2a. contractor eyebrow "Project Submission"')
  check(form.includes('Submit project for funder review'),
    '  2b. contractor heading "Submit project for funder review"')
  check(
    form.includes('Submit project information for funder review'),
    '  2c. contractor advisory heading retained',
  )
  // Body must reference funder verification + Vektrum enforces gate + selected rail executes
  check(
    contractorBranch.includes('Your funder must verify the governing terms') ||
    form.includes('Your funder must verify the governing terms'),
    '  2d. contractor body: "Your funder must verify the governing terms…"',
  )
  check(
    form.includes('Vektrum enforces the release gate'),
    '  2e. contractor body: "Vektrum enforces the release gate"',
  )
  check(
    form.includes('selected payment') && form.includes('rail executes'),
    '  2f. contractor body: "selected payment rail executes"',
  )
  check(
    form.includes('draft until a funder verifies the deal'),
    '  2g. contractor draft note: "draft until a funder verifies the deal"',
  )
  // Submit button — "Submit project information"
  check(
    form.includes('"Submit project information"') ||
    form.includes("'Submit project information'"),
    '  2h. contractor submit button: "Submit project information"',
  )

  // Banned phrasing on the contractor side ONLY (the funder branch is allowed
  // to say "Create governed deal" — that's the correct funder framing).
  for (const banned of [
    'Authorize release',
    'authorize release',
    'Release funds',
    'release funds',
    'Your partner rail executes',
    'your partner rail executes',
    'partner rail executes',
  ]) {
    check(
      !contractorBranch.includes(banned),
      `  2i. contractor branch does NOT contain "${banned}"`,
    )
  }
  // "Create governed deal" must not appear inside the contractor branch.
  check(
    !contractorBranch.includes('Create governed deal'),
    '  2j. contractor branch does NOT contain "Create governed deal" (funder framing)',
  )

  // ── 3. Contract upload section is role-aware ──────────────────────────
  console.log('\n3. Contract upload section role-aware copy')
  check(
    /role\?:\s*ContractUploadRole/.test(upload) ||
    /role\?:\s*['"]?contractor['"]?\s*\|/.test(upload) ||
    /role\?:\s*ContractUploadRole/.test(upload),
    '  3a. ContractUploadSection accepts an optional role prop',
  )
  check(
    upload.includes('signed or governing contract') &&
    upload.includes('source of truth before release authorization'),
    '  3b. funder copy: "signed or governing contract" + "source of truth before release authorization"',
  )
  check(
    upload.includes('supporting contract documents for funder verification') &&
    upload.includes('verify governing terms before releases can proceed'),
    '  3c. contractor copy: "supporting contract documents for funder verification" + "verify governing terms before releases can proceed"',
  )
  // Admin path keeps the existing neutral copy
  check(
    upload.includes('executed contract PDF'),
    '  3d. admin / neutral fallback copy preserved',
  )
  // Role prop wired through deal page
  check(
    /<ContractUploadSection[\s\S]{0,160}role=\{typedProfile\.role/.test(dealPage),
    '  3e. deal page passes role={typedProfile.role} to <ContractUploadSection />',
  )

  // ── 4. Contract signing section copy ──────────────────────────────────
  console.log('\n4. Contract signing section copy')
  check(
    signing.includes('Contract uploaded — signatures not sent'),
    '  4a. uploaded-but-not-sent: "Contract uploaded — signatures not sent"',
  )
  check(
    signing.includes('Milestone releases remain blocked until the required parties complete signing'),
    '  4b. blocked-until-signed copy preserved',
  )
  check(
    signing.includes('Send for DocuSign Signatures') ||
    signing.includes('Send for DocuSign signatures'),
    '  4c. send-envelope CTA: "Send for DocuSign Signatures"',
  )
  // SignerRow renders Funder/Contractor labels
  check(
    /label="Funder"/.test(signing) && /label="Contractor"/.test(signing),
    '  4d. SignerRow renders Funder + Contractor labels',
  )
  check(
    signing.includes('contractorTurn') &&
    /contractorTurn\s*=\s*isContractor\s*&&\s*funderDone\s*&&\s*!contractorDone/.test(signing),
    '  4e. contractorTurn = isContractor && funderDone && !contractorDone',
  )
  check(
    signing.includes('It&rsquo;s your turn to sign') ||
    signing.includes("It's your turn to sign"),
    "  4f. \"It's your turn to sign.\" cue present",
  )
  check(
    signing.includes('Open DocuSign to Sign'),
    '  4g. "Open DocuSign to Sign" button text present',
  )
  // Refresh signing status fallback (added in earlier DocuSign sync pass)
  check(
    signing.includes('Refresh signing status'),
    '  4h. "Refresh signing status" fallback action present',
  )

  // ── 5. Banned product claims across all touched surfaces ──────────────
  console.log('\n5. Banned product claims absent across touched surfaces')
  const all = (form + '\n' + upload + '\n' + signing + '\n' + dealPage).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'vektrum is escrow',
    'vektrum is a lender',
    'ai approves release',
    'ai approved release',
    'ai authorizes payment',
    'guarantees compliance',
    'guarantees payment',
    'prevents fraud',
    'contractor authorizes release',
  ]) {
    check(!all.includes(banned), `  5. banned: "${banned}" absent`)
  }

  // ── 6. Test wired into npm test ───────────────────────────────────────
  check(
    pkg.includes('contract-funder-setup-pass.test.ts'),
    '6. contract-funder-setup-pass.test.ts wired into npm test',
  )

  console.log('\n✓ All contract-funder-setup-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
