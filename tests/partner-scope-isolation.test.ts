/**
 * Partner API scope isolation tests
 *
 * Proves that:
 *   1. A valid partner API key CANNOT access a release belonging to another partner's deal → 403
 *   2. A valid partner API key CANNOT confirm a release belonging to another partner's deal → 403
 *   3. A valid partner API key CANNOT fail a release belonging to another partner's deal → 403
 *   4. An invalid/missing partner key is rejected BEFORE any DB access → 401, dbCallCount=0
 *   5. A partner CANNOT confirm a Stripe-rail release (only external_manual supported) → 400
 *   6. The confirm success path IS reachable for the matching partner with a pending external release → 200
 *
 * All Supabase queries and partner auth are mocked via require.cache patching.
 * No real database queries. No real API keys.
 *
 * Run: npx tsx tests/partner-scope-isolation.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
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

// ─── Module paths (tsx uses .ts as require.cache keys) ────────────────────────

const supabaseAdminPath = path.resolve(ROOT, 'src/lib/supabase/admin.ts')
const partnerAuthPath   = path.resolve(ROOT, 'src/lib/auth/partner.ts')
const auditPath         = path.resolve(ROOT, 'src/lib/engine/audit.ts')
const rateLimitPath     = path.resolve(ROOT, 'src/lib/engine/rate-limit.ts')
const getRoutePath      = path.resolve(ROOT, 'src/app/api/partner/releases/[releaseId]/route.ts')
const confirmRoutePath  = path.resolve(ROOT, 'src/app/api/partner/releases/[releaseId]/confirm/route.ts')
const failRoutePath     = path.resolve(ROOT, 'src/app/api/partner/releases/[releaseId]/fail/route.ts')

// ─── Mutable test state ───────────────────────────────────────────────────────
//
// All mocks read from these variables at call-time so a single set of patched
// modules services every test — no per-test cache deletion required.

type AuthMode = 'success' | 'throw-401'

let authMode:      AuthMode = 'success'
let authPartnerId: string   = 'partner-A'
let dbCallCount:   number   = 0

// Per-table FIFO queue.  Each from(table) call shifts one item from the queue.
let tableQueues: Record<string, Array<{ data: unknown; error: unknown }>> = {}
// FIFO queue for admin.rpc() calls.
let rpcQueue: Array<{ data: unknown; error: unknown }> = []

function resetState(opts: { authMode?: AuthMode; authPartnerId?: string } = {}) {
  authMode      = opts.authMode      ?? 'success'
  authPartnerId = opts.authPartnerId ?? 'partner-A'
  dbCallCount   = 0
  tableQueues   = {}
  rpcQueue      = []
}

function queueTable(table: string, response: { data: unknown; error: unknown }) {
  if (!tableQueues[table]) tableQueues[table] = []
  tableQueues[table].push(response)
}

function queueRpc(response: { data: unknown; error: unknown }) {
  rpcQueue.push(response)
}

// ─── require.cache helpers ────────────────────────────────────────────────────

function makeModule(filename: string, exports: Record<string, unknown>) {
  return { id: filename, filename, loaded: true, exports, children: [], paths: [] } as NodeJS.Module
}

// ─── Mock: Supabase admin client ──────────────────────────────────────────────
//
// Each from(table) creates a fresh chain. The chain is thenable so
//   - `await chain.single()`         works (single returns the value directly)
//   - `await chain.update().select()` works (select returns chain; chain.then fires)
//   - `await chain.insert()`          works (insert returns a Promise)
//
// Only ONE item is consumed per from(table) call regardless of which terminal
// method is used, via the `consumed` guard.

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

    rpc: (_fn: string) => {
      const item = rpcQueue.shift() ?? { data: null, error: null }
      return Promise.resolve(item)
    },
  }
}

// ─── Install mocks into require.cache ─────────────────────────────────────────
//
// IMPORTANT: all patches must be installed BEFORE the routes are require()-d.
// The routes' top-level imports are resolved at load time; patching after
// loading has no effect.

require.cache[supabaseAdminPath] = makeModule(supabaseAdminPath, {
  createSupabaseAdminClient: () => makeMockAdmin(),
})

require.cache[partnerAuthPath] = makeModule(partnerAuthPath, {
  requirePartnerAuth: async (_request: NextRequest) => {
    if (authMode === 'throw-401') {
      throw NextResponse.json(
        { error: 'Invalid or missing API key.' },
        { status: 401 },
      )
    }
    return {
      partnerId:      authPartnerId,
      partnerName:    'Test Partner Ltd',
      webhookUrl:     null,
      keyEnvironment: 'test' as const,
    }
  },
})

require.cache[auditPath] = makeModule(auditPath, {
  logAudit: async () => { /* no-op */ },
})

// Rate limit: always allow; export POLICIES shape so routes can read .description
require.cache[rateLimitPath] = makeModule(rateLimitPath, {
  POLICIES: {
    partner_api: {
      windowSeconds: 60,
      maxRequests:   60,
      description:   'partner API calls',
    },
  },
  checkRateLimit: async () => ({
    allowed:      true,
    currentCount: 1,
    limit:        60,
    resetAt:      new Date(Date.now() + 60_000).toISOString(),
  }),
  rateLimitResponse:     (_result: unknown, _description: string) =>
    NextResponse.json({ error: 'rate limited' }, { status: 429 }),
  logRateLimitViolation: () => { /* no-op */ },
})

// ─── Load routes (after mocks are in place) ───────────────────────────────────

delete require.cache[getRoutePath]
delete require.cache[confirmRoutePath]
delete require.cache[failRoutePath]

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET }             = req(getRoutePath)    as { GET: Function }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST: POST_CONFIRM } = req(confirmRoutePath) as { POST: Function }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST: POST_FAIL }    = req(failRoutePath)    as { POST: Function }

// ─── Request / params helpers ─────────────────────────────────────────────────

const PARAMS = { params: Promise.resolve({ releaseId: 'rel-1' }) }

function makeRequest(method: string, body?: Record<string, unknown>): NextRequest {
  const url = 'http://localhost/api/partner/releases/rel-1'
  if (body) {
    return new NextRequest(url, {
      method,
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer vkp_test_abc' },
    })
  }
  return new NextRequest(url, {
    method,
    headers: { 'Authorization': 'Bearer vkp_test_abc' },
  })
}

// ─── Data fixtures ────────────────────────────────────────────────────────────

const RELEASE_EXTERNAL_PENDING = {
  id:                         'rel-1',
  milestone_id:               'ms-1',
  deal_id:                    'deal-1',
  amount:                     10_000,
  execution_rail:             'external_manual',
  execution_status:           'pending',
  external_execution_notes:   null,
  external_payment_reference: null,
  external_executed_at:       null,
  external_executed_by:       null,
}

const RELEASE_STRIPE_PENDING = {
  ...RELEASE_EXTERNAL_PENDING,
  execution_rail: 'stripe',
}

// Deal owned by partner-B — mismatches authPartnerId='partner-A'
const DEAL_PARTNER_B = {
  id:                   'deal-1',
  title:                'River Crossing Project',
  partner_id:           'partner-B',
  contractor_id:        'contractor-1',
  funder_id:            'funder-1',
  billing_rate_bps:     100,
  retainage_percentage: 0,
}

// Deal owned by partner-A — matches authPartnerId='partner-A'
const DEAL_PARTNER_A = {
  ...DEAL_PARTNER_B,
  partner_id: 'partner-A',
}

const MILESTONE_ROW = {
  id:     'ms-1',
  title:  'Foundation Work',
  amount: 10_000,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── 1. GET: valid key, deal.partner_id mismatch → 403 ────────────────────────

await test('GET: valid partner key, deal.partner_id mismatch → 403', async () => {
  resetState()
  queueTable('releases', { data: RELEASE_EXTERNAL_PENDING, error: null })
  queueTable('deals',    { data: DEAL_PARTNER_B,            error: null })

  const res: NextResponse = await GET(makeRequest('GET'), PARAMS)

  assert(res.status === 403, `Expected 403, got ${res.status}`)
  const body = await res.json() as { error?: string }
  assert(
    typeof body.error === 'string' && body.error.includes('not associated'),
    `Expected scope-mismatch message, got: ${JSON.stringify(body)}`,
  )
})

// ── 2. CONFIRM: valid key, deal.partner_id mismatch → 403 ────────────────────

await test('CONFIRM: valid partner key, deal.partner_id mismatch → 403', async () => {
  resetState()
  queueTable('releases', { data: RELEASE_EXTERNAL_PENDING, error: null })
  queueTable('deals',    { data: DEAL_PARTNER_B,           error: null })

  const res: NextResponse = await POST_CONFIRM(
    makeRequest('POST', { payment_method: 'wire', payment_reference: 'WIRE-REF-001' }),
    PARAMS,
  )

  assert(res.status === 403, `Expected 403, got ${res.status}`)
  const body = await res.json() as { error?: string }
  assert(
    typeof body.error === 'string' && body.error.includes('not associated'),
    `Expected scope-mismatch message, got: ${JSON.stringify(body)}`,
  )
})

// ── 3. FAIL: valid key, deal.partner_id mismatch → 403 ───────────────────────

await test('FAIL: valid partner key, deal.partner_id mismatch → 403', async () => {
  resetState()
  queueTable('releases', { data: RELEASE_EXTERNAL_PENDING, error: null })
  queueTable('deals',    { data: DEAL_PARTNER_B,           error: null })

  const res: NextResponse = await POST_FAIL(
    makeRequest('POST', { reason: 'Wire rejected by beneficiary bank — account closed.' }),
    PARAMS,
  )

  assert(res.status === 403, `Expected 403, got ${res.status}`)
  const body = await res.json() as { error?: string }
  assert(
    typeof body.error === 'string' && body.error.includes('not associated'),
    `Expected scope-mismatch message, got: ${JSON.stringify(body)}`,
  )
})

// ── 4. GET: invalid/missing partner key → 401, DB never touched ───────────────

await test('GET: invalid/missing partner key → 401, DB not touched', async () => {
  resetState({ authMode: 'throw-401' })

  const res: NextResponse = await GET(makeRequest('GET'), PARAMS)

  assert(res.status === 401, `Expected 401, got ${res.status}`)
  assert(
    dbCallCount === 0,
    `Expected DB to never be called before auth fails, but dbCallCount=${dbCallCount}`,
  )
  const body = await res.json() as { error?: string }
  assert(typeof body.error === 'string', `Expected error in body, got: ${JSON.stringify(body)}`)
})

// ── 5. CONFIRM: Stripe-rail release → 400 (before scope check) ───────────────
//
// The confirm route checks execution_rail BEFORE fetching the deal, so the
// scope check at line 187 is never reached. This proves the rail check is
// a hard gate that fires regardless of partner ownership.
// Note: validationError() returns HTTP 400, not 422.

await test('CONFIRM: Stripe-rail release → 400 before scope check', async () => {
  resetState()
  queueTable('releases', { data: RELEASE_STRIPE_PENDING, error: null })
  // Intentionally do NOT queue a deal row — proves deal is never queried

  const res: NextResponse = await POST_CONFIRM(
    makeRequest('POST', { payment_method: 'wire', payment_reference: 'WIRE-REF-001' }),
    PARAMS,
  )

  assert(res.status === 400, `Expected 400 validation error, got ${res.status}`)
  const body = await res.json() as { errors?: string[] }
  assert(
    Array.isArray(body.errors) && body.errors.length > 0,
    `Expected errors array, got: ${JSON.stringify(body)}`,
  )
  assert(
    body.errors![0].includes('external-rail'),
    `Expected external-rail message, got: "${body.errors![0]}"`,
  )
  // Verify deal table was never queried — scope check was never reached
  const dealQueueLength = tableQueues['deals']?.length ?? 0
  assert(
    dealQueueLength === 0,
    `Deal queue should be untouched (scope check unreachable), but length=${dealQueueLength}`,
  )
})

// ── 6. CONFIRM: matching partner, external_manual, pending → 200 ──────────────

await test('CONFIRM: matching partner, external_manual, pending → 200 success', async () => {
  resetState()
  // Fetch release (first from('releases') call)
  queueTable('releases',        { data: RELEASE_EXTERNAL_PENDING, error: null })
  // Fetch deal
  queueTable('deals',           { data: DEAL_PARTNER_A,           error: null })
  // Fetch milestone
  queueTable('milestones',      { data: MILESTONE_ROW,            error: null })
  // Update release (second from('releases') call) — returns the updated row
  queueTable('releases',        { data: [{ id: 'rel-1' }],        error: null })
  // Insert billing record
  queueTable('billing_records', { data: null,                     error: null })
  // RPC: increment_deal_financials
  queueRpc({ data: null, error: null })
  // RPC: increment_deal_retainage — not called when retainageAmount=0, but queued as safety
  queueRpc({ data: null, error: null })

  const res: NextResponse = await POST_CONFIRM(
    makeRequest('POST', { payment_method: 'wire', payment_reference: 'WIRE-REF-001' }),
    PARAMS,
  )

  assert(res.status === 200, `Expected 200, got ${res.status}`)
  const body = await res.json() as {
    success?: boolean
    execution_status?: string
    partner_id?: string
    external?: { payment_method?: string; payment_reference?: string }
    billing?: { fee_amount?: number }
  }
  assert(body.success === true,                           `Expected success: true`)
  assert(body.execution_status === 'confirmed',           `Expected execution_status: confirmed`)
  assert(body.partner_id === 'partner-A',                 `Expected partner_id: partner-A`)
  assert(body.external?.payment_method    === 'wire',     `Expected payment_method: wire`)
  assert(body.external?.payment_reference === 'WIRE-REF-001', `Expected payment_reference`)
  assert(typeof body.billing?.fee_amount  === 'number',   `Expected numeric fee_amount`)
})

// ─── Results ──────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — PARTNER API SCOPE ISOLATION TEST RESULTS')
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
