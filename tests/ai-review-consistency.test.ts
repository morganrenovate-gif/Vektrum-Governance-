/**
 * AI Draw Review consistency tests
 *
 * Proves that every AI draw review display across demo-live uses a single
 * source of truth — the demo-data object — and that the modal never shows a
 * score/risk/result that contradicts what the card or timeline displays.
 *
 * Scopes tested:
 *
 *   A. DATA INTEGRITY — demo-data values are self-consistent
 *      A1. HVAC milestone has aiScore, aiRisk, and findings
 *      A2. aiRisk 'high' maps to a failing result (not "Pass")
 *      A3. harbor-dispute page HVAC_MS constant references same milestone id
 *
 *   B. MODAL PROP CONTRACT — AiReviewModal derives display from aiReview prop
 *      B1. No raw '82' literal remains in AiReviewModal when aiReview provided
 *      B2. isPassRisk helper: low/medium → pass; high/critical → fail
 *      B3. riskLabel helper: capitalises and maps known strings
 *
 *   C. CALL-SITE CONSISTENCY — callers pass data that matches card display
 *      C1. harbor-dispute passes aiScore from HVAC_MS to modal (not hardcoded)
 *      C2. harbor-dispute passes aiRisk from HVAC_MS to modal
 *      C3. harbor-dispute passes findings from HVAC_MS to modal
 *      C4. Riverside/Westside do NOT pass aiReview prop (use 82/100 default)
 *
 *   D. ACTUAL DASHBOARD SAFETY — authenticated site never uses hardcoded scores
 *      D1. DrawReviewAgent renders assessment.score from API (no literal score)
 *      D2. DrawReviewPanel uses computeRiskLevel (no literal score)
 *      D3. No file outside AiReviewModal contains a raw '82/100' literal
 *
 *   E. REGRESSION GUARD
 *      E1. AiReviewModal source does not contain the old hardcoded '82/100' string
 *      E2. AiReviewModal source does not contain hardcoded 'Low' risk label
 *      E3. AiReviewModal findings count is dynamic (not hardcoded '11 checks')
 *
 * Run:  npx tsx tests/ai-review-consistency.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { harborDisputeMilestones } from '../src/lib/demo-data/index'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function src(rel: string) {
  return readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

// ─── Test runner ──────────────────────────────────────────────────────────────

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

// ─── A. DATA INTEGRITY ────────────────────────────────────────────────────────

test('A1: HVAC milestone has aiScore, aiRisk, and findings', () => {
  const ms = harborDisputeMilestones.find((m) => m.id === 'ms-hbd-5')
  assert(ms !== undefined, 'ms-hbd-5 not found in harborDisputeMilestones')
  assert(typeof ms.aiScore === 'number', `aiScore must be a number, got ${typeof ms.aiScore}`)
  assert(typeof ms.aiRisk  === 'string', `aiRisk must be a string, got ${typeof ms.aiRisk}`)
  assert(Array.isArray(ms.findings) && ms.findings.length > 0,
    `findings must be a non-empty array, got ${JSON.stringify(ms.findings)}`)
})

test('A2: HVAC aiScore is 34 and aiRisk is "high" (matches card display)', () => {
  const ms = harborDisputeMilestones.find((m) => m.id === 'ms-hbd-5')!
  assert(ms.aiScore === 34,    `Expected aiScore 34, got ${ms.aiScore}`)
  assert(ms.aiRisk  === 'high', `Expected aiRisk "high", got "${ms.aiRisk}"`)
})

test('A3: aiRisk "high" means the result must be Fail (not Pass)', () => {
  const ms = harborDisputeMilestones.find((m) => m.id === 'ms-hbd-5')!
  // The rule used by AiReviewModal: high/critical → fail
  const isPass = ms.aiRisk !== 'high' && ms.aiRisk !== 'critical'
  assert(!isPass, `aiRisk "${ms.aiRisk}" should produce a Fail result, but isPass=${isPass}`)
})

test('A4: HVAC findings contain the invoice-mismatch warning', () => {
  const ms = harborDisputeMilestones.find((m) => m.id === 'ms-hbd-5')!
  const hasInvoiceWarning = ms.findings?.some((f) => f.includes('Invoice amount') && f.includes('847K'))
  assert(hasInvoiceWarning === true, 'Expected a finding mentioning the $847K invoice mismatch')
})

// ─── B. MODAL PROP CONTRACT ───────────────────────────────────────────────────

test('B1: AiReviewModal source exports AiReviewData interface', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    src_.includes('export interface AiReviewData'),
    'AiReviewModal.tsx does not export AiReviewData — callers cannot type-check the prop',
  )
})

test('B2: AiReviewModal uses score from aiReview prop (not hardcoded)', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  // The rendered score must come from the variable `score` (derived from aiReview?.score ?? 82),
  // not from a raw string literal like "82/100" that bypasses the prop.
  assert(
    src_.includes('aiReview?.score'),
    'AiReviewModal does not read aiReview?.score — score prop is not wired up',
  )
  assert(
    src_.includes('{score}/100'),
    'AiReviewModal does not render {score}/100 — score from prop is not used in output',
  )
})

test('B3: AiReviewModal uses risk from aiReview prop (not hardcoded "Low")', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    src_.includes('aiReview?.risk'),
    'AiReviewModal does not read aiReview?.risk — risk prop is not wired up',
  )
  // The rendered risk badge must use a variable, not a literal string
  assert(
    src_.includes('riskLabel(risk)') || src_.includes('{riskLabel('),
    'AiReviewModal does not call riskLabel(risk) — risk label may be hardcoded',
  )
})

test('B4: AiReviewModal uses findings from aiReview prop (not hardcoded array)', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    src_.includes('aiReview?.findings'),
    'AiReviewModal does not read aiReview?.findings — findings prop is not wired up',
  )
  assert(
    src_.includes('findings.map('),
    'AiReviewModal does not map over findings — findings from prop are not rendered',
  )
})

test('B5: result label is derived from risk (not hardcoded)', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  // isPassRisk / resultLabel must be computed
  assert(
    src_.includes('isPassRisk(risk)') || src_.includes('isPass'),
    'AiReviewModal does not compute pass/fail from risk — result may be hardcoded',
  )
  assert(
    src_.includes('resultLabel'),
    'AiReviewModal does not use a resultLabel variable — result may be hardcoded',
  )
})

// ─── C. CALL-SITE CONSISTENCY ─────────────────────────────────────────────────

test('C1: harbor-dispute passes aiScore from HVAC_MS (not hardcoded 34)', () => {
  const src_ = src('src/app/demo-live/deal/harbor-dispute/page.tsx')
  // Must reference HVAC_MS.aiScore, not a literal number
  assert(
    src_.includes('HVAC_MS.aiScore'),
    'harbor-dispute/page.tsx does not pass HVAC_MS.aiScore to AiReviewModal — score could become stale',
  )
  // Must NOT hardcode 34 as the score value in the modal call
  // (it may appear in the timeline text, so we check the aiReview object specifically)
  const aiReviewBlock = src_.slice(src_.indexOf('aiReview={'), src_.indexOf('}', src_.indexOf('aiReview={') + 100) + 1)
  assert(
    !aiReviewBlock.includes('score: 34'),
    'harbor-dispute/page.tsx hardcodes score: 34 in the aiReview prop instead of using HVAC_MS.aiScore',
  )
})

test('C2: harbor-dispute passes aiRisk from HVAC_MS (not hardcoded "high")', () => {
  const src_ = src('src/app/demo-live/deal/harbor-dispute/page.tsx')
  assert(
    src_.includes('HVAC_MS.aiRisk'),
    'harbor-dispute/page.tsx does not pass HVAC_MS.aiRisk to AiReviewModal',
  )
})

test('C3: harbor-dispute passes findings from HVAC_MS (not hardcoded array)', () => {
  const src_ = src('src/app/demo-live/deal/harbor-dispute/page.tsx')
  assert(
    src_.includes('HVAC_MS.findings'),
    'harbor-dispute/page.tsx does not pass HVAC_MS.findings to AiReviewModal',
  )
})

test('C4: Riverside does not pass aiReview prop (uses 82/100 default)', () => {
  const src_ = src('src/app/demo-live/deal/riverside/page.tsx')
  // The aiReview prop must not be present — Riverside simulates a new review
  const aiReviewIdx = src_.indexOf('aiReview=')
  assert(
    aiReviewIdx === -1,
    'riverside/page.tsx passes an aiReview prop to AiReviewModal — it should use the 82/100 default for "Request AI Review"',
  )
})

test('C5: Westside does not pass aiReview prop (uses 82/100 default)', () => {
  const src_ = src('src/app/demo-live/deal/westside/page.tsx')
  const aiReviewIdx = src_.indexOf('aiReview=')
  assert(
    aiReviewIdx === -1,
    'westside/page.tsx passes an aiReview prop to AiReviewModal — it should use the 82/100 default for "Run AI Review"',
  )
})

// ─── D. ACTUAL DASHBOARD SAFETY ───────────────────────────────────────────────

test('D1: DrawReviewAgent renders assessment.score from API (no literal integer score)', () => {
  const src_ = src('src/components/ai/draw-review-agent.tsx')
  assert(
    src_.includes('assessment.score'),
    'DrawReviewAgent does not render assessment.score — may not show real score from API',
  )
  // Must not render a raw literal like "82" or "34" as a score
  assert(
    !src_.includes('>82<') && !src_.includes('>34<'),
    'DrawReviewAgent contains a hardcoded score literal',
  )
})

test('D2: DrawReviewPanel uses computeRiskLevel (no hardcoded risk labels)', () => {
  const src_ = src('src/components/dashboard/draw-review-panel.tsx')
  assert(
    src_.includes('computeRiskLevel'),
    'DrawReviewPanel does not use computeRiskLevel — risk level may be hardcoded',
  )
  assert(
    !src_.includes('"Low"') && !src_.includes('"High"') && !src_.includes('"Medium"'),
    'DrawReviewPanel contains a hardcoded risk label string — should use computeRiskLevel result',
  )
})

test('D3: No file outside AiReviewModal contains "82/100" literal', () => {
  const { execSync } = require('child_process')
  let output = ''
  try {
    output = execSync(
      'grep -rn --include="*.ts" --include="*.tsx" "82/100" src/ | grep -v "src/components/demo/AiReviewModal.tsx"',
      { cwd: ROOT, encoding: 'utf-8' },
    ).trim()
  } catch {
    output = '' // grep exits 1 when no matches
  }
  assert(
    output === '',
    `Found "82/100" literal outside AiReviewModal — hardcoded score leak:\n${output}`,
  )
})

// ─── E. REGRESSION GUARD ─────────────────────────────────────────────────────

test('E1: AiReviewModal does not contain old hardcoded "82/100" string literal in JSX', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  // The string '82/100' must NOT appear as a JSX text or string literal.
  // It may appear in a comment or default value like `?? 82` — we look for the exact pattern.
  assert(
    !src_.includes('>82/100<'),
    'AiReviewModal still contains >82/100< as a JSX text node — old hardcoded value not removed',
  )
})

test('E2: AiReviewModal does not contain hardcoded ">Low<" risk label in JSX output', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !src_.includes('>Low<'),
    'AiReviewModal still contains >Low< as a hardcoded JSX text node',
  )
})

test('E3: AiReviewModal findings count is dynamic (not hardcoded "11 checks")', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !src_.includes('11 checks') && !src_.includes('— 11 check'),
    'AiReviewModal still has "11 checks" hardcoded — findings count must be computed from findings.length',
  )
  assert(
    src_.includes('findings.length'),
    'AiReviewModal does not use findings.length for the count — count may be stale when findings change',
  )
})

// ─── F. AI / GATE BOUNDARY COPY ──────────────────────────────────────────────
//
// The AI Draw Review modal must not be confusable with the 10-condition
// release gate. Pin the disambiguating copy so it cannot regress.

test('F1: AiReviewModal findings section labels the AI/gate boundary clearly', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  // The section must contain "AI Review Findings" (as a gate-boundary anchor) AND/OR
  // "Draw Control Brief" (as the evidence-to-policy framing). Accepting either ensures
  // the label cannot silently collapse to an unmarked list that is confused with the gate.
  assert(
    src_.includes('AI Review Findings') || src_.includes('Draw Control Brief'),
    'AiReviewModal findings section must include "AI Review Findings" or "Draw Control Brief" — readers may confuse an unlabeled list with the release gate',
  )
  // The bare "Findings — N check" pattern is the old confusing label. Make
  // sure it is not the visible header anymore.
  assert(
    !src_.includes('>\n                Findings <span') &&
    !src_.includes('>Findings <span'),
    'AiReviewModal still uses the bare "Findings — N check(s)" label',
  )
})

test('F2: AiReviewModal findings count uses "item(s) reviewed" (not "checks")', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  // "checks" implies parity with the 10-condition gate. "item(s) reviewed"
  // disambiguates without losing meaning. JSX uses
  //   item{findings.length !== 1 ? 's' : ''} reviewed
  // so we look for both halves separately.
  assert(
    src_.includes('item') && src_.includes('reviewed'),
    'AiReviewModal count phrasing should include "item(s) reviewed" to avoid evoking the 10-condition gate',
  )
  // The old "— N check(s)" suffix tied to findings.length must not survive.
  assert(
    !src_.includes("'s' : ''} checks") &&
    !src_.includes('"s" : ""} checks') &&
    !src_.includes("} check{") &&
    !src_.includes("} check<"),
    'AiReviewModal still emits a "N check(s)" count next to findings.length',
  )
})

test('F3: AiReviewModal contains the AI/gate boundary statement', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  // Must explicitly say the gate evaluates separately at release time.
  assert(
    src_.includes('release gate is evaluated separately') ||
    src_.includes('release gate\n              evaluates separately') ||
    src_.includes('runs separately at release time'),
    'AiReviewModal no longer states that the 10-condition release gate evaluates separately',
  )
  // Must explicitly say AI does not authorize release / does not bypass gate.
  assert(
    src_.includes('does not authorize release') ||
    src_.includes('does not satisfy') ||
    src_.includes('does not bypass'),
    'AiReviewModal no longer states that a passing AI review does not authorize release',
  )
})

test('F4: AiReviewModal preamble does not call AI a "Precondition layer"', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  // "Precondition layer" was the old confusing phrasing — it implied the AI
  // step is part of the gate process. Replaced with explicit "AI assessment
  // only — informational" copy.
  assert(
    !src_.includes('Precondition layer'),
    'AiReviewModal still uses "Precondition layer" — should be "AI assessment only — informational"',
  )
  assert(
    src_.includes('AI assessment only') ||
    src_.includes('informational'),
    'AiReviewModal preamble does not clarify the assessment is informational only',
  )
})

test('F5: real-dashboard DrawReviewAgent findings section labels the AI/gate boundary clearly', () => {
  const src_ = src('src/components/ai/draw-review-agent.tsx')
  // Must include "AI Review Findings" and/or "Draw Control Brief" so the findings list
  // cannot be mistaken for the deterministic 10-condition release gate.
  assert(
    src_.includes('AI Review Findings') || src_.includes('Draw Control Brief') || src_.includes('Brief Findings'),
    'DrawReviewAgent findings section must include "AI Review Findings", "Draw Control Brief", or "Brief Findings" — same confusion risk as demo modal',
  )
})

// ─── G. COPY TRUTH-LOCK — no overclaims in demo modal ────────────────────────
//
// The demo AI Review modal must not assert capabilities that the platform does
// not have. These tests fail if any banned phrase is re-introduced into the
// defaultFindings() fallback or the loading animation copy.
//
// Banned because they imply the AI layer (or platform) performs verification it
// cannot actually perform from the information available at review time:
//
//   • "Sub-tier lien waivers collected"  — platform records only primary
//     contractor waiver; sub-tier collection is not implemented.
//   • "Change orders reconciled"         — platform checks open-CO status;
//     "reconciled" implies mathematical cross-checking not performed.
//   • "Retainage calculation correct"    — platform stores the retainage rule;
//     it does not independently verify arithmetic on the draw.
//   • "Document authenticity verified"   — AI receives document URLs, not
//     content; it cannot verify metadata or detect tampering.
//   • "Photographic evidence … timestamped within submission window" — the AI
//     layer does not parse photo EXIF data or verify submission timing.
//   • "tamper-proof"                     — use "tamper-evident" per hard rule.
//   • "AI approves" / "AI approved"      — AI informs; the gate decides.
//   • "Reconciling change orders and retainage math" in loading animation —
//     the platform checks for open blockers and the configured retainage rule,
//     not the arithmetic.

test('G1: defaultFindings does not claim "sub-tier lien waivers collected"', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !/sub-tier lien waivers collected/i.test(src_),
    'AiReviewModal contains "sub-tier lien waivers collected" — platform only records the primary contractor waiver. ' +
    'Use: "Primary conditional lien waiver on file — sub-tier collection not configured on this deal".',
  )
})

test('G2: defaultFindings does not claim "Change orders reconciled"', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !/change orders reconciled/i.test(src_),
    'AiReviewModal contains "Change orders reconciled" — platform checks open-CO status, not mathematical reconciliation. ' +
    'Use: "No open change-order blockers detected".',
  )
})

test('G3: defaultFindings does not claim "Retainage calculation correct"', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !/retainage calculation correct/i.test(src_),
    'AiReviewModal contains "Retainage calculation correct" — platform stores the rule, does not verify arithmetic. ' +
    'Use: "Retainage rule identified".',
  )
})

test('G4: defaultFindings does not claim "Document authenticity verified"', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !/document authenticity verified/i.test(src_),
    'AiReviewModal contains "Document authenticity verified" — AI receives only document URLs and cannot inspect content. ' +
    'Use copy that attributes document review to the funder.',
  )
})

test('G5: defaultFindings does not claim photographic evidence is timestamp-verified by the platform', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  // The old claim was "Photographic evidence (22 site photos) timestamped within submission window"
  // which implies the platform verified photo EXIF/timestamp data — it does not.
  assert(
    !/photographic evidence.*timestamped within/i.test(src_),
    'AiReviewModal implies the platform verified photo timestamps — it cannot. ' +
    'Use copy that notes photo attachments are present for funder review.',
  )
})

test('G6: loading animation step 4 does not say "Reconciling change orders and retainage math"', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !/Reconciling change orders and retainage math/i.test(src_),
    'AiReviewModal loading step 4 says "Reconciling change orders and retainage math" — implies arithmetic verification. ' +
    'Use: "Checking for open change-order blockers and retainage configuration".',
  )
})

test('G7: AiReviewModal does not contain "tamper-proof" (must be "tamper-evident")', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !/tamper-proof/i.test(src_),
    'AiReviewModal contains "tamper-proof" — the audit chain is tamper-evident, not tamper-proof.',
  )
})

test('G8: AiReviewModal does not say "AI approves" or "AI approved"', () => {
  const src_ = src('src/components/demo/AiReviewModal.tsx')
  assert(
    !/\bAI approves\b/i.test(src_) && !/\bAI approved\b/i.test(src_),
    'AiReviewModal contains "AI approves" or "AI approved" — AI informs; the 10-condition gate decides.',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

const passed  = results.filter((r) => r.passed).length
const failed  = results.filter((r) => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — AI REVIEW CONSISTENCY TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
