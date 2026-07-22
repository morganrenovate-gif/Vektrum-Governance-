/**
 * tests/gate-structured-results.test.ts
 *
 * Phase 1 completeness tests for the structured gate results. These assert that
 * validateRelease() now records one immutable-style result per evaluated
 * condition (passed / failed / not_applicable / error), that codes are unique
 * within an evaluation, and that the structured results stay consistent with
 * the authoritative { allowed, errors } surface (which parity is proven by
 * tests/release-gate.test.ts). No database is required — a minimal mock supplies
 * query responses; all logic lives in src/.
 *
 * Run: npx tsx tests/gate-structured-results.test.ts
 */
import { validateRelease } from '../src/lib/engine/release-gate'
import { CONDITIONS } from '../src/lib/engine/gate-conditions'
import type { Profile } from '../src/lib/types'

let passed = 0
const failures: string[] = []
function ok(c: boolean, m: string) { if (c) passed++; else failures.push(m) }

// ─── Minimal chainable Supabase mock ────────────────────────────────────────
type Resp = { data: unknown; error: unknown }
function builder(resp: Resp) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'in', 'not', 'lt', 'neq', 'order', 'limit']) b[m] = chain
  b.single = async () => resp
  b.maybeSingle = async () => resp
  // thenable — supports `await chain`
  b.then = (onF: (r: Resp) => unknown) => Promise.resolve(resp).then(onF)
  return b
}
interface MockCfg {
  milestone?: Resp; deal?: Resp; contractor?: Resp; releases?: Resp;
  change_orders?: Resp; contracts?: Resp; milestones_seq?: Resp;
  milestone_prerequisites?: Resp; lien_waivers?: Resp;
  milestone_sov_links?: Resp; sov_line_items?: Resp;
}
function mock(cfg: MockCfg) {
  let milestonesCall = 0
  return {
    from(table: string) {
      switch (table) {
        case 'milestones': {
          // First 'milestones' access = fetch milestone; later = sequential predecessors
          milestonesCall++
          if (milestonesCall === 1) return builder(cfg.milestone ?? { data: DEFAULT_MS, error: null })
          return builder(cfg.milestones_seq ?? { data: [], error: null })
        }
        case 'deals':        return builder(cfg.deal ?? { data: DEFAULT_DEAL, error: null })
        case 'profiles':     return builder(cfg.contractor ?? { data: DEFAULT_CONTRACTOR, error: null })
        case 'releases':     return builder(cfg.releases ?? { data: null, error: null })
        case 'change_orders':return builder(cfg.change_orders ?? { data: [], error: null })
        case 'contracts':    return builder(cfg.contracts ?? { data: { status: 'signed' }, error: null })
        case 'milestone_prerequisites': return builder(cfg.milestone_prerequisites ?? { data: [], error: null })
        case 'lien_waivers': return builder(cfg.lien_waivers ?? { data: { id: 'lw-1', approved_at: '2026-01-01' }, error: null })
        case 'milestone_sov_links':     return builder(cfg.milestone_sov_links ?? { data: [], error: null })
        case 'sov_line_items':          return builder(cfg.sov_line_items ?? { data: [], error: null })
        default:             return builder({ data: null, error: null })
      }
    },
  } as never
}

const DEFAULT_MS = { id: 'ms-1', deal_id: 'deal-1', amount: 10_000, status: 'approved', protection_status: 'ready_for_release', order_index: 1, title: 'M1' }
const DEFAULT_DEAL = { id: 'deal-1', status: 'active', contractor_id: 'c-1', funded_amount: 50_000, released_amount: 0, fees_collected: 0, reserved_amount: 0, billing_rate_bps: 100, total_amount: 50_000, sequential_release_required: false, lien_waiver_required: false, deal_freeze_on_void: false }
const DEFAULT_CONTRACTOR = { id: 'c-1', stripe_account_id: 'acct_1', stripe_payouts_enabled: true, onboarding_complete: true }
const FUNDER: Profile = { id: 'f-1', role: 'funder' } as Profile

function consistent(r: { allowed: boolean; results: { outcome: string }[] }) {
  const anyBad = r.results.some(x => x.outcome === 'failed' || x.outcome === 'error')
  return r.allowed === !anyBad
}
function uniqueCodes(r: { results: { code: string }[] }) {
  const codes = r.results.map(x => x.code)
  return new Set(codes).size === codes.length
}

;(async () => {
  // ── 1. All-pass (stripe rail): full completeness ──────────────────────────
  const passRes = await validateRelease(mock({}), 'ms-1', FUNDER, { executionRail: 'stripe_connect' })
  ok(passRes.allowed === true, '1. all-pass allowed=true')
  ok(passRes.errors.length === 0, '1. all-pass no errors')
  ok(Array.isArray(passRes.results) && passRes.results.length >= 13, `1. records >=13 conditions (got ${passRes.results.length})`)
  ok(uniqueCodes(passRes), '13. condition codes unique within evaluation')
  ok(consistent(passRes), '14. overall_outcome consistent with results (all-pass)')
  ok(passRes.results.every(r => ['passed', 'not_applicable'].includes(r.outcome)), '10/12. all results passed or not_applicable on clean deal')
  // every result carries stable identity fields
  ok(passRes.results.every(r => r.code && r.label && r.category && r.evaluatorVersion && typeof r.order === 'number' && r.resultCode), 'results carry stable code/label/category/evaluator/order/resultCode')

  // ── 2. Failed condition is recorded (not just errored out) ─────────────────
  const failRes = await validateRelease(mock({ milestone: { data: { ...DEFAULT_MS, status: 'in_progress' }, error: null } }), 'ms-1', FUNDER)
  ok(failRes.allowed === false, '11. milestone-not-approved → allowed=false')
  const mApproved = failRes.results.find(r => r.code === 'MILESTONE_APPROVED')
  ok(mApproved?.outcome === 'failed', '11. failed condition recorded with outcome=failed')
  ok(mApproved?.resultCode === 'FAIL_MILESTONE_NOT_APPROVED', '11. stable machine failure code recorded')
  ok(failRes.errors.includes(mApproved?.explanation ?? '__none__'), '15. structured failure explanation matches user-facing error string')
  ok(consistent(failRes), '14. overall_outcome consistent (fail case)')

  // ── 3. Not-applicable recorded (external rail → payout N/A; no waiver req) ──
  const naRes = await validateRelease(mock({}), 'ms-1', FUNDER, { executionRail: 'external_manual' })
  const payout = naRes.results.find(r => r.code === 'PAYOUT_ACCOUNT_READY')
  ok(payout?.outcome === 'not_applicable', '12. external rail → PAYOUT_ACCOUNT_READY not_applicable')
  ok(payout?.applicability === 'not_applicable', '12. applicability flagged not_applicable')
  ok(naRes.allowed === true, '3. external-rail clean deal still allowed')
  ok(naRes.results.find(r => r.code === 'LIEN_WAIVER_APPROVED')?.outcome === 'not_applicable', '12. lien waiver not required → not_applicable')

  // ── 4. Actor role failure records ACTOR_AUTHORIZED failed only ─────────────
  const roleRes = await validateRelease(mock({}), 'ms-1', { id: 'a-1', role: 'admin' } as Profile)
  ok(roleRes.allowed === false, '8. admin cannot release')
  ok(roleRes.results.length === 1 && roleRes.results[0].code === 'ACTOR_AUTHORIZED' && roleRes.results[0].outcome === 'failed', '8. role failure short-circuits with single ACTOR_AUTHORIZED result')

  // ── 5. Registry integrity ─────────────────────────────────────────────────
  ok(Object.entries(CONDITIONS).every(([k, v]) => k === v.code), '5. CONDITIONS registry keys match codes')

  if (failures.length) {
    console.error(`\n❌ gate-structured-results: ${failures.length} failed, ${passed} passed`)
    failures.forEach(f => console.error('   - ' + f)); process.exit(1)
  }
  console.log(`✅ gate-structured-results: all ${passed} checks passed`)
})()
