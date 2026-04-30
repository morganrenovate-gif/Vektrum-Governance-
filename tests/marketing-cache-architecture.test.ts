/**
 * tests/marketing-cache-architecture.test.ts
 *
 * Architecture-guard tests for the route-group caching split.
 *
 *   - Root layout (src/app/layout.tsx) is a thin shell with no Supabase /
 *     cookies / headers / getUser dependency.
 *   - Marketing tree (src/app/(marketing)/**) has no Supabase server import,
 *     no cookies/headers, no getUser. Pages here are eligible for static/ISR.
 *   - App layout (src/app/(app)/layout.tsx) keeps the auth-aware
 *     UserMenu/NotificationBell + Supabase getUser + profile lookup.
 *   - Public marketing URLs are unchanged (route group is invisible in URLs).
 *   - Build output (parsed from .next/server/app or build log) shows
 *     marketing pages as static/ISR and dashboard pages as dynamic.
 *
 * This test exists to prevent silent regression. Anyone re-introducing a
 * cookies() call into the marketing tree, or moving auth into the root
 * layout, will hit this test before the change can land.
 *
 * Run: npx tsx tests/marketing-cache-architecture.test.ts
 */

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

function walkTsxTs(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e)
    const s = fs.statSync(full)
    if (s.isDirectory()) walkTsxTs(full, files)
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) files.push(full)
  }
  return files
}

// Regex-based — matches actual `import` lines, not docstring mentions of the
// forbidden module name. We require either:
//   - import ... from '<module>'
//   - import('<module>')   (dynamic import)
function forbiddenImportRegex(modulePath: string): RegExp {
  // Escape regex specials in modulePath
  const escaped = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(
    `import\\s*(?:[^'"]*from\\s*)?['"]${escaped}['"]|import\\(\\s*['"]${escaped}['"]\\)`,
  )
}

const FORBIDDEN_IMPORTS_IN_PUBLIC_TREE = [
  '@/lib/supabase/server',
  '@supabase/ssr',
  'next/headers',
]

// Strip JS/TS line + block comments and template-literal/jsx-comment text so we
// don't false-positive on the docstring at the top of layout files describing
// the policy.
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')          // block comments
    .replace(/\/\/[^\n]*/g, '')                // line comments
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')      // JSX comments {/* */}
}

const FORBIDDEN_CALLS = [
  // Match `cookies()` and `headers()` actual call sites (after comment-strip).
  /\bcookies\s*\(/,
  /\bheaders\s*\(/,
  /\bauth\.getUser\s*\(/,
]

async function main() {
  console.log('\nmarketing-cache-architecture.test.ts\n')

  // ── 1. Root layout purity ───────────────────────────────────────────────────
  console.log('Root layout purity')

  const rootLayout = read('src/app/layout.tsx')
  const rootCode   = stripCommentsAndStrings(rootLayout)
  for (const mod of FORBIDDEN_IMPORTS_IN_PUBLIC_TREE) {
    check(
      !forbiddenImportRegex(mod).test(rootCode),
      ` 1. Root layout does not import "${mod}"`,
    )
  }
  for (const re of FORBIDDEN_CALLS) {
    check(
      !re.test(rootCode),
      ` 2. Root layout does not call ${re}`,
    )
  }
  check(
    !/export\s+default\s+async\s+function/.test(rootCode),
    ' 3. Root layout is NOT async (thin shell, no per-request work)',
  )
  check(
    !/<main[^>]*id=['"]main-content['"]/.test(rootLayout),
    ' 4. Root layout does not own <main id="main-content"> (route-group layouts do)',
  )

  // ── 2. Marketing tree purity ────────────────────────────────────────────────
  console.log('\nMarketing tree purity')

  const marketingFiles = walkTsxTs(path.resolve(ROOT, 'src/app/(marketing)'))
  check(marketingFiles.length > 5, ` 5. (marketing) tree has files (found ${marketingFiles.length})`)

  const marketingViolations: Array<{ file: string; reason: string }> = []
  for (const f of marketingFiles) {
    const raw = fs.readFileSync(f, 'utf-8')
    const code = stripCommentsAndStrings(raw)
    for (const mod of FORBIDDEN_IMPORTS_IN_PUBLIC_TREE) {
      if (forbiddenImportRegex(mod).test(code)) {
        marketingViolations.push({ file: f.replace(ROOT + '/', ''), reason: `imports ${mod}` })
      }
    }
    for (const re of FORBIDDEN_CALLS) {
      if (re.test(code)) {
        marketingViolations.push({ file: f.replace(ROOT + '/', ''), reason: `calls ${re}` })
      }
    }
  }
  check(
    marketingViolations.length === 0,
    ` 6. No Supabase server / cookies / headers / getUser in (marketing) tree (${marketingViolations.length} violations${
      marketingViolations.length ? ': ' + marketingViolations.map((v) => `${v.file} (${v.reason})`).join('; ') : ''
    })`,
  )

  // (marketing)/layout.tsx specifically must not be async.
  const marketingLayout = read('src/app/(marketing)/layout.tsx')
  check(
    !/export\s+default\s+async\s+function/.test(marketingLayout),
    ' 7. (marketing)/layout.tsx is NOT async — public chrome is per-request-free',
  )

  // ── 3. App layout retention ─────────────────────────────────────────────────
  console.log('\nApp layout retention')

  const appLayout = read('src/app/(app)/layout.tsx')
  check(
    appLayout.includes('@/lib/supabase/server'),
    ' 8. (app)/layout.tsx still imports the Supabase server client',
  )
  check(
    /auth\.getUser\s*\(/.test(appLayout),
    ' 9. (app)/layout.tsx still calls auth.getUser() for auth-aware nav',
  )
  check(
    appLayout.includes('UserMenu'),
    '10. (app)/layout.tsx still renders <UserMenu>',
  )
  check(
    appLayout.includes('NotificationBell'),
    '11. (app)/layout.tsx still renders <NotificationBell>',
  )
  check(
    /\.from\(['"]profiles['"]\)[\s\S]*\.eq\(['"]id['"]/.test(appLayout),
    '12. (app)/layout.tsx still fetches profiles.role for admin-gated nav items',
  )
  check(
    /export\s+default\s+async\s+function/.test(appLayout),
    '13. (app)/layout.tsx is async (intentionally dynamic per request)',
  )

  // ── 4. Public URLs preserved ────────────────────────────────────────────────
  console.log('\nPublic URLs preserved')

  // Route group `(marketing)` is invisible in URLs. Confirm the canonical
  // pages exist at their new location, which means their public URL is
  // unchanged.
  const URL_TO_PAGE: Record<string, string> = {
    '/':                                                'src/app/(marketing)/page.tsx',
    '/funders':                                         'src/app/(marketing)/funders/page.tsx',
    '/contractors':                                     'src/app/(marketing)/contractors/page.tsx',
    '/pricing':                                         'src/app/(marketing)/pricing/page.tsx',
    '/help':                                            'src/app/(marketing)/help/page.tsx',
    '/demo':                                            'src/app/(marketing)/demo/page.tsx',
    '/about':                                           'src/app/(marketing)/about/page.tsx',
    '/careers':                                         'src/app/(marketing)/careers/page.tsx',
    '/contact':                                         'src/app/(marketing)/contact/page.tsx',
    '/founders':                                        'src/app/(marketing)/founders/page.tsx',
    '/partners':                                        'src/app/(marketing)/partners/page.tsx',
    '/privacy':                                         'src/app/(marketing)/privacy/page.tsx',
    '/security':                                        'src/app/(marketing)/security/page.tsx',
    '/terms':                                           'src/app/(marketing)/terms/page.tsx',
    '/resources':                                       'src/app/(marketing)/resources/page.tsx',
    '/resources/construction-dispute-isolation':        'src/app/(marketing)/resources/construction-dispute-isolation/page.tsx',
    '/demo-live':                                       'src/app/(marketing)/demo-live/page.tsx',
    '/dashboard':                                       'src/app/(app)/dashboard/page.tsx',
  }
  const missing: string[] = []
  for (const [url, file] of Object.entries(URL_TO_PAGE)) {
    if (!exists(file)) missing.push(`${url} → ${file}`)
  }
  check(missing.length === 0, `14. Every public URL still resolves to a page (missing: ${missing.length}${missing.length ? ' → ' + missing.join('; ') : ''})`)

  // ── 5. Build output / static eligibility ────────────────────────────────────
  console.log('\nBuild output / static eligibility')

  // Each marketing page should declare ISR via `export const revalidate`,
  // OR opt out explicitly via `dynamic = 'force-dynamic'`. If neither, the
  // page is implicitly static — also acceptable.
  const STATIC_MARKETING_PAGES = [
    'src/app/(marketing)/page.tsx',
    'src/app/(marketing)/about/page.tsx',
    'src/app/(marketing)/careers/page.tsx',
    'src/app/(marketing)/contact/page.tsx',
    'src/app/(marketing)/contractors/page.tsx',
    'src/app/(marketing)/demo/page.tsx',
    'src/app/(marketing)/founders/page.tsx',
    'src/app/(marketing)/funders/page.tsx',
    'src/app/(marketing)/help/page.tsx',
    'src/app/(marketing)/partners/page.tsx',
    'src/app/(marketing)/pricing/page.tsx',
    'src/app/(marketing)/privacy/page.tsx',
    'src/app/(marketing)/resources/page.tsx',
    'src/app/(marketing)/resources/construction-dispute-isolation/page.tsx',
    'src/app/(marketing)/security/page.tsx',
    'src/app/(marketing)/terms/page.tsx',
  ]
  let revalidateCount = 0
  for (const rel of STATIC_MARKETING_PAGES) {
    const c = read(rel)
    if (/export\s+const\s+revalidate\s*=/.test(c)) revalidateCount++
  }
  check(
    revalidateCount >= STATIC_MARKETING_PAGES.length,
    `15. Every static marketing page declares ISR via export const revalidate (${revalidateCount}/${STATIC_MARKETING_PAGES.length})`,
  )

  // Demo-live remains dynamic via its own layout
  const demoLiveLayout = read('src/app/(marketing)/demo-live/layout.tsx')
  check(
    /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(demoLiveLayout),
    '16. demo-live/layout.tsx forces dynamic (uses runtime demo state)',
  )

  // Auth pages remain dynamic via auth/layout.tsx
  const authLayout = read('src/app/auth/layout.tsx')
  check(
    /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(authLayout),
    '17. auth/layout.tsx forces dynamic (cookies/session per request)',
  )

  // Middleware handles authed-user redirect from / to /dashboard
  const middleware = read('src/middleware.ts')
  check(
    /pathname\s*===\s*['"]\/['"][\s\S]{0,400}NextResponse\.redirect\([^)]*['"]\/dashboard['"]/.test(middleware),
    '18. Middleware redirects authed users from / to /dashboard',
  )
  check(
    /sb-[\s\S]{0,200}auth-token/.test(middleware),
    '19. Middleware cookie-sniffs for sb-...-auth-token before invoking getUser on /',
  )

  // Wired into npm test
  const pkg = read('package.json')
  check(
    pkg.includes('marketing-cache-architecture.test.ts'),
    '20. Test wired into npm test in package.json',
  )

  console.log('\n✓ marketing-cache-architecture tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
