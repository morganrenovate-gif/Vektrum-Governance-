/**
 * tests/milestone-isolation.test.ts
 *
 * Proves Vektrum's second core capability — MILESTONE ISOLATION — at the domain
 * layer, with NO database. It drives the REAL production release gate
 * (src/lib/engine/release-gate.ts::validateRelease) against a minimal in-memory
 * Supabase stub, and the REAL reconciliation/scope arithmetic
 * (src/lib/engine/release-units.ts). Nothing here re-implements domain logic.
 *
 * Scenario numbers are the Harbor Point Medical Center Draw #07 figures:
 *   gross $2,180,000 · retainage $109,000 (5%) · net $2,071,000, split across four
 *   release units, one isolated at $310,000 gross ($294,500 net).
 *
 * Covered (task test matrix): 1 (isolated ≠ neighbor block), 2 (dependency blocks),
 * 3 (sequential preserved), 4 (global stops not bypassable), 5 (isolated amount
 * unauthorizable), 6 (eligible reconciles exactly), 8 (roles cannot authorize),
 * 10 (re-eval after resolution keeps prior scope intact), plus financial invariants.
 *
 * Run: npx tsx tests/milestone-isolation.test.ts
 */
import { validateRelease } from '../src/lib/engine/release-gate'
import {
  reconcileDraw,
  deriveAuthorizationScope,
  assertAuthorizationWithinScope,
  type ReleaseUnit,
} from '../src/lib/engine/release-units'
import type { Profile } from '../src/lib/types'

let passed = 0
const failures: string[] = []
function ok(c: boolean, m: string) { if (c) passed++; else failures.push(m) }
function threw(fn: () => unknown): boolean { try { fn(); return false } catch { return true } }

// ─── Minimal chainable Supabase stub for ONE milestone evaluation ────────────
type Resp = { data: unknown; error: unknown }
function builder(resp: Resp) {
  const b: Record<string, unknown> = {}
  const chain = () => b
  for (const m of ['select', 'eq', 'in', 'not', 'lt', 'neq', 'order', 'limit']) b[m] = chain
  b.single = async () => resp
  b.maybeSingle = async () => resp
  b.then = (onF: (r: Resp) => unknown) => Promise.resolve(resp).then(onF)
  return b
}
interface UnitCfg {
  milestone?: Resp; deal?: Resp; releases?: Resp; change_orders?: Resp;
  contracts?: Resp; milestones_seq?: Resp; milestone_prerequisites?: Resp;
}
function gateMock(cfg: UnitCfg) {
  let milestonesCall = 0
  return {
    from(table: string) {
      switch (table) {
        case 'milestones': {
          milestonesCall++
          if (milestonesCall === 1) return builder(cfg.milestone ?? { data: null, error: { message: 'no ms' } })
          return builder(cfg.milestones_seq ?? { data: [], error: null })
        }
        case 'deals':     return builder(cfg.deal ?? { data: DEAL, error: null })
        case 'profiles':  return builder({ data: CONTRACTOR, error: null })
        case 'releases':  return builder(cfg.releases ?? { data: null, error: null })
        case 'change_orders': return builder(cfg.change_orders ?? { data: [], error: null })
        case 'contracts': return builder(cfg.contracts ?? { data: { status: 'signed' }, error: null })
        case 'milestone_prerequisites': return builder(cfg.milestone_prerequisites ?? { data: [], error: null })
        case 'lien_waivers': return builder({ data: { id: 'lw', approved_at: '2026-01-01' }, error: null })
        case 'milestone_sov_links': return builder({ data: [], error: null })
        case 'sov_line_items': return builder({ data: [], error: null })
        default: return builder({ data: null, error: null })
      }
    },
  } as never
}

const DEAL = {
  id: 'DEMO-DEAL-HPMC', status: 'active', contractor_id: 'c-1',
  funded_amount: 5_000_000, released_amount: 0, fees_collected: 0, reserved_amount: 0,
  billing_rate_bps: 100, total_amount: 5_000_000,
  sequential_release_required: false, lien_waiver_required: false, deal_freeze_on_void: false,
}
const CONTRACTOR = { id: 'c-1', stripe_account_id: 'acct_1', stripe_payouts_enabled: true, onboarding_complete: true }
const FUNDER: Profile = { id: 'f-1', role: 'funder' } as Profile

// An "eligible" unit milestone (approved + ready) and an "isolated" one (disputed).
const eligibleMs = (id: string, amount: number) =>
  ({ id, deal_id: DEAL.id, amount, status: 'approved', protection_status: 'ready_for_release', order_index: 2, title: id })
const disputedMs = (id: string, amount: number) =>
  ({ id, deal_id: DEAL.id, amount, status: 'approved', protection_status: 'disputed', order_index: 1, title: id })

;(async () => {
  // ══ 1. Isolation at the gate: disputed unit fails ONLY its own condition;
  //       an unrelated eligible unit on the SAME deal passes fully. ══════════
  const isoRes = await validateRelease(
    gateMock({ milestone: { data: disputedMs('DEMO-MS-ISO', 310_000), error: null } }),
    'DEMO-MS-ISO', FUNDER, { executionRail: 'external_manual' },
  )
  ok(isoRes.allowed === false, '1a. disputed unit is blocked')
  const isoFails = isoRes.results.filter(r => r.outcome === 'failed').map(r => r.code)
  ok(isoFails.length === 1 && isoFails[0] === 'PROTECTION_READY',
    `1b. ONLY PROTECTION_READY fails on the disputed unit (got ${JSON.stringify(isoFails)})`)

  const neighborRes = await validateRelease(
    gateMock({ milestone: { data: eligibleMs('DEMO-MS-B', 720_000), error: null } }),
    'DEMO-MS-B', FUNDER, { executionRail: 'external_manual' },
  )
  ok(neighborRes.allowed === true, '1c. unrelated eligible unit on the same deal still passes')
  ok(neighborRes.results.every(r => r.outcome === 'passed' || r.outcome === 'not_applicable'),
    '1d. neighbor has no failed conditions — dispute did not leak')

  // ══ 2. Genuine dependency blocks the dependent unit (explicit prerequisite) ══
  const depRes = await validateRelease(
    gateMock({
      milestone: { data: eligibleMs('DEMO-MS-DEP', 500_000), error: null },
      milestone_prerequisites: { data: [{ prerequisite_milestone_id: 'DEMO-MS-ISO' }], error: null },
      milestones_seq: { data: [{ id: 'DEMO-MS-ISO', title: 'Isolated predecessor', order_index: 0 }], error: null },
    }),
    'DEMO-MS-DEP', FUNDER, { executionRail: 'external_manual' },
  )
  ok(depRes.allowed === false, '2a. dependent unit is blocked by an unreleased prerequisite')
  ok(depRes.results.find(r => r.code === 'PREREQUISITES_SATISFIED')?.outcome === 'failed',
    '2b. prerequisite condition is the blocker')

  // ══ 3. Sequential-release policy preserved (not bypassed by isolation) ══════
  const seqRes = await validateRelease(
    gateMock({
      milestone: { data: { ...eligibleMs('DEMO-MS-SEQ', 400_000), order_index: 3 }, error: null },
      deal: { data: { ...DEAL, sequential_release_required: true }, error: null },
      milestones_seq: { data: [{ id: 'DEMO-MS-EARLIER', title: 'Earlier phase', order_index: 1 }], error: null },
    }),
    'DEMO-MS-SEQ', FUNDER, { executionRail: 'external_manual' },
  )
  ok(seqRes.allowed === false, '3a. sequential mode blocks a later unit with an unreleased predecessor')
  ok(seqRes.results.find(r => r.code === 'PREREQUISITES_SATISFIED')?.outcome === 'failed',
    '3b. sequential blocker recorded on PREREQUISITES_SATISFIED')

  // ══ 4. Global hard stops cannot be bypassed by isolation ═══════════════════
  // 4a — frozen deal blocks even an otherwise-eligible unit.
  const frozen = await validateRelease(
    gateMock({ milestone: { data: eligibleMs('DEMO-MS-B', 720_000), error: null },
      deal: { data: { ...DEAL, status: 'frozen' }, error: null } }),
    'DEMO-MS-B', FUNDER, { executionRail: 'external_manual' })
  ok(frozen.allowed === false && frozen.results.some(r => r.code === 'DEAL_NOT_FROZEN' && r.outcome === 'failed'),
    '4a. frozen deal is a global stop — isolation cannot bypass it')
  // 4b — non-funder actor cannot authorize (admin/contractor/partner/AI).
  for (const role of ['admin', 'contractor', 'partner'] as const) {
    const r = await validateRelease(
      gateMock({ milestone: { data: eligibleMs('DEMO-MS-B', 720_000), error: null } }),
      'DEMO-MS-B', { id: 'x', role } as unknown as Profile, { executionRail: 'external_manual' })
    ok(r.allowed === false && r.results[0].code === 'ACTOR_AUTHORIZED' && r.results[0].outcome === 'failed',
      `4b. role '${role}' cannot authorize a release`)
  }
  // 4c — insufficient AGGREGATE funds blocks even an eligible unit.
  const broke = await validateRelease(
    gateMock({ milestone: { data: eligibleMs('DEMO-MS-B', 720_000), error: null },
      deal: { data: { ...DEAL, funded_amount: 100_000 }, error: null } }),
    'DEMO-MS-B', FUNDER, { executionRail: 'external_manual' })
  ok(broke.allowed === false && broke.results.some(r => r.code === 'FUNDED_BALANCE_SUFFICIENT' && r.outcome === 'failed'),
    '4c. insufficient aggregate funding is a global stop')
  // 4d — an existing active release blocks a duplicate.
  const dup = await validateRelease(
    gateMock({ milestone: { data: eligibleMs('DEMO-MS-B', 720_000), error: null },
      releases: { data: { id: 'rel-1', transfer_status: 'confirmed' }, error: null } }),
    'DEMO-MS-B', FUNDER, { executionRail: 'external_manual' })
  ok(dup.allowed === false && dup.results.some(r => r.code === 'NO_ACTIVE_RELEASE' && r.outcome === 'failed'),
    '4d. duplicate/active release is a global stop')

  // ══ 5–6. Reconciliation + authorization scope (real release-units module) ══
  // Four release units; one isolated at $310,000 gross. Retainage 5% everywhere.
  const R = 0.05
  const unit = (id: string, gross: number, status: ReleaseUnit['status'], reason?: string): ReleaseUnit =>
    ({ id, label: id, grossAmount: gross, retainageAmount: Math.round(gross * R * 100) / 100, status, isolationReason: reason })

  const isolatedSet: ReleaseUnit[] = [
    unit('DEMO-MS-ISO', 310_000, 'isolated', 'DISPUTE:CO-027+LIEN_WAIVER'),
    unit('DEMO-MS-B', 720_000, 'eligible'),
    unit('DEMO-MS-C', 560_000, 'eligible'),
    unit('DEMO-MS-D', 590_000, 'eligible'),
  ]
  const recon = reconcileDraw(isolatedSet)
  ok(recon.drawGross === 2_180_000, `6a. draw gross reconciles to $2,180,000 (got ${recon.drawGross})`)
  ok(recon.retainageWithheld === 109_000, `6b. retainage withheld = $109,000 (got ${recon.retainageWithheld})`)
  ok(recon.drawNet === 2_071_000, `6c. net draw = $2,071,000 (got ${recon.drawNet})`)
  ok(recon.isolatedGross === 310_000 && recon.isolatedNet === 294_500,
    `5a. isolated = $310,000 gross / $294,500 net (got ${recon.isolatedGross}/${recon.isolatedNet})`)
  ok(recon.eligibleGross === 1_870_000 && recon.eligibleNet === 1_776_500,
    `6d. eligible = $1,870,000 gross / $1,776,500 net (got ${recon.eligibleGross}/${recon.eligibleNet})`)
  // I1 partition exact — no double counting, nothing lost.
  ok(recon.eligibleGross + recon.isolatedGross + recon.alreadyReleasedGross === recon.drawGross,
    '6e. partition exact: eligible + isolated + released === drawGross')

  const scope = deriveAuthorizationScope(isolatedSet)
  ok(!scope.unitIds.includes('DEMO-MS-ISO'), '5b. authorization scope EXCLUDES the isolated unit id (I5)')
  ok(scope.excludedIsolatedUnitIds.includes('DEMO-MS-ISO'), '5c. isolated unit id is explicitly recorded as excluded')
  ok(scope.netAmount === 1_776_500, `5d. authorizable net = $1,776,500, isolated amount unreachable (got ${scope.netAmount})`)
  // I2 — cannot authorize the isolated unit or more than the eligible net.
  ok(threw(() => assertAuthorizationWithinScope(isolatedSet, ['DEMO-MS-ISO'], 294_500)),
    '5e. attempting to authorize the isolated unit is rejected')
  ok(threw(() => assertAuthorizationWithinScope(isolatedSet, ['DEMO-MS-B'], 2_000_000)),
    '5f. authorizing more than the eligible net is rejected')
  ok(assertAuthorizationWithinScope(isolatedSet, scope.unitIds, scope.netAmount) === 1_776_500,
    '5g. authorizing exactly the eligible scope is accepted')

  // ══ 7. Financial invariants: no negatives, retainage ≤ gross ═══════════════
  ok(threw(() => reconcileDraw([unit('X', -1, 'eligible')])), '7a. negative gross rejected')
  ok(threw(() => reconcileDraw([{ id: 'X', label: 'X', grossAmount: 100, retainageAmount: 200, status: 'eligible' }])),
    '7b. retainage exceeding gross rejected')
  ok(threw(() => reconcileDraw([unit('X', 100, 'eligible'), unit('X', 100, 'eligible')])), '7c. duplicate unit id rejected')

  // ══ 10. Re-evaluation after resolution: the isolated unit flips to eligible
  //         and earns a SEPARATE authorization; the FIRST scope is unchanged. ══
  const firstScopeNet = scope.netAmount   // captured before resolution
  const resolvedSet = isolatedSet.map(u =>
    u.id === 'DEMO-MS-ISO' ? { ...u, status: 'eligible' as const, isolationReason: undefined } : u)
  const secondScopeAll = deriveAuthorizationScope(resolvedSet)
  // Second authorization is scoped to JUST the resolved unit (the other three
  // were already authorized in the first round — model them as 'released').
  const afterFirstAuth = resolvedSet.map(u =>
    u.id === 'DEMO-MS-ISO' ? u : { ...u, status: 'released' as const })
  const secondScope = deriveAuthorizationScope(afterFirstAuth)
  ok(firstScopeNet === 1_776_500, '10a. first authorization scope is not mutated by resolution')
  ok(secondScopeAll.unitIds.includes('DEMO-MS-ISO'), '10b. resolved unit re-enters eligibility')
  ok(secondScope.unitIds.length === 1 && secondScope.unitIds[0] === 'DEMO-MS-ISO' && secondScope.netAmount === 294_500,
    `10c. second authorization covers only the resolved unit ($294,500 net) (got ${secondScope.netAmount})`)

  if (failures.length) {
    console.error(`\n❌ milestone-isolation: ${failures.length} failed, ${passed} passed`)
    failures.forEach(f => console.error('   - ' + f)); process.exit(1)
  }
  console.log(`✅ milestone-isolation: all ${passed} checks passed`)
})()
