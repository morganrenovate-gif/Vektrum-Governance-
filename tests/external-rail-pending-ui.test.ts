/**
 * tests/external-rail-pending-ui.test.ts
 *
 * Verifies the funder-facing "Pending External Payments" section on the deal
 * detail page is correctly wired:
 *
 *   1. Deal page fetches releases with execution_status='pending' and
 *      execution_rail='external_manual' for the deal
 *   2. Deal page imports ConfirmExternalReleaseButton
 *   3. Deal page renders the button only for funders (not contractors/admins)
 *   4. ConfirmExternalReleaseButton calls the correct confirm-external endpoint
 *   5. ConfirmExternalReleaseButton calls mark-external-failed for the fail path
 *   6. Pending section is wired into npm test
 *
 * Run: npx tsx tests/external-rail-pending-ui.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {

const DEAL_PAGE  = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const BUTTON     = 'src/components/deal/confirm-external-release-button.tsx'
const CONFIRM_RT = 'src/app/api/releases/[releaseId]/confirm-external/route.ts'
const PKG        = 'package.json'

// ── 1. Deal page fetches pending external releases ───────────────────────────

console.log('\n── 1. Deal page queries pending external releases ──────────────────')

const dealPageSrc = read(DEAL_PAGE)

check(
  dealPageSrc.includes("execution_status") && dealPageSrc.includes("pending"),
  "Deal page fetches releases filtered by execution_status='pending'",
)
check(
  dealPageSrc.includes("external_manual") || dealPageSrc.includes("execution_rail"),
  "Deal page filters releases by external_manual rail",
)

// ── 2. Deal page imports ConfirmExternalReleaseButton ────────────────────────

console.log('\n── 2. Deal page imports ConfirmExternalReleaseButton ───────────────')

check(
  dealPageSrc.includes('ConfirmExternalReleaseButton'),
  'Deal page imports and uses ConfirmExternalReleaseButton',
)
check(
  dealPageSrc.includes('confirm-external-release-button'),
  'Deal page imports from confirm-external-release-button component file',
)

// ── 3. Pending section is funder-only ────────────────────────────────────────

console.log('\n── 3. Pending section is funder-only ───────────────────────────────')

// The ConfirmExternalReleaseButton JSX render must be inside a funder role guard.
// Skip the import declaration (first occurrence) — look for the JSX usage (<ConfirmExternal).
const jsxBtnIndex = dealPageSrc.indexOf('<ConfirmExternalReleaseButton')
const funderDbl   = dealPageSrc.lastIndexOf('role === "funder"', jsxBtnIndex)
const funderSgl   = dealPageSrc.lastIndexOf("role === 'funder'", jsxBtnIndex)
const funderCheck = Math.max(funderDbl, funderSgl)
check(
  jsxBtnIndex > -1,
  'ConfirmExternalReleaseButton is used as JSX in the deal page',
)
check(
  funderCheck > -1 && funderCheck < jsxBtnIndex,
  'ConfirmExternalReleaseButton JSX render is guarded by a funder role check',
)

// ── 4. Button component calls confirm-external endpoint ──────────────────────

console.log('\n── 4. ConfirmExternalReleaseButton calls correct endpoint ──────────')

const btnSrc = read(BUTTON)

check(
  btnSrc.includes('/api/releases/${releaseId}/confirm-external') ||
  btnSrc.includes('confirm-external'),
  'Button calls POST /api/releases/[releaseId]/confirm-external',
)
check(
  btnSrc.includes('payment_method') && btnSrc.includes('payment_reference'),
  'Button submits payment_method and payment_reference fields',
)

// ── 5. Button has mark-failed path ───────────────────────────────────────────

console.log('\n── 5. Button supports mark-as-failed path ──────────────────────────')

check(
  btnSrc.includes('mark-external-failed'),
  'Button calls mark-external-failed endpoint for the failure path',
)
check(
  btnSrc.includes('allowMarkFailed'),
  'Button accepts allowMarkFailed prop to show/hide the failure action',
)

// ── 6. Confirm-external route requires MFA ───────────────────────────────────

console.log('\n── 6. Confirm-external route enforces auth ─────────────────────────')

const confirmSrc = read(CONFIRM_RT)

check(
  confirmSrc.includes('requireMFA'),
  'confirm-external route calls requireMFA',
)
check(
  confirmSrc.includes("execution_status === 'confirmed'") ||
  confirmSrc.includes("execution_status: 'confirmed'"),
  'confirm-external route handles already-confirmed idempotency (409)',
)

// ── 7. Wired into npm test ───────────────────────────────────────────────────

console.log('\n── 7. Test wired into npm test ─────────────────────────────────────')

const pkg = read(PKG)
check(
  pkg.includes('external-rail-pending-ui.test.ts'),
  'external-rail-pending-ui.test.ts is wired into npm test',
)

console.log('\n✅  external-rail-pending-ui: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
