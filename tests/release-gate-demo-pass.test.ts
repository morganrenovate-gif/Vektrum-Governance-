/**
 * tests/release-gate-demo-pass.test.ts
 *
 * Cross-cutting invariants on the public release-gate / demo surface that
 * ensure both the contractor and funder demo pages stay role-correct and
 * never imply Vektrum moves money or autonomously releases funds.
 *
 * Existing per-surface tests already cover their own areas in detail
 * (demo-contractor-blocked-release.test.ts pins the 5-step AI review
 * animation, reset coverage, and per-condition handlers; demo-live-story
 * pins narrative copy; demo-reset-safety pins reset isolation). This test
 * adds the cross-page guarantees the spec asks for:
 *
 *   1. Contractor demo blocked-release card has 4 conditions, with
 *      "Funder authorization required" hardcoded done: false (contractor
 *      can NEVER mark it complete).
 *   2. AI review state machine has all three visible states:
 *        Awaiting → AI pre-review in progress → AI pre-review complete
 *      (plus the 5-step in-progress checklist).
 *   3. Even when contractorConditionsDone === true, the card switches to
 *      "Awaiting funder authorization" — release readiness is NOT
 *      release authorization.
 *   4. Reset Demo restores ALL the contractor blocked-release state vars
 *      (lienWaiverUploaded, changeOrderResolved, blockedAiReviewRunning,
 *      blockedAiReviewStep, blockedAiReviewDone) plus reviewSubmitted +
 *      activityEntries, and the page uses useDemoAutoReset.
 *   5. Funder demo has "Ready for Authorization" + "Funder authorization
 *      required" copy and a "Review & Authorize" CTA — funder is the only
 *      surface that can authorize release.
 *   6. Contractor demo has no UI affordance that authorizes / releases
 *      funds — those words/concepts cannot leak into the contractor view.
 *   7. Banned positioning phrases absent across both demo pages.
 *
 * Run: npx tsx tests/release-gate-demo-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const CONTRACTOR   = 'src/app/(marketing)/demo-live/contractor/page.tsx'
const FUNDER       = 'src/app/(marketing)/demo-live/funder/page.tsx'
const HARBOR_DEAL  = 'src/app/(marketing)/demo-live/deal/harbor/page.tsx'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// Strip block + line + JSX comments. We don't want comment text describing
// banned phrases ("does not say 'funds move automatically'") to false-fail
// the banned-phrase guards.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

async function main() {
  console.log('\nrelease-gate-demo-pass.test.ts\n')

  const contractor   = read(CONTRACTOR)
  const funder       = read(FUNDER)
  const harborRaw    = read(HARBOR_DEAL)
  const contractorRendered = stripComments(contractor)
  const funderRendered     = stripComments(funder)
  const harborRendered     = stripComments(harborRaw)
  const pkg          = read(PACKAGE_JSON)

  // ── 1. Contractor blocked-release card has 4 conditions ────────────────
  // The institutional refactor renamed two condition labels but the
  // semantics are unchanged. Accept either historical or new copy.
  console.log('1. Contractor blocked-release card — 4 conditions')
  const expectedConditions: Array<[string, string[]]> = [
    ['Lien waiver missing',           ['Lien waiver missing']],
    ['Open change order unresolved',  ['Open change order unresolved']],
    ['Control review not current',    ['Control review not current', 'AI pre-review not current']],
    ['Funder-authorization required', ['Funder authorization required', 'Authorization pending after conditions clear']],
  ]
  for (const [label, alternatives] of expectedConditions) {
    check(
      alternatives.some((alt) => contractor.includes(alt)),
      `  1a. condition "${label}" listed in MISSING_CONDITIONS`,
    )
  }
  // Funder authorization is hardcoded done: false — contractor can NEVER
  // mark it complete. The line literally says `done:   false`.
  check(
    /key:\s*['"]funder_auth['"][\s\S]{0,300}done:\s*false/.test(contractor),
    '  1b. Funder authorization condition is hardcoded done: false (contractor cannot clear)',
  )

  // ── 2. Control review state machine has all visible states ─────────────
  console.log('\n2. Control review state machine')
  check(
    contractor.includes('Awaiting AI Review') || contractor.includes('Under control review'),
    '  2a. "Under control review" state visible',
  )
  check(
    contractor.includes('AI pre-review in progress') || contractor.includes('Control review in progress'),
    '  2b. "Control review in progress" state visible',
  )
  check(
    contractor.includes('AI pre-review complete') ||
    contractor.includes('AI review complete') ||
    contractor.includes('Control review complete'),
    '  2c. "Control review complete" state visible',
  )
  check(
    contractor.includes('AI review running') || contractor.includes('Control review running'),
    '  2d. "Control review running…" disabled-button label',
  )
  // 5-step checklist
  for (const step of [
    'Reading draw request',
    'Comparing against SOV',
    'Checking lien waiver status',
    'Checking open change orders',
    'Preparing review summary',
  ]) {
    check(contractor.includes(step), `  2e. AI review step "${step}" listed`)
  }
  // AI review is NOT release authorization — completion message keeps the
  // boundary explicit.
  check(
    contractor.includes('funder authorization still required') ||
    contractor.includes('AI pre-review complete — funder authorization still required'),
    '  2f. completion still marks funder authorization required',
  )

  // ── 3. Release readiness is NOT release authorization ──────────────────
  console.log('\n3. Release readiness ≠ release authorization')
  // contractorConditionsDone derived flag exists
  check(
    contractor.includes('contractorConditionsDone') &&
    /lienWaiverUploaded\s*&&\s*changeOrderResolved\s*&&\s*blockedAiReviewDone/.test(contractor),
    '  3a. contractorConditionsDone flag is the AND of the three contractor-clearable conditions',
  )
  // When all three are done, card switches to "Awaiting funder authorization"
  check(
    contractor.includes('Awaiting funder authorization'),
    '  3b. card switches to "Awaiting funder authorization" when contractor side is done',
  )
  check(
    contractor.includes('All contractor-side release conditions are complete'),
    '  3c. body explicitly distinguishes contractor-side completion from funder authorization',
  )

  // ── 4. Demo reset restores all blocked-release state ───────────────────
  console.log('\n4. Demo reset restores blocked-release state')
  for (const setter of [
    'setReviewSubmitted(false)',
    'setSubmitting(false)',
    'setLienWaiverUploaded(false)',
    'setChangeOrderResolved(false)',
    'setBlockedAiReviewRunning(false)',
    'setBlockedAiReviewStep(0)',
    'setBlockedAiReviewDone(false)',
    'setActivityEntries(SEED_ENTRIES)',
  ]) {
    check(contractor.includes(setter),
      `  4a. reset callback calls ${setter}`)
  }
  check(
    contractor.includes('useDemoAutoReset'),
    '  4b. contractor page uses useDemoAutoReset (mounts the reset callback)',
  )

  // ── 5. Funder demo authorizes release ──────────────────────────────────
  // The institutional refactor uses sentence-case "Ready for authorization"
  // and renamed the CTA to "Review and authorize". Accept either.
  console.log('\n5. Funder demo authorizes release')
  check(
    /Ready for [Aa]uthorization/.test(funder),
    '  5a. funder demo shows a "Ready for authorization" badge',
  )
  check(
    funder.includes('Funder authorization required')
      || funder.includes('Funder authorization is required to proceed'),
    '  5b. funder demo asserts that funder authorization is required',
  )
  check(
    funder.includes('Review &amp; Authorize')
      || funder.includes('Review & Authorize')
      || funder.includes('Review and authorize'),
    '  5c. funder demo exposes a "Review and authorize" CTA',
  )
  // Funder demo links to the deal page where the actual authorize action lives
  check(
    funder.includes('/demo-live/deal/harbor?from=funder') ||
    funder.includes('/demo-live/deal/harbor'),
    '  5d. funder demo links to the harbor deal page',
  )

  // ── 6. Contractor demo never authorizes release ────────────────────────
  console.log('\n6. Contractor demo never authorizes release')
  // No "Authorize release" / "Authorize" / "Release funds" buttons in the
  // contractor render path.
  for (const banned of [
    'Authorize release',
    'Authorize Release',
    'authorize release',
    'Release funds',
    'release funds',
    'Approve release',
    'approve release',
  ]) {
    check(!contractorRendered.includes(banned),
      `  6a. contractor render does not contain "${banned}"`)
  }
  // The contractor page must mention "funder" + "authoriz" together so it's
  // clear who authorizes release on this surface.
  check(
    /funder[^.]*authoriz/i.test(contractorRendered),
    '  6b. contractor copy keeps "funder authorizes" boundary explicit',
  )

  // ── 7. Banned positioning phrases absent on both demo pages ─────────────
  console.log('\n7. Banned positioning phrases absent on demo pages')
  const bothLower = (contractorRendered + '\n' + funderRendered + '\n' + harborRendered).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum releases funds',
    'vektrum acts as escrow',
    'vektrum is escrow',
    'vektrum is a lender',
    'vektrum guarantees compliance',
    'vektrum prevents fraud',
    'ai approves release',
    'ai approved release',
    'ai authorizes payment',
    'automatic payment',
    'funds move automatically',
    'contractor authorizes release',
  ]) {
    check(!bothLower.includes(banned),
      `  7. banned: "${banned}" absent across contractor/funder/harbor demo pages`)
  }

  // ── 8. Rail-neutral disclaimer on contractor demo ──────────────────────
  // The contractor demo footer must remind viewers that Vektrum does not hold
  // funds or act as escrow — re-pinned here so this can't regress. JSX often
  // wraps long strings across lines; collapse whitespace before matching.
  console.log('\n8. Rail-neutral disclaimer on contractor demo')
  const contractorFlat = contractor.replace(/\s+/g, ' ')
  check(
    contractorFlat.includes('does not hold funds') &&
    (contractor.includes('escrow') || contractor.includes('selected rail')),
    '  8a. contractor demo includes "does not hold funds" + rail/escrow framing',
  )

  // ── 9. Test wired into npm test ───────────────────────────────────────
  check(
    pkg.includes('release-gate-demo-pass.test.ts'),
    '9. release-gate-demo-pass.test.ts wired into npm test',
  )

  console.log('\n✓ All release-gate-demo-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
