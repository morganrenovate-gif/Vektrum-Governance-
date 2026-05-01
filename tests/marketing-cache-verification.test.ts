/**
 * tests/marketing-cache-verification.test.ts
 *
 * Static guard against the specific cache-defeating triggers that produce
 *   Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
 *   x-vercel-cache: MISS
 * on public marketing HTML.
 *
 * The pre-existing tests/marketing-cache-architecture.test.ts already pins
 * the route-group split (no Supabase server / cookies / headers / getUser
 * inside the (marketing) tree). This test adds:
 *
 *   1. The public marketing layout is sync (no async work per request) and
 *      does not import next/headers, @supabase/ssr, or @/lib/supabase/server.
 *   2. Each "core" public marketing page declares ISR via `export const
 *      revalidate` and does NOT export `dynamic = 'force-dynamic'`.
 *   3. No core marketing page uses `cache: 'no-store'` or `revalidate: 0`
 *      on a `fetch(...)` call.
 *   4. /design-partners/page.tsx still has its ISR declaration intact.
 *   5. Private surfaces (dashboard, auth, API) are NOT touched by this pass.
 *   6. Banned product claims remain absent on the inspected public surfaces.
 *
 * The intentional exception is /demo-live, which forces dynamic in its own
 * route-group layout because DemoResetButton uses useSearchParams() and the
 * subroutes carry runtime React state. That carve-out is pinned by check 16
 * of marketing-cache-architecture.test.ts; it is intentionally NOT relaxed
 * here. The marketing tree above /demo-live remains static/ISR.
 *
 * Run: npx tsx tests/marketing-cache-verification.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT         = path.resolve(process.cwd())
const PACKAGE_JSON = 'package.json'

// "Core" public marketing surfaces — the ones the spec asked us to verify.
// /demo-live is intentionally excluded (dynamic by design, see its layout).
const CORE_PUBLIC_PAGES: Array<[string, string]> = [
  ['homepage',                            'src/app/(marketing)/page.tsx'],
  ['funders',                             'src/app/(marketing)/funders/page.tsx'],
  ['contractors',                         'src/app/(marketing)/contractors/page.tsx'],
  ['pricing',                             'src/app/(marketing)/pricing/page.tsx'],
  ['demo',                                'src/app/(marketing)/demo/page.tsx'],
  ['demo-booked',                         'src/app/(marketing)/demo-booked/page.tsx'],
  ['design-partners',                     'src/app/(marketing)/design-partners/page.tsx'],
  ['resources',                           'src/app/(marketing)/resources/page.tsx'],
  ['resources/construction-dispute-isolation',
                                          'src/app/(marketing)/resources/construction-dispute-isolation/page.tsx'],
  ['security',                            'src/app/(marketing)/security/page.tsx'],
  ['partners',                            'src/app/(marketing)/partners/page.tsx'],
  ['help',                                'src/app/(marketing)/help/page.tsx'],
  ['about',                               'src/app/(marketing)/about/page.tsx'],
  ['contact',                             'src/app/(marketing)/contact/page.tsx'],
]

// Private surfaces — this pass MUST NOT touch them. We assert their
// known-dynamic markers are still in place.
const PRIVATE_DYNAMIC_SURFACES: Array<[string, string]> = [
  ['(app)/layout.tsx', 'src/app/(app)/layout.tsx'],
  ['auth/layout.tsx',  'src/app/auth/layout.tsx'],
]

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// Strip JS/TS line + block comments and JSX comments so we don't false-positive
// on comments that document forbidden patterns.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

async function main() {
  console.log('\nmarketing-cache-verification.test.ts\n')

  // ── 1. Marketing layout is sync + free of cookies()/headers()/auth ──────
  console.log('1. Public marketing layout purity')
  const layout     = read('src/app/(marketing)/layout.tsx')
  const layoutCode = stripComments(layout)

  check(
    !/export\s+default\s+async\s+function/.test(layoutCode),
    '  1a. (marketing)/layout.tsx is sync (no async per-request work)',
  )
  for (const mod of [
    '@/lib/supabase/server',
    '@supabase/ssr',
    'next/headers',
  ]) {
    const re = new RegExp(
      `import\\s*(?:[^'"]*from\\s*)?['"]${mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]|` +
      `import\\(\\s*['"]${mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\)`,
    )
    check(!re.test(layoutCode), `  1b. (marketing)/layout.tsx does not import "${mod}"`)
  }
  check(!/\bcookies\s*\(/.test(layoutCode),  '  1c. (marketing)/layout.tsx does not call cookies()')
  check(!/\bheaders\s*\(/.test(layoutCode),  '  1d. (marketing)/layout.tsx does not call headers()')
  check(!/auth\.getUser\s*\(/.test(layoutCode),
    '  1e. (marketing)/layout.tsx does not call auth.getUser()')
  check(
    !/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(layoutCode),
    '  1f. (marketing)/layout.tsx does not export dynamic = "force-dynamic"',
  )

  // ── 2. Each core public marketing page is ISR/static, never force-dynamic ─
  console.log('\n2. Core public marketing pages — ISR and not force-dynamic')
  for (const [name, p] of CORE_PUBLIC_PAGES) {
    if (!exists(p)) {
      fail(`  2.${name}: source file missing at ${p}`)
      continue
    }
    const src = stripComments(read(p))

    check(
      /export\s+const\s+revalidate\s*=\s*\d+/.test(src),
      `  2.${name}: declares ISR via export const revalidate = <number>`,
    )
    check(
      !/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(src),
      `  2.${name}: does NOT export dynamic = "force-dynamic"`,
    )
  }

  // ── 3. No no-store / revalidate:0 fetch on core marketing pages ─────────
  console.log('\n3. No uncached fetch on core marketing pages')
  for (const [name, p] of CORE_PUBLIC_PAGES) {
    const src = stripComments(read(p))
    check(
      !/cache\s*:\s*['"]no-store['"]/.test(src),
      `  3.${name}: no { cache: 'no-store' } on fetch`,
    )
    // next: { revalidate: 0 } also forces dynamic
    check(
      !/next\s*:\s*\{[^}]*revalidate\s*:\s*0\b/.test(src),
      `  3.${name}: no { next: { revalidate: 0 } } on fetch`,
    )
  }

  // ── 4. /design-partners ISR is intact ───────────────────────────────────
  console.log('\n4. /design-partners ISR intact')
  const dp = read('src/app/(marketing)/design-partners/page.tsx')
  check(/export\s+const\s+revalidate\s*=\s*\d+/.test(dp),
    '  4a. /design-partners declares export const revalidate')
  // Backend route remains intentionally dynamic
  check(exists('src/app/api/design-partner-applications/route.ts'),
    '  4b. /api/design-partner-applications API route exists (intentionally dynamic)')
  const apiRoute = read('src/app/api/design-partner-applications/route.ts')
  check(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(apiRoute),
    '  4c. /api/design-partner-applications keeps dynamic = "force-dynamic" (POST endpoint)')

  // ── 5. Private surfaces preserved ──────────────────────────────────────
  console.log('\n5. Private/auth surfaces preserved (cache pass must not touch them)')
  for (const [name, p] of PRIVATE_DYNAMIC_SURFACES) {
    const src = read(p)
    if (name === '(app)/layout.tsx') {
      check(src.includes('@/lib/supabase/server'),
        `  5.${name}: still imports @/lib/supabase/server (auth-aware)`)
      check(/auth\.getUser\s*\(/.test(src),
        `  5.${name}: still calls auth.getUser()`)
    } else if (name === 'auth/layout.tsx') {
      check(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(src),
        `  5.${name}: still forces dynamic (cookies/session per request)`)
    }
  }

  // Middleware still redirects authed users from / to /dashboard so the
  // homepage HTML is safe to cache for anonymous visitors.
  const mw = read('src/middleware.ts')
  check(
    /pathname\s*===\s*['"]\/['"][\s\S]{0,400}NextResponse\.redirect\([^)]*['"]\/dashboard['"]/.test(mw),
    '  5c. middleware redirects authed / → /dashboard so cached / is safe for anon',
  )

  // ── 6. Banned product claims remain absent on inspected pages ──────────
  //
  // Notes on phrasing choice:
  //   - The dispute-isolation article's editorial-note carries an explicit
  //     disclaimer ("does not imply that Vektrum prevents fraud, eliminates
  //     disputes, or guarantees compliance"). That denial is safe copy.
  //     We therefore guard against the positive "Vektrum is/acts as/holds…"
  //     forms only — coverage of compliance/fraud/disputes claims lives in
  //     site-cleanup-pass.test.ts (per-page) where context is narrower.
  console.log('\n6. Banned product claims absent on inspected public pages')
  const surfaces: string[] = [layout]
  for (const [, p] of CORE_PUBLIC_PAGES) surfaces.push(read(p))
  const all = surfaces.join('\n').toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum acts as escrow',
    'vektrum is escrow',
    'vektrum is a lender',
    'vektrum holds funds',
    'ai approves release',
    'ai approved release',
    'ai authorizes payment',
    'automatic payment',
    'join beta',
  ]) {
    check(!all.includes(banned), `  6. banned: "${banned}" absent across core public pages`)
  }

  // ── 7. /demo-live remains intentionally dynamic — pinned, not changed ──
  console.log('\n7. /demo-live remains intentionally dynamic')
  const demoLiveLayout = read('src/app/(marketing)/demo-live/layout.tsx')
  check(
    /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(demoLiveLayout),
    '  7a. /demo-live/layout.tsx still forces dynamic (DemoResetButton uses useSearchParams)',
  )
  check(
    /Demo Mode/.test(demoLiveLayout),
    '  7b. /demo-live banner copy preserved (not touched by this pass)',
  )

  // ── 8. Test wired into npm test ────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('marketing-cache-verification.test.ts'),
    '8. marketing-cache-verification.test.ts wired into npm test',
  )

  console.log('\n✓ All marketing-cache-verification tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
