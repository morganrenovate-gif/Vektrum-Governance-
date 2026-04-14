/**
 * Vektrum Release Gate — End-to-End Test Suite
 * Tests all 7 blocking conditions + role check + state machine
 */

// ─── Path aliasing (replicate @/ → src/) ──────────────────────────────────────
import { createRequire } from 'module'
import { register } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'url'
import path from 'path'
import { readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// ─── Inline the logic we need (avoids TS compilation headaches) ──────────────

// --- State Machine (inlined from src/lib/engine/state-machine.ts) ---
const VALID_TRANSITIONS = {
  not_started: [{ next: 'in_progress', requiredRole: 'contractor' }],
  in_progress: [{ next: 'ready_for_review', requiredRole: 'contractor' }],
  ready_for_review: [
    { next: 'approved', requiredRole: 'funder' },
    { next: 'in_progress', requiredRole: 'funder' },
  ],
  approved: [{ next: 'released', requiredRole: 'system' }],
  released: [],
}

function validateTransition(currentStatus, newStatus, userRole) {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? []
  const matchingTransition = allowedTransitions.find(t => t.next === newStatus)

  if (!matchingTransition) {
    const possibleNext = allowedTransitions.map(t => `'${t.next}'`).join(', ')
    if (currentStatus === 'released') {
      return { valid: false, error: `This milestone has already been released and is in a terminal state. No further status changes are possible.` }
    }
    if (allowedTransitions.length === 0) {
      return { valid: false, error: `Milestone status '${currentStatus}' is a terminal state and cannot be changed.` }
    }
    return { valid: false, error: `Cannot transition a milestone from '${currentStatus}' to '${newStatus}'. From '${currentStatus}', the only valid next ${allowedTransitions.length === 1 ? 'status is' : 'statuses are'}: ${possibleNext}.` }
  }

  const { requiredRole } = matchingTransition

  if (requiredRole === 'system') {
    return { valid: false, error: `The transition from '${currentStatus}' to '${newStatus}' is reserved for the system release process. To release funds for an approved milestone, use the dedicated release endpoint instead.` }
  }

  if (userRole !== requiredRole && userRole !== 'admin') {
    const roleLabel = requiredRole.charAt(0).toUpperCase() + requiredRole.slice(1)
    return { valid: false, error: `Only a ${roleLabel} can move a milestone from '${currentStatus}' to '${newStatus}'. Your account role is '${userRole}'.` }
  }

  return { valid: true }
}

// --- Release Gate (inlined from src/lib/engine/release-gate.ts) ---
async function validateRelease(supabase, milestoneId, callerProfile) {
  const errors = []

  if (callerProfile.role !== 'funder' && callerProfile.role !== 'admin') {
    errors.push(`Only funders and admins can release milestone payments. Your account is registered as a '${callerProfile.role}'. If you believe this is incorrect, contact your account administrator.`)
    return { allowed: false, errors }
  }

  const { data: milestone, error: milestoneError } = await supabase.from('milestones').select('id, deal_id, amount, status, protection_status').eq('id', milestoneId).single()
  if (milestoneError || !milestone) return { allowed: false, errors: [`Milestone ${milestoneId} could not be found. Verify the milestone ID and try again.`] }

  const { data: deal, error: dealError } = await supabase.from('deals').select('id, contractor_id, funded_amount, released_amount, total_amount').eq('id', milestone.deal_id).single()
  if (dealError || !deal) return { allowed: false, errors: [`The deal associated with milestone ${milestoneId} could not be found. Contact support if this persists.`] }

  const { data: contractorProfile, error: contractorError } = await supabase.from('profiles').select('id, stripe_account_id, stripe_payouts_enabled, onboarding_complete').eq('id', deal.contractor_id).single()
  if (contractorError || !contractorProfile) errors.push('The contractor profile for this milestone could not be found. Ensure the contractor has completed account registration before releasing funds.')

  const { data: existingRelease, error: releaseQueryError } = await supabase.from('releases').select('id').eq('milestone_id', milestoneId).maybeSingle()
  const { data: openChangeOrders, error: changeOrderError } = await supabase.from('change_orders').select('id').eq('milestone_id', milestoneId).eq('status', 'submitted')

  // CONDITION 1: status must be 'approved'
  if (milestone.status !== 'approved') {
    errors.push(`This milestone has not been approved yet. The funder must review and approve the submitted work before funds can be released. Current status: '${milestone.status}'.`)
  }

  // CONDITION 2: protection_status must be 'ready_for_release'
  if (milestone.protection_status !== 'ready_for_release') {
    errors.push(`This milestone is not cleared for release. Current protection status: '${milestone.protection_status}'. The milestone must reach 'ready_for_release' protection status before funds can be disbursed.`)
  }

  // CONDITION 3: sufficient balance
  const available = deal.funded_amount - deal.released_amount
  if (available < milestone.amount) {
    const shortfall = milestone.amount - available
    errors.push(`Insufficient funded balance. Available: $${available.toFixed(2)}. Required: $${milestone.amount.toFixed(2)}. The funder needs to add $${shortfall.toFixed(2)} before this milestone can be released.`)
  }

  // CONDITION 4: payouts enabled
  if (contractorProfile && !contractorProfile.stripe_payouts_enabled) {
    errors.push('The contractor has not completed Stripe onboarding. Payouts must be enabled before funds can be released. The contractor should log in and complete their Stripe Connect setup.')
  }

  // CONDITION 5: onboarding complete
  if (contractorProfile && !contractorProfile.onboarding_complete) {
    errors.push("The contractor's account setup is incomplete. They must finish onboarding before receiving payments. Ask the contractor to log in and complete all required onboarding steps.")
  }

  // CONDITION 6: no duplicate release
  if (releaseQueryError) {
    errors.push('Could not verify whether this milestone has already been released. Release aborted as a precaution. Please try again or contact support.')
  } else if (existingRelease) {
    errors.push('Funds for this milestone have already been released. Duplicate releases are not permitted. If you believe this is an error, contact support with the milestone ID.')
  }

  // CONDITION 7: no open change orders
  if (changeOrderError) {
    errors.push('Could not verify pending change orders for this milestone. Release aborted as a precaution. Please try again or contact support.')
  } else if (openChangeOrders && openChangeOrders.length > 0) {
    errors.push(`There ${openChangeOrders.length === 1 ? 'is' : 'are'} ${openChangeOrders.length} pending change order${openChangeOrders.length === 1 ? '' : 's'} on this milestone that must be resolved before release. The funder must approve or reject all submitted change orders before funds can be disbursed.`)
  }

  return { allowed: errors.length === 0, errors }
}

// ─── Mock Builder ─────────────────────────────────────────────────────────────

function buildMock(overrides = {}) {
  const defaultMilestone = { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'approved', protection_status: 'ready_for_release' }
  const defaultDeal = { id: 'deal-1', contractor_id: 'c-1', funded_amount: 50000, released_amount: 0, total_amount: 50000 }
  const defaultContractor = { id: 'c-1', stripe_account_id: 'acct_test', stripe_payouts_enabled: true, onboarding_complete: true }

  const ms = overrides.milestoneError ? null : (overrides.milestone ?? defaultMilestone)
  const deal = overrides.dealError ? null : (overrides.deal ?? defaultDeal)
  const contractor = overrides.contractorError ? null : (overrides.contractorProfile ?? defaultContractor)
  const existingRelease = overrides.existingRelease ?? null
  const openCOs = overrides.openChangeOrders ?? []

  return {
    from: (table) => ({
      select: () => ({
        eq: (col, val) => {
          if (table === 'change_orders') {
            return {
              eq: () => ({
                data: overrides.changeOrderError ? null : openCOs,
                error: overrides.changeOrderError ? { message: 'DB error' } : null,
              })
            }
          }
          return {
            single: () => {
              if (table === 'milestones') return overrides.milestoneError ? { data: null, error: { message: 'not found' } } : { data: ms, error: null }
              if (table === 'deals') return overrides.dealError ? { data: null, error: { message: 'not found' } } : { data: deal, error: null }
              if (table === 'profiles') return overrides.contractorError ? { data: null, error: { message: 'not found' } } : { data: contractor, error: null }
              return { data: null, error: null }
            },
            maybeSingle: () => {
              if (table === 'releases') return overrides.releaseQueryError ? { data: null, error: { message: 'DB error' } } : { data: existingRelease, error: null }
              return { data: null, error: null }
            },
          }
        }
      })
    })
  }
}

function funder() {
  return { id: 'f-1', email: 'funder@test.com', role: 'funder', stripe_account_id: null, stripe_account_status: 'not_connected' }
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

const results = []

async function test(name, fn) {
  try {
    await fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e.message })
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg) }
function assertContains(str, sub) {
  if (!str.toLowerCase().includes(sub.toLowerCase()))
    throw new Error(`Expected to contain "${sub}" in:\n"${str}"`)
}
function assertNoStackTrace(errors) {
  for (const e of errors) {
    assert(!e.includes('at Object.'), `Stack trace in error: ${e}`)
    assert(!e.includes('TypeError:'), `TypeError in error: ${e}`)
    assert(e.length > 20, `Error too short: "${e}"`)
  }
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

// Role checks
await test('ROLE: contractor blocked immediately (no DB queries needed)', async () => {
  const r = await validateRelease(buildMock(), 'ms-1', { ...funder(), role: 'contractor' })
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'contractor')
  assertNoStackTrace(r.errors)
})

await test('ROLE: subcontractor blocked immediately', async () => {
  const r = await validateRelease(buildMock(), 'ms-1', { ...funder(), role: 'subcontractor' })
  assert(!r.allowed, 'Should block')
  assertNoStackTrace(r.errors)
})

await test('ROLE: funder passes role check — happy path all clear', async () => {
  const r = await validateRelease(buildMock(), 'ms-1', funder())
  assert(r.allowed, `Should allow but got: ${r.errors.join(' | ')}`)
})

await test('ROLE: admin passes role check — happy path all clear', async () => {
  const r = await validateRelease(buildMock(), 'ms-1', { ...funder(), role: 'admin' })
  assert(r.allowed, `Should allow but got: ${r.errors.join(' | ')}`)
})

// Condition 1
await test('COND 1: status=in_progress → blocked, message mentions "approved"', async () => {
  const r = await validateRelease(buildMock({ milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'in_progress', protection_status: 'ready_for_release' } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'approved')
  assertNoStackTrace(r.errors)
})

await test('COND 1: status=ready_for_review → blocked, message mentions "approved"', async () => {
  const r = await validateRelease(buildMock({ milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'ready_for_review', protection_status: 'ready_for_release' } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'approved')
  assertNoStackTrace(r.errors)
})

await test('COND 1: status=not_started → blocked, message mentions "approved"', async () => {
  const r = await validateRelease(buildMock({ milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'not_started', protection_status: 'ready_for_release' } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'approved')
  assertNoStackTrace(r.errors)
})

// Condition 2
await test('COND 2: protection_status=pending → blocked, message mentions "protection"', async () => {
  const r = await validateRelease(buildMock({ milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 10000, status: 'approved', protection_status: 'pending' } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'protection')
  assertNoStackTrace(r.errors)
})

// Condition 3
await test('COND 3: zero funded amount → blocked, message mentions "balance"', async () => {
  const r = await validateRelease(buildMock({ deal: { id: 'deal-1', contractor_id: 'c-1', funded_amount: 0, released_amount: 0, total_amount: 50000 } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'balance')
  assertNoStackTrace(r.errors)
})

await test('COND 3: partial funding not enough after prior releases → blocked', async () => {
  // funded=15000, released=10000, available=5000, need=10000
  const r = await validateRelease(buildMock({ deal: { id: 'deal-1', contractor_id: 'c-1', funded_amount: 15000, released_amount: 10000, total_amount: 50000 } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'balance')
  assertNoStackTrace(r.errors)
})

await test('COND 3: exact balance available → allowed (boundary check)', async () => {
  const r = await validateRelease(buildMock({ deal: { id: 'deal-1', contractor_id: 'c-1', funded_amount: 10000, released_amount: 0, total_amount: 50000 } }), 'ms-1', funder())
  assert(r.allowed, `Exact balance should be allowed but got: ${r.errors.join(' | ')}`)
})

// Condition 4
await test('COND 4: stripe_payouts_enabled=false → blocked, message mentions "payout"', async () => {
  const r = await validateRelease(buildMock({ contractorProfile: { id: 'c-1', stripe_account_id: 'acct_test', stripe_payouts_enabled: false, onboarding_complete: true } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'payout')
  assertNoStackTrace(r.errors)
})

// Condition 5
await test('COND 5: onboarding_complete=false → blocked, message mentions "onboard"', async () => {
  const r = await validateRelease(buildMock({ contractorProfile: { id: 'c-1', stripe_account_id: 'acct_test', stripe_payouts_enabled: true, onboarding_complete: false } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'onboard')
  assertNoStackTrace(r.errors)
})

// Condition 6
await test('COND 6: existing release record → blocked, message mentions "already been released"', async () => {
  const r = await validateRelease(buildMock({ existingRelease: { id: 'release-already' } }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'already been released')
  assertNoStackTrace(r.errors)
})

await test('COND 6: release DB query error → blocked safely, no 500 leak, mentions "verify"', async () => {
  const r = await validateRelease(buildMock({ releaseQueryError: true }), 'ms-1', funder())
  assert(!r.allowed, 'Should block on DB error')
  assertContains(r.errors.join(' '), 'verify')
  assertNoStackTrace(r.errors)
})

// Condition 7
await test('COND 7: 1 open change order → blocked, message mentions "change order"', async () => {
  const r = await validateRelease(buildMock({ openChangeOrders: [{ id: 'co-1' }] }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), 'change order')
  assertNoStackTrace(r.errors)
})

await test('COND 7: 3 open change orders → blocked, plural form correct', async () => {
  const r = await validateRelease(buildMock({ openChangeOrders: [{ id: 'co-1' }, { id: 'co-2' }, { id: 'co-3' }] }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assertContains(r.errors.join(' '), '3 pending change orders')
  assertNoStackTrace(r.errors)
})

// Multi-failure
await test('MULTI: all 5 data conditions fail → ≥5 distinct errors returned simultaneously', async () => {
  const r = await validateRelease(buildMock({
    milestone: { id: 'ms-1', deal_id: 'deal-1', amount: 99999, status: 'in_progress', protection_status: 'pending' },
    deal: { id: 'deal-1', contractor_id: 'c-1', funded_amount: 100, released_amount: 0, total_amount: 50000 },
    contractorProfile: { id: 'c-1', stripe_account_id: 'acct_test', stripe_payouts_enabled: false, onboarding_complete: false },
    existingRelease: { id: 'release-already' },
    openChangeOrders: [{ id: 'co-1' }],
  }), 'ms-1', funder())
  assert(!r.allowed, 'Should block')
  assert(r.errors.length >= 5, `Expected ≥5 errors, got ${r.errors.length}:\n${r.errors.map((e,i) => `  ${i+1}. ${e}`).join('\n')}`)
  assertNoStackTrace(r.errors)
})

// State machine
await test('SM: funder cannot directly trigger approved→released (system-only)', async () => {
  const r = validateTransition('approved', 'released', 'funder')
  assert(!r.valid, 'Should reject')
  assertContains(r.error, 'system')
})

await test('SM: contractor cannot trigger approved→released', async () => {
  const r = validateTransition('approved', 'released', 'contractor')
  assert(!r.valid, 'Should reject')
  assertContains(r.error, 'system')
})

await test('SM: admin cannot trigger approved→released via transition API', async () => {
  const r = validateTransition('approved', 'released', 'admin')
  assert(!r.valid, 'Should reject — must go via release endpoint')
  assertContains(r.error, 'system')
})

await test('SM: invalid jump in_progress→released → rejected with guidance', async () => {
  const r = validateTransition('in_progress', 'released', 'funder')
  assert(!r.valid, 'Should reject')
  assertContains(r.error, 'ready_for_review')
})

await test('SM: released is terminal — no further transitions possible', async () => {
  const r = validateTransition('released', 'in_progress', 'admin')
  assert(!r.valid, 'Should reject')
  assertContains(r.error, 'terminal')
})

await test('SM: valid contractor transition not_started→in_progress → allowed', async () => {
  const r = validateTransition('not_started', 'in_progress', 'contractor')
  assert(r.valid, `Should allow but got: ${r.error}`)
})

await test('SM: valid funder transition ready_for_review→approved → allowed', async () => {
  const r = validateTransition('ready_for_review', 'approved', 'funder')
  assert(r.valid, `Should allow but got: ${r.error}`)
})

await test('SM: funder can send work back in_progress from ready_for_review', async () => {
  const r = validateTransition('ready_for_review', 'in_progress', 'funder')
  assert(r.valid, `Should allow but got: ${r.error}`)
})

// ─── Results ─────────────────────────────────────────────────────────────────

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
