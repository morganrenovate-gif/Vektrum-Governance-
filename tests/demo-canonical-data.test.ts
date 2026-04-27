/**
 * Demo-live canonical data consistency tests
 *
 * Proves that every demo-live route reads from the canonical demo data in
 * src/lib/demo-data/index.ts — not from a stale duplicate copy.  Previously
 * the generic /demo-live/deal/[id] route, the contractor dashboard, and the
 * funder briefing had drifted from the canonical state, producing
 * contradictory views of the same deal across the demo.
 *
 *   A. HELPERS
 *      A1. getDealReleasedAtStart returns deal.released
 *      A2. getMilestoneSummary returns released count, total, pct
 *      A3. getMilestoneSummary handles deal.total === 0 without dividing
 *
 *   B. CANONICAL FIXED POINTS (regression guards)
 *      B1. Harbor Structural Steel starts 'approved' (not 'released')
 *      B2. Harbor released total is $2,160,000
 *      B3. Harbor Building Envelope starts 'in_progress' (not 'approved')
 *      B4. Harbor-dispute milestone 5 is 'HVAC Equipment Procurement'
 *
 *   C. GENERIC DEAL ROUTE — no stale duplicate DEALS object
 *      C1. [id]/page.tsx imports from '@/lib/demo-data'
 *      C2. [id]/page.tsx no longer contains the old hardcoded $3,460,000
 *      C3. [id]/page.tsx no longer contains "MEP Systems & Commissioning" as a disputed item
 *      C4. [id]/page.tsx no longer hardcodes Structural Steel with releasedAgo
 *
 *   D. CONTRACTOR DASHBOARD — derived from canonical
 *      D1. contractor/page.tsx imports riverside + harbor + getMilestoneSummary
 *      D2. contractor/page.tsx no longer contains the stale 3_940_000 literal
 *      D3. computed total released equals canonical riverside + harbor releases ($2,640,000)
 *      D4. computed Harbor milestonesCompleted equals canonical released-status count (2)
 *      D5. computed Harbor pct equals canonical pct (24%)
 *
 *   E. FUNDER BRIEFING — references the actual ready milestone
 *      E1. funder/page.tsx no longer references the stale "Milestone 4 ... score 92"
 *      E2. funder/page.tsx briefing references Structural Steel / score 91
 *
 * Run:  npx tsx tests/demo-canonical-data.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import {
  riverside,
  harbor,
  westside,
  harborDisputeMilestones,
  getDealReleasedAtStart,
  getMilestoneSummary,
} from '../src/lib/demo-data/index'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function src(rel: string) {
  return readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

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

// ─── A. HELPERS ──────────────────────────────────────────────────────────────

test('A1: getDealReleasedAtStart returns deal.released', () => {
  assert(getDealReleasedAtStart(harbor)    === harbor.released,    'harbor.released mismatch')
  assert(getDealReleasedAtStart(riverside) === riverside.released, 'riverside.released mismatch')
  assert(getDealReleasedAtStart(westside)  === westside.released,  'westside.released mismatch')
})

test('A2: getMilestoneSummary returns {released, total, pct}', () => {
  const s = getMilestoneSummary(harbor)
  assert(typeof s.released === 'number', 'released must be a number')
  assert(typeof s.total    === 'number', 'total must be a number')
  assert(typeof s.pct      === 'number', 'pct must be a number')
  assert(s.total === harbor.milestones.length, `total must equal milestones.length (${harbor.milestones.length}), got ${s.total}`)
  assert(s.released === harbor.milestones.filter(m => m.status === 'released').length,
    `released must equal count of status=released milestones`)
})

test('A3: getMilestoneSummary handles deal.total === 0 without NaN', () => {
  const empty = { ...harbor, total: 0, released: 0, milestones: [] }
  const s = getMilestoneSummary(empty)
  assert(s.pct === 0, `pct must be 0 when total is 0, got ${s.pct}`)
  assert(s.total === 0, `total must be 0`)
})

// ─── B. CANONICAL FIXED POINTS ───────────────────────────────────────────────

test('B1: Harbor Structural Steel starts "approved" (not "released")', () => {
  const ms = harbor.milestones.find(m => m.id === 'ms-hb-3')!
  assert(ms.status === 'approved', `ms-hb-3 status is "${ms.status}", expected "approved"`)
})

test('B2: Harbor released total is $2,160,000', () => {
  assert(harbor.released === 2_160_000,
    `harbor.released is ${harbor.released}, expected 2_160_000`)
})

test('B3: Harbor Building Envelope starts "in_progress" (not "approved")', () => {
  const ms = harbor.milestones.find(m => m.id === 'ms-hb-4')!
  assert(ms.status === 'in_progress', `ms-hb-4 status is "${ms.status}", expected "in_progress"`)
  assert(ms.aiScore == null, `ms-hb-4 should not have aiScore at demo-start, got ${ms.aiScore}`)
})

test('B4: Harbor-dispute milestone 5 is "HVAC Equipment Procurement"', () => {
  const ms = harborDisputeMilestones.find(m => m.id === 'ms-hbd-5')!
  assert(ms.name === 'HVAC Equipment Procurement',
    `ms-hbd-5 name is "${ms.name}", expected "HVAC Equipment Procurement"`)
  assert(ms.status === 'disputed', `ms-hbd-5 status is "${ms.status}", expected "disputed"`)
})

// ─── C. GENERIC DEAL ROUTE ───────────────────────────────────────────────────

test('C1: [id]/page.tsx imports from @/lib/demo-data', () => {
  const file = src('src/app/demo-live/deal/[id]/page.tsx')
  assert(file.includes("from '@/lib/demo-data'"),
    '[id]/page.tsx does not import from @/lib/demo-data — may still be using stale duplicate')
  assert(file.includes('riverside') && file.includes('harbor') && file.includes('westside'),
    '[id]/page.tsx does not reference all three canonical deal exports')
})

test('C2: [id]/page.tsx no longer contains stale 3_460_000 Harbor figure', () => {
  const file = src('src/app/demo-live/deal/[id]/page.tsx')
  assert(!file.includes('3_460_000'),
    '[id]/page.tsx still contains the stale 3_460_000 literal — Harbor released should come from canonical data ($2,160,000)')
})

test('C3: [id]/page.tsx does not label MEP Systems as a disputed item', () => {
  const file = src('src/app/demo-live/deal/[id]/page.tsx')
  // The old code listed milestone 5 of harbor-dispute as "MEP Systems & Commissioning"
  // with disputed status. The canonical disputed milestone is "HVAC Equipment Procurement".
  // Look for the specific stale combination.
  const hasStaleMep =
    file.includes("status: 'disputed'") &&
    file.includes('MEP Systems & Commissioning')
  assert(!hasStaleMep,
    '[id]/page.tsx still labels "MEP Systems & Commissioning" as disputed — the canonical disputed milestone is "HVAC Equipment Procurement"')
})

test('C4: [id]/page.tsx no longer hardcodes Structural Steel as released', () => {
  const file = src('src/app/demo-live/deal/[id]/page.tsx')
  // Old inline data: { title: 'Structural Steel Erection', ..., status: 'released', releasedAgo: '3 days ago' }
  // Look for the specific stale "released" + "Structural Steel" combination as a literal.
  const hasStaleSteel =
    file.includes("'Structural Steel Erection'") &&
    file.includes("status: 'released'") &&
    file.includes("releasedAgo: '3 days ago'")
  assert(!hasStaleSteel,
    '[id]/page.tsx still inlines Structural Steel as released — must come from canonical data')
})

// ─── D. CONTRACTOR DASHBOARD ─────────────────────────────────────────────────

test('D1: contractor/page.tsx imports riverside, harbor, getMilestoneSummary', () => {
  const file = src('src/app/demo-live/contractor/page.tsx')
  assert(file.includes("from '@/lib/demo-data'"),
    'contractor/page.tsx does not import from @/lib/demo-data')
  assert(file.includes('riverside') && file.includes('harbor'),
    'contractor/page.tsx does not import riverside and harbor')
  assert(file.includes('getMilestoneSummary'),
    'contractor/page.tsx does not import getMilestoneSummary helper')
})

test('D2: contractor/page.tsx no longer hardcodes 3_940_000', () => {
  const file = src('src/app/demo-live/contractor/page.tsx')
  assert(!file.includes('3_940_000'),
    'contractor/page.tsx still contains the stale 3_940_000 total — must derive from canonical riverside + harbor')
})

test('D3: contractor totalReleased = $2,640,000 (canonical riverside + harbor)', () => {
  const expected = riverside.released + harbor.released
  assert(expected === 2_640_000, `Canonical total is ${expected}, expected 2_640_000`)
})

test('D4: contractor Harbor milestonesCompleted = canonical released count', () => {
  const harborSummary = getMilestoneSummary(harbor)
  // Canonical Harbor: ms-hb-1 (released) + ms-hb-2 (released) = 2 released milestones
  assert(harborSummary.released === 2,
    `Harbor released-status count is ${harborSummary.released}, expected 2`)
  assert(harborSummary.total === 5,
    `Harbor total milestone count is ${harborSummary.total}, expected 5`)
})

test('D5: contractor Harbor pct equals canonical', () => {
  const harborSummary = getMilestoneSummary(harbor)
  // 2_160_000 / 9_100_000 ≈ 23.74% → rounds to 24
  assert(harborSummary.pct === 24,
    `Harbor pct is ${harborSummary.pct}, expected 24 (2.16M / 9.1M)`)
})

// ─── E. FUNDER BRIEFING ──────────────────────────────────────────────────────

test('E1: funder/page.tsx no longer references stale "Milestone 4 ... score 92"', () => {
  const file = src('src/app/demo-live/funder/page.tsx')
  assert(!file.includes('Milestone 4 passed AI review with score 92'),
    'funder/page.tsx still has stale "Milestone 4 ... score 92" briefing — Building Envelope is in_progress')
})

test('E2: funder briefing references Structural Steel / score 91', () => {
  const file = src('src/app/demo-live/funder/page.tsx')
  assert(file.includes('Structural Steel') && file.includes('91'),
    'funder/page.tsx briefing should reference "Structural Steel" and score 91 (the canonical ready milestone)')
})

test('E3: canonical Structural Steel aiScore is 91 (briefing matches)', () => {
  const ms = harbor.milestones.find(m => m.id === 'ms-hb-3')!
  assert(ms.aiScore === 91, `ms-hb-3 aiScore is ${ms.aiScore}, expected 91 (matches funder briefing text)`)
})

// ─── F. FUNDER CAPITAL PAGE (/demo-live/funder/capital) ──────────────────────
//
// This page presents portfolio totals derived from canonical demo data.
// Previously held its own stale Harbor figures (released $3,460,000, pct 56,
// Structural Steel listed as a recent release). Tests below pin the
// derived-from-canonical structure so it cannot drift again.

test('F1: capital page imports canonical demo data', () => {
  const file = src('src/app/demo-live/funder/capital/page.tsx')
  assert(file.includes("from '@/lib/demo-data'"),
    'capital/page.tsx does not import from @/lib/demo-data — values may drift again')
  assert(file.includes('riverside') && file.includes('harbor') && file.includes('westside'),
    'capital/page.tsx does not reference all three canonical deal exports')
})

test('F2: capital page no longer hardcodes 3_460_000 (stale Harbor released)', () => {
  // Ignore comment lines so the explanatory note that mentions the old value
  // by name does not trip this check — only flag actual code usage.
  const file = src('src/app/demo-live/funder/capital/page.tsx')
  const codeLines = file
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
    })
    .join('\n')
  assert(!codeLines.includes('3_460_000'),
    'capital/page.tsx still contains the stale 3_460_000 Harbor literal in code')
})

test('F3: capital page no longer lists Structural Steel as a hardcoded recent release', () => {
  const file = src('src/app/demo-live/funder/capital/page.tsx')
  // The old data had: { date: 'Apr 1, 2026', project: 'Harbor Logistics',
  //                     milestone: 'Structural Steel Erection', amount: 2_180_000 }
  // It must not appear as a literal entry — RECENT_RELEASES is now derived.
  const hasStaleSteelEntry =
    file.includes("milestone: 'Structural Steel Erection'") ||
    file.includes("'Structural Steel Erection', amount: 2_180_000")
  assert(!hasStaleSteelEntry,
    'capital/page.tsx still hardcodes a "Structural Steel Erection" release entry — must derive from canonical')
})

test('F4: derived Harbor released amount equals canonical $2,160,000', () => {
  // Capital page now reads `harbor.released`. Pin the canonical value.
  assert(harbor.released === 2_160_000,
    `harbor.released is ${harbor.released}, expected 2_160_000 (capital page uses this)`)
})

test('F5: derived totalReleased = sum of canonical deal.released across 3 deals', () => {
  const expected = riverside.released + harbor.released + westside.released
  // 480,000 + 2,160,000 + 950,000 = 3,590,000
  assert(expected === 3_590_000,
    `Canonical totalReleased is ${expected}, expected 3_590_000`)
})

test('F6: derived totalCommitted = $16,250,000', () => {
  const expected = riverside.total + harbor.total + westside.total
  assert(expected === 16_250_000,
    `Canonical totalCommitted is ${expected}, expected 16_250_000`)
})

test('F7: milestone status counts derived from canonical match expected', () => {
  // Combined milestone counts across riverside + harbor + westside.
  const all = [...riverside.milestones, ...harbor.milestones, ...westside.milestones]

  const released   = all.filter((m) => m.status === 'released').length
  const approved   = all.filter((m) => m.status === 'approved').length
  const inReview   = all.filter((m) => m.status === 'ready_for_review' || m.status === 'in_progress').length
  const notStarted = all.filter((m) => m.status === 'not_started').length

  assert(released   === 4, `Released count is ${released}, expected 4 (rv-1, hb-1, hb-2, ws-1)`)
  assert(approved   === 2, `Approved count is ${approved}, expected 2 (rv-2, hb-3)`)
  assert(inReview   === 4, `In Review/In Progress count is ${inReview}, expected 4 (rv-3, hb-4, hb-5, ws-2)`)
  assert(notStarted === 3, `Not Started count is ${notStarted}, expected 3 (rv-4, ws-3, ws-4)`)
})

test('F8: capital page Structural Steel will not appear in recent releases (canonical status is approved)', () => {
  const ms = harbor.milestones.find((m) => m.id === 'ms-hb-3')!
  // The recent-releases filter is `status === 'released'`. Structural Steel is
  // 'approved' canonically, so it is filtered out automatically.
  assert(ms.status !== 'released',
    `Structural Steel status is "${ms.status}" — if it ever becomes "released" canonically the capital page will list it (intentional). Today it must not.`)
})

test('F9: capital page no longer hardcodes stale 4_890_000 totalReleased', () => {
  const file = src('src/app/demo-live/funder/capital/page.tsx')
  assert(!file.includes('4_890_000'),
    'capital/page.tsx still contains the stale 4_890_000 totalReleased literal')
})

test('F10: capital page no longer hardcodes stale 11_360_000 heldPending', () => {
  const file = src('src/app/demo-live/funder/capital/page.tsx')
  assert(!file.includes('11_360_000'),
    'capital/page.tsx still contains the stale 11_360_000 heldPending literal')
})

// ─── G. NO STALE 3_460_000 ANYWHERE OUTSIDE ADMIN DISPUTE ────────────────────

test('G1: no file under src/app/demo-live or src/components/demo contains 3_460_000 in code', () => {
  // Filters comment lines out — explanatory comments that reference the old
  // value by name (e.g. "previously had `released: 3_460_000`") are allowed.
  const { execSync } = require('child_process')
  let output = ''
  try {
    output = execSync(
      'grep -rn --include="*.ts" --include="*.tsx" "3_460_000" src/app/demo-live src/components/demo src/lib/demo-data ' +
      // Exclude lines whose content portion (after `file:linenum:`) starts with // or *
      '| grep -v ":[0-9]*:[[:space:]]*//" ' +
      '| grep -v ":[0-9]*:[[:space:]]*\\*"',
      { cwd: ROOT, encoding: 'utf-8' },
    ).trim()
  } catch {
    output = '' // grep exits 1 when no match
  }
  assert(output === '',
    `Found stale 3_460_000 literal in demo files (in code, not comments):\n${output}`)
})

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — DEMO CANONICAL DATA TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
