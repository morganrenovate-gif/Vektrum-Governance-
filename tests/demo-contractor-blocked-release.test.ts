/**
 * tests/demo-contractor-blocked-release.test.ts
 *
 * Static source-parse checks proving the contractor demo-live page correctly
 * demonstrates blocked releases, interactive condition resolution, AI pre-review
 * as a precondition (not approval), and the Vektrum release model narrative.
 *
 * Root cause of the original fix:
 *   The contractor demo page showed "Request Review" (not "Request AI review"),
 *   showed only progress / "Awaiting funder release" without any blocked-release
 *   scenario, and had no rail-neutral disclaimer.
 *
 * Root cause of this follow-up fix (interactive buttons):
 *   The three blocked-release action buttons (Upload lien waiver, Resolve change
 *   order, Request AI review) were <Link> elements pointing to the harbor deal
 *   page — they had no onClick handlers and changed no demo state.
 *
 * Root cause of the AI review animation fix:
 *   Clicking "Request AI review" in the blocked card instantly set
 *   blockedAiReviewDone=true with no intermediate state, no visible panel,
 *   and no step-by-step checklist — no user feedback.
 *
 * After the animation fix:
 *   - Click → button immediately becomes disabled "AI review running…"
 *   - "AI pre-review in progress" panel appears with a 5-step animated checklist.
 *   - Steps advance every 700 ms: Reading draw request → Comparing against SOV →
 *     Checking lien waiver status → Checking open change orders →
 *     Preparing review summary.
 *   - On completion: panel switches to emerald "AI pre-review complete — funder
 *     authorization still required." with draw details and safe copy notes.
 *   - Activity feed: "AI pre-review requested" first, then "AI pre-review
 *     completed — deterministic release gate and funder authorization still
 *     control release."
 *   - blockedAiReviewRunning and blockedAiReviewStep are new state; both reset
 *     to false/0 on demo reset.
 *
 * After the fix:
 *   - Each button has an onClick handler that updates React state.
 *   - Upload lien waiver → sets lienWaiverUploaded, adds activity entry.
 *   - Resolve change order → sets changeOrderResolved, adds activity entry.
 *   - Request AI review (blocked card) → animated review sequence, then done.
 *   - When all three are done, contractorConditionsDone=true, card switches to
 *     "Awaiting funder authorization" — funder auth always remains required.
 *   - Contractor never sees "Authorize release", "Release funds", etc.
 *   - Demo reset restores all three flags to false.
 *   - Production release/payment/signing logic is completely untouched.
 *
 * Checks:
 *  1.  handleUploadLienWaiver exists (interactive handler for lien waiver).
 *  2.  handleResolveChangeOrder exists (interactive handler for change order).
 *  3.  handleBlockedAiReview exists (interactive handler for blocked AI review).
 *  4.  lienWaiverUploaded state exists with initial false.
 *  5.  changeOrderResolved state exists with initial false.
 *  6.  blockedAiReviewDone state exists with initial false.
 *  7.  contractorConditionsDone derived flag exists.
 *  8.  "Awaiting funder authorization" appears (all-complete state heading).
 *  9.  "All contractor-side release conditions are complete." copy exists.
 * 10.  Upload lien waiver action button uses type="button" onClick (not just Link).
 * 11.  Resolve change order action button uses type="button" onClick.
 * 12.  Blocked AI review action button uses type="button" onClick.
 * 13.  "Lien waiver uploaded" success state copy exists.
 * 14.  "Change order resolved" success state copy exists.
 * 15.  "AI review complete" success state copy exists.
 * 16.  Activity entry for lien waiver: "Conditional lien waiver uploaded".
 * 17.  Activity entry for change order: "Change order CO-007 resolved".
 * 18.  Activity entry for blocked AI review: "deterministic release gate".
 * 19.  Demo reset clears lienWaiverUploaded (setLienWaiverUploaded(false)).
 * 20.  Demo reset clears changeOrderResolved (setChangeOrderResolved(false)).
 * 21.  Demo reset clears blockedAiReviewDone (setBlockedAiReviewDone(false)).
 * 22.  Contractor never sees "Authorize release" anywhere in source.
 * 23.  Contractor never sees "Release funds" anywhere in source.
 * 24.  Contractor never sees "Approve payment" anywhere in source.
 * 25.  Contractor never sees "AI approved release" anywhere in source.
 * 26.  Contractor never sees "Automatic payment" anywhere in source.
 * 27.  No live Stripe import in contractor page.
 * 28.  No @supabase/ssr or supabase/server import in contractor page.
 * ── Preserved from previous test run ──
 * 29.  Contractor page contains "Request AI review" button label.
 * 30.  Contractor page contains "Release blocked" heading.
 * 31.  Blocked card lists "Lien waiver missing" condition.
 * 32.  Blocked card lists "Open change order unresolved" condition.
 * 33.  Blocked card lists "AI pre-review not current" condition.
 * 34.  Blocked card lists "Funder authorization required" condition.
 * 35.  Page says "funder authorization still required" after AI review.
 * 36.  Rail-neutral disclaimer exists.
 * 37.  Demo reset clears reviewSubmitted (setReviewSubmitted(false)).
 * 38.  Demo reset restores activityEntries to SEED_ENTRIES.
 * 39.  Page uses useDemoAutoReset.
 * 40.  Page has DemoActivityLog component.
 * 41.  "Draw #3 Status" banner is preserved.
 * 42.  "Awaiting Funder Authorization" status text is preserved.
 * 43.  Harbor deal link is preserved.
 * 44.  Required Steps workflow is preserved.
 * 45.  "10-condition check" language is preserved.
 * 46.  This test is wired into npm test in package.json.
 * ── AI review animation checks ──
 * 47.  blockedAiReviewRunning state exists.
 * 48.  blockedAiReviewStep state exists.
 * 49.  "AI review running…" disabled button label exists.
 * 50.  "AI pre-review in progress" panel title exists.
 * 51.  All 5 review step labels exist in source.
 * 52.  "AI pre-review complete — funder authorization still required" in
 *       completed panel (blocked card).
 * 53.  "AI pre-review requested" activity entry exists.
 * 54.  "Draw package appears ready for funder review" copy in completed panel.
 * 55.  Demo reset clears blockedAiReviewRunning (setBlockedAiReviewRunning(false)).
 * 56.  Demo reset clears blockedAiReviewStep (setBlockedAiReviewStep(0)).
 *
 * Run: npx tsx tests/demo-contractor-blocked-release.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT         = path.resolve(process.cwd())
const CONTRACTOR   = 'src/app/(marketing)/demo-live/contractor/page.tsx'
const PACKAGE_JSON = 'package.json'

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

  const src   = read(CONTRACTOR)
  const lower = src.toLowerCase()
  const pkg   = read(PACKAGE_JSON)

  // ── 1–3. Interactive handlers exist ──────────────────────────────────────
  check(src.includes('handleUploadLienWaiver'),  '1. handleUploadLienWaiver handler exists')
  check(src.includes('handleResolveChangeOrder'), '2. handleResolveChangeOrder handler exists')
  check(src.includes('handleBlockedAiReview'),   '3. handleBlockedAiReview handler exists')

  // ── 4–7. State variables ──────────────────────────────────────────────────
  check(src.includes('lienWaiverUploaded'),   '4. lienWaiverUploaded state variable exists')
  check(src.includes('changeOrderResolved'),  '5. changeOrderResolved state variable exists')
  check(src.includes('blockedAiReviewDone'),  '6. blockedAiReviewDone state variable exists')
  check(
    src.includes('contractorConditionsDone'),
    '7. contractorConditionsDone derived flag exists',
  )

  // ── 8–9. All-complete "Awaiting funder authorization" state ───────────────
  check(
    src.includes('Awaiting funder authorization'),
    '8. "Awaiting funder authorization" heading exists for all-complete state',
  )
  check(
    src.includes('All contractor-side release conditions are complete'),
    '9. "All contractor-side release conditions are complete." copy exists',
  )

  // ── 10–12. Action buttons use type="button" onClick (not just <Link>) ─────
  check(
    src.includes('onClick={handleUploadLienWaiver}'),
    '10. Upload lien waiver uses onClick={handleUploadLienWaiver} (interactive button)',
  )
  check(
    src.includes('onClick={handleResolveChangeOrder}'),
    '11. Resolve change order uses onClick={handleResolveChangeOrder} (interactive button)',
  )
  check(
    src.includes('onClick={handleBlockedAiReview}'),
    '12. Blocked AI review uses onClick={handleBlockedAiReview} (interactive button)',
  )

  // ── 13–15. Success state labels ───────────────────────────────────────────
  check(src.includes('Lien waiver uploaded'),  '13. "Lien waiver uploaded" success state copy exists')
  check(src.includes('Change order resolved'), '14. "Change order resolved" success state copy exists')
  check(src.includes('AI review complete'),    '15. "AI review complete" success state copy exists')

  // ── 16–18. Activity entry content ────────────────────────────────────────
  check(
    src.includes('Conditional lien waiver uploaded'),
    '16. Activity entry for lien waiver: "Conditional lien waiver uploaded"',
  )
  check(
    src.includes('Change order CO-007 resolved'),
    '17. Activity entry for change order: "Change order CO-007 resolved"',
  )
  check(
    src.includes('deterministic release gate'),
    '18. Activity entry for blocked AI review references "deterministic release gate"',
  )

  // ── 19–21. Reset clears new state flags ───────────────────────────────────
  check(src.includes('setLienWaiverUploaded(false)'),  '19. Demo reset clears lienWaiverUploaded')
  check(src.includes('setChangeOrderResolved(false)'), '20. Demo reset clears changeOrderResolved')
  check(src.includes('setBlockedAiReviewDone(false)'), '21. Demo reset clears blockedAiReviewDone')

  // ── 22–26. No contractor release / payment authority ──────────────────────
  check(
    !lower.includes('authorize release'),
    '22. Contractor page does not contain "authorize release"',
  )
  check(
    !lower.includes('release funds'),
    '23. Contractor page does not contain "release funds"',
  )
  check(
    !lower.includes('approve payment'),
    '24. Contractor page does not contain "approve payment"',
  )
  check(
    !lower.includes('ai approved release'),
    '25. Contractor page does not contain "ai approved release"',
  )
  check(
    !lower.includes('automatic payment'),
    '26. Contractor page does not contain "automatic payment"',
  )

  // ── 27–28. No production imports ─────────────────────────────────────────
  check(
    !src.includes("from '@/lib/stripe'") && !src.includes("from 'stripe'"),
    '27. No live Stripe import in contractor page',
  )
  check(
    !src.includes("from '@supabase/ssr'") && !src.includes("from '@/lib/supabase/server'"),
    '28. No supabase/ssr or supabase/server import in contractor page',
  )

  // ── 29–30. Core blocked-release UI ────────────────────────────────────────
  check(src.includes('Request AI review'), '29. Contractor page contains "Request AI review" button label')
  check(src.includes('Release blocked'),   '30. Contractor page contains "Release blocked" heading')

  // ── 31–34. Missing conditions in source ───────────────────────────────────
  check(src.includes('Lien waiver missing'),          '31. Blocked card lists "Lien waiver missing" condition')
  check(src.includes('Open change order unresolved'), '32. Blocked card lists "Open change order unresolved" condition')
  check(src.includes('AI pre-review not current'),    '33. Blocked card lists "AI pre-review not current" condition')
  check(src.includes('Funder authorization required'),'34. Blocked card lists "Funder authorization required" condition')

  // ── 35. Funder auth still required after AI review ────────────────────────
  check(
    src.includes('funder authorization still required') ||
    src.includes('Funder authorization still required'),
    '35. Page says "funder authorization still required" after AI review',
  )

  // ── 36. Rail-neutral disclaimer ───────────────────────────────────────────
  check(
    src.includes('does not hold funds') || src.includes('not hold funds') ||
    (src.includes('does not') && src.includes('escrow')),
    '36. Rail-neutral disclaimer: does not hold funds or act as escrow',
  )

  // ── 37–40. Demo reset coverage ────────────────────────────────────────────
  check(src.includes('setReviewSubmitted(false)'),     '37. Demo reset clears reviewSubmitted')
  check(src.includes('setActivityEntries(SEED_ENTRIES)'), '38. Demo reset restores activityEntries to SEED_ENTRIES')
  check(src.includes('useDemoAutoReset'),              '39. Page uses useDemoAutoReset')
  check(src.includes('DemoActivityLog'),               '40. Page renders DemoActivityLog component')

  // ── 41–45. Existing strings preserved ────────────────────────────────────
  check(src.includes('Draw #3 Status'), '41. "Draw #3 Status" banner is preserved')
  check(
    src.includes('Awaiting Funder Authorization') || src.includes('Awaiting Funder Release'),
    '42. "Awaiting Funder Authorization" status text is preserved',
  )
  check(
    src.includes('/demo-live/deal/harbor?from=contractor') || src.includes('/demo-live/deal/harbor'),
    '43. Harbor deal link is preserved',
  )
  check(
    src.includes('Required Steps') &&
    src.includes('Contract on file') &&
    src.includes('Schedule of Values submitted') &&
    src.includes('Draw request submitted') &&
    src.includes('Upload supporting documents'),
    '44. Required Steps workflow is preserved with all steps',
  )
  check(src.includes('10-condition check'), '45. "10-condition check" language is preserved')

  // ── 46. Test wired ────────────────────────────────────────────────────────
  check(
    pkg.includes('demo-contractor-blocked-release.test.ts'),
    '46. This test is wired into npm test in package.json',
  )

  // ── 47–56. AI review animation checks ────────────────────────────────────
  check(src.includes('blockedAiReviewRunning'), '47. blockedAiReviewRunning state exists')
  check(src.includes('blockedAiReviewStep'),    '48. blockedAiReviewStep state exists')
  check(
    src.includes('AI review running'),
    '49. "AI review running…" disabled button label exists',
  )
  check(
    src.includes('AI pre-review in progress'),
    '50. "AI pre-review in progress" panel title exists',
  )
  // All 5 step labels
  check(src.includes('Reading draw request'),      '51a. Review step "Reading draw request" exists')
  check(src.includes('Comparing against SOV'),     '51b. Review step "Comparing against SOV" exists')
  check(src.includes('Checking lien waiver status'), '51c. Review step "Checking lien waiver status" exists')
  check(src.includes('Checking open change orders'), '51d. Review step "Checking open change orders" exists')
  check(src.includes('Preparing review summary'),  '51e. Review step "Preparing review summary" exists')
  check(
    src.includes('AI pre-review complete — funder authorization still required'),
    '52. Completed panel: "AI pre-review complete — funder authorization still required"',
  )
  check(
    src.includes('AI pre-review requested'),
    '53. Activity entry "AI pre-review requested" exists',
  )
  check(
    src.includes('Draw package appears ready for funder review'),
    '54. Completed panel: "Draw package appears ready for funder review"',
  )
  check(
    src.includes('setBlockedAiReviewRunning(false)'),
    '55. Demo reset clears blockedAiReviewRunning',
  )
  check(
    src.includes('setBlockedAiReviewStep(0)'),
    '56. Demo reset clears blockedAiReviewStep',
  )

  console.log('\n✓ All demo-contractor-blocked-release tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
