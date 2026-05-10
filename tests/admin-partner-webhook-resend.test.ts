/**
 * Admin partner webhook resend endpoint tests
 *
 * Covers:
 *   POST /api/admin/partner-webhooks/[deliveryId]/resend
 *
 * STATIC SOURCE CHECKS
 *   - Route requires admin role before any DB access.
 *   - Route does not select webhook_signing_secret in this file
 *     (secret is loaded only inside resendPartnerWebhook).
 *   - Route does not accept a target URL from the request body.
 *   - Route does not accept a payload from the request body.
 *   - Route reconstructs payload from canonical release/deal/milestone state.
 *   - Route creates audit entry via requireAdminAudit.
 *   - Route links new delivery row via resentFromDeliveryId.
 *   - Migration adds resent_from_delivery_id column.
 *   - resendPartnerWebhook is exported from partner-webhook.ts.
 *
 * RUNTIME BEHAVIOR TESTS
 *   - Admin (success): 200 with resend_status=success.
 *   - Admin (exhausted): 200 with resend_status=exhausted.
 *   - Non-admin (funder): 403 before any DB access.
 *   - Unauthenticated: 401 before any DB access.
 *   - Delivery not found: 404.
 *   - Partner not found: 404.
 *   - No webhook_url on partner: 422.
 *   - resendPartnerWebhook called (delivery log created).
 *   - requireAdminAudit called with correct action.
 *   - Response does not contain webhook_signing_secret.
 *
 * No real HTTP calls. No real database queries. No env vars required.
 *
 * Run: npx tsx tests/admin-partner-webhook-resend.test.ts
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
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

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ─── File paths ───────────────────────────────────────────────────────────────

const ROUTE_SRC    = path.resolve(ROOT, 'src/app/api/admin/partner-webhooks/[deliveryId]/resend/route.ts')
const SENDER_SRC   = path.resolve(ROOT, 'src/lib/engine/partner-webhook.ts')
const MIGRATION_0  = path.resolve(ROOT, 'supabase/migrations/20260512000000_partner_webhook_deliveries.sql')
const MIGRATION_1  = path.resolve(ROOT, 'supabase/migrations/20260512000001_partner_webhook_delivery_resend_link.sql')

const supabaseAdminPath = path.resolve(ROOT, 'src/lib/supabase/admin.ts')
const middlewarePath    = path.resolve(ROOT, 'src/lib/auth/middleware.ts')
const rateLimitPath     = path.resolve(ROOT, 'src/lib/engine/rate-limit.ts')
const partnerHookPath   = path.resolve(ROOT, 'src/lib/engine/partner-webhook.ts')
const billingPath       = path.resolve(ROOT, 'src/lib/engine/billing.ts')
const errorsPath        = path.resolve(ROOT, 'src/lib/errors.ts')

// ─── Mutable test state ───────────────────────────────────────────────────────

type AuthMode = 'admin' | 'funder' | 'unauthenticated'

let authMode:          AuthMode = 'admin'
let tableResponses:    Record<string, { data: unknown; error: unknown }> = {}
let resendResult:      unknown  = { ok: true, deliveryRowId: 'new-del-1', status: 200, attemptCount: 1, finalStatus: 'success' }
let resendShouldThrow: boolean  = false
let capturedAudits:    unknown[] = []
let capturedResendCalls: Array<{ partnerId: string; idempotencyKey: string; resentFromDeliveryId: string }> = []
let dbCallCount:       number   = 0

function resetState(opts: { auth?: AuthMode } = {}) {
  authMode          = opts.auth ?? 'admin'
  tableResponses    = {}
  resendResult      = { ok: true, deliveryRowId: 'new-del-1', status: 200, attemptCount: 1, finalStatus: 'success' }
  resendShouldThrow = false
  capturedAudits    = []
  capturedResendCalls = []
  dbCallCount       = 0
}

// ─── Module helpers ───────────────────────────────────────────────────────────

function makeModule(filename: string, exports: Record<string, unknown>) {
  return { id: filename, filename, loaded: true, exports, children: [], paths: [] } as unknown as NodeJS.Module
}

// ─── Mock: Supabase admin client ──────────────────────────────────────────────

function makeMockAdmin() {
  return {
    from: (table: string) => {
      dbCallCount++
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select:      () => chain,
        eq:          () => chain,
        single:      () => tableResponses[table] ?? { data: null, error: { message: `no mock for ${table}` } },
        maybeSingle: () => ({ data: null, error: null }),
        insert:      () => Promise.resolve({ data: null, error: null }),
        update:      () => chain,
        then: (
          onFulfilled: ((v: unknown) => unknown) | null,
          onRejected:  ((v: unknown) => unknown) | null,
        ) => Promise.resolve({ data: null, error: null }).then(onFulfilled ?? undefined, onRejected ?? undefined),
      }
      return chain
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  }
}

// ─── Mock: Auth middleware ────────────────────────────────────────────────────

const ADMIN_USER    = { id: 'admin-user-1', email: 'admin@vektrum.io' }
const ADMIN_PROFILE = { id: 'admin-user-1', role: 'admin' }
const FUNDER_USER   = { id: 'funder-1',     email: 'funder@test.io' }
const FUNDER_PROFILE = { id: 'funder-1',    role: 'funder' }

function makeMiddlewareMock() {
  return {
    getAuthUser: async () => {
      if (authMode === 'unauthenticated') return { user: null, profile: null }
      if (authMode === 'funder')          return { user: FUNDER_USER, profile: FUNDER_PROFILE }
      return { user: ADMIN_USER, profile: ADMIN_PROFILE }
    },
    requireRole: (profile: { role: string }, ...allowedRoles: string[]) => {
      if (!profile || !allowedRoles.includes(profile.role)) {
        throw NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    },
    requireMFA: async () => { /* no-op */ },
    requireAdminAudit: async (
      _profile: unknown,
      _user: unknown,
      justification: string,
      ctx: unknown,
    ) => {
      // Mirror the real behaviour: throw if justification is too short
      if (!justification || justification.length < 20) {
        throw NextResponse.json(
          { errors: ['admin_justification must be at least 20 characters.'] },
          { status: 400 },
        )
      }
      capturedAudits.push(ctx)
    },
    extractAdminJustification: (_req: unknown, body: Record<string, unknown> | null) =>
      (typeof body?.admin_justification === 'string' ? body.admin_justification : '').trim(),
  }
}

// ─── Mock: Rate limit (always allow) ─────────────────────────────────────────

function makeRateLimitMock() {
  return {
    POLICIES:               { admin_write: { description: 'Admin write rate limit', windowMs: 60000, max: 100 } },
    checkRateLimit:         async () => ({ allowed: true }),
    rateLimitResponse:      () => NextResponse.json({ error: 'rate limited' }, { status: 429 }),
    logRateLimitViolation:  () => { /* no-op */ },
  }
}

// ─── Mock: partner-webhook (resendPartnerWebhook) ─────────────────────────────

function makePartnerWebhookMock() {
  return {
    PARTNER_WEBHOOK_API_VERSION: '2026-05-01',
    resendPartnerWebhook: async (
      partnerId: string,
      payload: { idempotency_key: string },
      _actorId: string,
      resentFromDeliveryId: string,
    ) => {
      capturedResendCalls.push({ partnerId, idempotencyKey: payload.idempotency_key, resentFromDeliveryId })
      if (resendShouldThrow) throw new Error('Mock resend error')
      return resendResult
    },
    deliverPartnerWebhook:   async () => { /* no-op */ },
    ResendResult:            undefined,
    PartnerWebhookPayload:   undefined,
  }
}

// ─── Mock: billing ────────────────────────────────────────────────────────────

function makeBillingMock() {
  return {
    calculateFee: (amount: number, bps: number) => ({
      grossAmount:    amount,
      feeAmount:      Math.floor(amount * bps / 10_000),
      billingRateBps: bps,
      totalDebit:     amount + Math.floor(amount * bps / 10_000),
      netAmount:      amount - Math.floor(amount * bps / 10_000),
    }),
    calculateRetainage: (amount: number, pct: number) => ({
      retainageAmount: Math.floor(amount * pct / 100),
      netToContractor: amount - Math.floor(amount * pct / 100),
    }),
  }
}

// ─── Install mocks BEFORE loading route ──────────────────────────────────────

require.cache[supabaseAdminPath] = makeModule(supabaseAdminPath, {
  createSupabaseAdminClient: () => makeMockAdmin(),
})
require.cache[middlewarePath]   = makeModule(middlewarePath,   makeMiddlewareMock())
require.cache[rateLimitPath]    = makeModule(rateLimitPath,    makeRateLimitMock())
require.cache[partnerHookPath]  = makeModule(partnerHookPath,  makePartnerWebhookMock())
require.cache[billingPath]      = makeModule(billingPath,      makeBillingMock())

// errors.ts may already be in require.cache (no-op if so) — let the real one load.

// ─── Load route AFTER mocks ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = req(ROUTE_SRC) as { POST: (req: NextRequest, ctx: { params: Promise<{ deliveryId: string }> }) => Promise<NextResponse> }

// ─── Request helper ───────────────────────────────────────────────────────────

const PARAMS = { params: Promise.resolve({ deliveryId: 'del-original-1' }) }

function makeRequest(body?: Record<string, unknown>): NextRequest {
  const url = 'http://localhost/api/admin/partner-webhooks/del-original-1/resend'
  if (body) {
    return new NextRequest(url, {
      method:  'POST',
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new NextRequest(url, { method: 'POST' })
}

// ─── Data fixtures ────────────────────────────────────────────────────────────

const DELIVERY_ROW = {
  id:                'del-original-1',
  partner_id:        'partner-1',
  release_id:        'rel-1',
  idempotency_key:   'idem-key-abc',
  delivery_status:   'exhausted',
  webhook_event_type: 'release.authorized',
}

const PARTNER_ROW = {
  id:          'partner-1',
  name:        'Test Bank',
  webhook_url: 'https://hooks.testbank.example/vektrum',
  is_active:   true,
}

const PARTNER_NO_URL = { ...PARTNER_ROW, webhook_url: null }

const RELEASE_ROW = {
  id:            'rel-1',
  milestone_id:  'ms-1',
  deal_id:       'deal-1',
  amount:        50_000,
  execution_rail: 'external_manual',
}

const DEAL_ROW = {
  id:                   'deal-1',
  title:                'River Crossing Project',
  contractor_id:        'contractor-1',
  funder_id:            'funder-1',
  billing_rate_bps:     100,
  retainage_percentage: 0,
  partner_id:           'partner-1',
}

const MILESTONE_ROW = {
  id:     'ms-1',
  title:  'Foundation Work',
  amount: 50_000,
}

const VALID_JUSTIFICATION = 'Admin resend — partner confirmed non-receipt of webhook after network failure.'

// ─── Helper: set up happy-path fixtures ──────────────────────────────────────

function setupHappyPath() {
  resetState()
  tableResponses['partner_webhook_deliveries'] = { data: DELIVERY_ROW,  error: null }
  tableResponses['partners']                   = { data: PARTNER_ROW,   error: null }
  tableResponses['releases']                   = { data: RELEASE_ROW,   error: null }
  tableResponses['deals']                      = { data: DEAL_ROW,      error: null }
  tableResponses['milestones']                 = { data: MILESTONE_ROW, error: null }
}

// ─── STATIC SOURCE CHECKS ─────────────────────────────────────────────────────

async function runStaticChecks() {

await test('Route file exists at expected path', () => {
  assert(fs.existsSync(ROUTE_SRC), `Route not found: ${ROUTE_SRC}`)
})

await test('Route requires admin role before any DB access', () => {
  const src = read(ROUTE_SRC)
  assert(src.includes("requireRole(profile, 'admin')"), "requireRole('admin') not found in route")
})

await test('Route does NOT select webhook_signing_secret (secret stays in sender)', () => {
  const src = read(ROUTE_SRC)
  // Extract all .select() call arguments and check none include the secret.
  // Comments and docstrings that mention the field name are acceptable; the
  // check is specifically for the field appearing inside a DB select() call.
  const selectArgs = [...src.matchAll(/\.select\(([^)]+)\)/g)].map(m => m[1])
  const secretSelected = selectArgs.some(arg => arg.includes('webhook_signing_secret'))
  assert(
    !secretSelected,
    'webhook_signing_secret found inside a .select() call in admin route — secret must stay encapsulated in partner-webhook.ts',
  )
})

await test('Route does NOT accept target URL from request body', () => {
  const src = read(ROUTE_SRC)
  // Should not read body.url, body.webhook_url, body.target_url, etc.
  assert(!src.includes('body.url'),         'Route reads url from body — forbidden')
  assert(!src.includes('body.webhook_url'), 'Route reads webhook_url from body — forbidden')
  assert(!src.includes('body.target_url'),  'Route reads target_url from body — forbidden')
})

await test('Route does NOT accept payload from request body', () => {
  const src = read(ROUTE_SRC)
  // Should not read body.payload, body.event, body.amount etc. from the caller
  assert(!src.includes('body.payload'), 'Route reads payload from body — forbidden')
  assert(!src.includes('body.event'),   'Route reads event type from body — forbidden')
  assert(!src.includes('body.amount'),  'Route reads amount from body — forbidden')
})

await test('Route reconstructs payload from canonical DB state (release + deal + milestone)', () => {
  const src = read(ROUTE_SRC)
  assert(src.includes("from('releases')"),    "No releases query found in route")
  assert(src.includes("from('deals')"),       "No deals query found in route")
  assert(src.includes("from('milestones')"),  "No milestones query found in route")
  assert(src.includes('calculateFee'),        "calculateFee not called in route")
  assert(src.includes('calculateRetainage'), "calculateRetainage not called in route")
})

await test('Route calls requireAdminAudit with partner_webhook_resend action', () => {
  const src = read(ROUTE_SRC)
  assert(src.includes('requireAdminAudit'), 'requireAdminAudit not called')
  assert(src.includes("'partner_webhook_resend'"), 'partner_webhook_resend action missing')
})

await test('Route passes resentFromDeliveryId to resendPartnerWebhook', () => {
  const src = read(ROUTE_SRC)
  assert(src.includes('resendPartnerWebhook'), 'resendPartnerWebhook not called from route')
  assert(src.includes('deliveryId'), 'deliveryId not passed as resentFromDeliveryId')
})

await test('Route links new delivery row to original in response', () => {
  const src = read(ROUTE_SRC)
  assert(src.includes('new_delivery_row_id'), 'new_delivery_row_id not in response')
  assert(src.includes('original_delivery_id'), 'original_delivery_id not in response')
})

await test('resendPartnerWebhook exported from partner-webhook.ts', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('export async function resendPartnerWebhook'), 'resendPartnerWebhook not exported')
})

await test('PARTNER_WEBHOOK_API_VERSION exported from partner-webhook.ts', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('export const PARTNER_WEBHOOK_API_VERSION'), 'PARTNER_WEBHOOK_API_VERSION not exported')
})

await test('ResendResult interface exported from partner-webhook.ts', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('export interface ResendResult'), 'ResendResult not exported')
})

await test('Migration 1 adds resent_from_delivery_id column', () => {
  assert(fs.existsSync(MIGRATION_1), `Migration 1 not found: ${MIGRATION_1}`)
  const src = read(MIGRATION_1)
  assert(src.includes('resent_from_delivery_id'), 'resent_from_delivery_id column missing from migration')
  assert(src.includes('REFERENCES public.partner_webhook_deliveries'), 'Self-referential FK missing')
})

await test('Migration 0 has no resent_from_delivery_id (added by migration 1)', () => {
  const src = read(MIGRATION_0)
  assert(!src.includes('resent_from_delivery_id'), 'resent_from_delivery_id found in migration 0 — should be in migration 1')
})

await test('doDeliver private function passes resent_from_delivery_id to delivery row insert', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('resent_from_delivery_id'), 'resent_from_delivery_id not in delivery row insert in sender')
})

} // end runStaticChecks

// ─── RUNTIME BEHAVIOR TESTS ───────────────────────────────────────────────────

async function runRuntimeTests() {

await test('ADMIN SUCCESS: 200, resend_status=success, new_delivery_row_id present', async () => {
  setupHappyPath()
  resendResult = { ok: true, deliveryRowId: 'new-del-1', status: 200, attemptCount: 1, finalStatus: 'success' }

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(res.status === 200, `Expected 200, got ${res.status}`)
  const body = await res.json() as Record<string, unknown>
  assert(body['success']              === true,        'success should be true')
  assert(body['resend_status']        === 'success',   'resend_status should be success')
  assert(body['ok']                   === true,        'ok should be true')
  assert(body['new_delivery_row_id']  === 'new-del-1', 'new_delivery_row_id mismatch')
  assert(body['original_delivery_id'] === 'del-original-1', 'original_delivery_id mismatch')
  assert(typeof body['note']          === 'string',    'note should be a string')
})

await test('ADMIN EXHAUSTED: 200, resend_status=exhausted, attempt_count=3', async () => {
  setupHappyPath()
  resendResult = { ok: false, deliveryRowId: 'new-del-2', status: 503, attemptCount: 3, finalStatus: 'exhausted' }

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(res.status === 200, `Expected 200, got ${res.status}`)
  const body = await res.json() as Record<string, unknown>
  assert(body['resend_status'] === 'exhausted', `Expected 'exhausted', got '${body['resend_status']}'`)
  assert(body['ok']            === false,       'ok should be false on exhausted')
  assert(body['attempt_count'] === 3,           `Expected attempt_count=3, got ${body['attempt_count']}`)
})

await test('NON-ADMIN (funder): 403 before any DB access', async () => {
  resetState({ auth: 'funder' })
  const prevDbCount = dbCallCount

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(res.status === 403, `Expected 403, got ${res.status}`)
  assert(dbCallCount === prevDbCount, `DB was queried ${dbCallCount - prevDbCount} time(s) before auth check`)
})

await test('UNAUTHENTICATED: 401 before any DB access', async () => {
  resetState({ auth: 'unauthenticated' })
  const prevDbCount = dbCallCount

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(res.status === 401, `Expected 401, got ${res.status}`)
  assert(dbCallCount === prevDbCount, `DB was queried before auth check`)
})

await test('DELIVERY NOT FOUND: 404', async () => {
  resetState()
  tableResponses['partner_webhook_deliveries'] = { data: null, error: { message: 'not found' } }

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(res.status === 404, `Expected 404, got ${res.status}`)
})

await test('PARTNER NOT FOUND: 404', async () => {
  resetState()
  tableResponses['partner_webhook_deliveries'] = { data: DELIVERY_ROW, error: null }
  tableResponses['partners']                   = { data: null, error: { message: 'not found' } }

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(res.status === 404, `Expected 404, got ${res.status}`)
})

await test('PARTNER NO WEBHOOK URL: 422', async () => {
  resetState()
  tableResponses['partner_webhook_deliveries'] = { data: DELIVERY_ROW,    error: null }
  tableResponses['partners']                   = { data: PARTNER_NO_URL,  error: null }

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(res.status === 422, `Expected 422, got ${res.status}`)
})

await test('RESEND CREATES DELIVERY LOG: resendPartnerWebhook called with correct args', async () => {
  setupHappyPath()

  await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(capturedResendCalls.length === 1,
    `Expected 1 resend call, got ${capturedResendCalls.length}`)
  const call = capturedResendCalls[0]
  assert(call.partnerId            === 'partner-1',    `Wrong partnerId: ${call.partnerId}`)
  assert(call.idempotencyKey       === 'idem-key-abc', `Wrong idempotency_key: ${call.idempotencyKey}`)
  assert(call.resentFromDeliveryId === 'del-original-1',
    `Expected resentFromDeliveryId='del-original-1', got '${call.resentFromDeliveryId}'`)
})

await test('AUDIT EVENT CREATED: requireAdminAudit called with partner_webhook_resend', async () => {
  setupHappyPath()

  await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(capturedAudits.length === 1, `Expected 1 audit entry, got ${capturedAudits.length}`)
  const audit = capturedAudits[0] as Record<string, unknown>
  assert(audit['action']     === 'partner_webhook_resend',        `Wrong action: ${audit['action']}`)
  assert(audit['entityType'] === 'partner_webhook_delivery',      `Wrong entityType: ${audit['entityType']}`)
  assert(audit['entityId']   === 'del-original-1',                `Wrong entityId: ${audit['entityId']}`)
  const meta = audit['metadata'] as Record<string, unknown>
  assert(meta['partner_id']              === 'partner-1',      'partner_id missing from audit metadata')
  assert(meta['release_id']             === 'rel-1',           'release_id missing from audit metadata')
  assert(meta['original_delivery_id']   === 'del-original-1', 'original_delivery_id missing from audit metadata')
  assert(typeof meta['new_delivery_row_id'] === 'string',      'new_delivery_row_id missing from audit metadata')
})

await test('SECRETS NOT EXPOSED: response does not contain signing_secret or HMAC', async () => {
  setupHappyPath()

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  const body = await res.json() as Record<string, unknown>
  const bodyStr = JSON.stringify(body)
  assert(!bodyStr.includes('webhook_signing_secret'), 'webhook_signing_secret found in response')
  assert(!bodyStr.includes('whsec_'),                 'Signing secret pattern found in response')
  assert(!bodyStr.includes('sha256='),                'HMAC value found in response')
  // partner sub-object should only have id and name
  const partnerInResponse = body['partner'] as Record<string, unknown>
  assert(!('webhook_signing_secret' in partnerInResponse), 'signing_secret exposed in partner response object')
  assert(!('webhook_url' in partnerInResponse) || true,    'webhook_url is acceptable in response')
})

await test('INVALID JUSTIFICATION: 400 when justification too short', async () => {
  setupHappyPath()

  const res = await POST(
    makeRequest({ admin_justification: 'too short' }),
    PARAMS,
  )

  assert(res.status === 400, `Expected 400, got ${res.status}`)
})

await test('RESEND FAILURE: 500 when resendPartnerWebhook throws', async () => {
  setupHappyPath()
  resendShouldThrow = true

  const res = await POST(
    makeRequest({ admin_justification: VALID_JUSTIFICATION }),
    PARAMS,
  )

  assert(res.status === 500, `Expected 500, got ${res.status}`)
})

} // end runRuntimeTests

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══ STATIC SOURCE CHECKS ════════════════════════════════════════════════\n')
  await runStaticChecks()

  console.log('\n══ RUNTIME BEHAVIOR TESTS ══════════════════════════════════════════════\n')
  await runRuntimeTests()

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log('\n' + '═'.repeat(72))
  console.log('  VEKTRUM — ADMIN PARTNER WEBHOOK RESEND TEST RESULTS')
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
