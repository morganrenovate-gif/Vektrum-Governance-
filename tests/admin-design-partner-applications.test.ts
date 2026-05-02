/**
 * tests/admin-design-partner-applications.test.ts
 *
 * Pins the admin lead-review surface for design-partner applications.
 *
 *   1. Route exists at /dashboard/admin/design-partner-applications.
 *   2. Server-side admin role gate:
 *        - createClient + auth.getUser
 *        - profile.role !== 'admin' → redirect('/dashboard')
 *        - unauth visitor → redirect('/auth/login?next=…')
 *      No client-side data fetch, no client-side role check.
 *   3. Admin client used to read the lead table (RLS denies all public
 *      access). The page never embeds the service-role key in the client
 *      bundle — `createSupabaseAdminClient` lives in @/lib/supabase/server.
 *   4. Page sorts newest first and selects the spec'd columns.
 *   5. Each row shows name, company, role, email, audience_type,
 *      draw_exposure, biggest_bottleneck preview, status, admin_email_sent_at
 *      indicator, created_at, plus an expandable detail with full
 *      bottleneck + UTM fields + referrer + user_agent + id.
 *   6. Status taxonomy in the UI matches the migration's CHECK constraint
 *      ('new', 'reviewing', 'invited', 'accepted', 'declined').
 *   7. The page is `dynamic = 'force-dynamic'` (per-request auth state),
 *      `robots: noindex/nofollow` (admin), and never imported from any
 *      marketing surface.
 *   8. The main admin dashboard exposes a "Design partner applications"
 *      tile linking to the new route.
 *
 * Run: npx tsx tests/admin-design-partner-applications.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const ADMIN_PAGE   = 'src/app/(app)/dashboard/admin/design-partner-applications/page.tsx'
const ADMIN_INDEX  = 'src/app/(app)/dashboard/admin/page.tsx'
const MIGRATION    = 'supabase/migrations/20260430000000_design_partner_applications.sql'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

function walkSync(dir: string, files: string[] = []): string[] {
  const full = path.resolve(ROOT, dir)
  if (!fs.existsSync(full)) return files
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) walkSync(rel, files)
    else if (rel.endsWith('.tsx') || rel.endsWith('.ts')) files.push(rel)
  }
  return files
}

async function main() {
  console.log('\nadmin-design-partner-applications.test.ts\n')

  // ── 1. Route file exists ───────────────────────────────────────────────
  console.log('1. Route exists')
  check(exists(ADMIN_PAGE),
    '  1a. /dashboard/admin/design-partner-applications page.tsx exists')

  const page = read(ADMIN_PAGE)

  // ── 2. Server-side admin role gate ─────────────────────────────────────
  console.log('\n2. Server-side admin role gate')
  // Page must NOT be a client component
  check(
    !page.includes("'use client'") && !page.includes('"use client"'),
    '  2a. page is a server component (no "use client" directive)',
  )
  check(
    /export\s+default\s+async\s+function/.test(page),
    '  2b. page is async (per-request server work)',
  )
  // Session-bound client + auth check
  check(
    page.includes('createClient') &&
    page.includes('@/lib/supabase/server'),
    '  2c. page imports createClient from @/lib/supabase/server',
  )
  check(
    page.includes('auth.getUser()'),
    '  2d. page calls auth.getUser() server-side',
  )
  // Unauth → redirect to login (with next= for post-login bounce)
  check(
    /redirect\([^)]*\/auth\/login[^)]*next=[^)]*design-partner-applications/.test(page),
    '  2e. unauth visitor redirected to /auth/login?next=…',
  )
  // Profile role lookup + non-admin redirect
  check(
    /\.from\(['"]profiles['"]\)[\s\S]*\.select\(['"]role['"]\)[\s\S]*\.eq\(['"]id['"],\s*user\.id\)/.test(page),
    '  2f. page reads profiles.role for the authenticated user',
  )
  check(
    /profileData\.role\s*!==\s*['"]admin['"]/.test(page) &&
    /redirect\(['"]\/dashboard['"]\)/.test(page),
    '  2g. non-admin viewer is redirected to /dashboard',
  )

  // ── 3. Admin client used for the lead-table read ──────────────────────
  console.log('\n3. Admin client read of design_partner_applications')
  check(
    page.includes('createSupabaseAdminClient') &&
    page.includes('@/lib/supabase/server'),
    '  3a. page uses createSupabaseAdminClient (RLS-bypass) for the table read',
  )
  check(
    /\.from\(['"]design_partner_applications['"]\)/.test(page),
    '  3b. page reads the design_partner_applications table',
  )
  // Admin-client read happens only AFTER the role gate. Match on the
  // .from('design_partner_applications') call site (not the first textual
  // occurrence, which is inside the file's documentation block).
  const roleGateIdx     = page.search(/profileData\.role\s*!==\s*['"]admin['"]/)
  const tableReadCallIdx = page.search(/\.from\(['"]design_partner_applications['"]\)/)
  check(
    roleGateIdx > -1 && tableReadCallIdx > roleGateIdx,
    '  3c. .from(design_partner_applications) call happens AFTER role gate',
  )

  // ── 4. Sort newest first + spec'd columns selected ────────────────────
  console.log('\n4. Sort + selected columns')
  check(
    /\.order\(['"]created_at['"][^)]*ascending:\s*false[^)]*\)/.test(page),
    '  4a. page sorts by created_at descending (newest first)',
  )
  // Required columns appear in the .select() that follows
  // .from('design_partner_applications'). The page also has a separate
  // .select('role') for the profile lookup — we anchor to the design-
  // partner-applications chain so we read the right select string.
  const tableSelectMatch = page.match(
    /\.from\(['"]design_partner_applications['"]\)[\s\S]*?\.select\(\s*([\s\S]*?)\s*\)\s*\.order/,
  )
  const selectArg = tableSelectMatch ? tableSelectMatch[1] : ''
  for (const col of [
    'id', 'name', 'company', 'role', 'email',
    'audience_type', 'draw_exposure', 'biggest_bottleneck',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'referrer', 'user_agent',
    'status', 'admin_email_sent_at', 'created_at',
  ]) {
    check(selectArg.includes(col),
      `  4b. select() includes column "${col}"`)
  }

  // ── 5. Each visible field shown + expandable detail ───────────────────
  console.log('\n5. Visible fields + detail expansion')
  // Rendered field references — accept either direct `{a.X}` or wrapped
  // (e.g. {formatTimestamp(a.created_at)}). The field must appear in
  // a JSX expression context.
  for (const field of [
    'name',
    'company',
    'role',
    'email',
    'audience_type',
    'draw_exposure',
    'biggest_bottleneck',
    'created_at',
    'id',
  ]) {
    const re = new RegExp(`\\ba\\.${field}\\b`)
    check(re.test(page), `  5a. row references a.${field}`)
  }
  // status badge
  check(
    /STATUS_TONE\[a\.status\]/.test(page),
    '  5b. row badges status using STATUS_TONE[a.status]',
  )
  // admin_email_sent_at indicator
  check(
    page.includes('admin_email_sent_at') &&
    page.includes('Email sent') &&
    page.includes('Email pending'),
    '  5c. row shows admin_email_sent_at indicator (Email sent / pending)',
  )
  // <details>/<summary> for expandable row
  check(
    page.includes('<details') && page.includes('<summary'),
    '  5d. expandable detail uses native <details>/<summary>',
  )
  // Expanded detail dl includes UTM keys + referrer + user_agent
  for (const detailKey of [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'referrer', 'user_agent',
  ]) {
    check(
      page.includes(`['${detailKey}'`) || page.includes(`'${detailKey}'`),
      `  5e. detail panel renders attribution key "${detailKey}"`,
    )
  }
  // Reply-by-email link
  check(
    page.includes('mailto:${a.email}') || page.includes("mailto:${a.email}"),
    '  5f. detail panel includes a mailto: reply link',
  )

  // ── 6. Status taxonomy matches migration CHECK constraint ─────────────
  console.log('\n6. Status taxonomy matches migration')
  check(exists(MIGRATION), '  6a. migration file exists')
  const sql = read(MIGRATION)
  // Spec'd values from the migration's CHECK constraint
  for (const value of ['new', 'reviewing', 'invited', 'accepted', 'declined']) {
    check(
      sql.includes(`'${value}'`),
      `  6b. migration CHECK includes "${value}"`,
    )
    check(
      page.includes(`'${value}'`),
      `  6c. UI STATUS_VALUES includes "${value}"`,
    )
  }
  // Single source of truth — STATUS_VALUES literal array
  check(
    /const\s+STATUS_VALUES\s*=\s*\[\s*['"]new['"]\s*,\s*['"]reviewing['"]\s*,\s*['"]invited['"]\s*,\s*['"]accepted['"]\s*,\s*['"]declined['"]\s*\]/.test(page),
    '  6d. STATUS_VALUES literal array matches migration order',
  )

  // ── 7. Page is dynamic + noindex + not imported by marketing ──────────
  console.log('\n7. Page is dynamic + noindex + not leaked to marketing')
  check(
    /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(page),
    '  7a. page exports dynamic = "force-dynamic"',
  )
  check(
    /robots:\s*\{[^}]*index:\s*false[^}]*follow:\s*false/.test(page),
    '  7b. page sets robots: { index: false, follow: false }',
  )
  // Verify no public marketing surface imports this page
  const marketingFiles = walkSync('src/app/(marketing)')
  const importToken = '@/app/(app)/dashboard/admin/design-partner-applications'
  // Any marketing file that mentions the admin route OR imports its components
  // would be a leak. The admin page is a route, not a reusable component, so
  // it should never be referenced from a public surface. We scan the route
  // path itself plus the design_partner_applications table name.
  const leaks: string[] = []
  for (const f of marketingFiles) {
    const c = read(f)
    if (
      c.includes('design-partner-applications/page') ||
      c.includes(importToken) ||
      c.includes('/dashboard/admin/design-partner-applications') ||
      /\.from\(['"]design_partner_applications['"]\)/.test(c)
    ) {
      leaks.push(f)
    }
  }
  check(leaks.length === 0,
    `  7c. no marketing surface imports the admin route (${leaks.length} leaks${leaks.length ? ': ' + leaks.join(', ') : ''})`)

  // No service-role-key access from any client component (".tsx" with "use client").
  // We trust the admin-client lives in @/lib/supabase/server which is server-only;
  // the test prevents a future regression that imports SUPABASE_SERVICE_ROLE_KEY
  // directly into a client component.
  const allFiles = [
    ...walkSync('src/app'),
    ...walkSync('src/components'),
  ]
  const clientFilesUsingServiceRole: string[] = []
  for (const f of allFiles) {
    const c = read(f)
    const isClient = c.includes("'use client'") || c.includes('"use client"')
    if (!isClient) continue
    if (c.includes('SUPABASE_SERVICE_ROLE_KEY') || c.includes('createSupabaseAdminClient')) {
      clientFilesUsingServiceRole.push(f)
    }
  }
  check(
    clientFilesUsingServiceRole.length === 0,
    `  7d. no client component references the service-role key or admin client (${clientFilesUsingServiceRole.length} leaks${clientFilesUsingServiceRole.length ? ': ' + clientFilesUsingServiceRole.join(', ') : ''})`,
  )

  // ── 8. Admin dashboard tile links to the new route ────────────────────
  console.log('\n8. Admin dashboard tile')
  const adminIndex = read(ADMIN_INDEX)
  check(
    adminIndex.includes('/dashboard/admin/design-partner-applications'),
    '  8a. admin dashboard links to /dashboard/admin/design-partner-applications',
  )
  check(
    adminIndex.includes('Design partner applications'),
    '  8b. admin dashboard tile labelled "Design partner applications"',
  )

  // ── 9. Banned product claims absent on the admin page ─────────────────
  console.log('\n9. Banned product claims absent')
  const lower = page.toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'ai approves release',
    'ai approved release',
    'guarantees compliance',
    'contractor authorizes release',
  ]) {
    check(!lower.includes(banned), `  9. banned: "${banned}" absent`)
  }

  // ── 10. Test wired into npm test ──────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('admin-design-partner-applications.test.ts'),
    '10. admin-design-partner-applications.test.ts wired into npm test',
  )

  console.log('\n✓ All admin-design-partner-applications tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
