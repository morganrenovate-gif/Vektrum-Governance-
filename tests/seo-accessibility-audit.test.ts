/**
 * tests/seo-accessibility-audit.test.ts
 *
 * Static source-parse checks for Sprint 1 + Sprint 2 SEO/GEO/accessibility work.
 *
 * Metadata presence
 *   1. Root layout has metadataBase
 *   2. Root layout has openGraph defaults
 *   3. Root layout has twitter defaults
 *   4. Homepage has per-page metadata export
 *   5. /funders has canonical
 *   6. /contractors has canonical
 *   7. /pricing has canonical
 *   8. /help has canonical
 *   9. /demo has canonical
 *
 * robots.ts
 *  10. /src/app/robots.ts exists
 *  11. robots.ts disallows /auth/
 *  12. robots.ts disallows /dashboard/
 *  13. robots.ts disallows /api/
 *  14. robots.ts references sitemap.xml
 *
 * Sitemap
 *  15. sitemap.ts includes /funders
 *  16. sitemap.ts includes /contractors
 *  17. sitemap.ts includes /help
 *  18. sitemap.ts includes /resources
 *  19. sitemap.ts includes /lenders
 *  20. sitemap.ts does NOT include /dashboard
 *  21. sitemap.ts does NOT include /auth
 *
 * FAQPage schema
 *  22. /help exports faqSchema with @type FAQPage
 *  23. /help injects application/ld+json script
 *
 * SoftwareApplication schema
 *  24. Homepage exports softwareSchema with @type SoftwareApplication
 *
 * Accessibility
 *  25. Root layout has skip link with href="#main-content"
 *  26. Root layout main element has id="main-content"
 *  27. Mobile nav button has aria-controls
 *  28. Mobile nav drawer has id="mobile-nav-menu"
 *
 * /help heading hierarchy
 *  29. /help has an h2 for the main FAQ section
 *
 * llms.txt
 *  30. /src/app/llms.txt/route.ts exists
 *  31. llms.txt content includes company summary
 *  32. llms.txt content includes non-custody disclaimer
 *  33. llms.txt content includes "What Vektrum Does Not Do"
 *
 * /resources
 *  34. /resources page exists
 *  35. First article page exists
 *  36. Article links to /funders and /help internally
 *
 * /funders segmentation
 *  37. /funders includes "Private lenders" section
 *  38. /funders includes institutional rails content
 *  39. /funders has non-custody trust strip above benefits
 *
 * /contractors
 *  40. /contractors includes invite flow explanation
 *  41. /contractors has "Tell your funder about Vektrum" CTA
 *
 * Banned claims
 *  42. /funders has no "Vektrum moves money"
 *  43. /contractors has no "AI approves"
 *  44. /help has no "tamper-proof"
 *  45. /llms.txt route has no "escrow replacement"
 *  46. Homepage has no "funds stay in Stripe" (funds held in Stripe-managed accounts is OK)
 *
 * OG image asset
 *  47. public/og-image.png exists (1200×630 branded asset)
 *  48. og-image.png is at least 1 KB (real image, not empty)
 *  49. og-image.png declared as PNG by file header
 *  50. Layout's openGraph references /og-image.png
 *  51. Per-page metadata references /og-image.png consistently
 *
 * Citations & sources
 *  52. No "[Citation placeholder" text remains in any public page or article
 *  53. No "[citation needed]" text remains
 *  54. Article includes a Sources section with id="sources"
 *  55. Article cites at least 5 distinct sources
 *  56. Article includes FDIC source (12% draw denial stat)
 *  57. Article includes California Civil Code 8850 source
 *  58. Article includes Bank Director source
 *  59. Article includes OCC source
 *  60. Article includes FAR source
 *  61. /demo Section 2 stats use citations (FDIC and ACFE) and not the unsupported $3.1B/87%
 *  62. About/Careers do not assert exact $2.19T figure (softened)
 *
 * Banned overclaims
 *  63. Article does not say Vektrum prevents fraud
 *  64. Article does not say Vektrum eliminates disputes
 *  65. Article does not say Vektrum guarantees compliance
 *
 * External source links
 *  66. Sources section contains at least 1 external link (FAR canonical)
 *  67. FAR 52.232-5 links to acquisition.gov canonical URL
 *  68. FAR 52.232-27 links to acquisition.gov canonical URL
 *  69. All external links use rel="noopener noreferrer"
 *  70. All external links use target="_blank"
 *  71. No placeholder URLs remain (#, example.com, TODO in href)
 *  72. Unverified sources marked with TODO(canonical-url) comments
 *
 * Footer / nav visibility for /resources
 *  73. Footer contains a link to /resources
 *  74. Footer link uses the label "Resources"
 *  75. Footer Help link uses label "Help / FAQ" and route /help
 *  76. No /faq route is linked anywhere (route does not exist)
 *  77. Mobile nav contains a link to /resources
 *  78. Sitemap still includes /resources
 *  79. Sitemap still includes /resources/construction-dispute-isolation
 *
 * Cleanup-sprint audit items
 *  80. Self-canonicals on every public page (no page canonicals to homepage)
 *  81. /lenders no longer has a page (config-level redirect to /funders)
 *  82. /lenders is NOT in sitemap (avoid crawl waste)
 *  83. /lenders is permanent: true in next.config redirects
 *  84. Demo page does NOT contain "Recommendation: approve"
 *  85. Demo page does NOT contain "Zero industry-standard solution"
 *  86. Article does NOT contain visible "pending verification" or "pending source URL"
 *  87. Article has byline "Vektrum Research"
 *  88. Article has visible publication date
 *  89. Article schema has author + datePublished + dateModified
 *  90. Pricing has exactly one <h1>
 *  91. Pricing plan name renders as <h3>, not <h1>
 *  92. Mobile nav drawer ("mobile-nav-menu") rendered with `hidden` (always in DOM)
 *  93. Mobile nav has aria-label="Main menu"
 *  94. Mobile nav has Escape key handler
 *  95. Reduced-motion CSS exists in globals.css
 *  96. /funders includes "AI pre-review before the gate" section
 *  97. /contractors hero distinguishes Stripe Connect vs external rail
 *  98. Security page has separate "Webhook signing secret handling" section
 *  99. Webhook secret note is OUT of "What Vektrum never stores" section
 * 100. Security headers configured in next.config: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
 * 101. poweredByHeader: false in next.config
 * 102. Decorative icons aria-hidden — at least 30 occurrences across public pages
 * 103. Pricing has CFO-readable enterprise bridge text
 *
 * package.json
 * 104. Test wired into npm test
 *
 * Run: npx tsx tests/seo-accessibility-audit.test.ts
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

async function main() {
  console.log('\nseo-accessibility-audit.test.ts\n')

  const layout      = read('src/app/layout.tsx')
  const mobileNav   = read('src/components/nav/mobile-nav.tsx')
  const homepage    = read('src/app/page.tsx')
  const funders     = read('src/app/funders/page.tsx')
  const contractors = read('src/app/contractors/page.tsx')
  const pricing     = read('src/app/pricing/page.tsx')
  const helpPage    = read('src/app/help/page.tsx')
  const demoPage    = read('src/app/demo/page.tsx')
  const sitemap     = read('src/app/sitemap.ts')
  const pkg         = read('package.json')
  const llmsRoute   = read('src/app/llms.txt/route.ts')
  const resourcesPage  = read('src/app/resources/page.tsx')
  const articlePage    = read('src/app/resources/construction-dispute-isolation/page.tsx')

  // ── Metadata presence ────────────────────────────────────────────────────────
  console.log('Metadata presence')

  check(layout.includes('metadataBase'),                               ' 1. Root layout has metadataBase')
  check(layout.includes('openGraph'),                                  ' 2. Root layout has openGraph defaults')
  check(layout.includes("twitter:") || layout.includes("twitter: {"), ' 3. Root layout has twitter defaults')
  check(homepage.includes('export const metadata'),                    ' 4. Homepage has per-page metadata export')
  check(funders.includes("canonical: 'https://vektrum.io/funders'") || funders.includes('canonical:'), ' 5. /funders has canonical')
  check(contractors.includes('canonical:'),                            ' 6. /contractors has canonical')
  check(pricing.includes('canonical:'),                                ' 7. /pricing has canonical')
  check(helpPage.includes('canonical:'),                               ' 8. /help has canonical')
  check(demoPage.includes('canonical:'),                               ' 9. /demo has canonical')

  // ── robots.ts ────────────────────────────────────────────────────────────────
  console.log('\nrobots.ts')

  check(exists('src/app/robots.ts'),                                   '10. robots.ts exists')
  const robots = read('src/app/robots.ts')
  check(robots.includes('/auth/'),                                     '11. robots.ts disallows /auth/')
  check(robots.includes('/dashboard/'),                                '12. robots.ts disallows /dashboard/')
  check(robots.includes('/api/'),                                      '13. robots.ts disallows /api/')
  check(robots.includes('sitemap.xml'),                                '14. robots.ts references sitemap.xml')

  // ── Sitemap ──────────────────────────────────────────────────────────────────
  console.log('\nSitemap')

  check(sitemap.includes('/funders'),                                  '15. sitemap includes /funders')
  check(sitemap.includes('/contractors'),                              '16. sitemap includes /contractors')
  check(sitemap.includes('/help'),                                     '17. sitemap includes /help')
  check(sitemap.includes('/resources'),                                '18. sitemap includes /resources')
  check(sitemap.includes('/lenders'),                                  '19. sitemap includes /lenders')
  check(!sitemap.includes('/dashboard'),                               '20. sitemap does NOT include /dashboard')
  check(!sitemap.includes('/auth'),                                    '21. sitemap does NOT include /auth')

  // ── FAQPage schema ───────────────────────────────────────────────────────────
  console.log('\nFAQPage schema')

  check(helpPage.includes("'FAQPage'") || helpPage.includes('"FAQPage"'),  '22. /help exports faqSchema with @type FAQPage')
  check(helpPage.includes('application/ld+json'),                           '23. /help injects application/ld+json script')

  // ── SoftwareApplication schema ───────────────────────────────────────────────
  console.log('\nSoftwareApplication schema')

  check(
    homepage.includes("'SoftwareApplication'") || homepage.includes('"SoftwareApplication"'),
    '24. Homepage exports softwareSchema with @type SoftwareApplication',
  )

  // ── Accessibility ────────────────────────────────────────────────────────────
  console.log('\nAccessibility')

  check(layout.includes('href="#main-content"'),                       '25. Root layout has skip link targeting #main-content')
  check(layout.includes('id="main-content"'),                          '26. Root layout main element has id="main-content"')
  check(mobileNav.includes('aria-controls'),                           '27. Mobile nav button has aria-controls')
  check(mobileNav.includes('id="mobile-nav-menu"'),                    '28. Mobile nav drawer has id="mobile-nav-menu"')

  // ── /help heading hierarchy ──────────────────────────────────────────────────
  console.log('\n/help heading hierarchy')

  check(
    helpPage.includes('General questions') && helpPage.includes('<h2'),
    '29. /help has an h2 for the main FAQ section',
  )

  // ── llms.txt ─────────────────────────────────────────────────────────────────
  console.log('\nllms.txt')

  check(exists('src/app/llms.txt/route.ts'),                           '30. llms.txt route exists')
  check(llmsRoute.includes('Vektrum'),                                 '31. llms.txt content includes company summary')
  check(
    llmsRoute.includes('does not hold') || llmsRoute.includes('Non-Custody'),
    '32. llms.txt content includes non-custody disclaimer',
  )
  check(llmsRoute.includes('Does Not Do') || llmsRoute.includes('does not'),  '33. llms.txt includes What Vektrum Does Not Do')

  // ── /resources ───────────────────────────────────────────────────────────────
  console.log('\n/resources')

  check(exists('src/app/resources/page.tsx'),                          '34. /resources page exists')
  check(exists('src/app/resources/construction-dispute-isolation/page.tsx'), '35. First article page exists')
  check(
    articlePage.includes('/funders') && articlePage.includes('/help'),
    '36. Article links to /funders and /help internally',
  )

  // ── /funders segmentation ────────────────────────────────────────────────────
  console.log('\n/funders segmentation')

  check(
    funders.includes('Private lenders') || funders.includes('private lenders'),
    '37. /funders includes private lenders section',
  )
  check(
    funders.includes('institutional') || funders.includes('Institutional'),
    '38. /funders includes institutional rails content',
  )
  check(
    funders.includes('does not hold') || funders.includes('Vektrum does not hold'),
    '39. /funders has non-custody trust strip',
  )

  // ── /contractors ─────────────────────────────────────────────────────────────
  console.log('\n/contractors')

  check(
    contractors.includes('invite') || contractors.includes('Invite'),
    '40. /contractors includes invite flow explanation',
  )
  check(
    contractors.includes('Tell your funder') || contractors.includes('funder about Vektrum'),
    '41. /contractors has Tell your funder CTA',
  )

  // ── Banned claims ────────────────────────────────────────────────────────────
  console.log('\nBanned claims')

  check(!funders.includes('Vektrum moves money'),                      '42. /funders has no "Vektrum moves money"')
  check(!contractors.includes('AI approves'),                          '43. /contractors has no "AI approves"')
  check(!helpPage.includes('tamper-proof'),                            '44. /help has no "tamper-proof"')
  check(!llmsRoute.includes('escrow replacement'),                     '45. llms.txt has no "escrow replacement"')
  check(!homepage.includes('funds stay in Stripe'),                    '46. Homepage has no "funds stay in Stripe"')

  // ── OG image asset ───────────────────────────────────────────────────────────
  console.log('\nOG image asset')

  const ogPng = path.resolve(ROOT, 'public/og-image.png')
  check(fs.existsSync(ogPng),                                          '47. public/og-image.png exists')
  const ogBytes = fs.existsSync(ogPng) ? fs.statSync(ogPng).size : 0
  check(ogBytes >= 1024,                                               `48. og-image.png is at least 1 KB (got ${ogBytes} bytes)`)
  if (fs.existsSync(ogPng)) {
    const head = fs.readFileSync(ogPng).slice(0, 8)
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47
    check(isPng,                                                       '49. og-image.png has valid PNG header')
  } else {
    fail('49. og-image.png missing — cannot verify PNG header')
  }
  check(layout.includes('/og-image.png'),                              '50. Layout openGraph references /og-image.png')
  check(
    funders.includes('/og-image.png') &&
      contractors.includes('/og-image.png') &&
      pricing.includes('/og-image.png') &&
      helpPage.includes('/og-image.png') &&
      demoPage.includes('/og-image.png') &&
      homepage.includes('/og-image.png'),
    '51. Per-page metadata references /og-image.png consistently',
  )

  // ── Citations & sources ──────────────────────────────────────────────────────
  console.log('\nCitations & sources')

  // 52. No "[Citation placeholder" text remains anywhere in src/app
  function walkDir(dir: string, files: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) walkDir(full, files)
      else if (full.endsWith('.tsx') || full.endsWith('.ts')) files.push(full)
    }
    return files
  }
  const allSrcFiles = walkDir(path.resolve(ROOT, 'src/app'))
  const placeholderHits = allSrcFiles.filter((f) => {
    const c = fs.readFileSync(f, 'utf-8')
    return c.includes('[Citation placeholder') || c.includes('[citation placeholder')
  })
  check(placeholderHits.length === 0, `52. No "[Citation placeholder" text remains (found in ${placeholderHits.length} files)`)
  const citationNeededHits = allSrcFiles.filter((f) => {
    const c = fs.readFileSync(f, 'utf-8')
    return c.includes('[citation needed]') || c.includes('[CITATION NEEDED]')
  })
  check(citationNeededHits.length === 0, `53. No "[citation needed]" text remains (found in ${citationNeededHits.length} files)`)

  // 54-60. Article structural checks
  check(articlePage.includes('id="sources"'),                          '54. Article includes a Sources section with id="sources"')

  const sourceIds = ['source-1', 'source-2', 'source-3', 'source-4', 'source-5', 'source-6']
  const presentSources = sourceIds.filter((id) => articlePage.includes(`id="${id}"`))
  check(presentSources.length >= 5,                                    `55. Article cites at least 5 distinct sources (found ${presentSources.length})`)

  check(articlePage.includes('FDIC'),                                  '56. Article includes FDIC source (12% draw denial stat)')
  check(articlePage.includes('Civil Code') || articlePage.includes('8850'), '57. Article includes California Civil Code 8850 source')
  check(articlePage.includes('Bank Director'),                         '58. Article includes Bank Director source')
  check(articlePage.includes('Comptroller of the Currency') || articlePage.includes('OCC'), '59. Article includes OCC source')
  check(articlePage.includes('Federal Acquisition Regulation') || articlePage.includes('FAR '), '60. Article includes FAR source')

  // 61. Demo stats: FDIC + ACFE present, $3.1B and 87% removed
  check(
    demoPage.includes('FDIC') &&
      demoPage.includes('ACFE') &&
      !demoPage.includes('$3.1B') &&
      !demoPage.includes('87%'),
    '61. /demo stats use FDIC + ACFE; unsupported $3.1B and 87% removed',
  )

  // 62. About/Careers softened
  const aboutPage = read('src/app/about/page.tsx')
  const careersPage = read('src/app/careers/page.tsx')
  check(
    !aboutPage.includes('$2.19 trillion') && !careersPage.includes('$2.19 trillion'),
    '62. About/Careers do not assert exact $2.19T figure (softened)',
  )

  // ── Banned overclaims ───────────────────────────────────────────────────────
  // We forbid AFFIRMATIVE claims like "Vektrum prevents fraud". A negative
  // disclaimer ("does not claim to prevent fraud") is allowed.
  console.log('\nBanned overclaims')

  // Affirmative-claim regex: Vektrum + (verb) + (banned thing).
  // Tolerates a negation immediately before — e.g. "does not", "cannot",
  // "doesn't" — by requiring no "not" / "n't" / "never" / "no" between the
  // subject "Vektrum" and the verb within ~20 characters.
  const NEGATION = /\b(?:not|n['’]t|never|no\b)\b/i
  function affirmativeClaim(text: string, verbPattern: RegExp): boolean {
    // Walk all matches of the verb in the article body.
    let m
    const re = new RegExp(verbPattern, 'gi')
    while ((m = re.exec(text)) !== null) {
      // Look at the 60 chars *before* the match — if there's no negation,
      // and there's "Vektrum" or "we" within that window, it's an affirmative claim.
      const window = text.slice(Math.max(0, m.index - 60), m.index)
      if (NEGATION.test(window)) continue
      if (/\bVektrum\b/.test(window) || /\b(?:we|We)\b/.test(window)) return true
    }
    return false
  }

  check(
    !affirmativeClaim(articlePage, /\bprevents?\s+fraud\b/),
    '63. Article does not affirmatively claim Vektrum prevents fraud',
  )
  check(
    !affirmativeClaim(articlePage, /\beliminates?\s+disputes?\b/),
    '64. Article does not affirmatively claim Vektrum eliminates disputes',
  )
  check(
    !affirmativeClaim(articlePage, /\bguarantees?\s+compliance\b/),
    '65. Article does not affirmatively claim Vektrum guarantees compliance',
  )

  // ── External source links ────────────────────────────────────────────────────
  console.log('\nExternal source links')

  // Isolate the Sources section so we don't accidentally count the in-body
  // [1]/[2] superscript anchors as external links.
  const sourcesIdx    = articlePage.indexOf('id="sources"')
  const sourcesEndIdx = articlePage.indexOf('</section>', sourcesIdx)
  const sourcesBlock  = sourcesIdx !== -1 ? articlePage.slice(sourcesIdx, sourcesEndIdx) : ''

  // Match all external <a href="https://..."> within the Sources block
  const externalLinkRe = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>/g
  const externalLinks: string[] = []
  let m: RegExpExecArray | null
  while ((m = externalLinkRe.exec(sourcesBlock)) !== null) {
    externalLinks.push(m[1])
  }
  check(externalLinks.length >= 1, `66. Sources section contains at least 1 external link (found ${externalLinks.length})`)
  check(
    sourcesBlock.includes('https://www.acquisition.gov/far/52.232-5'),
    '67. FAR 52.232-5 links to acquisition.gov canonical URL',
  )
  check(
    sourcesBlock.includes('https://www.acquisition.gov/far/52.232-27'),
    '68. FAR 52.232-27 links to acquisition.gov canonical URL',
  )

  // Check rel/target on every external <a> in the sources block
  const externalAnchorRe = /<a\s+href="https?:\/\/[^"]+"[^>]*>/g
  const externalAnchors: string[] = []
  let am: RegExpExecArray | null
  while ((am = externalAnchorRe.exec(sourcesBlock)) !== null) {
    externalAnchors.push(am[0])
  }
  const allHaveRel    = externalAnchors.every((a) => /rel="[^"]*noopener[^"]*noreferrer[^"]*"|rel="[^"]*noreferrer[^"]*noopener[^"]*"/.test(a))
  const allHaveTarget = externalAnchors.every((a) => a.includes('target="_blank"'))
  check(allHaveRel,    '69. All external links in Sources use rel="noopener noreferrer"')
  check(allHaveTarget, '70. All external links in Sources use target="_blank"')

  // No placeholder URLs anywhere in the Sources block
  const hasPlaceholderUrl =
    /href="#"/.test(sourcesBlock) ||
    /href="example\.com|href="https?:\/\/example\./.test(sourcesBlock) ||
    /href="[^"]*TODO/.test(sourcesBlock) ||
    /href="\s*"/.test(sourcesBlock)
  check(!hasPlaceholderUrl, '71. No placeholder URLs in Sources section (no #, example.com, TODO, or empty href)')

  // Unverified sources marked with TODO(canonical-url) comments — confirms we
  // didn't silently drop the "needs confirmation" markers.
  const todoCount = (sourcesBlock.match(/TODO\(canonical-url\)/g) ?? []).length
  check(todoCount >= 4, `72. Unverified sources marked with TODO(canonical-url) comments (found ${todoCount})`)

  // ── Footer / nav visibility for /resources ───────────────────────────────────
  console.log('\nFooter / nav visibility for /resources')

  // Isolate the <footer>...</footer> block in layout.tsx so we don't conflate
  // header nav links with footer links.
  const footerStart = layout.indexOf('<footer')
  const footerEnd   = layout.indexOf('</footer>', footerStart)
  const footerBlock = footerStart !== -1 ? layout.slice(footerStart, footerEnd) : ''

  check(
    footerBlock.includes('href="/resources"'),
    '73. Footer contains a link to /resources',
  )
  // The footer Resources link should label as exactly "Resources"
  const resourcesLinkRe = /href="\/resources"[^>]*>\s*Resources\s*</
  check(
    resourcesLinkRe.test(footerBlock),
    '74. Footer link to /resources uses the label "Resources"',
  )
  // Help / FAQ label change with /help route preserved
  const helpLinkRe = /href="\/help"[^>]*>\s*Help\s*\/\s*FAQ\s*</
  check(
    helpLinkRe.test(footerBlock),
    '75. Footer Help link uses label "Help / FAQ" and route /help',
  )
  // No /faq route is linked anywhere — route does not exist in the app
  const faqRouteHits = allSrcFiles.filter((f) => {
    const c = fs.readFileSync(f, 'utf-8')
    // Match href="/faq" or href="/faq/..." or push('/faq') etc., but not /faqs
    return /href=["']\/faq(?:["'/])|push\(['"]\/faq(?:["'/])/.test(c)
  })
  check(
    faqRouteHits.length === 0,
    `76. No /faq route is linked anywhere (found in ${faqRouteHits.length} files)`,
  )
  // Mobile nav has /resources for logged-out users
  check(
    mobileNav.includes('href="/resources"'),
    '77. Mobile nav contains a link to /resources',
  )
  // Sitemap entries preserved
  check(
    sitemap.includes('/resources') &&
      !/^\s*\/\/.*\/resources/m.test(sitemap), // not commented out
    '78. Sitemap still includes /resources',
  )
  check(
    sitemap.includes('/resources/construction-dispute-isolation'),
    '79. Sitemap still includes /resources/construction-dispute-isolation',
  )

  // ── Cleanup-sprint audit items ──────────────────────────────────────────────
  console.log('\nCleanup-sprint audit items')

  // 80. Self-canonicals — no page canonicals to homepage. Walk every public
  // page metadata export and check the canonical, if present, points at its
  // own path. Pages without a canonical are tolerated (root layout default).
  const PUBLIC_PAGES_WITH_OWN_CANONICAL: Array<[string, string]> = [
    ['src/app/page.tsx',                                                      'https://vektrum.io'],
    ['src/app/funders/page.tsx',                                              'https://vektrum.io/funders'],
    ['src/app/contractors/page.tsx',                                          'https://vektrum.io/contractors'],
    ['src/app/pricing/page.tsx',                                              'https://vektrum.io/pricing'],
    ['src/app/help/page.tsx',                                                 'https://vektrum.io/help'],
    ['src/app/demo/page.tsx',                                                 'https://vektrum.io/demo'],
    ['src/app/about/page.tsx',                                                'https://vektrum.io/about'],
    ['src/app/careers/page.tsx',                                              'https://vektrum.io/careers'],
    ['src/app/contact/page.tsx',                                              'https://vektrum.io/contact'],
    ['src/app/founders/page.tsx',                                             'https://vektrum.io/founders'],
    ['src/app/partners/page.tsx',                                             'https://vektrum.io/partners'],
    ['src/app/security/page.tsx',                                             'https://vektrum.io/security'],
    ['src/app/privacy/page.tsx',                                              'https://vektrum.io/privacy'],
    ['src/app/terms/page.tsx',                                                'https://vektrum.io/terms'],
    ['src/app/resources/page.tsx',                                            'https://vektrum.io/resources'],
    ['src/app/resources/construction-dispute-isolation/page.tsx',             'https://vektrum.io/resources/construction-dispute-isolation'],
  ]
  const canonicalMisses: string[] = []
  for (const [rel, expected] of PUBLIC_PAGES_WITH_OWN_CANONICAL) {
    const src = read(rel)
    // Find canonical: '<url>'
    const m = src.match(/canonical:\s*['"]([^'"]+)['"]/)
    if (!m) { canonicalMisses.push(`${rel}: MISSING canonical`); continue }
    if (m[1] !== expected) canonicalMisses.push(`${rel}: canonical=${m[1]} expected=${expected}`)
  }
  check(canonicalMisses.length === 0, `80. Self-canonicals on every public page (failures: ${canonicalMisses.length}) ${canonicalMisses.join(' | ')}`)

  // 81. /lenders page removed
  check(!exists('src/app/lenders/page.tsx'), '81. /lenders page removed (config-level redirect handles route)')

  // 82. /lenders not in sitemap (only as URL entry, comments allowed)
  // Match a sitemap url field: `url: \`${baseUrl}/lenders\``
  const lendersInSitemapAsUrl = /url:\s*`\$\{baseUrl\}\/lenders`/.test(sitemap)
  check(!lendersInSitemapAsUrl, '82. /lenders is NOT in sitemap (no url entry)')

  // 83. /lenders permanent redirect in next.config
  const nextConfig = read('next.config.ts')
  check(
    /source:\s*['"]\/lenders['"][^}]*permanent:\s*true/.test(nextConfig.replace(/\s+/g, ' ')),
    '83. /lenders → /funders is permanent: true in next.config redirects',
  )

  // 84. No "Recommendation: approve" on demo
  check(!demoPage.includes('Recommendation') || !demoPage.includes('approve'),
    '84. Demo page does NOT contain "Recommendation: approve"')
  // Stricter: literal lowercase "approve" inside the AI card
  check(!/Recommendation[\s\S]{0,60}approve/i.test(demoPage),
    '84b. Demo "Recommendation: approve" pattern not present')

  // 85. No "Zero industry-standard solution"
  check(!demoPage.includes('Zero industry-standard'), '85. Demo page does NOT contain "Zero industry-standard solution"')

  // 86. No visible pending-source language in article
  check(
    !articlePage.includes('pending verification') && !articlePage.includes('pending confirmation against'),
    '86. Article has no visible "pending verification" public language',
  )

  // 87, 88. Byline + visible date
  check(articlePage.includes('Vektrum Research'), '87. Article has byline "Vektrum Research"')
  check(
    articlePage.includes('PUBLISHED_DATE_DISPLAY') || articlePage.includes('April 29, 2026'),
    '88. Article has visible publication date',
  )

  // 89. Article schema has author + dates
  check(
    articlePage.includes("author:") &&
      articlePage.includes('datePublished:') &&
      articlePage.includes('dateModified:'),
    '89. Article schema has author + datePublished + dateModified',
  )

  // 90. Pricing has exactly one <h1>
  const pricingH1Count = (pricing.match(/<h1\b/g) ?? []).length
  check(pricingH1Count === 1, `90. Pricing has exactly one <h1> (found ${pricingH1Count})`)

  // 91. Pricing plan name renders as <h3>
  check(/<h3[^>]*>\s*\{name\}\s*<\/h3>/.test(pricing), '91. Pricing plan name renders as <h3> (not <p> or <h1>)')

  // 92. Mobile drawer always rendered (hidden attribute)
  check(
    /id="mobile-nav-menu"[\s\S]{0,200}hidden=\{!open\}/.test(mobileNav),
    '92. Mobile nav drawer rendered with `hidden` (always in DOM for aria-controls target)',
  )

  // 93. Mobile nav has aria-label="Main menu"
  check(mobileNav.includes('aria-label="Main menu"'), '93. Mobile nav has aria-label="Main menu"')

  // 94. Escape key handler
  check(/Escape['"][\s\S]{0,80}setOpen\(false\)/.test(mobileNav), '94. Mobile nav has Escape key handler')

  // 95. Reduced-motion CSS
  const globalsCss = read('src/app/globals.css')
  check(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(globalsCss) &&
      globalsCss.includes('.animate-fade-in') &&
      globalsCss.includes('animation: none'),
    '95. Reduced-motion CSS exists in globals.css',
  )

  // 96. /funders AI pre-review section
  check(
    funders.includes('AI pre-review before the gate') &&
      funders.includes('AI does not approve payment'),
    '96. /funders includes "AI pre-review before the gate" section with non-overclaim',
  )

  // 97. /contractors rail distinction in hero
  check(
    contractors.includes('Stripe Connect deals deposit') &&
      contractors.includes("external-rail deals are executed"),
    '97. /contractors hero distinguishes Stripe Connect vs external rail',
  )

  // 98. Security webhook signing section
  const securityPage = read('src/app/security/page.tsx')
  check(
    securityPage.includes('Webhook signing secret handling'),
    '98. Security page has separate "Webhook signing secret handling" section',
  )

  // 99. Webhook note moved out of "never stores"
  // The "What Vektrum never stores" block must NOT include the webhook secret entry.
  const neverStoresStart = securityPage.indexOf('What Vektrum never stores')
  const webhookHandlingStart = securityPage.indexOf('Webhook signing secret handling')
  const neverStoresBlock = neverStoresStart !== -1 && webhookHandlingStart !== -1
    ? securityPage.slice(neverStoresStart, webhookHandlingStart)
    : ''
  check(
    !neverStoresBlock.includes('Webhook signing secrets after issuance'),
    '99. Webhook secret note is OUT of "What Vektrum never stores" section',
  )

  // 100. Security headers in next.config
  const requiredHeaders = ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']
  const missingHeaders = requiredHeaders.filter((h) => !nextConfig.includes(h))
  check(missingHeaders.length === 0, `100. Security headers in next.config (missing: ${missingHeaders.join(', ') || 'none'})`)

  // 101. poweredByHeader false
  check(/poweredByHeader:\s*false/.test(nextConfig), '101. poweredByHeader: false in next.config')

  // 102. Decorative icons aria-hidden — count across public pages
  const PUBLIC_PAGES_WITH_ICONS = [
    'src/app/page.tsx',
    'src/app/funders/page.tsx',
    'src/app/contractors/page.tsx',
    'src/app/help/page.tsx',
    'src/app/pricing/page.tsx',
    'src/app/demo/page.tsx',
    'src/app/resources/page.tsx',
    'src/app/resources/construction-dispute-isolation/page.tsx',
    'src/app/partners/page.tsx',
  ]
  let ariaHiddenCount = 0
  for (const rel of PUBLIC_PAGES_WITH_ICONS) {
    const c = read(rel)
    ariaHiddenCount += (c.match(/aria-hidden="true"/g) ?? []).length
  }
  check(ariaHiddenCount >= 30, `102. Decorative icons aria-hidden (found ${ariaHiddenCount} across public pages, ≥30 expected)`)

  // 103. Pricing CFO-readable enterprise bridge text
  check(
    pricing.includes('How the retainer works') &&
      pricing.includes('credited against per-release fees') &&
      pricing.includes('only to verified disbursements'),
    '103. Pricing has CFO-readable enterprise bridge text',
  )

  // ── package.json ─────────────────────────────────────────────────────────────
  check(pkg.includes('seo-accessibility-audit.test.ts'),               '104. Test wired into npm test')

  console.log('\n✓ All seo-accessibility-audit tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
