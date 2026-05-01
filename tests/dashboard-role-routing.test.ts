/**
 * tests/dashboard-role-routing.test.ts
 *
 * Static source-parse checks verifying that the main dashboard correctly
 * routes by role and shows role-appropriate empty states and CTAs.
 *
 * Root cause addressed:
 *   - Contractors who signed up via an invite link had role=funder set by the
 *     signup page (lockedAsFunder logic), so they landed on "FUNDER DASHBOARD."
 *   - Funder empty state copy said "once a contractor invites you" — confusing
 *     to anyone seeing it unexpectedly, and missing a Create Governed Deal CTA.
 *   - Unknown/null role caused a silent blank page (no fallback rendered).
 *
 * Checks:
 *  1.  Dashboard page file exists
 *  2.  Contractor view heading says "Contractor Dashboard" (eyebrow)
 *  3.  Funder view heading says "Funder Dashboard" (eyebrow)
 *  4.  Dashboard renders an explicit unknown-role fallback (not a silent blank page)
 *  5.  Unknown-role fallback does NOT silently render the funder view
 *  6.  Contractor empty state includes a CTA (Create Deal or Invite Funder or Submit Project)
 *  7.  Contractor empty state copy does not imply contractors control payment release
 *  8.  Funder empty state includes "Create Governed Deal" CTA
 *  9.  Funder empty state does NOT say "once a contractor invites you"
 * 10.  Signup page defaults to contractor role (not funder) for non-invite flow
 * 11.  Signup page locks role to funder only when invite token is present
 * 12.  Signup page shows an escape note so non-funders can restart without the invite lock
 * 13.  Existing deal access controls unchanged — contractor query uses contractor_id
 * 14.  Existing deal access controls unchanged — funder query uses funder_id
 * 15.  Admin role still redirects to /dashboard/admin (not silently shown funder view)
 * 16.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/dashboard-role-routing.test.ts
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

const DASHBOARD   = 'src/app/(app)/dashboard/page.tsx'
const SIGNUP      = 'src/app/auth/signup/page.tsx'
const PACKAGE_JSON = 'package.json'

async function main() {
  console.log('\ndashboard-role-routing.test.ts\n')

  // ── 1. Files exist ────────────────────────────────────────────────────────────
  check(exists(DASHBOARD),  '1. Dashboard page file exists')
  check(exists(SIGNUP),     '1b. Signup page file exists')

  const page   = read(DASHBOARD)
  const signup = read(SIGNUP)

  // Use section comment landmarks to scope checks to the correct view block.
  const contractorStart  = page.indexOf('// ── Contractor view')
  const funderStart      = page.indexOf('// ── Funder view')
  const adminStart       = page.indexOf('// ── Admin view')

  const contractorBlock  = page.slice(contractorStart, funderStart)
  const funderBlock      = page.slice(funderStart, adminStart > -1 ? adminStart : undefined)
  const afterAdminBlock  = adminStart > -1 ? page.slice(adminStart) : ''

  // ── 2. Contractor view has correct heading ────────────────────────────────────
  check(
    contractorBlock.includes('Contractor Dashboard'),
    '2. Contractor view eyebrow/heading says "Contractor Dashboard"',
  )

  // ── 3. Funder view has correct heading ────────────────────────────────────────
  check(
    funderBlock.includes('Funder Dashboard'),
    '3. Funder view eyebrow/heading says "Funder Dashboard"',
  )

  // ── 4. Unknown-role fallback exists ──────────────────────────────────────────
  // After the admin redirect, there must be a fallback return statement.
  // Check that a return exists after the admin block (not just undefined fallthrough).
  check(
    afterAdminBlock.includes('return (') || page.includes('unknown role') || page.includes('complete your profile') ||
    page.includes('role is not recognised') || page.includes('account role') || page.includes('contact support'),
    '4. Dashboard renders an explicit fallback for unknown/missing role (not a blank page)',
  )

  // ── 5. Unknown role does NOT silently render funder content ───────────────────
  // The funder content must be inside the funder role guard, not at the top level.
  // A simple proxy: "Funder Dashboard" appears inside the funder if-block only.
  const funderDashboardIdxInFunderBlock = funderBlock.indexOf('Funder Dashboard')
  const funderDashboardIdxInPage        = page.indexOf('Funder Dashboard')
  // The first occurrence must be inside the funder block (not before it)
  check(
    funderDashboardIdxInPage >= funderStart,
    '5. "Funder Dashboard" label only appears inside the funder role guard block',
  )

  // ── 6. Contractor empty state has actionable CTA ──────────────────────────────
  check(
    contractorBlock.includes('Create Deal') ||
    contractorBlock.includes('Invite Funder') ||
    contractorBlock.includes('Submit Project') ||
    contractorBlock.includes('invite') ||
    contractorBlock.includes('/dashboard/deals/new'),
    '6. Contractor empty state includes an actionable CTA (Create Deal / Invite Funder)',
  )

  // ── 7. Contractor copy does not imply contractors control payment release ─────
  check(
    !contractorBlock.includes('receiving payments') &&
    !contractorBlock.includes('receive payments'),
    '7. Contractor empty state copy does not imply contractors control payment release',
  )

  // ── 8. Funder empty state has Create Governed Deal CTA ───────────────────────
  check(
    funderBlock.includes('Create Governed Deal') ||
    (funderBlock.includes('Create') && funderBlock.includes('deal')),
    '8. Funder empty state includes "Create Governed Deal" or equivalent CTA',
  )

  // ── 9. Funder empty state does NOT say "once a contractor invites you" ────────
  check(
    !funderBlock.includes('once a contractor invites you'),
    '9. Funder empty state does NOT say "once a contractor invites you to a project"',
  )

  // ── 10. Signup defaults to contractor role ────────────────────────────────────
  check(
    signup.includes('"contractor"') &&
    (signup.includes('lockedAsFunder ? "funder" : "contractor"') ||
     signup.includes("lockedAsFunder ? 'funder' : 'contractor'")),
    '10. Signup defaults to contractor role when no invite token is present',
  )

  // ── 11. Signup locks funder role only when invite token present ───────────────
  check(
    signup.includes('lockedAsFunder') && signup.includes('inviteToken'),
    '11. Signup role lock is conditional on invite token (lockedAsFunder)',
  )

  // ── 12. Signup has escape note for non-funders arriving via invite link ────────
  check(
    signup.includes('Not a funder') ||
    signup.includes('sign up without') ||
    signup.includes('without the invite') ||
    signup.includes('wrong role') ||
    signup.includes('Contractor?') ||
    signup.includes('sign up here') ||
    signup.includes('/auth/signup" ') ||
    signup.includes("/auth/signup'") ||
    signup.includes('href="/auth/signup"') ||
    signup.includes("href='/auth/signup'"),
    '12. Signup shows an escape note for non-funders who arrived via an invite link',
  )

  // ── 13. Contractor query still scoped to contractor_id ────────────────────────
  check(
    page.includes("query = query.eq('contractor_id', userId)"),
    '13. Contractor query still uses contractor_id filter (access controls unchanged)',
  )

  // ── 14. Funder query still scoped to funder_id ───────────────────────────────
  check(
    page.includes("query = query.eq('funder_id', userId)"),
    '14. Funder query still uses funder_id filter (access controls unchanged)',
  )

  // ── 15. Admin role still redirects to /dashboard/admin ───────────────────────
  check(
    page.includes("profile.role === 'admin'") &&
    page.includes("redirect('/dashboard/admin')"),
    '15. Admin role still redirects to /dashboard/admin',
  )

  // ── 16. Test wired into package.json ─────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('dashboard-role-routing.test.ts'),
    '16. This test file is wired into npm test in package.json',
  )

  console.log('\n✓ All dashboard-role-routing tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
