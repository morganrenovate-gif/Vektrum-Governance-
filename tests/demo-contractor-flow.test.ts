/**
 * Demo-live contractor submit-for-review flow tests
 *
 * Pins the contractor's role boundary on the Harbor deal page:
 *   - Contractor CAN submit a draw/work package for review.
 *   - Contractor CANNOT release funds.
 *   - Funder authorizes release; that path stays separate and intact.
 *
 *   A. CANONICAL FIXED POINTS (the demo story)
 *      A1. Building Envelope (ms-hb-4) starts in_progress (the contractor target)
 *      A2. Structural Steel (ms-hb-3) stays approved — funder release demo intact
 *      A3. ms-hb-4 is the FIRST in_progress milestone in canonical order
 *
 *   B. SUBMIT-FOR-REVIEW WIRING IN harbor/page.tsx
 *      B1. Imports DrawRequestModal
 *      B2. Has a submitModal state and a setSubmitModal call
 *      B3. Renders a "Submit for Review" button for in_progress + contractor view
 *      B4. The submit branch is gated by `submittableMilestoneId` so only the
 *          first in_progress milestone shows the button
 *      B5. onConfirm overrides the milestone status to 'ready_for_review'
 *      B6. submitModal is reset by useDemoAutoReset
 *
 *   C. CONTRACTOR ROLE BOUNDARY
 *      C1. Release Funds button is gated by `from !== 'contractor'`
 *      C2. Contractor view shows "Awaiting Funder Release" pill for approved
 *      C3. ready_for_review status renders an "Awaiting … Review" pill (not a
 *          contractor-clickable submit button — re-submission must not appear
 *          as the same affordance)
 *
 *   D. FUNDER FLOW UNCHANGED
 *      D1. ReleaseFundsModal still wired to ms-hb-3 (Structural Steel)
 *      D2. Release Funds button still renders for from=funder + approved
 *
 *   E. AUTO-RESET RESTORES CONTRACTOR FLOW
 *      E1. The useDemoAutoReset call clears submitModal and overrides — so a
 *          fresh visit shows Building Envelope as in_progress + submittable.
 *
 * Run:  npx tsx tests/demo-contractor-flow.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { harbor } from '../src/lib/demo-data/index'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function src(rel: string) {
  return readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

const HARBOR_PAGE = src('src/app/demo-live/deal/harbor/page.tsx')

const results: { name: string; passed: boolean; error?: string }[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// ─── A. CANONICAL FIXED POINTS ───────────────────────────────────────────────

test('A1: Building Envelope (ms-hb-4) starts in_progress', () => {
  const ms = harbor.milestones.find((m) => m.id === 'ms-hb-4')!
  assert(ms.status === 'in_progress',
    `ms-hb-4 status is "${ms.status}", expected "in_progress" (contractor submission target)`)
})

test('A2: Structural Steel (ms-hb-3) stays approved — funder release demo intact', () => {
  const ms = harbor.milestones.find((m) => m.id === 'ms-hb-3')!
  assert(ms.status === 'approved',
    `ms-hb-3 status is "${ms.status}", expected "approved" — contractor demo must not break funder release demo`)
})

test('A3: Building Envelope is the FIRST in_progress milestone in canonical order', () => {
  const firstInProgress = harbor.milestones.find((m) => m.status === 'in_progress')
  assert(firstInProgress !== undefined, 'no in_progress milestone found in Harbor canonical data')
  assert(firstInProgress.id === 'ms-hb-4',
    `first in_progress milestone is "${firstInProgress.id}", expected "ms-hb-4" (Building Envelope)`)
})

// ─── B. SUBMIT-FOR-REVIEW WIRING ─────────────────────────────────────────────

test('B1: harbor/page.tsx imports DrawRequestModal', () => {
  assert(HARBOR_PAGE.includes("from '@/components/demo/DrawRequestModal'"),
    'harbor/page.tsx does not import DrawRequestModal')
})

test('B2: harbor/page.tsx has submitModal state', () => {
  assert(HARBOR_PAGE.includes('submitModal') && HARBOR_PAGE.includes('setSubmitModal'),
    'harbor/page.tsx does not declare submitModal state')
})

test('B3: harbor/page.tsx renders a "Submit for Review" button', () => {
  assert(HARBOR_PAGE.includes('Submit for Review'),
    'harbor/page.tsx does not render a "Submit for Review" button')
})

test('B4: submit button is gated by submittableMilestoneId (first-in-progress only)', () => {
  // The button must reference both `from === 'contractor'` and the
  // submittableMilestoneId guard so only one milestone gets the affordance.
  assert(HARBOR_PAGE.includes('submittableMilestoneId'),
    'harbor/page.tsx does not compute submittableMilestoneId — Submit button could appear on multiple milestones')
  assert(HARBOR_PAGE.includes("ms.id === submittableMilestoneId"),
    'Submit button is not gated by ms.id === submittableMilestoneId')
})

test('B5: submit onConfirm overrides milestone status to ready_for_review', () => {
  // The onConfirm handler attached to the submit modal must transition state.
  assert(HARBOR_PAGE.includes("'ready_for_review'") || HARBOR_PAGE.includes('"ready_for_review"'),
    'harbor/page.tsx does not transition the submitted milestone to ready_for_review')
})

test('B6: useDemoAutoReset clears submitModal', () => {
  // Find the useDemoAutoReset block and assert it clears submitModal.
  const idx = HARBOR_PAGE.indexOf('useDemoAutoReset(')
  assert(idx !== -1, 'useDemoAutoReset call not found in harbor/page.tsx')
  // Slice a window large enough to capture the callback body.
  const block = HARBOR_PAGE.slice(idx, idx + 600)
  assert(block.includes('setSubmitModal(null)'),
    'useDemoAutoReset callback does not call setSubmitModal(null) — submit modal may survive reset')
})

// ─── C. CONTRACTOR ROLE BOUNDARY ─────────────────────────────────────────────

test('C1: Release Funds button is gated by from !== "contractor"', () => {
  assert(HARBOR_PAGE.includes("from !== 'contractor'"),
    'Release Funds button is not gated against contractor role — contractor could see release control')
})

test('C2: contractor view of approved shows "Awaiting Funder Release" pill', () => {
  assert(HARBOR_PAGE.includes('Awaiting Funder Release'),
    'contractor view of approved milestone is missing the "Awaiting Funder Release" pill')
})

test('C3: ready_for_review renders an "Awaiting … Review" pill, not a clickable submit', () => {
  assert(
    HARBOR_PAGE.includes('Submitted — Awaiting Funder Review') ||
    HARBOR_PAGE.includes('Awaiting Your Review'),
    'ready_for_review state does not render a review-pending pill',
  )
  // The Submit button for in_progress must not also render for ready_for_review
  // — verify the button branch is scoped to in_progress.
  assert(HARBOR_PAGE.includes("status === 'in_progress' && from === 'contractor' && ms.id === submittableMilestoneId"),
    'Submit for Review button is not strictly gated to in_progress + contractor + first-submittable')
})

// ─── D. FUNDER FLOW UNCHANGED ────────────────────────────────────────────────

test('D1: ReleaseFundsModal still wired to Structural Steel (ms-hb-3)', () => {
  assert(HARBOR_PAGE.includes("'Structural Steel Erection'") && HARBOR_PAGE.includes('2_180_000'),
    'ReleaseFundsModal lost its Structural Steel wiring')
  assert(HARBOR_PAGE.includes("'ms-hb-3': 'released'"),
    'ReleaseFundsModal onConfirm no longer overrides ms-hb-3 to released')
})

test('D2: Release Funds button still renders for non-contractor approved view', () => {
  assert(HARBOR_PAGE.includes('Release Funds'),
    'Release Funds button removed from harbor/page.tsx — funder demo is broken')
})

// ─── E. AUTO-RESET ───────────────────────────────────────────────────────────

test('E1: auto-reset clears overrides + submitModal so Building Envelope is again submittable', () => {
  // The useDemoAutoReset callback must clear both pieces of state. We verified
  // submitModal in B6; assert overrides reset here.
  const idx = HARBOR_PAGE.indexOf('useDemoAutoReset(')
  const block = HARBOR_PAGE.slice(idx, idx + 600)
  assert(block.includes('setOverrides({})'),
    'useDemoAutoReset callback does not clear overrides — submit override could persist')
})

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — DEMO CONTRACTOR FLOW TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
