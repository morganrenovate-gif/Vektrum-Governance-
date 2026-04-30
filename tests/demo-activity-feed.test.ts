/**
 * Demo-live Harbor activity feed tests
 *
 * Confirms that the visible Activity section on /demo-live/deal/harbor
 * appends a release-authorized entry when the funder confirms a release —
 * the signal Demosmith looks for to verify the demo flow.
 *
 * IMPORTANT: this is a demo-state-only test. It exercises the visible
 * activity feed in `harbor/page.tsx`. It does NOT touch the production
 * `audit_log` database — that is covered by audit-p0-coverage.test.ts and
 * audit-p1-auth-onboarding.test.ts.
 *
 *   A. STATE WIRING
 *      A1. harbor/page.tsx declares releaseEvents state
 *      A2. ReleaseFundsModal onConfirm appends a release-authorized event
 *      A3. The appended event includes the milestone name + audit-evidence
 *          language + a "Just now" timestamp
 *      A4. The appended event is rendered in the Activity Timeline section
 *      A5. useDemoAutoReset clears releaseEvents (so refresh / reset returns
 *          to canonical state)
 *
 *   B. CONTRACTOR FLOW PARITY
 *      B1. DrawRequestModal onConfirm also appends an audit-evidence event
 *          (so contractor submission produces equivalent visible evidence)
 *
 *   C. PRODUCTION-AUDIT ISOLATION
 *      C1. harbor/page.tsx does not import from src/lib/engine/audit
 *      C2. harbor/page.tsx does not call logAudit / logAdminAudit
 *      C3. harbor/page.tsx does not fetch any /api/* route from this flow
 *
 *   D. RECORDING-MODE COMPATIBILITY
 *      D1. The Activity section is not gated behind a recording-mode check
 *          (the feed must remain visible whether or not ?recording=1 is set)
 *
 * Run:  npx tsx tests/demo-activity-feed.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function src(rel: string) {
  return readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

const HARBOR = src('src/app/(marketing)/demo-live/deal/harbor/page.tsx')

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

// ─── A. STATE WIRING ─────────────────────────────────────────────────────────

test('A1: harbor/page.tsx declares releaseEvents state', () => {
  assert(
    HARBOR.includes('releaseEvents') && HARBOR.includes('setReleaseEvents'),
    'harbor/page.tsx is missing the releaseEvents useState — activity feed cannot update',
  )
})

test('A2: ReleaseFundsModal onConfirm appends a release-authorized event', () => {
  // Find the ReleaseFundsModal block, then assert it pushes onto releaseEvents.
  const releaseIdx = HARBOR.indexOf('<ReleaseFundsModal')
  assert(releaseIdx !== -1, 'ReleaseFundsModal not found in harbor/page.tsx')
  // Walk to the closing tag to scope the assertion to this modal only.
  const closeIdx = HARBOR.indexOf('/>', releaseIdx)
  const block = HARBOR.slice(releaseIdx, closeIdx)
  assert(
    block.includes('setReleaseEvents'),
    'ReleaseFundsModal onConfirm does not call setReleaseEvents — activity feed will not update on release',
  )
  assert(
    block.includes('Release authorized'),
    'ReleaseFundsModal appended event does not use "Release authorized" language',
  )
})

test('A3: appended release event includes milestone name, audit evidence, and "Just now"', () => {
  // Search the entire file for the appended event literal — it must mention
  // the canonical milestone for the demo (Structural Steel Erection), the
  // word "audit" and "Just now" as a relative timestamp.
  assert(
    HARBOR.includes('Structural Steel Erection'),
    'release event must reference the milestone name "Structural Steel Erection"',
  )
  // Expected language — at least one of these audit/proof markers must appear
  // in the appended event literal.
  assert(
    HARBOR.includes('audit evidence recorded') ||
    HARBOR.includes('audit log') ||
    HARBOR.includes('audit trail'),
    'release event must include audit / proof language',
  )
  assert(
    HARBOR.includes("'Just now'") || HARBOR.includes('"Just now"'),
    'release event must use "Just now" as the timestamp so Demosmith can identify the new entry',
  )
  assert(
    HARBOR.includes('funder authorized release') ||
    HARBOR.includes('Funder authorized release'),
    'release event should explicitly state the funder authorized the release',
  )
})

test('A4: appended events are rendered in the Activity Timeline section', () => {
  // The Activity Timeline section must spread releaseEvents into its event list.
  // We look for the canonical pattern: `...releaseEvents` inside the Activity
  // section's JSX.
  const activityIdx = HARBOR.indexOf('Activity Timeline')
  assert(activityIdx !== -1, 'Activity Timeline section not found')
  const sectionEnd = HARBOR.indexOf('</section>', activityIdx)
  const block = HARBOR.slice(activityIdx, sectionEnd)
  assert(
    block.includes('...releaseEvents'),
    'Activity Timeline does not spread releaseEvents into its event list — appended events will not render',
  )
})

test('A5: useDemoAutoReset clears releaseEvents (refresh / reset returns canonical)', () => {
  const idx = HARBOR.indexOf('useDemoAutoReset(')
  assert(idx !== -1, 'useDemoAutoReset call not found')
  const block = HARBOR.slice(idx, idx + 700)
  assert(
    block.includes('setReleaseEvents([])'),
    'useDemoAutoReset callback does not clear releaseEvents — appended events would persist across reset / refresh',
  )
})

// ─── B. CONTRACTOR FLOW PARITY ───────────────────────────────────────────────

test('B1: DrawRequestModal onConfirm also appends an audit-evidence event', () => {
  const drawIdx = HARBOR.indexOf('<DrawRequestModal')
  assert(drawIdx !== -1, 'DrawRequestModal not found in harbor/page.tsx')
  const closeIdx = HARBOR.indexOf('/>', drawIdx)
  const block = HARBOR.slice(drawIdx, closeIdx)
  assert(
    block.includes('setReleaseEvents'),
    'DrawRequestModal onConfirm does not append an activity event for contractor submission',
  )
  assert(
    block.includes('audit evidence recorded') || block.includes('audit log'),
    'Contractor-submission activity event should include audit/proof language',
  )
})

// ─── C. PRODUCTION-AUDIT ISOLATION ───────────────────────────────────────────

test('C1: harbor/page.tsx does not import from src/lib/engine/audit', () => {
  // The visible activity feed must be 100% client-side state. Importing the
  // production audit module from a demo page would risk demo flows triggering
  // real audit_log writes.
  assert(
    !HARBOR.includes("from '@/lib/engine/audit'"),
    'harbor/page.tsx must not import from @/lib/engine/audit — demo flows must not write to production audit_log',
  )
})

test('C2: harbor/page.tsx does not call logAudit / logAdminAudit', () => {
  assert(
    !HARBOR.includes('logAudit(') && !HARBOR.includes('logAdminAudit('),
    'harbor/page.tsx must not call logAudit/logAdminAudit — demo flows are frontend state only',
  )
})

test('C3: harbor/page.tsx does not fetch any production /api/ route', () => {
  // Demo pages must not hit production API routes. The existing demo-reset
  // POST is acceptable (it is the safety-gated demo reset endpoint and
  // already covered by demo-reset-safety tests), but we assert no /api/ fetch
  // appears in this file at all — the harbor page owns no fetches.
  assert(
    !HARBOR.includes("fetch('/api/") && !HARBOR.includes('fetch("/api/'),
    'harbor/page.tsx must not call any /api/ endpoint — demo state is frontend-only',
  )
})

// ─── D. RECORDING-MODE COMPATIBILITY ─────────────────────────────────────────

test('D1: Activity section is not gated behind a recording-mode check', () => {
  // The Activity Timeline render must NOT be wrapped in a `recording`-style
  // conditional. Recording mode hides only the manual reset button, not the
  // demo content.
  const activityIdx = HARBOR.indexOf('Activity Timeline')
  assert(activityIdx !== -1, 'Activity Timeline marker not found')
  // Walk back ~400 chars to look for any conditional wrapper that would hide
  // the section under recording mode.
  const before = HARBOR.slice(Math.max(0, activityIdx - 400), activityIdx)
  assert(
    !before.includes('recording') && !before.includes('demosmith'),
    'Activity Timeline appears to be gated behind a recording-mode check — must remain visible in all modes',
  )
})

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — DEMO ACTIVITY FEED TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
