/**
 * tests/accessibility-pass.test.ts
 *
 * Static checks pinning the marketing-surface accessibility pass:
 *   1. Mobile nav: aria-label, aria-expanded, aria-controls, Escape close,
 *      focus return to trigger, drawer always rendered in DOM.
 *   2. Decorative icons: nav/footer/CTA icons carry aria-hidden="true".
 *   3. Headings: each major public page renders exactly one <h1>.
 *   4. FAQ: homepage FAQ uses native <details>/<summary> semantics.
 *   5. Reduced motion: globals.css honors prefers-reduced-motion.
 *   6. Contrast: meaningful headlines/CTA labels do not use text-white/40
 *      (decorative microcopy/footnotes are explicitly allowed).
 *   7. New-tab safety: every target="_blank" pairs with rel="noopener noreferrer"
 *      and visible Cal.com CTAs include sr-only "opens in a new tab".
 *
 * Run: npx tsx tests/accessibility-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const MOBILE_NAV   = 'src/components/nav/mobile-nav.tsx'
const SITE_FOOTER  = 'src/components/nav/site-footer.tsx'
const ENGAGE_CTA   = 'src/components/marketing/engagement-cta.tsx'
const MKT_LAYOUT   = 'src/app/(marketing)/layout.tsx'
const HOMEPAGE     = 'src/app/(marketing)/page.tsx'
const GLOBALS_CSS  = 'src/app/globals.css'
const PACKAGE_JSON = 'package.json'

// Major public pages — every entry must expose exactly one <h1>.
const PUBLIC_PAGES: Array<[string, string]> = [
  ['homepage',         'src/app/(marketing)/page.tsx'],
  ['funders',          'src/app/(marketing)/funders/page.tsx'],
  ['contractors',      'src/app/(marketing)/contractors/page.tsx'],
  ['pricing',          'src/app/(marketing)/pricing/page.tsx'],
  ['demo',             'src/app/(marketing)/demo/page.tsx'],
  ['design-partners',  'src/app/(marketing)/design-partners/page.tsx'],
  ['security',         'src/app/(marketing)/security/page.tsx'],
  ['resources',        'src/app/(marketing)/resources/page.tsx'],
  ['partners',         'src/app/(marketing)/partners/page.tsx'],
]

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\naccessibility-pass.test.ts\n')

  // ── 1. Mobile nav ───────────────────────────────────────────────────────
  console.log('1. Mobile navigation')
  const mobile = read(MOBILE_NAV)

  check(mobile.includes("aria-label={open ? 'Close menu' : 'Open menu'}"),
    '  1a. trigger has aria-label that toggles Open/Close menu')
  check(mobile.includes('aria-expanded={open}'),
    '  1b. trigger has aria-expanded reflecting open state')
  check(mobile.includes('aria-controls="mobile-nav-menu"'),
    '  1c. trigger has aria-controls pointing to drawer id')
  check(mobile.includes('id="mobile-nav-menu"'),
    '  1d. drawer element with id="mobile-nav-menu" is rendered')
  check(mobile.includes('hidden={!open}'),
    '  1e. drawer always rendered in DOM (uses `hidden` attr, not conditional render)')
  check(mobile.includes("e.key === 'Escape'") && mobile.includes('setOpen(false)'),
    '  1f. Escape key closes the drawer')
  // Focus restoration to trigger after close
  check(
    mobile.includes('triggerRef') && mobile.includes('triggerRef.current?.focus()'),
    '  1g. focus returns to trigger after the drawer closes',
  )
  // wasOpen ref so we don't steal focus on mount
  check(
    mobile.includes('wasOpen') && mobile.includes('wasOpen.current'),
    '  1h. focus restoration is gated to the open→closed transition (no initial steal)',
  )
  // Trigger gets aria-haspopup
  check(mobile.includes('aria-haspopup'),
    '  1i. trigger declares aria-haspopup')
  // Trigger has a focus-visible outline
  check(mobile.includes('focus-visible:outline'),
    '  1j. trigger has a visible keyboard focus indicator')

  // ── 2. Decorative icons ─────────────────────────────────────────────────
  console.log('\n2. Decorative icons')
  // Mobile nav: Menu/X icons inside the trigger button must be aria-hidden
  // so screen readers announce only the button's aria-label.
  check(
    mobile.includes('<X size={20} aria-hidden="true" />') &&
    mobile.includes('<Menu size={20} aria-hidden="true" />'),
    '  2a. mobile nav trigger icons (Menu, X) are aria-hidden',
  )
  check(
    mobile.includes('<ArrowRight size={15} aria-hidden="true" />'),
    '  2b. mobile nav Book-a-call ArrowRight icon is aria-hidden',
  )

  // Marketing layout: ArrowRight on Book-a-call CTA is aria-hidden
  const layout = read(MKT_LAYOUT)
  // Pull ArrowRight occurrences and ensure each one carries aria-hidden
  const layoutArrow = layout.match(/<ArrowRight\b[^>]*\/>/g) || []
  check(
    layoutArrow.length > 0 && layoutArrow.every((tag) => tag.includes('aria-hidden')),
    `  2c. marketing layout ArrowRight icons all aria-hidden (found ${layoutArrow.length})`,
  )

  // ── 3. One H1 per public page ───────────────────────────────────────────
  console.log('\n3. Single H1 per public page')
  for (const [name, p] of PUBLIC_PAGES) {
    const src = read(p)
    const count = (src.match(/<h1\b/g) || []).length
    check(count === 1, `  3.${name}: exactly one <h1> (found ${count})`)
  }

  // ── 4. FAQ uses native <details>/<summary> ─────────────────────────────
  console.log('\n4. FAQ accessibility (homepage)')
  const home = read(HOMEPAGE)
  const detailsIdx = home.indexOf('<details')
  const summaryIdx = home.indexOf('<summary')
  check(detailsIdx > -1, '  4a. homepage uses native <details> element')
  check(summaryIdx > -1 && summaryIdx > detailsIdx,
    '  4b. <summary> appears inside the <details> block')
  check(home.includes('id="faq"'), '  4c. FAQ section has id="faq" anchor')

  // ── 5. Reduced motion CSS ──────────────────────────────────────────────
  console.log('\n5. Reduced motion')
  const css = read(GLOBALS_CSS)
  check(
    css.includes('prefers-reduced-motion: reduce') ||
    css.includes('prefers-reduced-motion:reduce'),
    '  5a. globals.css contains @media (prefers-reduced-motion: reduce)',
  )
  // Entrance animations explicitly disabled
  check(
    css.includes('.animate-fade-in') && css.includes('animation: none'),
    '  5b. entrance fade-in animations are disabled under reduced-motion',
  )
  check(
    css.includes('.animate-slide-up'),
    '  5c. slide-up animations are listed for reduced-motion override',
  )
  // Catch-all transition cap
  check(
    css.includes('transition-duration: 0.01ms') &&
    css.includes('animation-duration: 0.01ms'),
    '  5d. global transition/animation duration is clamped under reduced-motion',
  )

  // ── 6. Contrast — meaningful headlines must not use text-white/40 ──────
  console.log('\n6. Contrast — H1 headlines')
  for (const [name, p] of PUBLIC_PAGES) {
    const src = read(p)
    // Locate the first <h1 …> open tag and verify its className doesn't use
    // text-white/40 (the lowest of the readable opacity tiers).
    const h1 = src.match(/<h1\b[^>]*>/)
    if (!h1) {
      fail(`  6.${name}: no <h1> found`)
      continue
    }
    const tag = h1[0]
    check(
      !/text-white\/40\b/.test(tag),
      `  6.${name}: <h1> does not use text-white/40 (must remain readable)`,
    )
  }

  // ── 7. target="_blank" hygiene + sr-only "opens in a new tab" ──────────
  console.log('\n7. New-tab links')
  // Every target="_blank" surface must pair with rel="noopener noreferrer"
  // to prevent reverse-tabnabbing.
  const targets: Array<[string, string]> = [
    ['marketing layout',    MKT_LAYOUT],
    ['site footer',         SITE_FOOTER],
    ['engagement CTA',      ENGAGE_CTA],
    ['mobile nav',          MOBILE_NAV],
  ]
  for (const [name, p] of targets) {
    const src = read(p)
    if (!src.includes("target: '_blank'") && !src.includes('target="_blank"')) {
      // No new-tab links on this surface — OK
      pass(`  7.${name}: no target="_blank" (skip)`)
      continue
    }
    // Whenever target="_blank" appears, rel="noopener noreferrer" appears too.
    check(
      src.includes("rel: 'noopener noreferrer'") || src.includes('rel="noopener noreferrer"'),
      `  7.${name}: target="_blank" pairs with rel="noopener noreferrer"`,
    )
    // Visible "opens in a new tab" sr-only label for screen-reader users.
    check(
      src.includes('opens in a new tab'),
      `  7.${name}: includes sr-only "opens in a new tab" indicator`,
    )
  }

  // Also pin the dispute-isolation article — its FAR.gov citations are
  // user-visible external links and now carry the sr-only label.
  // Strip JSX comments first ({/* ... */}) so we don't count the example
  // string in the operator-instruction comment block.
  const article    = read('src/app/(marketing)/resources/construction-dispute-isolation/page.tsx')
  const articleSrc = article.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  if (articleSrc.includes('target="_blank"')) {
    const blankCount = (articleSrc.match(/target="_blank"/g) || []).length
    const labelCount = (articleSrc.match(/opens in a new tab/g) || []).length
    check(
      labelCount >= blankCount,
      `  7.dispute-isolation article: every target="_blank" has an sr-only label (blank=${blankCount}, label=${labelCount})`,
    )
  }

  // ── 8. Test wired into npm test ────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('accessibility-pass.test.ts'),
    '8. accessibility-pass.test.ts wired into npm test',
  )

  console.log('\n✓ All accessibility-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
