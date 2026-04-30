/**
 * Demo funder guided walkthrough — safety and copy tests.
 *
 * Static source-parse checks — no rendering, no live server.
 * Ensures the ?tour=1 walkthrough mode is:
 *   1. Correctly wired to the query param (not always-on).
 *   2. Copy-safe: no escrow, funds-held, moves-wires, or AI-approves claims.
 *   3. Production-safe: no real API, Supabase, Stripe, or email calls.
 *   4. Properly integrated into the funder page.
 *   5. Conditionally rendered (returns null when tour is inactive).
 *
 * Checks:
 *  1.  DemoFunderTour component exists.
 *  2.  Component reads ?tour=1 from the URL (not hardcoded active).
 *  3.  Component returns null when tour is not active.
 *  4.  Funder page imports DemoFunderTour.
 *  5.  Funder page renders DemoFunderTour in its JSX.
 *  6.  Tour copy mentions "simulated" or "no real funds".
 *  7.  Tour copy says AI informs / cannot approve (not "AI approves").
 *  8.  Tour copy does not say Vektrum holds funds, acts as escrow, or moves wires.
 *  9.  Tour copy does not say "AI approves" payments or releases.
 * 10.  No Supabase client import in the tour component.
 * 11.  No Stripe import in the tour component.
 * 12.  No /api/ fetch call in the tour component.
 * 13.  No email/notification call in the tour component.
 * 14.  Tour has at least 5 steps (TOUR_STEPS array).
 * 15.  Tour has Next / Back / End Tour controls.
 * 16.  Tour has an "Exit walkthrough" control.
 *
 * Run:  npx tsx tests/demo-walkthrough.test.ts
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

/** Strip JSX comments and string literals for write-verb checks */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ')
}

const TOUR_COMPONENT = 'src/components/demo/DemoFunderTour.tsx'
const FUNDER_PAGE    = 'src/app/(marketing)/demo-live/funder/page.tsx'

async function main() {

// ─── 1. Tour component file exists ───────────────────────────────────────────

await test('1. DemoFunderTour component file exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, TOUR_COMPONENT)),
    `${TOUR_COMPONENT} does not exist. Create the DemoFunderTour component.`,
  )
})

// ─── 2. Tour reads ?tour=1 from URL (not hardcoded active) ───────────────────

await test('2. Component detects tour via URL param, not hardcoded', () => {
  const src = read(TOUR_COMPONENT)
  // Must read 'tour' from URLSearchParams or window.location.search
  assert(
    src.includes("get('tour')") || src.includes('get("tour")') ||
    src.includes("params.get('tour')") || src.includes('URLSearchParams'),
    `${TOUR_COMPONENT} must detect ?tour=1 via URLSearchParams — do not hardcode tourActive = true.`,
  )
  // Must NOT hardcode setTourActive(true) without the param check
  // (simple guard: param check must exist alongside setTourActive)
  assert(
    src.includes('setTourActive'),
    `${TOUR_COMPONENT} must have setTourActive state setter.`,
  )
})

// ─── 3. Component returns null when tour is inactive ─────────────────────────

await test('3. Component returns null when tour is not active', () => {
  const src = read(TOUR_COMPONENT)
  assert(
    src.includes('if (!tourActive) return null') ||
    src.includes('if (!tourActive)\n    return null') ||
    src.includes('!tourActive') && src.includes('return null'),
    `${TOUR_COMPONENT} must return null when the tour is inactive so normal demo use is unaffected.`,
  )
})

// ─── 4. Funder page imports DemoFunderTour ────────────────────────────────────

await test('4. Funder page imports DemoFunderTour', () => {
  const src = read(FUNDER_PAGE)
  assert(
    src.includes('DemoFunderTour'),
    `${FUNDER_PAGE} must import and use the DemoFunderTour component.`,
  )
})

// ─── 5. Funder page renders DemoFunderTour in JSX ────────────────────────────

await test('5. Funder page renders <DemoFunderTour /> in JSX', () => {
  const src = read(FUNDER_PAGE)
  assert(
    src.includes('<DemoFunderTour'),
    `${FUNDER_PAGE} must render <DemoFunderTour /> in its JSX.`,
  )
})

// ─── 6. Tour copy says "simulated" or "no real funds" ────────────────────────

await test('6. Tour copy mentions "simulated" or "no real funds"', () => {
  const src = collapse(read(TOUR_COMPONENT))
  assert(
    src.toLowerCase().includes('simulated') ||
    src.toLowerCase().includes('no real funds'),
    `${TOUR_COMPONENT} tour copy must say data is "simulated" or clarify "no real funds". ` +
    'Step 1 must establish the demo context.',
  )
})

// ─── 7. Tour says AI informs but cannot approve ───────────────────────────────

await test('7. Tour copy says AI informs / cannot approve (not "AI approves")', () => {
  const src = collapse(read(TOUR_COMPONENT))
  assert(
    src.toLowerCase().includes('cannot approve') ||
    src.toLowerCase().includes('does not approve') ||
    src.toLowerCase().includes('informs') ||
    src.toLowerCase().includes('gate decides'),
    `${TOUR_COMPONENT} tour copy must state that AI informs but does not approve releases. ` +
    'The release gate is deterministic; AI is pre-review only.',
  )
})

// ─── 8. No funds-held / escrow / moves-wires claims ─────────────────────────

await test('8. Tour copy does not say Vektrum holds funds, is escrow, or moves wires', () => {
  const src = collapse(read(TOUR_COMPONENT))
  const forbidden = [
    'vektrum holds funds',
    'vektrum holds your funds',
    'vektrum-held funds',
    'vektrum is escrow',
    'vektrum acts as escrow',
    'escrow replacement',
    'vektrum moves wires',
    'vektrum sends wires',
    'wire transfer via vektrum',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${TOUR_COMPONENT} contains forbidden phrase "${phrase}". ` +
      'Remove — Vektrum does not hold funds, is not escrow, and does not move wires.',
    )
  }
})

// ─── 9. No "AI approves" claim ───────────────────────────────────────────────

await test('9. Tour copy does not say "AI approves" payments or releases', () => {
  const src = collapse(read(TOUR_COMPONENT))
  const forbidden = [
    'ai approves',
    'ai-approved',
    'ai will approve',
    'ai approved the release',
    'approved by ai',
    'automatically approved by',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${TOUR_COMPONENT} contains "${phrase}" — AI informs; the gate decides. ` +
      'Do not describe AI as approving payments.',
    )
  }
})

// ─── 10. No Supabase import ───────────────────────────────────────────────────

await test('10. DemoFunderTour does not import Supabase', () => {
  const src = read(TOUR_COMPONENT)
  assert(
    !src.includes('@supabase') && !src.includes('createClient') && !src.includes('supabase'),
    `${TOUR_COMPONENT} must not import or use Supabase. The tour is client-side demo only.`,
  )
})

// ─── 11. No Stripe import ────────────────────────────────────────────────────

await test('11. DemoFunderTour does not import the Stripe SDK', () => {
  // "Stripe" may appear in copy (e.g. "Stripe Connect") — that is safe and expected.
  // This test guards only against importing or calling the Stripe SDK.
  const code = codeOnly(read(TOUR_COMPONENT))
  assert(
    !code.includes("from 'stripe'") &&
    !code.includes('from "stripe"') &&
    !code.includes("require('stripe')") &&
    !code.includes('require("stripe")') &&
    !code.includes('new Stripe(') &&
    !code.includes('stripe.'),
    `${TOUR_COMPONENT} must not import or instantiate the Stripe SDK. The tour is client-side demo only.`,
  )
})

// ─── 12. No /api/ fetch calls ────────────────────────────────────────────────

await test('12. DemoFunderTour does not make /api/ fetch calls', () => {
  const src = codeOnly(read(TOUR_COMPONENT))
  assert(
    !src.includes('/api/'),
    `${TOUR_COMPONENT} must not make /api/ fetch calls. The tour is client-side demo only — no production requests.`,
  )
})

// ─── 13. No email/notification calls ─────────────────────────────────────────

await test('13. DemoFunderTour does not call email or notification APIs', () => {
  const code = codeOnly(read(TOUR_COMPONENT))
  const forbidden = ['sendEmail', 'resend', 'sendgrid', 'notify(', 'sendNotification']
  for (const fn of forbidden) {
    assert(
      !code.toLowerCase().includes(fn.toLowerCase()),
      `${TOUR_COMPONENT} must not call email/notification APIs. Found "${fn}".`,
    )
  }
})

// ─── 14. At least 5 tour steps ───────────────────────────────────────────────

await test('14. Tour has at least 5 steps in TOUR_STEPS', () => {
  const src = read(TOUR_COMPONENT)
  // Count step objects: each has a stepLabel field
  const matches = src.match(/stepLabel:/g)
  const count   = matches ? matches.length : 0
  assert(
    count >= 5,
    `${TOUR_COMPONENT} has ${count} tour steps — minimum 5 required. ` +
    'Add steps covering: simulated env, evidence review, AI, release gate, disputes, activity log, payment rail.',
  )
})

// ─── 15. Next / Back / End Tour controls ─────────────────────────────────────

await test('15. Tour has Next, Back, and End Tour controls', () => {
  const src = collapse(read(TOUR_COMPONENT))
  assert(
    src.includes('Next') || src.includes('"Next"'),
    `${TOUR_COMPONENT} must have a "Next" button to advance the tour.`,
  )
  assert(
    src.includes('Back') || src.includes('"Back"'),
    `${TOUR_COMPONENT} must have a "Back" button to go to the previous step.`,
  )
  assert(
    src.includes('End Tour') || src.includes('"End Tour"'),
    `${TOUR_COMPONENT} must have an "End Tour" button on the last step.`,
  )
})

// ─── 16. Exit walkthrough control ────────────────────────────────────────────

await test('16. Tour has an "Exit walkthrough" control', () => {
  const src = collapse(read(TOUR_COMPONENT))
  assert(
    src.includes('Exit walkthrough') || src.includes('Exit Walkthrough'),
    `${TOUR_COMPONENT} must have an "Exit walkthrough" button or link so the user can dismiss the tour at any step.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — DEMO FUNDER GUIDED WALKTHROUGH TEST RESULTS')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter((r) => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)

} // end main()

main()
