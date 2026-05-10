/**
 * tests/partner-confirm-fail-atomicity.test.ts
 *
 * Guards the atomic partner release state-transition behavior introduced in
 * migration 20260511000000_partner_release_atomic_transitions.sql.
 *
 * This file tests the ROUTE BEHAVIOR given various RPC outcomes. It does not
 * exercise the actual PostgreSQL SELECT FOR UPDATE — that lock is a DB runtime
 * property that can only be verified against a live Postgres instance. What we
 * CAN verify (and what must be regression-guarded) is:
 *
 *   1. Routes call the atomic RPC functions (not direct table UPDATEs) so that
 *      the DB-level lock is actually invoked in production.
 *   2. Every RPC outcome maps to the correct HTTP status and response body.
 *   3. Every RPC outcome emits the correct audit event (no silent failures).
 *   4. The `partner_ack_hash` is bound to all audit events in all paths.
 *   5. Idempotent outcomes (already_confirmed, already_failed) return 200.
 *   6. Conflict outcomes return 409 with the EXECUTION_CONFLICT code.
 *   7. The migration exists and declares the two expected functions.
 *   8. The routes no longer contain direct `.update({execution_status})` calls —
 *      all state transitions go through the RPC.
 *
 * Simulated race scenarios (all handled by returning the RPC outcome a
 * concurrent DB session would produce after winning the row lock):
 *
 *   CONFIRM scenarios:
 *   a) Normal success                — RPC returns 'confirmed'        → 200
 *   b) Idempotent retry (same ref)  — RPC returns 'already_confirmed' → 200 + idempotent audit
 *   c) Conflicting confirm (diff ref)— RPC returns 'conflict'         → 409 + conflict audit
 *   d) Fail won the race first       — RPC returns 'wrong_status'     → 400
 *   e) RPC error (DB failure)        — RPC returns error              → 500 + audit
 *
 *   FAIL scenarios:
 *   f) Normal success                — RPC returns 'failed'           → 200
 *   g) Idempotent retry              — RPC returns 'already_failed'   → 200 + idempotent audit
 *   h) Confirm won the race first    — RPC returns 'conflict'         → 409 + fail_rejected audit
 *   i) Wrong status (reversed, etc.) — RPC returns 'wrong_status'     → 400
 *   j) RPC error (DB failure)        — RPC returns error              → 500 + audit
 *
 * Run: npx tsx tests/partner-confirm-fail-atomicity.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'module'
import { NextRequest, NextResponse } from 'next/server'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')
const req        = createRequire(import.meta.url)

// ─── Test runner ──────────────────────────────────────────────────────────────

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

// ─── Static source-code checks (sections 1, 2, 8) ────────────────────────────

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// ─── Module paths ─────────────────────────────────────────────────────────────

const supabaseAdminPath = path.resolve(ROOT, 'src/lib/supabase/admin.ts')
const partnerAuthPath   = path.resolve(ROOT, 'src/lib/auth/partner.ts')
const auditPath         = path.resolve(ROOT, 'src/lib/engine/audit.ts')
const billingPath       = path.resolve(ROOT, 'src/lib/engine/billing.ts')
const errorsPath        = path.resolve(ROOT, 'src/lib/errors.ts')
const rateLimitPath     = path.resolve(ROOT, 'src/lib/engine/rate-limit.ts')
const confirmRoutePath  = path.resolve(ROOT, 'src/app/api/partner/releases/[releaseId]/confirm/route.ts')
const failRoutePath     = path.resolve(ROOT, 'src/app/api/partner/releases/[releaseId]/fail/route.ts')
const migrationPath     = path.resolve(ROOT, 'supabase/migrations/20260511000000_partner_release_atomic_transitions.sql')

// ─── Mutable test state ───────────────────────────────────────────────────────

type AuthMode = 'success' | 'throw-401'

let authMode:      AuthMode  = 'success'
let dbCallCount:   number    = 0
let auditEvents:   string[]  = []   // collects action names from logAudit calls
let rpcQueue:      Array<{ data: unknown; error: unknown }> = []
let tableQueues:   Record<string, Array<{ data: unknown; error: unknown }>> = {}

function resetState(opts: { authMode?: AuthMode } = {}) {
  authMode    = opts.authMode ?? 'success'
  dbCallCount = 0
  auditEvents = []
  rpcQueue    = []
  tableQueues = {}
}

function queueTable(table: string, response: { data: unknown; error: unknown }) {
  if (!tableQueues[table]) tableQueues[table] = []
  tableQueues[table].push(response)
}

function queueRpc(response: { data: unknown; error: unknown }) {
  rpcQueue.push(response)
}

// ─── Mock factory ─────────────────────────────────────────────────────────────

function makeModule(filename: string, exports: Record<string, unknown>) {
  return { id: filename, filename, loaded: true, exports, children: [], paths: [] } as unknown as NodeJS.Module
}

function makeMockAdmin() {
  dbCallCount++
  return {
    from: (table: string) => {
      let consumed = false
      function getResult(): { data: unknown; error: unknown } {
        if (consumed) return { data: null, error: null }
        consumed = true
        return tableQueues[table]?.shift() ?? { data: null, error: null }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select:      () => chain,
        eq:          () => chain,
        neq:         () => chain,
        in:          () => chain,
        update:      () => chain,
        insert:      () => Promise.resolve(getResult()),
        single:      () => getResult(),
        maybeSingle: () => getResult(),
        then: (
          onFulfilled: ((v: unknown) => unknown) | null,
          onRejected:  ((v: unknown) => unknown) | null,
        ) => Promise.resolve(getResult()).then(onFulfilled ?? undefined, onRejected ?? undefined),
      }
      return chain
    },
    rpc: (_fn: string, _args?: unknown) => {
      const item = rpcQueue.shift() ?? { data: null, error: null }
      return Promise.resolve(item)
    },
    auth: {
      admin: {
        getUserById: (_id: string) =>
          Promise.resolve({ data: { user: { email: 'mock@example.com' } }, error: null }),
      },
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        remove: () => Promise.resolve({ error: null }),
      }),
    },
  }
}

// ─── Install mocks ────────────────────────────────────────────────────────────

require.cache[supabaseAdminPath] = makeModule(supabaseAdminPath, {
  createSupabaseAdminClient: () => makeMockAdmin(),
})

require.cache[partnerAuthPath] = makeModule(partnerAuthPath, {
  requirePartnerAuth: async (_request: NextRequest) => {
    if (authMode === 'throw-401') {
      throw NextResponse.json({ error: 'Invalid or missing API key.' }, { status: 401 })
    }
    return {
      partnerId:      'partner-A',
      partnerName:    'Test Partner Ltd',
      webhookUrl:     null,
      keyEnvironment: 'test' as const,
    }
  },
})

require.cache[auditPath] = makeModule(auditPath, {
  logAudit: async (params: { action?: string }) => {
    if (params.action) auditEvents.push(params.action)
  },
})

require.cache[billingPath] = makeModule(billingPath, {
  calculateFee: (_amount: number, _bps: number) => ({
    grossAmount:     10_000,
    billingRateBps:  100,
    feeAmount:       100,
    totalDebit:      10_100,
  }),
  calculateRetainage: (_amount: number, _pct: number) => ({
    retainageAmount:  0,
    netToContractor:  10_000,
  }),
})

require.cache[errorsPath] = makeModule(errorsPath, {
  internalError:  (msg: string, _detail?: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
  notFoundError:  (msg: string) =>
    NextResponse.json({ error: msg }, { status: 404 }),
  validationError: (errors: string[]) =>
    NextResponse.json({ errors }, { status: 400 }),
})

require.cache[rateLimitPath] = makeModule(rateLimitPath, {
  POLICIES: {
    partner_api: {
      windowSeconds: 60,
      maxRequests:   60,
      description:   'partner API calls',
    },
  },
  checkRateLimit:        async () => ({ allowed: true, currentCount: 1, limit: 60, resetAt: '' }),
  rateLimitResponse:     (_result: unknown, _desc: string) =>
    NextResponse.json({ error: 'rate limited' }, { status: 429 }),
  logRateLimitViolation: () => { /* no-op */ },
})

// ─── Load routes (after mocks are installed) ──────────────────────────────────

delete require.cache[confirmRoutePath]
delete require.cache[failRoutePath]

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST: POST_CONFIRM } = req(confirmRoutePath) as { POST: Function }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST: POST_FAIL }    = req(failRoutePath)    as { POST: Function }

// ─── Test helpers ─────────────────────────────────────────────────────────────

const PARAMS = { params: Promise.resolve({ releaseId: 'rel-1' }) }

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/partner/releases/rel-1', {
    method:  'POST',
    body:    JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer vkp_test_abc' },
  })
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const RELEASE_PENDING = {
  id:                       'rel-1',
  milestone_id:             'ms-1',
  deal_id:                  'deal-1',
  amount:                   10_000,
  execution_rail:           'external_manual',
  execution_status:         'pending',
  external_execution_notes: null,
  authorization_token_id:   null,
}

const DEAL = {
  id:                   'deal-1',
  title:                'River Crossing',
  partner_id:           'partner-A',
  contractor_id:        'contractor-1',
  funder_id:            'funder-1',
  billing_rate_bps:     100,
  retainage_percentage: 0,
}

const MILESTONE = { id: 'ms-1', title: 'Foundation', amount: 10_000 }

const CONFIRM_BODY = { payment_method: 'wire', payment_reference: 'WIRE-REF-001' }
const FAIL_BODY    = { reason: 'Wire rejected by beneficiary bank — account closed.' }

// RPC outcome row shapes
const RPC_CONFIRMED         = [{ outcome: 'confirmed',         current_execution_status: 'confirmed',  current_payment_reference: 'WIRE-REF-001', current_executed_at: '2026-05-11T00:00:00Z' }]
const RPC_ALREADY_CONFIRMED = [{ outcome: 'already_confirmed', current_execution_status: 'confirmed',  current_payment_reference: 'WIRE-REF-001', current_executed_at: '2026-05-11T00:00:00Z' }]
const RPC_CONFLICT_CONFIRM  = [{ outcome: 'conflict',          current_execution_status: 'confirmed',  current_payment_reference: 'WIRE-REF-999', current_executed_at: '2026-05-11T00:00:00Z' }]
const RPC_WRONG_STATUS      = [{ outcome: 'wrong_status',      current_execution_status: 'failed',     current_payment_reference: null,           current_executed_at: null }]

const RPC_FAILED            = [{ outcome: 'failed',         current_execution_status: 'failed'     }]
const RPC_ALREADY_FAILED    = [{ outcome: 'already_failed', current_execution_status: 'failed'     }]
const RPC_CONFLICT_FAIL     = [{ outcome: 'conflict',       current_execution_status: 'confirmed'  }]
const RPC_WRONG_STATUS_FAIL = [{ outcome: 'wrong_status',   current_execution_status: 'reversed'   }]

// Queue the standard pre-RPC queries for confirm (release + deal + milestone)
function queueConfirmPreReqs() {
  queueTable('releases',        { data: RELEASE_PENDING, error: null })
  queueTable('deals',           { data: DEAL,            error: null })
  queueTable('milestones',      { data: MILESTONE,       error: null })
}

// Queue the standard post-RPC queries for confirm (billing + rpc calls)
function queueConfirmPostSuccess() {
  queueTable('billing_records', { data: null, error: null })
  queueRpc({ data: null, error: null })  // increment_deal_financials
  // no authorization_token_id in fixture, so token lookup is skipped
}

// Queue the standard pre-RPC queries for fail (release + deal)
function queueFailPreReqs() {
  queueTable('releases', { data: RELEASE_PENDING, error: null })
  queueTable('deals',    { data: DEAL,            error: null })
}

// ─── STATIC CHECKS ────────────────────────────────────────────────────────────

console.log('\n══ STATIC SOURCE CHECKS ════════════════════════════════════════════════')

console.log('\n── 1. Migration exists and declares both atomic functions ───────────────')

check(
  fs.existsSync(migrationPath),
  'Migration 20260511000000_partner_release_atomic_transitions.sql exists',
)

const migSrc = fs.readFileSync(migrationPath, 'utf-8')

check(
  migSrc.includes('partner_confirm_release_atomic'),
  'Migration declares partner_confirm_release_atomic function',
)
check(
  migSrc.includes('partner_fail_release_atomic'),
  'Migration declares partner_fail_release_atomic function',
)
check(
  (migSrc.match(/FOR UPDATE/g) ?? []).length >= 2,
  'Migration uses SELECT FOR UPDATE in both functions (≥ 2 occurrences)',
)
check(
  migSrc.includes("'confirmed'") &&
  migSrc.includes("'already_confirmed'") &&
  migSrc.includes("'conflict'"),
  "Migration defines 'confirmed', 'already_confirmed', and 'conflict' outcomes",
)
check(
  migSrc.includes("'failed'") &&
  migSrc.includes("'already_failed'"),
  "Migration defines 'failed' and 'already_failed' outcomes",
)
check(
  migSrc.includes('SECURITY DEFINER'),
  'Both functions use SECURITY DEFINER',
)

console.log('\n── 2. Confirm route calls atomic RPC (not direct table UPDATE) ──────────')

const confirmSrc = readSrc('src/app/api/partner/releases/[releaseId]/confirm/route.ts')

check(
  confirmSrc.includes('partner_confirm_release_atomic'),
  "Confirm route calls 'partner_confirm_release_atomic' RPC",
)
check(
  confirmSrc.includes("'already_confirmed'"),
  "Confirm route handles 'already_confirmed' outcome",
)
check(
  confirmSrc.includes("'conflict'"),
  "Confirm route handles 'conflict' outcome",
)
check(
  confirmSrc.includes('partner_release_confirm_idempotent'),
  "Confirm route emits 'partner_release_confirm_idempotent' audit event",
)
check(
  confirmSrc.includes('partner_release_confirm_conflict'),
  "Confirm route emits 'partner_release_confirm_conflict' audit event",
)
check(
  confirmSrc.includes('EXECUTION_CONFLICT'),
  "Confirm route returns EXECUTION_CONFLICT code for conflict",
)

// Confirm route must NOT do a direct table update where execution_status is the
// first key in the object literal — that pattern was the old conditional-update
// approach.  State transitions now go through the RPC function.
// We check for `execution_status` as the immediate first key after `.update({`.
const confirmDirectUpdates = (confirmSrc.match(/\.update\(\s*\{\s*\n?\s*execution_status/g) ?? []).length
check(
  confirmDirectUpdates === 0,
  `Confirm route has no direct .update({execution_status…}) calls — all transitions via RPC (found ${confirmDirectUpdates})`,
)

console.log('\n── 3. Fail route calls atomic RPC (not direct table UPDATE) ─────────────')

const failSrc = readSrc('src/app/api/partner/releases/[releaseId]/fail/route.ts')

check(
  failSrc.includes('partner_fail_release_atomic'),
  "Fail route calls 'partner_fail_release_atomic' RPC",
)
check(
  failSrc.includes("'already_failed'"),
  "Fail route handles 'already_failed' outcome",
)
check(
  failSrc.includes("'conflict'"),
  "Fail route handles 'conflict' outcome",
)
check(
  failSrc.includes('partner_release_fail_idempotent'),
  "Fail route emits 'partner_release_fail_idempotent' audit event",
)
check(
  failSrc.includes('partner_release_fail_rejected'),
  "Fail route emits 'partner_release_fail_rejected' audit event",
)
check(
  failSrc.includes('EXECUTION_CONFLICT'),
  "Fail route returns EXECUTION_CONFLICT code for conflict",
)

const failDirectUpdates = (failSrc.match(/\.update\(\s*\{\s*\n?\s*execution_status/g) ?? []).length
check(
  failDirectUpdates === 0,
  `Fail route has no direct .update({execution_status…}) calls — all transitions via RPC (found ${failDirectUpdates})`,
)

console.log('\n── 4. Both routes bind partner_ack_hash to every audit event ────────────')

// Count logAudit calls in confirm route
const confirmAuditCount   = (confirmSrc.match(/await logAudit\(\{/g)                          ?? []).length
const confirmAckCount     = (confirmSrc.match(/partner_ack_hash:\s*partnerAckHash/g)           ?? []).length
check(confirmAuditCount > 0, `Confirm route has at least one logAudit call (${confirmAuditCount})`)
check(
  confirmAckCount === confirmAuditCount,
  `Confirm route binds partner_ack_hash in all ${confirmAuditCount} audit events (${confirmAckCount} bindings)`,
)

// Count logAudit calls in fail route
const failAuditCount  = (failSrc.match(/await logAudit\(\{/g)                    ?? []).length
const failAckCount    = (failSrc.match(/partner_ack_hash:\s*partnerAckHash/g)     ?? []).length
check(failAuditCount > 0, `Fail route has at least one logAudit call (${failAuditCount})`)
check(
  failAckCount === failAuditCount,
  `Fail route binds partner_ack_hash in all ${failAuditCount} audit events (${failAckCount} bindings)`,
)

// ─── RUNTIME TESTS ────────────────────────────────────────────────────────────

console.log('\n══ RUNTIME SCENARIO TESTS ══════════════════════════════════════════════')

async function main() {

// ── CONFIRM SCENARIOS ─────────────────────────────────────────────────────────

console.log('\n── CONFIRM SCENARIOS ────────────────────────────────────────────────────')

// a) Normal confirm success
await test('CONFIRM (a): RPC outcome=confirmed → 200, partner_release_confirmed audit', async () => {
  resetState()
  queueConfirmPreReqs()
  queueRpc({ data: RPC_CONFIRMED, error: null })   // atomic RPC returns 'confirmed'
  queueConfirmPostSuccess()

  const res: NextResponse = await POST_CONFIRM(makeRequest(CONFIRM_BODY), PARAMS)

  assert(res.status === 200, `Expected 200, got ${res.status}`)
  const body = await res.json() as { success?: boolean; execution_status?: string }
  assert(body.success === true,                 'Expected success: true')
  assert(body.execution_status === 'confirmed', 'Expected execution_status: confirmed')
  assert(
    auditEvents.includes('partner_release_confirmed'),
    `Expected 'partner_release_confirmed' in audit events, got: [${auditEvents.join(', ')}]`,
  )
})

// b) Idempotent confirm — same payment reference, RPC returns already_confirmed
await test('CONFIRM (b): RPC outcome=already_confirmed (same ref) → 200, idempotent audit', async () => {
  resetState()
  queueConfirmPreReqs()
  queueRpc({ data: RPC_ALREADY_CONFIRMED, error: null })  // atomic RPC returns 'already_confirmed'
  // No post-success steps needed (billing/ledger are skipped for idempotent path)

  const res: NextResponse = await POST_CONFIRM(makeRequest(CONFIRM_BODY), PARAMS)

  assert(res.status === 200, `Expected 200 for idempotent confirm, got ${res.status}`)
  const body = await res.json() as {
    success?: boolean;
    alreadyConfirmed?: boolean;
    execution_status?: string
  }
  assert(body.success === true,              'Expected success: true for idempotent')
  assert(body.alreadyConfirmed === true,     'Expected alreadyConfirmed: true')
  assert(body.execution_status === 'confirmed', 'Expected execution_status: confirmed')
  assert(
    auditEvents.includes('partner_release_confirm_idempotent'),
    `Expected 'partner_release_confirm_idempotent' audit event, got: [${auditEvents.join(', ')}]`,
  )
  assert(
    !auditEvents.includes('partner_release_confirmed'),
    'Idempotent path must NOT emit partner_release_confirmed (no state change occurred)',
  )
})

// c) Conflicting confirm — different payment reference, RPC returns conflict
//    Simulates: two concurrent confirms where one already won with REF-999,
//    and this request arrived with REF-001.
await test('CONFIRM (c): RPC outcome=conflict (different ref) → 409, conflict audit', async () => {
  resetState()
  queueConfirmPreReqs()
  queueRpc({ data: RPC_CONFLICT_CONFIRM, error: null })  // RPC: conflict

  const res: NextResponse = await POST_CONFIRM(makeRequest(CONFIRM_BODY), PARAMS)

  assert(res.status === 409, `Expected 409 for conflict confirm, got ${res.status}`)
  const body = await res.json() as { error?: string; code?: string }
  assert(body.code === 'EXECUTION_CONFLICT', `Expected EXECUTION_CONFLICT code, got: ${body.code}`)
  assert(
    typeof body.error === 'string' && body.error.length > 0,
    'Expected error message in conflict response',
  )
  assert(
    auditEvents.includes('partner_release_confirm_conflict'),
    `Expected 'partner_release_confirm_conflict' audit event, got: [${auditEvents.join(', ')}]`,
  )
  assert(
    !auditEvents.includes('partner_release_confirmed'),
    'Conflict path must NOT emit partner_release_confirmed',
  )
})

// d) Fail won the race first — confirm RPC sees wrong_status (release is now 'failed')
//    Simulates: concurrent confirm + fail; fail won the row lock first.
await test('CONFIRM (d): RPC outcome=wrong_status (fail won race) → 400', async () => {
  resetState()
  queueConfirmPreReqs()
  queueRpc({ data: RPC_WRONG_STATUS, error: null })  // RPC: wrong_status, current='failed'

  const res: NextResponse = await POST_CONFIRM(makeRequest(CONFIRM_BODY), PARAMS)

  assert(res.status === 400, `Expected 400 for wrong_status, got ${res.status}`)
  const body = await res.json() as { errors?: string[] }
  assert(Array.isArray(body.errors), 'Expected errors array')
  assert(body.errors!.some(e => e.includes('pending')), "Error should mention 'pending'")
  // No state-change audit event expected
  assert(
    !auditEvents.includes('partner_release_confirmed'),
    'wrong_status path must not emit partner_release_confirmed',
  )
})

// e) RPC error (DB failure) → 500 + audit
await test('CONFIRM (e): RPC error → 500, partner_confirm_update_failed audit', async () => {
  resetState()
  queueConfirmPreReqs()
  queueRpc({ data: null, error: { message: 'deadlock detected' } })  // RPC error

  const res: NextResponse = await POST_CONFIRM(makeRequest(CONFIRM_BODY), PARAMS)

  assert(res.status === 500, `Expected 500 for RPC error, got ${res.status}`)
  assert(
    auditEvents.includes('partner_confirm_update_failed'),
    `Expected 'partner_confirm_update_failed' audit event, got: [${auditEvents.join(', ')}]`,
  )
})

// ── FAIL SCENARIOS ────────────────────────────────────────────────────────────

console.log('\n── FAIL SCENARIOS ───────────────────────────────────────────────────────')

// f) Normal fail success
await test('FAIL (f): RPC outcome=failed → 200, partner_release_failed audit', async () => {
  resetState()
  queueFailPreReqs()
  queueRpc({ data: RPC_FAILED, error: null })  // atomic RPC returns 'failed'
  // cancel_release_reservation RPC
  queueRpc({ data: null, error: null })

  const res: NextResponse = await POST_FAIL(makeRequest(FAIL_BODY), PARAMS)

  assert(res.status === 200, `Expected 200 for fail success, got ${res.status}`)
  const body = await res.json() as { success?: boolean; execution_status?: string }
  assert(body.success === true,             'Expected success: true')
  assert(body.execution_status === 'failed', 'Expected execution_status: failed')
  assert(
    auditEvents.includes('partner_release_failed'),
    `Expected 'partner_release_failed' audit event, got: [${auditEvents.join(', ')}]`,
  )
})

// g) Idempotent fail — release already failed
//    Simulates: two concurrent fail calls; the second sees 'already_failed' from RPC.
await test('FAIL (g): RPC outcome=already_failed → 200, idempotent audit', async () => {
  resetState()
  queueFailPreReqs()
  queueRpc({ data: RPC_ALREADY_FAILED, error: null })  // RPC: already_failed

  const res: NextResponse = await POST_FAIL(makeRequest(FAIL_BODY), PARAMS)

  assert(res.status === 200, `Expected 200 for idempotent fail, got ${res.status}`)
  const body = await res.json() as { success?: boolean; alreadyFailed?: boolean }
  assert(body.success === true,      'Expected success: true')
  assert(body.alreadyFailed === true, 'Expected alreadyFailed: true')
  assert(
    auditEvents.includes('partner_release_fail_idempotent'),
    `Expected 'partner_release_fail_idempotent' audit event, got: [${auditEvents.join(', ')}]`,
  )
  assert(
    !auditEvents.includes('partner_release_failed'),
    'Idempotent path must NOT emit partner_release_failed (no state change)',
  )
})

// h) Confirm won the race first — fail RPC sees conflict (release now confirmed)
//    Simulates: concurrent confirm + fail; confirm won the row lock.
await test('FAIL (h): RPC outcome=conflict (confirm won race) → 409, fail_rejected audit', async () => {
  resetState()
  queueFailPreReqs()
  queueRpc({ data: RPC_CONFLICT_FAIL, error: null })  // RPC: conflict (confirmed)

  const res: NextResponse = await POST_FAIL(makeRequest(FAIL_BODY), PARAMS)

  assert(res.status === 409, `Expected 409 for fail-after-confirm, got ${res.status}`)
  const body = await res.json() as { error?: string; code?: string; current_status?: string }
  assert(body.code === 'EXECUTION_CONFLICT',   `Expected EXECUTION_CONFLICT code, got: ${body.code}`)
  assert(body.current_status === 'confirmed',  `Expected current_status: confirmed, got: ${body.current_status}`)
  assert(
    auditEvents.includes('partner_release_fail_rejected'),
    `Expected 'partner_release_fail_rejected' audit event, got: [${auditEvents.join(', ')}]`,
  )
  assert(
    !auditEvents.includes('partner_release_failed'),
    'Conflict path must NOT emit partner_release_failed',
  )
})

// i) Wrong status (e.g., reversed) — fail returns 400
await test('FAIL (i): RPC outcome=wrong_status → 400', async () => {
  resetState()
  queueFailPreReqs()
  queueRpc({ data: RPC_WRONG_STATUS_FAIL, error: null })  // RPC: wrong_status, current='reversed'

  const res: NextResponse = await POST_FAIL(makeRequest(FAIL_BODY), PARAMS)

  assert(res.status === 400, `Expected 400 for wrong_status, got ${res.status}`)
  const body = await res.json() as { errors?: string[] }
  assert(Array.isArray(body.errors), 'Expected errors array')
  assert(
    !auditEvents.includes('partner_release_failed'),
    'wrong_status path must not emit partner_release_failed',
  )
})

// j) RPC error (DB failure) → 500 + audit
await test('FAIL (j): RPC error → 500, partner_fail_update_failed audit', async () => {
  resetState()
  queueFailPreReqs()
  queueRpc({ data: null, error: { message: 'connection timeout' } })  // RPC error

  const res: NextResponse = await POST_FAIL(makeRequest(FAIL_BODY), PARAMS)

  assert(res.status === 500, `Expected 500 for RPC error, got ${res.status}`)
  assert(
    auditEvents.includes('partner_fail_update_failed'),
    `Expected 'partner_fail_update_failed' audit event, got: [${auditEvents.join(', ')}]`,
  )
})

// ── CROSS-SCENARIO: audit_ack binding ────────────────────────────────────────

console.log('\n── AUDIT ACK BINDING ────────────────────────────────────────────────────')

// The partner_ack_hash is verified statically above (check 4).
// Here we verify at runtime that the audit spy is called on the idempotent
// and conflict paths — proving the routes DO call logAudit (not just route).

await test('AUDIT BINDING: idempotent confirm path calls logAudit', async () => {
  resetState()
  queueConfirmPreReqs()
  queueRpc({ data: RPC_ALREADY_CONFIRMED, error: null })

  await POST_CONFIRM(makeRequest(CONFIRM_BODY), PARAMS)

  assert(auditEvents.length > 0, 'Expected at least one logAudit call on idempotent confirm path')
  assert(
    auditEvents.includes('partner_release_confirm_idempotent'),
    'Expected idempotent audit event',
  )
})

await test('AUDIT BINDING: fail_rejected conflict path calls logAudit', async () => {
  resetState()
  queueFailPreReqs()
  queueRpc({ data: RPC_CONFLICT_FAIL, error: null })

  await POST_FAIL(makeRequest(FAIL_BODY), PARAMS)

  assert(auditEvents.length > 0, 'Expected at least one logAudit call on fail_rejected path')
  assert(
    auditEvents.includes('partner_release_fail_rejected'),
    'Expected fail_rejected audit event',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — PARTNER CONFIRM/FAIL ATOMICITY TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)

}

main().catch(e => { console.error(e); process.exit(1) })
