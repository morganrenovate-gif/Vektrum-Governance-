/**
 * tests/meta-pixel-tracking.test.ts
 *
 * Static source-parse checks for the Meta Pixel conversion tracking setup.
 * No browser rendering, no DB, no env vars required.
 *
 * Checks:
 *  1.  src/lib/meta-pixel.ts exists.
 *  2.  trackMetaEvent is exported from meta-pixel.ts.
 *  3.  trackMetaEvent guards against SSR (typeof window === 'undefined').
 *  4.  trackMetaEvent guards for missing fbq (window.fbq check).
 *  5.  MetaPixelScript.tsx exists and is NOT a client component (no 'use client').
 *  6.  MetaPixelScript guards on NEXT_PUBLIC_META_PIXEL_ID — returns null if unset.
 *  7.  MetaPixelScript uses next/script strategy="afterInteractive".
 *  8.  MetaPixelScript calls fbq('init') with the pixel ID.
 *  9.  MetaPixelScript fires fbq('track','PageView') for the initial load.
 * 10.  MetaPixelPageView.tsx exists and is a client component.
 * 11.  MetaPixelPageView fires PageView on SPA route change via usePathname.
 * 12.  MetaPixelPageView skips the first render (isFirst ref).
 * 13.  MetaPixelPageView is mounted in the root layout.
 * 14.  MetaPixelScript is mounted in the root layout.
 * 15.  MetaViewContent.tsx exists and is a client component.
 * 16.  MetaViewContent fires ViewContent with content_name param.
 * 17.  MetaViewContent uses a fired ref to prevent duplicate fires.
 * 18.  funders/page.tsx imports MetaViewContent.
 * 19.  funders/page.tsx renders <MetaViewContent contentName="Funders" />.
 * 20.  contractors/page.tsx imports MetaViewContent.
 * 21.  contractors/page.tsx renders <MetaViewContent contentName="Contractors" />.
 * 22.  pricing/page.tsx imports MetaViewContent.
 * 23.  pricing/page.tsx renders <MetaViewContent contentName="Pricing" />.
 * 24.  demo/page.tsx imports MetaViewContent.
 * 25.  demo/page.tsx renders <MetaViewContent contentName="Demo" />.
 * 26.  engagement-cta.tsx imports trackMetaEvent.
 * 27.  engagement-cta.tsx fires Lead on book-walkthrough click.
 * 28.  signup/page.tsx imports trackMetaEvent.
 * 29.  signup/page.tsx fires CompleteRegistration before setSuccess(true).
 * 30.  demo-booked/demo-booked-client.tsx exists and is a client component.
 * 31.  DemoBookedClient fires Schedule on mount.
 * 32.  demo-booked/page.tsx renders DemoBookedClient.
 * 33.  demo-booked/page.tsx sets robots noindex/nofollow.
 * 34.  This test is wired into npm test in package.json.
 *
 * Run: npx tsx tests/meta-pixel-tracking.test.ts
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

// ─── File paths ───────────────────────────────────────────────────────────────
const META_PIXEL_LIB       = 'src/lib/meta-pixel.ts'
const META_PIXEL_SCRIPT    = 'src/components/analytics/MetaPixelScript.tsx'
const META_PIXEL_PAGE_VIEW = 'src/components/analytics/MetaPixelPageView.tsx'
const META_VIEW_CONTENT    = 'src/components/analytics/MetaViewContent.tsx'
const ROOT_LAYOUT          = 'src/app/layout.tsx'
const FUNDERS_PAGE         = 'src/app/(marketing)/funders/page.tsx'
const CONTRACTORS_PAGE     = 'src/app/(marketing)/contractors/page.tsx'
const PRICING_PAGE         = 'src/app/(marketing)/pricing/page.tsx'
const DEMO_PAGE            = 'src/app/(marketing)/demo/page.tsx'
const ENGAGEMENT_CTA       = 'src/components/marketing/engagement-cta.tsx'
const SIGNUP_PAGE          = 'src/app/auth/signup/page.tsx'
const DEMO_BOOKED_CLIENT   = 'src/app/(marketing)/demo-booked/demo-booked-client.tsx'
const DEMO_BOOKED_PAGE     = 'src/app/(marketing)/demo-booked/page.tsx'
const PACKAGE_JSON         = 'package.json'

async function main() {
  console.log('\nmeta-pixel-tracking.test.ts\n')

  // ── 1–4. trackMetaEvent helper ────────────────────────────────────────────
  check(exists(META_PIXEL_LIB), '1. src/lib/meta-pixel.ts exists')
  const pixelLib = read(META_PIXEL_LIB)
  check(pixelLib.includes('export function trackMetaEvent'), '2. trackMetaEvent is exported')
  check(pixelLib.includes("typeof window === 'undefined'"), '3. guards against SSR (typeof window check)')
  check(pixelLib.includes('window.fbq'), '4. guards for missing fbq (window.fbq check)')

  // ── 5–9. MetaPixelScript (base code, server component) ───────────────────
  check(exists(META_PIXEL_SCRIPT), '5. MetaPixelScript.tsx exists')
  const pixelScript = read(META_PIXEL_SCRIPT)
  check(
    !pixelScript.includes("'use client'") && !pixelScript.includes('"use client"'),
    '5. MetaPixelScript has no "use client" directive (server component)',
  )
  check(
    pixelScript.includes('NEXT_PUBLIC_META_PIXEL_ID') && pixelScript.includes('return null'),
    '6. MetaPixelScript guards on NEXT_PUBLIC_META_PIXEL_ID and returns null if unset',
  )
  check(pixelScript.includes('afterInteractive'), '7. MetaPixelScript uses strategy="afterInteractive"')
  check(pixelScript.includes("fbq('init'"), "8. MetaPixelScript calls fbq('init') with pixel ID")
  check(pixelScript.includes("fbq('track','PageView')"), "9. MetaPixelScript fires fbq('track','PageView') for initial load")

  // ── 10–14. MetaPixelPageView (SPA route changes) ─────────────────────────
  check(exists(META_PIXEL_PAGE_VIEW), '10. MetaPixelPageView.tsx exists')
  const pageView = read(META_PIXEL_PAGE_VIEW)
  check(
    pageView.includes("'use client'") || pageView.includes('"use client"'),
    '10. MetaPixelPageView is a client component',
  )
  check(
    pageView.includes('usePathname') && pageView.includes("trackMetaEvent('PageView')"),
    '11. MetaPixelPageView fires PageView on SPA route change via usePathname',
  )
  check(pageView.includes('isFirst'), '12. MetaPixelPageView skips first render (isFirst ref)')

  const rootLayout = read(ROOT_LAYOUT)
  check(
    rootLayout.includes('MetaPixelPageView') && rootLayout.includes('<MetaPixelPageView'),
    '13. MetaPixelPageView is mounted in the root layout',
  )
  check(
    rootLayout.includes('MetaPixelScript') && rootLayout.includes('<MetaPixelScript'),
    '14. MetaPixelScript is mounted in the root layout',
  )

  // ── 15–17. MetaViewContent ────────────────────────────────────────────────
  check(exists(META_VIEW_CONTENT), '15. MetaViewContent.tsx exists')
  const viewContent = read(META_VIEW_CONTENT)
  check(
    viewContent.includes("'use client'") || viewContent.includes('"use client"'),
    '15. MetaViewContent is a client component',
  )
  check(
    viewContent.includes("trackMetaEvent('ViewContent'") && viewContent.includes('content_name'),
    '16. MetaViewContent fires ViewContent with content_name param',
  )
  check(
    viewContent.includes('fired') && viewContent.includes('useRef'),
    '17. MetaViewContent uses a fired ref to prevent duplicate fires',
  )

  // ── 18–25. ViewContent on marketing pages ─────────────────────────────────
  const funders = read(FUNDERS_PAGE)
  check(
    funders.includes('MetaViewContent') && funders.includes('@/components/analytics/MetaViewContent'),
    '18. funders/page.tsx imports MetaViewContent',
  )
  check(funders.includes('contentName="Funders"'), '19. funders/page.tsx renders <MetaViewContent contentName="Funders" />')

  const contractors = read(CONTRACTORS_PAGE)
  check(
    contractors.includes('MetaViewContent') && contractors.includes('@/components/analytics/MetaViewContent'),
    '20. contractors/page.tsx imports MetaViewContent',
  )
  check(contractors.includes('contentName="Contractors"'), '21. contractors/page.tsx renders <MetaViewContent contentName="Contractors" />')

  const pricing = read(PRICING_PAGE)
  check(
    pricing.includes('MetaViewContent') && pricing.includes('@/components/analytics/MetaViewContent'),
    '22. pricing/page.tsx imports MetaViewContent',
  )
  check(pricing.includes('contentName="Pricing"'), '23. pricing/page.tsx renders <MetaViewContent contentName="Pricing" />')

  const demo = read(DEMO_PAGE)
  check(
    demo.includes('MetaViewContent') && demo.includes('@/components/analytics/MetaViewContent'),
    '24. demo/page.tsx imports MetaViewContent',
  )
  check(demo.includes('contentName="Demo"'), '25. demo/page.tsx renders <MetaViewContent contentName="Demo" />')

  // ── 26–27. Lead on book-walkthrough CTA ───────────────────────────────────
  const cta = read(ENGAGEMENT_CTA)
  check(
    cta.includes('trackMetaEvent') && cta.includes('@/lib/meta-pixel'),
    '26. engagement-cta.tsx imports trackMetaEvent from @/lib/meta-pixel',
  )
  check(cta.includes("trackMetaEvent('Lead')"), "27. engagement-cta.tsx fires Lead on book-walkthrough click")

  // ── 28–29. CompleteRegistration on signup ─────────────────────────────────
  const signup = read(SIGNUP_PAGE)
  check(
    signup.includes('trackMetaEvent') && signup.includes('@/lib/meta-pixel'),
    '28. signup/page.tsx imports trackMetaEvent from @/lib/meta-pixel',
  )
  const completeIdx = signup.indexOf("trackMetaEvent('CompleteRegistration')")
  const successIdx  = signup.indexOf('setSuccess(true)')
  check(completeIdx > -1, '29. signup/page.tsx fires CompleteRegistration')
  check(
    completeIdx > -1 && successIdx > -1 && completeIdx < successIdx,
    '29. CompleteRegistration fires before setSuccess(true)',
  )

  // ── 30–33. Schedule on /demo-booked ──────────────────────────────────────
  check(exists(DEMO_BOOKED_CLIENT), '30. demo-booked-client.tsx exists')
  const demoBookedClient = read(DEMO_BOOKED_CLIENT)
  check(
    demoBookedClient.includes("'use client'") || demoBookedClient.includes('"use client"'),
    '30. DemoBookedClient is a client component',
  )
  check(
    demoBookedClient.includes("trackMetaEvent('Schedule')") && demoBookedClient.includes('useEffect'),
    '31. DemoBookedClient fires Schedule on mount',
  )
  const demoBookedPage = read(DEMO_BOOKED_PAGE)
  check(
    demoBookedPage.includes('DemoBookedClient') && demoBookedPage.includes('<DemoBookedClient'),
    '32. demo-booked/page.tsx renders DemoBookedClient',
  )
  check(
    demoBookedPage.includes('robots') && (demoBookedPage.includes('index: false') || demoBookedPage.includes('noindex')),
    '33. demo-booked/page.tsx sets robots noindex/nofollow',
  )

  // ── 34. Test wired into package.json ─────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(pkg.includes('meta-pixel-tracking.test.ts'), '34. This test is wired into npm test in package.json')

  console.log('\n✓ All meta-pixel-tracking tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
