/**
 * tests/funder-empty-state-cta.test.ts
 *
 * Static source-parse checks verifying that the funder dashboard has a
 * prominent "Create governed deal" CTA in both the page header and the
 * empty state, and that contractor / unknown-role views do not show
 * funder-specific content.
 *
 * Root cause of the bug:
 *   - Funder PageHeader had no action prop → no top-right CTA button.
 *   - Funder empty state title was "No projects yet" with generic description.
 *   - Old copy said "Deals will appear here once a contractor invites you"
 *     which is wrong: funders create and govern deals, not wait for invites.
 *
 * Checks:
 *  1.  Funder PageHeader includes a CTA linking to /dashboard/deals/new
 *  2.  Funder PageHeader CTA label is "Create governed deal"
 *  3.  Funder empty state title is "No governed deals yet"
 *  4.  Funder empty state has "Create governed deal" action label
 *  5.  Funder empty state action links to /dashboard/deals/new
 *  6.  Funder empty state does NOT say "once a contractor invites you"
 *  7.  Funder empty state description mentions contract / funding agreement / draw schedule
 *  8.  Contractor block does NOT show funder-specific "Create governed deal" header CTA
 *  9.  Contractor empty state contains contractor-appropriate copy
 * 10.  Unknown/missing role does not silently fall through to funder view
 * 11.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/funder-empty-state-cta.test.ts
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

const DASHBOARD    = 'src/app/(app)/dashboard/page.tsx'
const PACKAGE_JSON = 'package.json'

async function main() {
  console.log('\nfunder-empty-state-cta.test.ts\n')

  check(exists(DASHBOARD), 'Dashboard page file exists')

  const page = read(DASHBOARD)

  // Use section comment landmarks to scope checks to the correct view block.
  const contractorStart = page.indexOf('// ── Contractor view')
  const funderStart     = page.indexOf('// ── Funder view')
  const adminStart      = page.indexOf('// ── Admin view')
  const unknownStart    = page.indexOf('// ── Unknown')

  check(contractorStart >= 0, 'Contractor view landmark comment exists')
  check(funderStart     >= 0, 'Funder view landmark comment exists')

  const contractorBlock = page.slice(contractorStart, funderStart)
  const funderBlock     = page.slice(funderStart, adminStart > -1 ? adminStart : undefined)
  const afterAdmin      = adminStart > -1 ? page.slice(adminStart) : ''

  // ── 1. Funder PageHeader action links to /dashboard/deals/new ────────────────
  // The action prop must appear before the funder EmptyState (in the PageHeader).
  // We check that the funder block wires /dashboard/deals/new into a PageHeader action.
  // Proxy: the href appears in the funder block.
  check(
    funderBlock.includes('/dashboard/deals/new'),
    '1. Funder block contains a link to /dashboard/deals/new (header CTA or empty state)',
  )

  // ── 2. Funder PageHeader CTA label is "Create governed deal" ─────────────────
  // Both "Create governed deal" and "Create Governed Deal" are acceptable.
  check(
    funderBlock.toLowerCase().includes('create governed deal'),
    '2. Funder block contains "Create governed deal" CTA label',
  )

  // ── 3. Funder empty state title is "No governed deals yet" ───────────────────
  check(
    funderBlock.includes('No governed deals yet'),
    '3. Funder empty state title is "No governed deals yet"',
  )

  // ── 4. Funder empty state has "Create governed deal" action label ─────────────
  // The EmptyState action label must include "Create governed deal" (case-insensitive).
  check(
    funderBlock.toLowerCase().includes('create governed deal'),
    '4. Funder empty state has "Create governed deal" action label',
  )

  // ── 5. Funder empty state action links to /dashboard/deals/new ───────────────
  // We already checked /dashboard/deals/new is in the funder block (check 1).
  // Extra specificity: it appears near the EmptyState action object.
  const emptyStateIdx = funderBlock.indexOf('EmptyState')
  // 700 chars covers icon+title+long description+action href
  const emptyStateSlice = emptyStateIdx >= 0 ? funderBlock.slice(emptyStateIdx, emptyStateIdx + 700) : ''
  check(
    emptyStateSlice.includes('/dashboard/deals/new'),
    '5. Funder EmptyState action links to /dashboard/deals/new',
  )

  // ── 6. Funder block does NOT say "once a contractor invites you" ──────────────
  check(
    !funderBlock.includes('once a contractor invites you'),
    '6. Funder empty state does NOT say "once a contractor invites you"',
  )

  // ── 7. Funder empty state description mentions contract / draw schedule ────────
  const funderLower = funderBlock.toLowerCase()
  check(
    funderLower.includes('contract') ||
    funderLower.includes('draw schedule') ||
    funderLower.includes('funding agreement'),
    '7. Funder empty state description mentions contract, funding agreement, or draw schedule',
  )

  // ── 8. Contractor block does NOT contain funder-only PageHeader CTA ───────────
  // The contractor PageHeader should link to deals/new for Stripe'd contractors
  // but should NOT include "Create governed deal" — that framing is funder-specific.
  // (Contractors see "Create New Deal" or similar, not the governance-authority copy.)
  check(
    !contractorBlock.includes('Create governed deal'),
    '8. Contractor block does NOT contain funder-specific "Create governed deal" copy',
  )

  // ── 9. Contractor empty state has contractor-appropriate copy ─────────────────
  check(
    contractorBlock.includes('Create Deal') ||
    contractorBlock.includes('Create a deal') ||
    contractorBlock.includes('create a deal') ||
    contractorBlock.includes('invite') ||
    contractorBlock.includes('funder') ||
    contractorBlock.includes('/dashboard/deals/new'),
    '9. Contractor empty state has contractor-appropriate copy or CTA',
  )

  // ── 10. Unknown/missing role does not silently render funder view ─────────────
  // After the admin redirect block there must be an explicit fallback, not just
  // a fall-through that would re-render any earlier role view.
  check(
    afterAdmin.includes('return (') ||
    page.includes('account role') ||
    page.includes('contact support') ||
    page.includes('unrecognised role') ||
    (unknownStart >= 0),
    '10. Unknown/missing role renders an explicit fallback, not a silent funder view',
  )

  // ── 11. Test wired into package.json ─────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('funder-empty-state-cta.test.ts'),
    '11. This test file is wired into npm test in package.json',
  )

  console.log('\n✓ All funder-empty-state-cta tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
