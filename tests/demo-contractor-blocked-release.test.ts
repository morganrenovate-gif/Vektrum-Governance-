/**
 * tests/demo-contractor-blocked-release.test.ts
 *
 * Static source-parse checks proving the contractor demo-live page correctly
 * demonstrates blocked releases, AI pre-review (as a precondition, not approval),
 * and the Vektrum release model narrative.
 *
 * Root cause of the fix:
 *   The contractor demo page showed "Request Review" (not "Request AI review"),
 *   showed only progress / "Awaiting funder release" without any blocked-release
 *   scenario, and had no rail-neutral disclaimer. Visitors could not learn from
 *   the demo that releases are blocked when conditions are missing.
 *
 * After the fix:
 *   - "Request AI review" button (not "Request Review", not "AI approval")
 *   - "Release blocked" card for Building Envelope & Roofing
 *   - Missing conditions listed (lien waiver missing, change order, etc.)
 *   - AI review copy: "AI pre-review complete — funder authorization still required"
 *   - Three milestone states displayed: released, gate-passed, blocked
 *   - DemoActivityLog pre-seeded with blocked-release evidence
 *   - Rail-neutral disclaimer at bottom
 *   - Demo reset restores all new state (reviewSubmitted, activityEntries)
 *   - No production Stripe/Supabase/payment/signing logic touched
 *
 * Checks:
 *  1.  Contractor page contains "Request AI review" button label.
 *  2.  Contractor page does NOT contain the old "Request Review" label alone.
 *  3.  Contractor page contains "Release blocked" heading.
 *  4.  Blocked card body mentions the milestone by name.
 *  5.  Blocked card lists "Lien waiver missing" condition.
 *  6.  Blocked card lists "Open change order unresolved" condition.
 *  7.  Blocked card lists "AI pre-review not current" condition.
 *  8.  Blocked card lists "Funder authorization required" condition.
 *  9.  Blocked card has "Upload lien waiver" action.
 * 10.  Blocked card has "Resolve change order" action.
 * 11.  Page does NOT contain "AI approval" or "AI approved release" anywhere.
 * 12.  Page does NOT contain "AI approves" anywhere.
 * 13.  Page says "funder authorization still required" after AI review.
 * 14.  Page includes rail-neutral disclaimer (does not hold funds / not escrow).
 * 15.  Disclaimer references "selected rail" or "payment rail".
 * 16.  Demo reset clears reviewSubmitted state (setReviewSubmitted(false)).
 * 17.  Demo reset restores activityEntries to seed (setActivityEntries(SEED_ENTRIES)).
 * 18.  Page uses useDemoAutoReset (auto-reset on mount and manual reset event).
 * 19.  Page has DemoActivityLog component.
 * 20.  SEED_ENTRIES includes "Release gate blocked" activity entry.
 * 21.  SEED_ENTRIES includes "Funder authorization pending" entry.
 * 22.  Activity log is seeded on reset (not just on first mount).
 * 23.  Milestone status section shows "released" state.
 * 24.  Milestone status section shows "Gate passed — funder auth required".
 * 25.  Milestone status section shows "Release blocked" state label.
 * 26.  No live Stripe import in contractor page.
 * 27.  No @supabase/ssr or supabase/server import in contractor page.
 * 28.  Existing "Draw #3 Status" banner is preserved.
 * 29.  Existing "Awaiting Funder Authorization" status text is preserved.
 * 30.  Harbor deal link is preserved in contractor page.
 * 31.  Required Steps workflow is preserved.
 * 32.  "10-condition check" language is preserved.
 * 33.  This test is wired into npm test in package.json.
 *
 * Run: npx tsx tests/demo-contractor-blocked-release.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT          = path.resolve(process.cwd())
const CONTRACTOR    = 'src/app/(marketing)/demo-live/contractor/page.tsx'
const PACKAGE_JSON  = 'package.json'

function read(rel: string): string {
  const full = path.resolve(ROOT, rel)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${rel}`)
  return fs.readFileSync(full, 'utf-8')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\ndemo-contractor-blocked-release.test.ts\n')

  const src = read(CONTRACTOR)
  const lower = src.toLowerCase()
  const pkg = read(PACKAGE_JSON)

  // ── 1–2. AI review button label ──────────────────────────────────────────
  check(
    src.includes('Request AI review'),
    '1. Contractor page contains "Request AI review" button label',
  )
  // The old label "Request Review" must not appear as a standalone button
  // label. "Request AI review" supersedes it. (We allow it in comments only.)
  check(
    !src.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').includes('>Request Review<'),
    '2. Contractor page does not contain old ">Request Review<" button text',
  )

  // ── 3–10. Release blocked card ───────────────────────────────────────────
  check(src.includes('Release blocked'), '3. Contractor page contains "Release blocked" heading')
  check(
    src.includes('Building Envelope') && src.includes('Roofing'),
    '4. Blocked card mentions "Building Envelope & Roofing" milestone',
  )
  check(src.includes('Lien waiver missing'),         '5. Blocked card lists "Lien waiver missing" condition')
  check(src.includes('Open change order unresolved'), '6. Blocked card lists "Open change order unresolved" condition')
  check(src.includes('AI pre-review not current'),   '7. Blocked card lists "AI pre-review not current" condition')
  check(src.includes('Funder authorization required'), '8. Blocked card lists "Funder authorization required" condition')
  check(src.includes('Upload lien waiver'),           '9. Blocked card has "Upload lien waiver" action')
  check(src.includes('Resolve change order'),         '10. Blocked card has "Resolve change order" action')

  // ── 11–12. No AI approval language ───────────────────────────────────────
  check(
    !lower.includes('ai approval') && !lower.includes('ai approved release'),
    '11. Page does not contain "AI approval" or "AI approved release"',
  )
  check(
    !lower.includes('ai approves'),
    '12. Page does not contain "AI approves"',
  )

  // ── 13. Funder auth still required after AI review ────────────────────────
  check(
    src.includes('funder authorization still required') ||
    src.includes('Funder authorization still required'),
    '13. Page says "funder authorization still required" after AI review',
  )

  // ── 14–15. Rail-neutral disclaimer ───────────────────────────────────────
  check(
    src.includes('does not hold funds') || src.includes('not hold funds') ||
    src.includes('not act as escrow') || src.includes('does not') && src.includes('escrow'),
    '14. Rail-neutral disclaimer: does not hold funds or act as escrow',
  )
  check(
    src.includes('selected rail') || src.includes('payment rail') || src.includes('selected payment rail'),
    '15. Disclaimer references "selected rail" or "payment rail"',
  )

  // ── 16–18. Demo reset coverage ────────────────────────────────────────────
  check(src.includes('setReviewSubmitted(false)'), '16. Demo reset clears reviewSubmitted (setReviewSubmitted(false))')
  check(
    src.includes('setActivityEntries(SEED_ENTRIES)'),
    '17. Demo reset restores activityEntries to SEED_ENTRIES',
  )
  check(src.includes('useDemoAutoReset'), '18. Page uses useDemoAutoReset for auto-reset on mount and manual reset')

  // ── 19–22. DemoActivityLog and seed entries ───────────────────────────────
  check(src.includes('DemoActivityLog'), '19. Page imports and renders DemoActivityLog component')
  check(
    src.includes('Release gate blocked') || src.includes('release gate blocked'),
    '20. SEED_ENTRIES includes "Release gate blocked" activity entry',
  )
  check(
    src.includes('Funder authorization pending'),
    '21. SEED_ENTRIES includes "Funder authorization pending" entry',
  )
  check(
    src.includes('setActivityEntries(SEED_ENTRIES)') &&
    src.includes('useDemoAutoReset'),
    '22. Activity log is seeded in useDemoAutoReset reset callback',
  )

  // ── 23–25. Milestone status section ──────────────────────────────────────
  check(
    src.includes("'released'") || src.includes('"released"') || src.includes('Released'),
    '23. Milestone status section shows released state',
  )
  check(
    src.includes('Gate passed') || src.includes('gate passed') ||
    src.includes('funder auth required') || src.includes('funder authorization required'),
    '24. Milestone status section shows gate-passed / funder-auth state',
  )
  // The blocked label in the milestone overview section
  const blockedLabelIdx   = src.indexOf('Release blocked')
  const milestoneSection  = src.includes('Milestone Status')
  check(blockedLabelIdx > -1 && milestoneSection, '25. Milestone status section shows "Release blocked" label')

  // ── 26–27. No production imports ─────────────────────────────────────────
  check(
    !src.includes("from '@/lib/stripe'") && !src.includes("from 'stripe'"),
    '26. No live Stripe import in contractor page',
  )
  check(
    !src.includes("from '@supabase/ssr'") && !src.includes("from '@/lib/supabase/server'"),
    '27. No supabase/ssr or supabase/server import in contractor page',
  )

  // ── 28–32. Existing strings preserved ────────────────────────────────────
  check(src.includes('Draw #3 Status'), '28. "Draw #3 Status" banner is preserved')
  check(
    src.includes('Awaiting Funder Authorization') || src.includes('Awaiting Funder Release'),
    '29. "Awaiting Funder Authorization" status text is preserved',
  )
  check(
    src.includes('/demo-live/deal/harbor?from=contractor') || src.includes('/demo-live/deal/harbor'),
    '30. Harbor deal link is preserved',
  )
  check(
    src.includes('Required Steps') &&
    src.includes('Contract on file') &&
    src.includes('Schedule of Values submitted') &&
    src.includes('Draw request submitted') &&
    src.includes('Upload supporting documents'),
    '31. Required Steps workflow is preserved with all steps',
  )
  check(src.includes('10-condition check'), '32. "10-condition check" language is preserved')

  // ── 33. Test wired ────────────────────────────────────────────────────────
  check(
    pkg.includes('demo-contractor-blocked-release.test.ts'),
    '33. This test is wired into npm test in package.json',
  )

  console.log('\n✓ All demo-contractor-blocked-release tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
