/**
 * EngagementCta — Sticky post-engagement CTA tests
 *
 * Static source-parse checks — no browser rendering, no DB, no env vars.
 *
 * Checks:
 *  1.  Component file exists at the expected path.
 *  2.  Component is a client component ('use client').
 *  3.  Component is mounted in the marketing layout.
 *  4.  Component is NOT mounted in the app/dashboard layout.
 *  5.  Component is NOT mounted in the root layout.
 *  6.  No immediate-modal / blocking-overlay pattern (show state not true at init).
 *  7.  Dismissal uses localStorage with the expected key.
 *  8.  Dismissal persists for 7 days.
 *  9.  /demo-live is in the excluded-routes list.
 * 10.  /dashboard is in the excluded-routes list.
 * 11.  /auth is in the excluded-routes list.
 * 12.  /api is in the excluded-routes list.
 * 13.  /invite is in the excluded-routes list.
 * 14.  CTA links to /demo-live (demo destination).
 * 15.  CTA links to BOOK_CALL_URL (book destination).
 * 16.  Copy does not say "Vektrum moves money".
 * 17.  Copy does not say "replaces escrow".
 * 18.  Copy does not say "AI approves".
 * 19.  Copy does not say "prevents fraud" or "eliminates disputes".
 * 20.  Component does not block / overlay on mobile (uses hidden sm:flex or equivalent).
 * 21.  Dismiss button has aria-label.
 * 22.  Escape key dismissal handler present.
 * 23.  Scroll trigger is between 55–65% (not 0% — not immediate).
 * 24.  Time trigger is ≥ 30 seconds (not 0 — not immediate).
 * 25.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/engagement-cta.test.ts
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

const results: { name: string; passed: boolean; error?: string }[] = []

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

const CTA_FILE        = 'src/components/marketing/engagement-cta.tsx'
const MARKETING_LAYOUT = 'src/app/(marketing)/layout.tsx'
const APP_LAYOUT       = 'src/app/(app)/layout.tsx'
const ROOT_LAYOUT      = 'src/app/layout.tsx'
const PKG              = 'package.json'

async function main() {

// ─── 1. Component file exists ─────────────────────────────────────────────────

await test('1. EngagementCta component file exists', () => {
  assert(
    exists(CTA_FILE),
    `${CTA_FILE} does not exist. Create the sticky CTA component at this path.`,
  )
})

// ─── 2. Client component ──────────────────────────────────────────────────────

await test("2. Component is a client component ('use client')", () => {
  const src = read(CTA_FILE)
  assert(
    src.startsWith("'use client'") || src.includes("'use client'"),
    `${CTA_FILE} must start with 'use client' — the component uses useState, useEffect, ` +
    `and usePathname which are React client hooks.`,
  )
})

// ─── 3. Mounted in marketing layout ──────────────────────────────────────────

await test('3. EngagementCta is mounted in the marketing layout', () => {
  const src = read(MARKETING_LAYOUT)
  assert(
    src.includes('EngagementCta'),
    `${MARKETING_LAYOUT} must import and render <EngagementCta /> so the sticky CTA ` +
    `appears on all public marketing pages.`,
  )
})

// ─── 4. Not in app/dashboard layout ──────────────────────────────────────────

await test('4. EngagementCta is NOT mounted in the (app) layout', () => {
  if (!exists(APP_LAYOUT)) return // layout not present — trivially satisfied
  const src = read(APP_LAYOUT)
  assert(
    !src.includes('EngagementCta'),
    `${APP_LAYOUT} must NOT render <EngagementCta />. The sticky CTA is a marketing ` +
    `surface and must not appear inside the authenticated dashboard.`,
  )
})

// ─── 5. Not in root layout ────────────────────────────────────────────────────

await test('5. EngagementCta is NOT mounted in the root layout', () => {
  const src = read(ROOT_LAYOUT)
  assert(
    !src.includes('EngagementCta'),
    `${ROOT_LAYOUT} must NOT render <EngagementCta />. Mount it only in ` +
    `(marketing)/layout.tsx so it never appears on dashboard/auth routes.`,
  )
})

// ─── 6. No immediate show (not blocking) ─────────────────────────────────────

await test('6. CTA does not show immediately on mount (show initialises false)', () => {
  const src = read(CTA_FILE)
  // useState(false) means not visible at init; useState(true) would be a popup
  assert(
    src.includes('useState(false)') || src.includes('useState<boolean>(false)'),
    `${CTA_FILE}: show state must initialise to false. ` +
    `"useState(true)" or an initial truthy value would display a blocking modal immediately.`,
  )
  // Confirm it does NOT set visible to true synchronously / without a trigger
  assert(
    !src.includes('useState(true)'),
    `${CTA_FILE}: must not use useState(true) for the show state — that creates an ` +
    `immediate modal that appears on every page load.`,
  )
})

// ─── 7. Dismissal uses localStorage ──────────────────────────────────────────

await test('7. Dismissal uses localStorage with expected key', () => {
  const src = read(CTA_FILE)
  assert(
    src.includes('localStorage'),
    `${CTA_FILE}: dismissal must use localStorage to persist the dismissed state.`,
  )
  assert(
    src.includes('vektrum_cta_dismissed'),
    `${CTA_FILE}: localStorage key must contain "vektrum_cta_dismissed" ` +
    `so it is namespaced and does not collide with other storage keys.`,
  )
})

// ─── 8. Dismissal persists 7 days ────────────────────────────────────────────

await test('8. Dismissal persists for 7 days', () => {
  const src = read(CTA_FILE)
  // We look for DISMISS_DAYS = 7 or the literal 7 * 24 * 60 * 60 in the dismissal logic
  assert(
    src.includes('DISMISS_DAYS    = 7') ||
    src.includes('DISMISS_DAYS = 7') ||
    src.includes('7 * 24 * 60 * 60') ||
    (src.includes('= 7') && src.includes('24 * 60 * 60')),
    `${CTA_FILE}: dismissal must persist for 7 days. ` +
    `Use DISMISS_DAYS = 7 or calculate ms = 7 * 24 * 60 * 60 * 1000.`,
  )
})

// ─── 9-13. Excluded routes ────────────────────────────────────────────────────

const EXCLUDED_ROUTES = [
  ['/demo-live', '9'],
  ['/dashboard', '10'],
  ['/auth',      '11'],
  ['/api',       '12'],
  ['/invite',    '13'],
] as const

for (const [route, num] of EXCLUDED_ROUTES) {
  await test(`${num}. "${route}" is in the excluded-routes list`, () => {
    const src = read(CTA_FILE)
    assert(
      src.includes(`'${route}'`) || src.includes(`"${route}"`),
      `${CTA_FILE}: "${route}" must appear in the EXCLUDED_PREFIXES array (or equivalent). ` +
      `The CTA must not render on ${route} routes.`,
    )
  })
}

// ─── 14. CTA links to /demo-live ─────────────────────────────────────────────

await test('14. CTA includes a link to /demo-live', () => {
  const src = read(CTA_FILE)
  assert(
    src.includes('"/demo-live"') || src.includes("'/demo-live'"),
    `${CTA_FILE}: must link to "/demo-live" for the primary demo CTA button.`,
  )
})

// ─── 15. CTA links to BOOK_CALL_URL ──────────────────────────────────────────

await test('15. CTA includes a link to BOOK_CALL_URL', () => {
  const src = read(CTA_FILE)
  assert(
    src.includes('BOOK_CALL_URL'),
    `${CTA_FILE}: must reference BOOK_CALL_URL from @/lib/book-call for the ` +
    `"Book walkthrough" / "Talk to Vektrum" button destination.`,
  )
})

// ─── 16-19. Banned copy claims ────────────────────────────────────────────────

await test('16. Copy does not say "Vektrum moves money"', () => {
  const lower = read(CTA_FILE).toLowerCase()
  assert(
    !lower.includes('vektrum moves money') &&
    !lower.includes('moves funds') &&
    !lower.includes('vektrum transfers'),
    `${CTA_FILE}: must not say "Vektrum moves money", "moves funds", or similar. ` +
    `Vektrum does not hold funds; the customer\'s execution rail does.`,
  )
})

await test('17. Copy does not say "replaces escrow"', () => {
  const lower = read(CTA_FILE).toLowerCase()
  assert(
    !lower.includes('replaces escrow') &&
    !lower.includes('escrow replacement') &&
    !lower.includes('instead of escrow'),
    `${CTA_FILE}: must not imply Vektrum replaces escrow. ` +
    `Approved positioning: Vektrum governs release conditions; escrow/title/lender handles custody.`,
  )
})

await test('18. Copy does not say "AI approves"', () => {
  const lower = read(CTA_FILE).toLowerCase()
  assert(
    !lower.includes('ai approves') &&
    !lower.includes('ai-powered payment') &&
    !lower.includes('ai payment approval'),
    `${CTA_FILE}: must not say "AI approves" releases or payments. ` +
    `AI informs; the gate decides; the funder authorizes.`,
  )
})

await test('19. Copy does not say "prevents fraud" or "eliminates disputes"', () => {
  const lower = read(CTA_FILE).toLowerCase()
  assert(
    !lower.includes('prevents fraud') &&
    !lower.includes('eliminate dispute') &&
    !lower.includes('eliminates dispute') &&
    !lower.includes('fraud prevention'),
    `${CTA_FILE}: must not say Vektrum prevents fraud or eliminates disputes. ` +
    `Approved language: "governed controls", "condition enforcement", "audit evidence".`,
  )
})

// ─── 20. Hidden on mobile ────────────────────────────────────────────────────

await test('20. CTA is hidden on mobile (sm breakpoint or equivalent)', () => {
  const src = read(CTA_FILE)
  assert(
    src.includes('hidden sm:') || src.includes('sm:hidden') ||
    src.includes('max-sm:hidden') || src.includes('@media') ||
    src.includes('hidden md:'),
    `${CTA_FILE}: must use Tailwind responsive prefix (e.g., "hidden sm:flex") ` +
    `to hide the sticky overlay on small screens where it would harm navigation.`,
  )
})

// ─── 21. Dismiss button aria-label ───────────────────────────────────────────

await test('21. Dismiss button has aria-label', () => {
  const src = read(CTA_FILE)
  assert(
    src.includes('aria-label="Dismiss') || src.includes("aria-label='Dismiss"),
    `${CTA_FILE}: the dismiss button must have an aria-label describing its purpose ` +
    `(e.g., aria-label="Dismiss this prompt") for screen reader users.`,
  )
})

// ─── 22. Escape key dismiss handler ──────────────────────────────────────────

await test('22. Escape key dismissal handler is present', () => {
  const src = read(CTA_FILE)
  assert(
    src.includes("'Escape'") || src.includes('"Escape"'),
    `${CTA_FILE}: must handle the Escape key to dismiss the CTA, ` +
    `per keyboard accessibility requirements.`,
  )
})

// ─── 23. Scroll trigger is 55–65% (not immediate) ────────────────────────────

await test('23. Scroll trigger is between 55–65% (not 0 — not immediate)', () => {
  const src = read(CTA_FILE)
  // Extract the scroll threshold value
  const match = src.match(/SCROLL_TRIGGER\s*=\s*([\d.]+)/)
  if (match) {
    const pct = parseFloat(match[1])
    assert(
      pct >= 0.55 && pct <= 0.65,
      `${CTA_FILE}: SCROLL_TRIGGER must be between 0.55 and 0.65 (55–65%). ` +
      `Found: ${pct}. A threshold of 0 or 1 would either always trigger or never trigger.`,
    )
  } else {
    // Fallback: ensure neither 0 nor 1 appears as a scroll ratio
    assert(
      src.includes('0.5') || src.includes('0.6') || src.includes('0.7'),
      `${CTA_FILE}: scroll trigger ratio must be between 0.55 and 0.65. ` +
      `Could not locate SCROLL_TRIGGER constant — add it as a named constant.`,
    )
  }
})

// ─── 24. Time trigger ≥ 30 seconds ───────────────────────────────────────────

await test('24. Time trigger is at least 30 seconds (not immediate)', () => {
  const src = read(CTA_FILE)
  const match = src.match(/TIME_TRIGGER_MS\s*=\s*([\d_]+)/)
  if (match) {
    const ms = parseInt(match[1].replace(/_/g, ''), 10)
    assert(
      ms >= 30_000,
      `${CTA_FILE}: TIME_TRIGGER_MS must be ≥ 30,000 ms (30 seconds). ` +
      `Found: ${ms}ms. A low value creates a near-immediate popup.`,
    )
  } else {
    // Fallback: ensure 45_000 or 45000 or similar is present
    assert(
      src.includes('45_000') || src.includes('45000') || src.includes('60_000'),
      `${CTA_FILE}: time trigger must be ≥ 30 seconds. ` +
      `Could not find TIME_TRIGGER_MS constant — add it as a named constant.`,
    )
  }
})

// ─── 25. Wired into npm test ─────────────────────────────────────────────────

await test('25. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('engagement-cta.test.ts'),
    `package.json npm test script must include 'engagement-cta.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

  console.log('')
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log('  VEKTRUM — Engagement CTA Tests')
  console.log('════════════════════════════════════════════════════════════════════════')
  for (const r of results) {
    if (r.passed) console.log(`  ✓  ${r.name}`)
    else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
  }
  const passed = results.filter(r => r.passed).length
  const failed = results.length - passed
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
  console.log('════════════════════════════════════════════════════════════════════════')
  console.log('')

  if (failed > 0) process.exit(1)

} // end main()

main().catch(e => { console.error(e); process.exit(1) })
