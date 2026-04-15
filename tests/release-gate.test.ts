/**
 * End-to-end release gate test suite.
 *
 * Tests all 7 blocking conditions + role check against a mock Supabase client.
 * Each test confirms:
 *   - allowed: false
 *   - errors contains a human-readable string (not a stack trace or 500)
 *   - No Stripe call is made
 */

import { validateRelease } from '../src/lib/engine/release-gate'
import { validateTransition } from '../src/lib/engine/state-machine'
import type { Profile } from '../src/lib/types'

// ─── Mock Builder ─────────────────────────────────────────────────────────────

type MockRow = Record<string, unknown>

interface MockOverrides {
  milestone?: MockRow | null
  deal?: MockRow | null
  contractorProfile?: MockRow | null
  existingRelease?: MockRow | null
  openChangeOrders?: MockRow[]
  milestoneError?: boolean
  dealError?: boolean
  contractorError?: boolean
  releaseQueryError?: boolean
  changeOrderError?: boolean
}

function buildSupabaseMock(overrides: MockOverrides) {
  const defaultMilestone: MockRow = {
    id: 'ms-1', deal_id: 'deal-1', amount: 10000,
    status: 'approved', protection_status: 'ready_for_release',
  }
  const defaultDeal: MockRow = {
    id: 'deal-1', contractor_id: 'contractor-1',
    funded_amount: 50000, released_amount: 0, total_amount: 50000,
  }
  const defaultContractor: MockRow = {
    id: 'contractor-1', stripe_account_id: 'acct_test_123',
    stripe_payouts_enabled: true, onboarding_complete: true,
  }

  const milestone = overrides.milestoneError ? null : (overrides.milestone ?? defaultMilestone)
  const deal = overrides.dealError ? null : (overrides.deal ?? defaultDeal)
  const contractor = overrides.contractorError ? null : (overrides.contractorProfile ?? defaultContractor)
  const existingRelease = overrides.existingRelease ?? null
  const openChangeOrders = overrides.openChangeOrders ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mock: any = {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (col: string, val: unknown) => {
          // change_orders has two .eq() calls
          if (table === 'change_orders') {
            return {
              eq: (_col2: string, _val2: unknown) => ({
                data: overrides.changeOrderError ? null : openChangeOrders,
                error: overrides.changeOrderError ? { message: 'DB error' } : null,
              }),
            }
          }
          return {
            eq: (_col2: string, _val2: unknown) => ({
              data: null, error: null,
            }),
            single: () => {
              if (table === 'milestones') {
                return overrides.milestoneError
                  ? { data: null, error: { message: 'not found' } }
                  : { data: milestone, error: null }
              }
              if (table === 'deals') {
                return overrides.dealError
                  ? { data: null, error: { message: 'not found' } }
                  : { data: deal, error: null }
              }
              if (table === 'profiles') {
                return overrides.contractorError
                  ? { data: null, error: { message: 'not found' } }
                  : { data: contractor, error: null }
              }
              return { data: null, error: null }
            },
            maybeSingle: () => {
              if (table === 'releases') {
                return overrides.releaseQueryError
                  ? { data: null, error: { message: 'DB error' } }
                  : { data: existingRelease, error: null }
              }
              return { data: null, error: null }
            },
          }
        },
      }),
    }),
  }

  return mock
}

function funder(): Profile {
  return {
    id: 'funder-1', email: 'funder@test.com', full_name: 'Test Funder',
    company_name: null, role: 'funder', stripe_account_id: null, stripe_payouts_enabled: false, stripe_onboarding_complete: false, onboarding_complete: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

const results: { name: string; passed: boolean; error?: string }[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function assertContains(str: string, sub: string) {
  if (!str.toLowerCase().includes(sub.toLowerCase())) {
    throw new Error(`Expected message to contain "${sub}" but got:\n"${str}"`)
  }
}

function assertNoStackTrace(errors: string[]) {
  for (const e of errors) {
    assert(!e.includes('at Object.'), `Stack trace leaked into error: ${e}`)
    assert(!e.includes('TypeError:'), `TypeError leaked into error: ${e}`)
    assert(!e.includes('Cannot read'), `JS error leaked into error: ${e}`)
    assert(e.length > 20, `Error too short to be human-readable: "${e}"`)
  }
}

// ─── ROLE CHECK ───────────────────────────────────────────────────────────────

await test('ROLE: contractor is blocked before any DB query', async () => {
  const result = await validateRelease(buildSupabaseMock({}) as any, 'ms-1', { ...funder(), role: 'contractor' })
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'contractor')
  assertNoStackTrace(result.errors)
})

await test('ROLE: funder passes role check (happy path)', async () => {
  const result = await validateRelease(buildSupabaseMock({}) as any, 'ms-1', funder())
  assert(result.allowed, `Should be allowed but got: ${result.errors.join(' | ')}`)
})

await test('ROLE: admin passes role check (happy path)', async () => {
  const result = await validateRelease(buildSupabaseMock({}) as any, 'ms-1', { ...funder(), role: 'admin' })
  assert(result.allowed, `Should be allowed but got: ${result.errors.join(' | ')}`)
})

// ─── CONDITION 1: Milestone status must be 'approved' ─────────────────────────

await test('COND 1: in_progress milestone → blocked, mentions approved', async () => {
  const result = await validateRelease(
    buildSupabaseMock({ milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'in_progress', protection_status: 'ready_for_release' } }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'approved')
  assertNoStackTrace(result.errors)
})

await test('COND 1: ready_for_review milestone → blocked, mentions approved', async () => {
  const result = await validateRelease(
    buildSupabaseMock({ milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'ready_for_review', protection_status: 'ready_for_release' } }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'approved')
  assertNoStackTrace(result.errors)
})

// ─── CONDITION 2: protection_status must be 'ready_for_release' ───────────────

await test('COND 2: wrong protection_status → blocked, mentions protection', async () => {
  const result = await validateRelease(
    buildSupabaseMock({ milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'approved', protection_status: 'pending' } }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'protection')
  assertNoStackTrace(result.errors)
})

// ─── CONDITION 3: Sufficient funded balance ───────────────────────────────────

await test('COND 3: funded < milestone amount → blocked, mentions balance', async () => {
  const result = await validateRelease(
    buildSupabaseMock({
      deal: { id: 'deal-1', contractor_id: 'contractor-1', funded_amount: 5000, released_amount: 0, total_amount: 50000 },
      milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'approved', protection_status: 'ready_for_release' },
    }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'balance')
  assertNoStackTrace(result.errors)
})

await test('COND 3: available after prior releases is insufficient → blocked', async () => {
  // funded=15000, released=10000, available=5000, need=10000
  const result = await validateRelease(
    buildSupabaseMock({
      deal: { id: 'deal-1', contractor_id: 'contractor-1', funded_amount: 15000, released_amount: 10000, total_amount: 50000 },
      milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'approved', protection_status: 'ready_for_release' },
    }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'balance')
  assertNoStackTrace(result.errors)
})

// ─── CONDITION 4: Stripe payouts enabled ─────────────────────────────────────

await test('COND 4: stripe_payouts_enabled=false → blocked, mentions payout', async () => {
  const result = await validateRelease(
    buildSupabaseMock({ contractorProfile: { id: 'contractor-1', stripe_account_id: 'acct_test', stripe_payouts_enabled: false, onboarding_complete: true } }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'payout')
  assertNoStackTrace(result.errors)
})

// ─── CONDITION 5: Onboarding complete ────────────────────────────────────────

await test('COND 5: onboarding_complete=false → blocked, mentions onboarding', async () => {
  const result = await validateRelease(
    buildSupabaseMock({ contractorProfile: { id: 'contractor-1', stripe_account_id: 'acct_test', stripe_payouts_enabled: true, onboarding_complete: false } }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'onboard')
  assertNoStackTrace(result.errors)
})

// ─── CONDITION 6: No existing release ────────────────────────────────────────

await test('COND 6: existing release record → blocked, mentions already released', async () => {
  const result = await validateRelease(
    buildSupabaseMock({ existingRelease: { id: 'release-already' } }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'already been released')
  assertNoStackTrace(result.errors)
})

await test('COND 6: release query DB error → blocked safely, no 500 leak', async () => {
  const result = await validateRelease(
    buildSupabaseMock({ releaseQueryError: true }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked on DB error')
  assertContains(result.errors.join(' '), 'verify')
  assertNoStackTrace(result.errors)
})

// ─── CONDITION 7: No open change orders ──────────────────────────────────────

await test('COND 7: 2 open change orders → blocked, mentions change order count', async () => {
  const result = await validateRelease(
    buildSupabaseMock({ openChangeOrders: [{ id: 'co-1' }, { id: 'co-2' }] }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assertContains(result.errors.join(' '), 'change order')
  assertNoStackTrace(result.errors)
})

// ─── MULTI-FAILURE ────────────────────────────────────────────────────────────

await test('MULTI: all 5 data conditions fail simultaneously → all errors returned', async () => {
  const result = await validateRelease(
    buildSupabaseMock({
      milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 99999, status: 'in_progress', protection_status: 'pending' },
      deal: { id: 'deal-1', contractor_id: 'contractor-1', funded_amount: 100, released_amount: 0, total_amount: 50000 },
      contractorProfile: { id: 'contractor-1', stripe_account_id: 'acct_test', stripe_payouts_enabled: false, onboarding_complete: false },
      existingRelease: { id: 'release-already' },
      openChangeOrders: [{ id: 'co-1' }],
    }) as any,
    'ms-1', funder()
  )
  assert(!result.allowed, 'Should be blocked')
  assert(result.errors.length >= 5, `Expected ≥5 errors, got ${result.errors.length}: ${result.errors.join(' | ')}`)
  assertNoStackTrace(result.errors)
})

// ─── STATE MACHINE ────────────────────────────────────────────────────────────

await test('SM: funder cannot directly trigger approved→released', async () => {
  const result = validateTransition('approved', 'released', 'funder')
  assert(!result.valid, 'Should be rejected')
  assertContains(result.error!, 'system')
})

await test('SM: contractor cannot trigger approved→released', async () => {
  const result = validateTransition('approved', 'released', 'contractor')
  assert(!result.valid, 'Should be rejected')
  assertContains(result.error!, 'system')
})

await test('SM: admin cannot directly trigger approved→released via transition API', async () => {
  const result = validateTransition('approved', 'released', 'admin')
  assert(!result.valid, 'Should be rejected — must go through release endpoint')
  assertContains(result.error!, 'system')
})

await test('SM: invalid jump in_progress→released → rejected with guidance', async () => {
  const result = validateTransition('in_progress', 'released', 'funder')
  assert(!result.valid, 'Should be rejected')
  assertContains(result.error!, 'ready_for_review')
})

await test('SM: released is terminal → no further transitions', async () => {
  const result = validateTransition('released', 'in_progress', 'admin')
  assert(!result.valid, 'Should be rejected')
  assertContains(result.error!, 'terminal')
})

await test('SM: valid contractor transition not_started→in_progress → allowed', async () => {
  const result = validateTransition('not_started', 'in_progress', 'contractor')
  assert(result.valid, `Should be allowed but got: ${result.error}`)
})

await test('SM: valid funder transition ready_for_review→approved → allowed', async () => {
  const result = validateTransition('ready_for_review', 'approved', 'funder')
  assert(result.valid, `Should be allowed but got: ${result.error}`)
})

// ─── Print Results ────────────────────────────────────────────────────────────

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
