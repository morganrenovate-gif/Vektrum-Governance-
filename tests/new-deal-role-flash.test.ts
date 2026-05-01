/**
 * tests/new-deal-role-flash.test.ts
 *
 * Static source-parse tests proving the new-deal page has no role-flash bug.
 *
 * Root cause of bug (now fixed):
 *   page.tsx was "use client" with `useState<UserRole>(null)`.
 *   isContractor = userRole === "contractor" → initially false.
 *   So every contractor saw the funder/admin UI on first render, then it
 *   switched after the useEffect completed its Supabase profile fetch.
 *   The layout already fetched profile.role server-side but discarded it.
 *
 * Fix (verified by these tests):
 *   page.tsx is now a server component that fetches role and passes it as a
 *   prop to <NewDealForm role={role}>.  NewDealForm receives role synchronously
 *   — no initial null state, no async fetch for role, no flash.
 *
 * Checks:
 *  1.  page.tsx does NOT contain "use client" (it is a server component)
 *  2.  page.tsx does NOT contain useState (no client state at page level)
 *  3.  page.tsx does NOT contain useEffect (no async role fetch at page level)
 *  4.  page.tsx imports and renders NewDealForm
 *  5.  page.tsx fetches role server-side (calls .from('profiles').select('role'))
 *  6.  page.tsx passes role as a prop to NewDealForm
 *  7.  NewDealForm file exists as a separate client component
 *  8.  NewDealForm contains "use client"
 *  9.  NewDealForm does NOT use useState<UserRole>(null) — role is a prop, not state
 * 10.  NewDealForm does NOT fetch role in useEffect — no async role detection
 * 11.  NewDealForm defines isContractor from prop (not from async state)
 * 12.  NewDealForm contractor copy ("Submit project information") is present
 * 13.  NewDealForm funder/admin copy ("Create governed deal") is present
 * 14.  NewDealForm contractor advisory block is present
 * 15.  NewDealForm funder advisory block ("Start from the contract") is present
 * 16.  No default-to-funder: isContractor is NOT derived from a null-initial state
 * 17.  Layout still performs server-side role check before page renders
 * 18.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/new-deal-role-flash.test.ts
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

const PAGE        = 'src/app/(app)/dashboard/deals/new/page.tsx'
const FORM        = 'src/app/(app)/dashboard/deals/new/new-deal-form.tsx'
const LAYOUT      = 'src/app/(app)/dashboard/deals/new/layout.tsx'
const PACKAGE_JSON = 'package.json'

async function main() {
  console.log('\nnew-deal-role-flash.test.ts\n')

  // ── Files exist ───────────────────────────────────────────────────────────────
  check(exists(PAGE),   'page.tsx exists')
  check(exists(FORM),   'new-deal-form.tsx exists')
  check(exists(LAYOUT), 'layout.tsx exists')

  const page   = read(PAGE)
  const form   = read(FORM)
  const layout = read(LAYOUT)

  // ── 1. page.tsx is NOT a client component ─────────────────────────────────────
  check(
    !page.includes('"use client"') && !page.includes("'use client'"),
    '1. page.tsx does not contain "use client" — it is a server component',
  )

  // ── 2. page.tsx has no useState ───────────────────────────────────────────────
  check(
    !page.includes('useState'),
    '2. page.tsx does not contain useState (no client state at page level)',
  )

  // ── 3. page.tsx has no useEffect ──────────────────────────────────────────────
  check(
    !page.includes('useEffect'),
    '3. page.tsx does not contain useEffect (no async role fetch at page level)',
  )

  // ── 4. page.tsx renders NewDealForm ──────────────────────────────────────────
  check(
    page.includes('NewDealForm'),
    '4. page.tsx imports and renders <NewDealForm>',
  )

  // ── 5. page.tsx fetches role server-side ──────────────────────────────────────
  check(
    page.includes("'profiles'") || page.includes('"profiles"'),
    '5. page.tsx fetches role from profiles table server-side',
  )

  // ── 6. page.tsx passes role prop to NewDealForm ───────────────────────────────
  check(
    page.includes('role={') || page.includes('role ='),
    '6. page.tsx passes role as a prop to <NewDealForm>',
  )

  // ── 7. NewDealForm exists ─────────────────────────────────────────────────────
  // Already checked above via exists(FORM)
  pass('7. new-deal-form.tsx exists as a separate client component file')

  // ── 8. NewDealForm is a client component ─────────────────────────────────────
  check(
    form.includes('"use client"') || form.includes("'use client'"),
    '8. new-deal-form.tsx contains "use client"',
  )

  // ── 9. NewDealForm does NOT useState<UserRole>(null) ─────────────────────────
  // The role must arrive as a prop — not initialised as null state.
  check(
    !form.includes('useState<UserRole>(null)') &&
    !form.includes("useState<UserRole>('null')") &&
    !(form.includes('useState') && form.includes('UserRole') && form.includes('(null)')),
    '9. NewDealForm does not initialise role as useState(null)',
  )

  // ── 10. NewDealForm does NOT fetch role in useEffect ─────────────────────────
  // The key pattern to eliminate: async detectRole() inside useEffect that calls
  // supabase.from('profiles').select('role') and then setUserRole().
  // Check that we don't have a useEffect that sets role state from a profile fetch.
  const hasRoleSetterInEffect =
    form.includes('setUserRole') ||
    (form.includes('useEffect') &&
     form.includes('profiles') &&
     (form.includes('setRole') || form.includes('setUserRole')))
  check(
    !hasRoleSetterInEffect,
    '10. NewDealForm does not fetch role in useEffect — role comes from prop',
  )

  // ── 11. isContractor derived from prop, not null-initial state ────────────────
  // Accept any of: `role === "contractor"`, `role === 'contractor'`,
  // `props.role === 'contractor'`, `{ role }` destructuring then comparison.
  check(
    form.includes("role === 'contractor'") ||
    form.includes('role === "contractor"'),
    '11. isContractor derived from role prop (role === "contractor"), not async state',
  )

  // ── 12. Contractor copy present in form ───────────────────────────────────────
  check(
    form.includes('Submit project information'),
    '12. NewDealForm contractor copy "Submit project information" is present',
  )

  // ── 13. Funder/admin copy present in form ─────────────────────────────────────
  check(
    form.includes('Create governed deal') ||
    form.includes('Governed Deal') ||
    form.includes('governed deal'),
    '13. NewDealForm funder/admin copy "Create governed deal" is present',
  )

  // ── 14. Contractor advisory block present ─────────────────────────────────────
  check(
    form.includes('Invite your funder') || form.includes('invite your funder'),
    '14. NewDealForm contractor advisory block "Invite your funder" is present',
  )

  // ── 15. Funder advisory block present ────────────────────────────────────────
  check(
    form.includes('Start from the contract') || form.includes('Import from contract'),
    '15. NewDealForm funder advisory block "Start from the contract" is present',
  )

  // ── 16. No null-initial role anywhere in form ─────────────────────────────────
  // !isContractor being shown as funder content requires that isContractor starts
  // false. With role as a prop there is no null initial state.
  // Verify: no `useState(null)` where the state is used as the role.
  const nullRoleState =
    form.includes("useState<UserRole>(null)") ||
    form.includes("useState<'contractor' | 'funder' | 'admin' | null>(null)")
  check(
    !nullRoleState,
    '16. No null-initial role state in NewDealForm — no default-to-funder behavior',
  )

  // ── 17. Layout still performs server-side role check ─────────────────────────
  check(
    layout.includes("profile.role") && layout.includes('ALLOWED_ROLES'),
    '17. Layout still performs server-side role guard before page renders',
  )

  // ── 18. Test wired into package.json ─────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('new-deal-role-flash.test.ts'),
    '18. This test file is wired into npm test in package.json',
  )

  console.log('\n✓ All new-deal-role-flash tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
