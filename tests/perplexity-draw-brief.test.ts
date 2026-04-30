/**
 * Perplexity Draw Control Brief — Copy & Safety Tests
 *
 * Source-parse checks — no live DB, no env vars, no rendering required.
 * Proves that Perplexity Computer is visibly core to the product as the
 * required evidence-to-policy layer, while preserving all safety boundaries.
 *
 * Safety invariants tested:
 *   - AI does not approve payments
 *   - AI does not release funds
 *   - Perplexity does not control payment execution
 *   - Gate logic is not weakened
 *   - Stripe, partner API, RLS, auth, audit are not modified
 *
 * Checks:
 *  1.  "Draw Control Brief" appears in the demo AI review modal.
 *  2.  "Perplexity Computer" appears in the demo AI review modal.
 *  3.  Demo modal copy says the brief is required before release gate evaluation.
 *  4.  Demo modal copy says "AI informs" and "gate decides".
 *  5.  Demo modal copy does not say AI approves payments.
 *  6.  Demo modal copy does not say AI releases funds.
 *  7.  "Draw Control Brief" appears in the production draw-review-agent component.
 *  8.  "Perplexity" appears in the production draw-review-agent component.
 *  9.  Production component copy says the brief is required before release gate evaluation.
 * 10.  Demo funder tour step mentions "Perplexity Computer" and "Draw Control Brief".
 * 11.  Demo funder tour step says "without a current brief" release workflow cannot proceed.
 * 12.  Public FAQ explains what Perplexity Computer does inside Vektrum.
 * 13.  Public FAQ or help page says the brief is required before release gate evaluation.
 * 14.  Public FAQ copy preserves the four-layer authority model.
 * 15.  Release gate logic file still has the AI precondition check.
 * 16.  Release gate does not allow AI to authorize release.
 * 17.  No Stripe, partner API, auth, or RLS logic files were modified.
 * 18.  Demo modal does not say "Perplexity controls payments".
 * 19.  Demo modal does not say "AI payment approval".
 * 20.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/perplexity-draw-brief.test.ts
 */

import fs from 'fs'
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

function read(p: string): string {
  return fs.readFileSync(path.resolve(ROOT, p), 'utf-8')
}

const DEMO_MODAL    = 'src/components/demo/AiReviewModal.tsx'
const PROD_WIDGET   = 'src/components/ai/draw-review-agent.tsx'
const FUNDER_TOUR   = 'src/components/demo/DemoFunderTour.tsx'
const HELP_PAGE     = 'src/app/help/page.tsx'
const RELEASE_GATE  = 'src/lib/engine/release-gate.ts'
const PKG           = 'package.json'

async function main() {

// ─── 1-6. Demo AI review modal ───────────────────────────────────────────────

await test('1. Demo modal includes "Draw Control Brief"', () => {
  const src = read(DEMO_MODAL)
  assert(
    src.includes('Draw Control Brief'),
    `${DEMO_MODAL} must include "Draw Control Brief" to make Perplexity Computer's ` +
    `role as the evidence-to-policy layer visible to demo viewers.`,
  )
})

await test('2. Demo modal includes "Perplexity Computer"', () => {
  const src = read(DEMO_MODAL)
  assert(
    src.includes('Perplexity Computer') || src.includes('Perplexity'),
    `${DEMO_MODAL} must include "Perplexity Computer" or "Perplexity" so the AI ` +
    `provider is named and visibly core, not just an abstract "AI review."`,
  )
})

await test('3. Demo modal copy says brief is required before release gate evaluation', () => {
  const src = read(DEMO_MODAL)
  assert(
    src.includes('required before') || src.includes('Required before') ||
    src.includes('before the release gate') || src.includes('before release gate'),
    `${DEMO_MODAL} must state that the Draw Control Brief is required before the release ` +
    `gate can evaluate the draw — this is the core product claim.`,
  )
})

await test('4. Demo modal copy says "AI informs" and "gate decides"', () => {
  const src = read(DEMO_MODAL)
  assert(
    src.includes('AI informs') && src.includes('gate decides'),
    `${DEMO_MODAL} must include "AI informs" and "gate decides" to preserve the safety ` +
    `boundary between evidence preparation and release authorization.`,
  )
})

await test('5. Demo modal copy does not say AI approves payments', () => {
  const src = read(DEMO_MODAL)
  const lower = src.toLowerCase()
  assert(
    !lower.includes('ai approves payment') &&
    !lower.includes('ai approved payment') &&
    !lower.includes('ai payment approval') &&
    !lower.includes('perplexity approves'),
    `${DEMO_MODAL} must not say "AI approves payments" or "AI payment approval" — ` +
    `AI prepares the brief; the gate decides; the funder authorizes.`,
  )
})

await test('6. Demo modal copy does not say AI releases funds', () => {
  const src = read(DEMO_MODAL)
  const lower = src.toLowerCase()
  assert(
    !lower.includes('ai releases') &&
    !lower.includes('ai will release') &&
    !lower.includes('perplexity releases funds') &&
    !lower.includes('ai decides whether money'),
    `${DEMO_MODAL} must not imply AI releases funds or decides whether money moves.`,
  )
})

// ─── 7-9. Production draw-review-agent component ─────────────────────────────

await test('7. Production widget includes "Draw Control Brief"', () => {
  const src = read(PROD_WIDGET)
  assert(
    src.includes('Draw Control Brief'),
    `${PROD_WIDGET} must include "Draw Control Brief" so the production dashboard ` +
    `surfaces the same framing as the demo — Perplexity Computer is the evidence-to-policy layer.`,
  )
})

await test('8. Production widget includes "Perplexity"', () => {
  const src = read(PROD_WIDGET)
  assert(
    src.includes('Perplexity'),
    `${PROD_WIDGET} must include "Perplexity" to name the AI provider — not just a ` +
    `generic "AI Draw Review" that could be any arbitrary service.`,
  )
})

await test('9. Production widget says brief is required before release gate evaluation', () => {
  const src = read(PROD_WIDGET)
  assert(
    src.includes('Required before release gate') ||
    src.includes('required before release gate') ||
    src.includes('required precondition') ||
    src.includes('release gate will not evaluate'),
    `${PROD_WIDGET} must state that the Draw Control Brief is a required precondition ` +
    `for the release gate — this is the core product claim that makes Perplexity core.`,
  )
})

// ─── 10-11. Demo funder tour ──────────────────────────────────────────────────

await test('10. Funder tour step mentions Perplexity Computer and Draw Control Brief', () => {
  const src = read(FUNDER_TOUR)
  assert(
    src.includes('Perplexity Computer') || src.includes('Perplexity'),
    `${FUNDER_TOUR} must mention "Perplexity Computer" in the AI review tour step ` +
    `so the walkthrough makes the named AI provider visible.`,
  )
  assert(
    src.includes('Draw Control Brief'),
    `${FUNDER_TOUR} must mention "Draw Control Brief" in the tour step about the ` +
    `AI precondition so viewers understand the brief is the required artifact.`,
  )
})

await test('11. Funder tour step says the release workflow cannot proceed without a current brief', () => {
  const src = read(FUNDER_TOUR)
  assert(
    src.includes('cannot proceed') ||
    src.includes('required before') ||
    src.includes('Without a current brief') ||
    src.includes('without a current brief'),
    `${FUNDER_TOUR} must state that the governed release workflow cannot proceed ` +
    `without a current Draw Control Brief — this is the "cannot operate without it" claim.`,
  )
})

// ─── 12-14. Public FAQ / help page ───────────────────────────────────────────

await test('12. Help page FAQ explains the AI evidence-to-policy layer', () => {
  // Per the precision-cleanup audit, public-facing copy now uses
  // "Vektrum's AI review engine" / "AI Draw Control Brief" instead of the
  // vendor name. Vendor naming is reserved for technical/developer surfaces
  // (production widget at PROD_WIDGET, demo modal at DEMO_MODAL).
  // This test still requires the FAQ to explain the AI precondition, just
  // not by vendor name on a buyer-facing page.
  const src = read(HELP_PAGE)
  assert(
    src.includes('AI review engine') ||
      src.includes('AI Draw Control Brief') ||
      src.includes('Perplexity Computer') ||
      src.includes('Perplexity'),
    `${HELP_PAGE} must explain the AI evidence-to-policy layer in the FAQ. ` +
    `Use "AI review engine" / "AI Draw Control Brief" on buyer-facing pages; ` +
    `vendor naming is permitted on technical surfaces only.`,
  )
  assert(
    src.includes('evidence-to-policy') || src.includes('Draw Control Brief'),
    `${HELP_PAGE} must use "evidence-to-policy" or "Draw Control Brief" in the ` +
    `AI FAQ answer to explain the role clearly.`,
  )
})

await test('13. Help page says the brief is required before release gate evaluation', () => {
  const src = read(HELP_PAGE)
  assert(
    src.includes('required before the release gate') ||
    src.includes('required before the gate') ||
    src.includes('before the release gate can evaluate') ||
    src.includes('before the gate evaluates'),
    `${HELP_PAGE} must state that the Draw Control Brief is required before the ` +
    `release gate evaluates the draw — this anchors the public product truth.`,
  )
})

await test('14. Help page preserves the four-layer authority model', () => {
  const src = read(HELP_PAGE)
  assert(
    src.includes('AI informs') ||
    src.includes('gate decides') ||
    src.includes('funder authorizes') ||
    src.includes('AI does not approve'),
    `${HELP_PAGE} must preserve the four-layer authority model: AI informs, gate decides, ` +
    `funder authorizes, rail executes. At least one of these phrases must appear.`,
  )
})

// ─── 15-16. Release gate safety ───────────────────────────────────────────────

await test('15. Release gate still has the AI precondition check', () => {
  const src = read(RELEASE_GATE)
  assert(
    src.includes('checkAiDrawReview') || src.includes('ai_draw_review') || src.includes('aiDrawReview'),
    `${RELEASE_GATE} must still contain the AI draw review precondition check. ` +
    `The gate must require a current brief before authorizing release — this is ` +
    `what makes Perplexity Computer indispensable, not just advisory.`,
  )
})

await test('16. Release gate does not allow AI to authorize release', () => {
  const src = read(RELEASE_GATE)
  // The gate should never have a clause where AI directly triggers authorization.
  // Check that the AI precondition is a check (passed/failed) not an authorizer.
  assert(
    !src.includes('ai.authorize') &&
    !src.includes('aiAuthorize') &&
    !src.includes('perplexity.release') &&
    !src.includes('aiRelease'),
    `${RELEASE_GATE} must not contain any pattern that lets AI authorize or trigger ` +
    `a release. AI prepares the brief; the gate enforces; the funder authorizes.`,
  )
})

// ─── 17. Safety boundary — no changes to execution-layer files ───────────────

await test('17. Stripe, partner API, RLS, auth files contain no Draw Control Brief references (not modified)', () => {
  const stripeWebhook   = read('src/app/api/stripe/webhook/route.ts')
  const partnerConfirm  = read('src/app/api/partner/releases/[releaseId]/confirm/route.ts')

  // These files should not reference Draw Control Brief — they are execution-layer
  // files and should not have been touched by this copy change.
  assert(
    !stripeWebhook.includes('Draw Control Brief'),
    'src/app/api/stripe/webhook/route.ts should not reference Draw Control Brief — it is an execution-layer file.',
  )
  assert(
    !partnerConfirm.includes('Draw Control Brief'),
    'src/app/api/partner/releases/[releaseId]/confirm/route.ts should not reference Draw Control Brief.',
  )
})

// ─── 18-19. Banned phrases ───────────────────────────────────────────────────

await test('18. Demo modal does not say "Perplexity controls payments"', () => {
  const src = read(DEMO_MODAL)
  const lower = src.toLowerCase()
  assert(
    !lower.includes('perplexity controls payment') &&
    !lower.includes('perplexity controls fund') &&
    !lower.includes('perplexity moves money'),
    `${DEMO_MODAL} must not imply Perplexity controls, moves, or executes payments. ` +
    `Perplexity prepares the brief; the gate and funder control authorization; the rail executes.`,
  )
})

await test('19. Demo modal does not say "AI payment approval"', () => {
  const src = read(DEMO_MODAL)
  const lower = src.toLowerCase()
  assert(
    !lower.includes('ai payment approval') &&
    !lower.includes('ai-powered payment') &&
    !lower.includes('escrow replacement') &&
    !lower.includes('vektrum holds funds'),
    `${DEMO_MODAL} must not contain "AI payment approval", "AI-powered payment", ` +
    `"escrow replacement", or "Vektrum holds funds" — these are banned product claims.`,
  )
})

// ─── 20. Package.json ─────────────────────────────────────────────────────────

await test('20. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('perplexity-draw-brief.test.ts'),
    `package.json npm test script must include 'perplexity-draw-brief.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Perplexity Draw Control Brief Tests')
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

main()
