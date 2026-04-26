/**
 * Vektrum Release Gate — End-to-End Test Suite
 *
 * Tests ALL 10 blocking conditions, the caller role check, the frozen-deal
 * fast-path, fee arithmetic (including the $50 floor and reserved_amount),
 * external_manual rail skip for Condition 4, checkAiPrecondition, and the
 * state machine — all against the REAL production source.
 *
 * Nothing in this file re-implements validateRelease or validateTransition.
 * The mock only provides Supabase query responses; all logic lives in src/.
 *
 * Run:  npx tsx tests/release-gate.test.ts
 */

import { validateRelease, checkAiPrecondition } from '../src/lib/engine/release-gate'
import { validateTransition } from '../src/lib/engine/state-machine'
import type { Profile } from '../src/lib/types'

// ─── Mock Types ───────────────────────────────────────────────────────────────

type MockRow = Record<string, unknown>

/**
 * Each field is optional.  Omitting a field uses the default fixture (all
 * conditions pass).  Pass `null` to simulate a missing/not-found row.
 * Pass *Error: true to simulate a DB-level failure.
 *
 * `contract` defaults to `{ status: 'signed' }` when not present in cfg.
 * `lienWaiver` defaults to an approved waiver row when not present in cfg.
 * (Both defaults only matter when the relevant flag is set on the deal.)
 */
interface MockConfig {
  // ── Milestone (initial fetch) ──────────────────────────────────────────────
  milestone?: Partial<MockRow> | null
  milestoneError?: boolean

  // ── Deal ──────────────────────────────────────────────────────────────────
  deal?: Partial<MockRow> | null
  dealError?: boolean

  // ── Contractor profile (Conditions 4, 5) ──────────────────────────────────
  contractorProfile?: Partial<MockRow> | null
  contractorError?: boolean

  // ── Existing release (Condition 6) ────────────────────────────────────────
  existingRelease?: MockRow | null          // null → no existing release
  releaseQueryError?: boolean

  // ── Open change orders (Condition 7) ──────────────────────────────────────
  openChangeOrders?: MockRow[]              // [] → no open COs
  changeOrderError?: boolean

  // ── Contract (Condition 8) ────────────────────────────────────────────────
  // When absent from cfg → default: { status: 'signed' }
  contract?: { status: string } | null
  contractError?: boolean

  // ── Sequential blockers (Condition 9a) ────────────────────────────────────
  sequentialBlockers?: MockRow[]            // [] → no blockers
  sequentialError?: boolean

  // ── Explicit prerequisites (Condition 9b) ─────────────────────────────────
  milestonePrerequisites?: { prerequisite_milestone_id: string }[]   // [] → none
  prereqError?: boolean
  unreleasedPrereqs?: MockRow[]             // [] → all prereqs already released
  prereqDetailError?: boolean

  // ── Lien waiver (Condition 10) ────────────────────────────────────────────
  // When absent from cfg → default: approved waiver row (condition passes)
  lienWaiver?: MockRow | null
  lienWaiverError?: boolean
}

// ─── Default Fixtures ─────────────────────────────────────────────────────────
//
// All conditions pass with these defaults:
//   – billing_rate_bps: 100 (1 %) is REQUIRED (calculateFee throws on ≤ 0)
//   – fee on $10,000 milestone = max($100, $50) = $100 → totalDebit = $10,100
//   – funded_amount: 50,000 comfortably covers the $10,100 total debit

const DEFAULT_MILESTONE: MockRow = {
  id: 'ms-1',
  deal_id: 'deal-1',
  amount: 10_000,
  status: 'approved',
  protection_status: 'ready_for_release',
  order_index: 1,
  title: 'Test Milestone',
}

const DEFAULT_DEAL: MockRow = {
  id: 'deal-1',
  status: 'active',
  contractor_id: 'contractor-1',
  funded_amount: 50_000,
  released_amount: 0,
  fees_collected: 0,
  reserved_amount: 0,
  billing_rate_bps: 100,       // MUST be > 0 — calculateFee throws otherwise
  total_amount: 50_000,
  sequential_release_required: false,
  lien_waiver_required: false,
  deal_freeze_on_void: false,
}

const DEFAULT_CONTRACTOR: MockRow = {
  id: 'contractor-1',
  stripe_account_id: 'acct_test_123',
  stripe_payouts_enabled: true,
  onboarding_complete: true,
}

// ─── Mock Builder ─────────────────────────────────────────────────────────────

/**
 * Builds a minimal Supabase client stub.
 *
 * Every `.from(table)` call returns a new query builder that tracks which
 * chain methods have been called so the terminal resolution can pick the
 * right mock row(s).
 *
 * Thenable builders (.then) are required wherever validateRelease uses
 * `await chain` directly (change_orders, milestone_prerequisites, and the
 * sequential + prereq queries inside Promise.all).
 *
 * Deal overrides are merged with DEFAULT_DEAL to ensure billing_rate_bps
 * and other required fields are always present — partial overrides are safe.
 * The same shallow-merge strategy applies to milestone and contractorProfile.
 */
function buildSupabaseMock(cfg: MockConfig) {
  // Resolve the deal row once: merge partial override with defaults.
  const dealRow: MockRow | null =
    cfg.dealError         ? null
    : cfg.deal === null   ? null
    : cfg.deal !== undefined ? { ...DEFAULT_DEAL, ...cfg.deal }
    : DEFAULT_DEAL

  const milestoneRow: MockRow | null =
    cfg.milestoneError       ? null
    : cfg.milestone === null  ? null
    : cfg.milestone !== undefined ? { ...DEFAULT_MILESTONE, ...cfg.milestone }
    : DEFAULT_MILESTONE

  const contractorRow: MockRow | null =
    cfg.contractorError            ? null
    : cfg.contractorProfile === null ? null
    : cfg.contractorProfile !== undefined ? { ...DEFAULT_CONTRACTOR, ...cfg.contractorProfile }
    : DEFAULT_CONTRACTOR

  function buildChain(table: string) {
    const state = {
      firstEqCol: '',
      hasLt: false,
      hasIn: false,
      hasNot: false,
    }

    function resolveData(): { data: unknown; error: unknown } {
      const ok  = (data: unknown) => ({ data, error: null })
      const err = (msg: string)   => ({ data: null, error: { message: msg } })

      // ── milestones ─────────────────────────────────────────────────────────
      if (table === 'milestones') {
        // (a) initial fetch:  .eq('id', ...).single()
        if (state.firstEqCol === 'id') {
          if (cfg.milestoneError) return err('not found')
          return ok(milestoneRow)
        }
        // (b) sequential blockers (9a):  .eq('deal_id',...).lt(...).neq(...).order(...)
        if (state.hasLt) {
          if (cfg.sequentialError) return err('DB error')
          return ok(cfg.sequentialBlockers ?? [])
        }
        // (c) unreleased prereq details (9b):  .in('id', prereqIds).neq(...)
        if (state.hasIn) {
          if (cfg.prereqDetailError) return err('DB error')
          return ok(cfg.unreleasedPrereqs ?? [])
        }
        return ok([])
      }

      // ── deals ──────────────────────────────────────────────────────────────
      if (table === 'deals') {
        if (cfg.dealError) return err('not found')
        return ok(dealRow)
      }

      // ── profiles ───────────────────────────────────────────────────────────
      if (table === 'profiles') {
        if (cfg.contractorError) return err('not found')
        return ok(contractorRow)
      }

      // ── releases  (.eq().in().maybeSingle()) ───────────────────────────────
      if (table === 'releases') {
        if (cfg.releaseQueryError) return err('DB error')
        return ok(cfg.existingRelease ?? null)
      }

      // ── change_orders  (.eq().eq()  ← direct await, no terminal method) ───
      if (table === 'change_orders') {
        if (cfg.changeOrderError) return err('DB error')
        return ok(cfg.openChangeOrders ?? [])
      }

      // ── contracts  (.eq().not().maybeSingle()) ─────────────────────────────
      if (table === 'contracts') {
        if (cfg.contractError) return err('DB error')
        if ('contract' in cfg) return ok(cfg.contract)
        return ok({ status: 'signed' })   // default: signed contract present
      }

      // ── milestone_prerequisites  (.eq()  ← direct await) ──────────────────
      if (table === 'milestone_prerequisites') {
        if (cfg.prereqError) return err('DB error')
        return ok(cfg.milestonePrerequisites ?? [])
      }

      // ── lien_waivers  (.eq().eq().eq().order().limit().maybeSingle()) ──────
      if (table === 'lien_waivers') {
        if (cfg.lienWaiverError) return err('DB error')
        if ('lienWaiver' in cfg) return ok(cfg.lienWaiver)
        return ok({ id: 'lw-1', approved_at: new Date().toISOString() })
      }

      return ok(null)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select:     () => chain,
      eq:         (col: string) => { if (!state.firstEqCol) state.firstEqCol = col; return chain },
      neq:        () => chain,
      not:        () => { state.hasNot = true; return chain },
      lt:         () => { state.hasLt  = true; return chain },
      in:         () => { state.hasIn  = true; return chain },
      order:      () => chain,
      limit:      () => chain,
      single:     () => resolveData(),
      maybeSingle:() => resolveData(),
      // Thenable so `await chain` and Promise.all([chain]) work without .single()
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolveData()).then(onFulfilled, onRejected),
    }

    return chain
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => buildChain(table),
  }
}

// ─── Audit Mock (for checkAiPrecondition) ─────────────────────────────────────

interface AuditMockConfig {
  noReview?:          boolean   // no ai_draw_review rows at all
  reviewAgeMs?:       number    // ms since review was created  (default: 1 h → passes)
  reviewRiskLevel?:   string    // default: 'low'
  overrideAgeMs?:     number    // ms since admin override was created (undefined → no override)
}

function buildAuditMock(cfg: AuditMockConfig = {}) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (_table: string) => {
      const state = { action: '' }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select:  () => chain,
        eq:      (col: string, val: string) => { if (col === 'action') state.action = val; return chain },
        order:   () => chain,
        limit:   () => chain,
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
          let rows: MockRow[] = []

          if (state.action === 'ai_draw_review' && !cfg.noReview) {
            const ageMs = cfg.reviewAgeMs ?? 60 * 60 * 1000   // 1 h ago by default
            rows = [{
              created_at: new Date(Date.now() - ageMs).toISOString(),
              metadata:   { risk_level: cfg.reviewRiskLevel ?? 'low' },
            }]
          }

          if (state.action === 'ai_review_admin_override' && cfg.overrideAgeMs !== undefined) {
            const ttlMs = 4 * 60 * 60 * 1000
            // Only emit the override row if it is still within the TTL window
            if (cfg.overrideAgeMs <= ttlMs) {
              rows = [{
                created_at: new Date(Date.now() - cfg.overrideAgeMs).toISOString(),
                metadata:   {
                  override_risk_level: 'low',
                  expires_at: new Date(Date.now() + (ttlMs - cfg.overrideAgeMs)).toISOString(),
                },
              }]
            }
          }

          return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected)
        },
      }

      return chain
    },
  }
}

// ─── Profile Fixtures ─────────────────────────────────────────────────────────

function funder(): Profile {
  return {
    id:                    'funder-1',
    full_name:             'Test Funder',
    company_name:          null,
    role:                  'funder',
    stripe_account_id:     null,
    stripe_payouts_enabled: false,
    onboarding_complete:   true,
    subscription_tier:     'standalone',    // required field on Profile
    created_at:            new Date().toISOString(),
    updated_at:            new Date().toISOString(),
  }
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

const results: { name: string; passed: boolean; error?: string }[] = []

async function test(name: string, fn: () => Promise<void> | void) {
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

function assertContains(haystack: string, needle: string) {
  if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`Expected to contain "${needle}" but got:\n"${haystack}"`)
  }
}

function assertNoStackTrace(errors: string[]) {
  for (const e of errors) {
    assert(!e.includes('at Object.'),   `Stack trace leaked into error: ${e}`)
    assert(!e.includes('TypeError:'),   `TypeError leaked into error: ${e}`)
    assert(!e.includes('Cannot read'),  `JS error leaked into error: ${e}`)
    assert(e.length > 20,               `Error too short to be human-readable: "${e}"`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DEFINITIONS  (all inside main() to support CJS + ESM environments)
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {

// ── ROLE CHECK ────────────────────────────────────────────────────────────────

await test('ROLE: contractor blocked before any DB query', async () => {
  const r = await validateRelease(
    buildSupabaseMock({}) as never, 'ms-1', { ...funder(), role: 'contractor' })
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'contractor')
  assertNoStackTrace(r.errors)
})

await test('ROLE: admin cannot trigger release — funder-only gate', async () => {
  const r = await validateRelease(
    buildSupabaseMock({}) as never, 'ms-1', { ...funder(), role: 'admin' })
  assert(!r.allowed, 'Admin should be blocked from triggering a release')
  assertContains(r.errors.join(' '), 'admin')
  assertNoStackTrace(r.errors)
})

await test('ROLE: funder passes role check — happy path all clear', async () => {
  const r = await validateRelease(buildSupabaseMock({}) as never, 'ms-1', funder())
  assert(r.allowed, `Should be allowed but got: ${r.errors.join(' | ')}`)
})

// ═══════════════════════════════════════════════════════════════════════════════
// FROZEN DEAL FAST-PATH  (checked before conditions 1–10)
// ═══════════════════════════════════════════════════════════════════════════════

await test('FROZEN: deal.status=frozen → early exit, specific frozen-deal message', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ deal: { status: 'frozen' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Frozen deal should block')
  assertContains(r.errors.join(' '), 'frozen')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 1: milestone.status must be 'approved'
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 1: status=in_progress → blocked, mentions "approved"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ milestone: { status: 'in_progress' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'approved')
  assertNoStackTrace(r.errors)
})

await test('COND 1: status=ready_for_review → blocked, mentions "approved"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ milestone: { status: 'ready_for_review' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'approved')
  assertNoStackTrace(r.errors)
})

await test('COND 1: status=not_started → blocked, mentions "approved"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ milestone: { status: 'not_started' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'approved')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 2: protection_status must be 'ready_for_release'
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 2: protection_status=pending → blocked, mentions "protection"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ milestone: { protection_status: 'pending' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'protection')
  assertNoStackTrace(r.errors)
})

await test('COND 2: protection_status=disputed → blocked, mentions "protection"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ milestone: { protection_status: 'disputed' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'protection')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 3: sufficient funded balance (includes fee + reserved_amount)
//
//   billing_rate_bps = 100 (1 %)
//   milestone.amount = 10,000
//   fee              = max(10,000 * 100 / 10,000, 50) = max(100, 50) = 100
//   totalDebit       = 10,100
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 3: funded=0 → blocked, mentions "balance"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ deal: { funded_amount: 0 } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'balance')
  assertNoStackTrace(r.errors)
})

await test('COND 3: available after prior releases is insufficient → blocked', async () => {
  // funded=15,000  released=10,000  available=5,000  totalDebit=10,100 → blocked
  const r = await validateRelease(
    buildSupabaseMock({ deal: { funded_amount: 15_000, released_amount: 10_000 } }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'balance')
  assertNoStackTrace(r.errors)
})

await test('COND 3: funded=10,099 (one cent below totalDebit) → blocked', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ deal: { funded_amount: 10_099 } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block — one cent short of fee-inclusive totalDebit')
  assertContains(r.errors.join(' '), 'balance')
  assertNoStackTrace(r.errors)
})

await test('COND 3: funded=10,100 (exact totalDebit boundary) → allowed', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ deal: { funded_amount: 10_100 } }) as never, 'ms-1', funder())
  assert(r.allowed, `Exact balance should pass but got: ${r.errors.join(' | ')}`)
})

await test('COND 3: reserved_amount reduces available balance → blocked', async () => {
  // funded=20,100  reserved=10,001  available=10,099 < 10,100 → blocked
  const r = await validateRelease(
    buildSupabaseMock({ deal: { funded_amount: 20_100, reserved_amount: 10_001 } }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'reserved_amount should eat into available balance')
  assertContains(r.errors.join(' '), 'balance')
  assertNoStackTrace(r.errors)
})

await test('COND 3: reserved_amount exactly allows passage → allowed', async () => {
  // funded=20,100  reserved=10,000  available=10,100 = 10,100 → passes
  const r = await validateRelease(
    buildSupabaseMock({ deal: { funded_amount: 20_100, reserved_amount: 10_000 } }) as never,
    'ms-1', funder())
  assert(r.allowed, `Should pass: ${r.errors.join(' | ')}`)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 4: contractor Stripe payouts enabled
//              Rail-aware: skipped for external_manual
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 4 [stripe_connect]: stripe_payouts_enabled=false → blocked', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ contractorProfile: { stripe_payouts_enabled: false } }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'payout')
  assertNoStackTrace(r.errors)
})

await test('COND 4 [external_manual]: stripe_payouts_enabled=false → NOT blocked (skipped)', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ contractorProfile: { stripe_payouts_enabled: false } }) as never,
    'ms-1', funder(), { executionRail: 'external_manual' })
  // Condition 4 is the only one skipped for external_manual.
  // All other conditions pass by default, so release should be allowed.
  assert(r.allowed, `external_manual should skip stripe payouts check but got: ${r.errors.join(' | ')}`)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 5: contractor onboarding complete
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 5: onboarding_complete=false → blocked, mentions "onboard"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ contractorProfile: { onboarding_complete: false } }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'onboard')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 6: no existing active release record
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 6: existing release → blocked, mentions "already been released"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ existingRelease: { id: 'release-xyz' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'already been released')
  assertNoStackTrace(r.errors)
})

await test('COND 6: release query DB error → blocked safely, no 500 leak', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ releaseQueryError: true }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block on DB error — fail-closed')
  assertContains(r.errors.join(' '), 'verify')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 7: no open change orders
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 7: 1 open change order → blocked, mentions "change order"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ openChangeOrders: [{ id: 'co-1' }] }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'change order')
  assertNoStackTrace(r.errors)
})

await test('COND 7: 3 open change orders → blocked, plural grammar correct', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ openChangeOrders: [{ id: 'co-1' }, { id: 'co-2' }, { id: 'co-3' }] }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), '3 pending change orders')
  assertNoStackTrace(r.errors)
})

await test('COND 7: change order DB error → blocked safely', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ changeOrderError: true }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block on DB error — fail-closed')
  assertContains(r.errors.join(' '), 'change order')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 8: signed contract on file
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 8: contractQueryError → blocked safely, mentions "verify"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ contractError: true }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block on DB error — fail-closed')
  assertContains(r.errors.join(' '), 'verify')
  assertNoStackTrace(r.errors)
})

await test('COND 8: no contract (null) → blocked, mentions "contract on file"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ contract: null }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'contract on file')
  assertNoStackTrace(r.errors)
})

await test('COND 8: contract.status=pending → blocked, mentions "not fully executed"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ contract: { status: 'pending' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'not fully executed')
  assertNoStackTrace(r.errors)
})

await test('COND 8: contract.status=voided → blocked, mentions "voided"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ contract: { status: 'voided' } }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'voided')
  assertNoStackTrace(r.errors)
})

await test('COND 8: contract.status=signed (default) → passes', async () => {
  // Contract defaults to { status: 'signed' } when omitted from cfg
  const r = await validateRelease(buildSupabaseMock({}) as never, 'ms-1', funder())
  assert(r.allowed, `Signed contract should pass, got: ${r.errors.join(' | ')}`)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 9a: sequential release order
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 9a: sequential=true, blocker exists → blocked, mentions blocker title', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      deal: { sequential_release_required: true },
      sequentialBlockers: [{ id: 'ms-0', title: 'Foundation Work', order_index: 0 }],
    }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'Foundation Work')
  assertNoStackTrace(r.errors)
})

await test('COND 9a: sequential=true, no blockers → passes', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      deal: { sequential_release_required: true },
      sequentialBlockers: [],
    }) as never,
    'ms-1', funder())
  assert(r.allowed, `No blockers should pass: ${r.errors.join(' | ')}`)
})

await test('COND 9a: sequential=false, unreleased earlier milestones exist → NOT blocked', async () => {
  // When sequential_release_required=false the query is skipped (Promise.resolve shortcut)
  const r = await validateRelease(
    buildSupabaseMock({
      deal: { sequential_release_required: false },
      // sequentialBlockers would be ignored because flag is false
      sequentialBlockers: [{ id: 'ms-0', title: 'Foundation Work', order_index: 0 }],
    }) as never,
    'ms-1', funder())
  assert(r.allowed, `Sequential flag=false should not block: ${r.errors.join(' | ')}`)
})

await test('COND 9a: sequential query error → blocked safely', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      deal: { sequential_release_required: true },
      sequentialError: true,
    }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block on DB error — fail-closed')
  assertContains(r.errors.join(' '), 'sequential')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 9b: explicit prerequisites
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 9b: prereq exists and is unreleased → blocked, mentions prereq title', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      milestonePrerequisites: [{ prerequisite_milestone_id: 'ms-prereq' }],
      unreleasedPrereqs: [{ id: 'ms-prereq', title: 'Site Prep', order_index: 0 }],
    }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'Site Prep')
  assertNoStackTrace(r.errors)
})

await test('COND 9b: prereq exists but is already released → allowed', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      milestonePrerequisites: [{ prerequisite_milestone_id: 'ms-prereq' }],
      unreleasedPrereqs: [],    // prereq is already released → no blocking rows
    }) as never,
    'ms-1', funder())
  assert(r.allowed, `Released prereq should not block: ${r.errors.join(' | ')}`)
})

await test('COND 9b: milestone_prerequisites query error → blocked safely', async () => {
  const r = await validateRelease(
    buildSupabaseMock({ prereqError: true }) as never, 'ms-1', funder())
  assert(!r.allowed, 'Should block on DB error — fail-closed')
  assertContains(r.errors.join(' '), 'prerequisite')
  assertNoStackTrace(r.errors)
})

await test('COND 9b: prereq detail query error → blocked safely', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      milestonePrerequisites: [{ prerequisite_milestone_id: 'ms-prereq' }],
      prereqDetailError: true,
    }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block on DB error — fail-closed')
  assertContains(r.errors.join(' '), 'prerequisite')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION 10: approved conditional lien waiver
// ═══════════════════════════════════════════════════════════════════════════════

await test('COND 10: lien_waiver_required=false → condition skipped, passes', async () => {
  // Default deal has lien_waiver_required: false — condition 10 is never evaluated
  const r = await validateRelease(buildSupabaseMock({}) as never, 'ms-1', funder())
  assert(r.allowed, `lien_waiver_required=false should pass: ${r.errors.join(' | ')}`)
})

await test('COND 10: lien_waiver_required=true, no waiver → blocked, mentions "lien waiver"', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      deal: { lien_waiver_required: true },
      lienWaiver: null,
    }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block when waiver is missing')
  assertContains(r.errors.join(' '), 'lien waiver')
  assertNoStackTrace(r.errors)
})

await test('COND 10: lien_waiver_required=true, approved waiver exists → passes', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      deal: { lien_waiver_required: true },
      // lienWaiver not in cfg → default approved waiver row returned
    }) as never,
    'ms-1', funder())
  assert(r.allowed, `Approved waiver should pass: ${r.errors.join(' | ')}`)
})

await test('COND 10: lien waiver query error → blocked safely', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      deal: { lien_waiver_required: true },
      lienWaiverError: true,
    }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block on DB error — fail-closed')
  assertContains(r.errors.join(' '), 'lien waiver')
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-FAILURE — all data conditions fail simultaneously
// ═══════════════════════════════════════════════════════════════════════════════

await test('MULTI: all data conditions fail → ≥5 distinct errors returned simultaneously', async () => {
  const r = await validateRelease(
    buildSupabaseMock({
      milestone:        { status: 'in_progress', protection_status: 'pending' },
      deal:             { funded_amount: 0 },
      contractorProfile:{ stripe_payouts_enabled: false, onboarding_complete: false },
      existingRelease:  { id: 'release-xyz' },
      openChangeOrders: [{ id: 'co-1' }],
    }) as never,
    'ms-1', funder())
  assert(!r.allowed, 'Should block')
  // At minimum: cond 1, cond 2, cond 3, cond 4, cond 5, cond 6, cond 7 = 7 errors
  assert(r.errors.length >= 5,
    `Expected ≥5 errors, got ${r.errors.length}:\n${r.errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}`)
  assertNoStackTrace(r.errors)
})

// ═══════════════════════════════════════════════════════════════════════════════
// AI PRECONDITION  (checkAiPrecondition — checked BEFORE the 10-condition gate)
// ═══════════════════════════════════════════════════════════════════════════════

await test('AI: no review at all → fails, mentions "required"', async () => {
  const r = await checkAiPrecondition('ms-1', buildAuditMock({ noReview: true }) as never)
  assert(!r.passed, 'Should fail — no review exists')
  assert(r.reason !== undefined, 'Should provide a reason')
  assertContains(r.reason!, 'required')
})

await test('AI: valid review, low risk, 1 h old → passes', async () => {
  const r = await checkAiPrecondition('ms-1',
    buildAuditMock({ reviewAgeMs: 60 * 60 * 1000, reviewRiskLevel: 'low' }) as never)
  assert(r.passed, `Should pass but got reason: ${r.reason}`)
})

await test('AI: critical risk review → fails, mentions "critical"', async () => {
  const r = await checkAiPrecondition('ms-1',
    buildAuditMock({ reviewRiskLevel: 'critical' }) as never)
  assert(!r.passed, 'Critical risk should block')
  assert(r.reason !== undefined, 'Should provide a reason')
  assertContains(r.reason!, 'critical')
})

await test('AI: expired review (49 h old), no override → fails, mentions "expired"', async () => {
  const r = await checkAiPrecondition('ms-1',
    buildAuditMock({ reviewAgeMs: 49 * 60 * 60 * 1000 }) as never)
  assert(!r.passed, 'Expired review should fail')
  assert(r.reason !== undefined, 'Should provide a reason')
  assertContains(r.reason!, 'expired')
})

await test('AI: active admin override (1 h old, within 4 h TTL) → passes with warning', async () => {
  const r = await checkAiPrecondition('ms-1',
    buildAuditMock({ noReview: true, overrideAgeMs: 60 * 60 * 1000 }) as never)
  assert(r.passed, `Active override should pass but got reason: ${r.reason}`)
  assert(r.warning !== undefined, 'Should include a warning field when override is active')
  assertContains(r.warning!, 'override')
})

await test('AI: expired admin override (5 h old, beyond 4 h TTL) → fails', async () => {
  const r = await checkAiPrecondition('ms-1',
    buildAuditMock({ noReview: true, overrideAgeMs: 5 * 60 * 60 * 1000 }) as never)
  assert(!r.passed, 'Expired override should fail')
})

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

await test('SM: funder cannot directly trigger approved→released (system-only)', () => {
  const r = validateTransition('approved', 'released', 'funder')
  assert(!r.valid, 'Should reject')
  assertContains(r.error!, 'system')
})

await test('SM: contractor cannot trigger approved→released', () => {
  const r = validateTransition('approved', 'released', 'contractor')
  assert(!r.valid, 'Should reject')
  assertContains(r.error!, 'system')
})

await test('SM: admin cannot trigger approved→released via transition API', () => {
  const r = validateTransition('approved', 'released', 'admin')
  assert(!r.valid, 'Should reject — must go via release endpoint')
  assertContains(r.error!, 'system')
})

await test('SM: invalid jump in_progress→released → rejected with guidance', () => {
  const r = validateTransition('in_progress', 'released', 'funder')
  assert(!r.valid, 'Should reject')
  assertContains(r.error!, 'ready_for_review')
})

await test('SM: released is terminal — no further transitions', () => {
  const r = validateTransition('released', 'in_progress', 'admin')
  assert(!r.valid, 'Should reject')
  assertContains(r.error!, 'terminal')
})

await test('SM: valid contractor transition not_started→in_progress → allowed', () => {
  const r = validateTransition('not_started', 'in_progress', 'contractor')
  assert(r.valid, `Should allow but got: ${r.error}`)
})

await test('SM: valid funder transition ready_for_review→approved → allowed', () => {
  const r = validateTransition('ready_for_review', 'approved', 'funder')
  assert(r.valid, `Should allow but got: ${r.error}`)
})

await test('SM: funder can send work back in_progress from ready_for_review', () => {
  const r = validateTransition('ready_for_review', 'in_progress', 'funder')
  assert(r.valid, `Should allow but got: ${r.error}`)
})

// ── RESULTS ───────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — RELEASE GATE END-TO-END TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)

} // end main()

main().catch(e => { console.error(e); process.exit(1) })
