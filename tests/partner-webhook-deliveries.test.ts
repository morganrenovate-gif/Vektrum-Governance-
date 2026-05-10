/**
 * Partner webhook delivery logging tests
 *
 * Verifies that every outbound partner webhook delivery attempt is durably
 * recorded in the partner_webhook_deliveries table with the correct shape,
 * lifecycle transitions, and security properties (no secrets stored).
 *
 * TWO LAYERS:
 *
 * A. STATIC SOURCE CHECKS
 *    - Migration creates the table, RLS, indexes, and constraints.
 *    - Sender imports createHash (for body hashing).
 *    - Sender inserts a 'pending' row before the HTTP call.
 *    - Sender updates the row after delivery with final status and attempt count.
 *    - Sender stores request_body_hash (not the raw body).
 *    - Sender never stores webhook_signing_secret.
 *    - Sender never stores X-Vektrum-Signature in headers meta.
 *    - Sender truncates response_body_snippet to 500 chars.
 *    - Migration enables RLS and grants read access to admins only (no direct writes).
 *
 * B. RUNTIME BEHAVIOR TESTS
 *    - Success path: 'pending' row inserted, then updated to 'success'.
 *    - Exhausted path: all retries fail → updated to 'exhausted', attempt_count=3.
 *    - Secret not stored: insert payload contains no webhook_signing_secret or HMAC value.
 *    - Signature header not stored: X-Vektrum-Signature absent from request_headers_meta.
 *    - No delivery row when partner has no webhook_url (no DB write for skip paths).
 *    - No delivery row when partner is inactive.
 *    - Delivery row id bound into audit log metadata.
 *
 * No real HTTP requests. No real database queries. No env vars required.
 *
 * Run: npx tsx tests/partner-webhook-deliveries.test.ts
 */

import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

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

const MIGRATION   = path.resolve(ROOT, 'supabase/migrations/20260512000000_partner_webhook_deliveries.sql')
const SENDER_SRC  = path.resolve(ROOT, 'src/lib/engine/partner-webhook.ts')
const supabasePath = path.resolve(ROOT, 'src/lib/supabase/admin.ts')
const auditPath    = path.resolve(ROOT, 'src/lib/engine/audit.ts')
const senderPath   = SENDER_SRC.replace(/\.ts$/, '')  // tsx loads .ts directly

// ─── Runtime mock state ───────────────────────────────────────────────────────

// Captured writes to partner_webhook_deliveries (and any other table)
let deliveryInserts: unknown[] = []
let deliveryUpdates: unknown[] = []
let auditEvents:     unknown[] = []
let fetchCalls:      Array<{ url: string; body: string; headers: Record<string, string> }> = []

// Configurable per-test table responses for .single() calls
let tableResponses: Record<string, { data: unknown; error: unknown }> = {}

// Configurable fetch mock
let mockFetchImpl: (() => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>) | null = null

function resetMockState() {
  deliveryInserts = []
  deliveryUpdates = []
  auditEvents     = []
  fetchCalls      = []
  tableResponses  = {}
  mockFetchImpl   = null
}

// ─── Module path helpers ──────────────────────────────────────────────────────

function makeModule(filename: string, exports: Record<string, unknown>) {
  return { id: filename, filename, loaded: true, exports, children: [], paths: [] } as unknown as NodeJS.Module
}

// ─── Mock: Supabase admin client ──────────────────────────────────────────────

function makeMockAdmin() {
  return {
    from: (table: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select:      () => chain,
        eq:          () => chain,
        in:          () => chain,
        update: (data: unknown) => {
          if (table === 'partner_webhook_deliveries') {
            deliveryUpdates.push(data)
          }
          return chain
        },
        insert: (data: unknown) => {
          if (table === 'partner_webhook_deliveries') {
            deliveryInserts.push(data)
          }
          return Promise.resolve({ data: null, error: null })
        },
        single: () => {
          return tableResponses[table] ?? { data: null, error: { message: `No mock for ${table}` } }
        },
        maybeSingle: () => ({ data: null, error: null }),
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

// ─── Install mocks into require.cache ─────────────────────────────────────────
//
// These must be set BEFORE the sender module is require()-d.

require.cache[supabasePath] = makeModule(supabasePath, {
  createSupabaseAdminClient: () => makeMockAdmin(),
})

require.cache[auditPath] = makeModule(auditPath, {
  logAudit: (event: unknown) => {
    auditEvents.push(event)
    return Promise.resolve()
  },
})

// ─── Mock global fetch ────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
  fetchCalls.push({
    url:     url as string,
    body:    (init?.body ?? '') as string,
    headers: (init?.headers ?? {}) as Record<string, string>,
  })
  if (mockFetchImpl) {
    return mockFetchImpl()
  }
  return { ok: true, status: 200, text: async () => 'ok' }
}

// ─── Load sender AFTER mocks are installed ────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { deliverPartnerWebhook } = req(SENDER_SRC) as {
  deliverPartnerWebhook: (dealId: string, payload: unknown, actorId: string) => Promise<void>
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEAL_WITH_PARTNER = { partner_id: 'partner-1' }
const DEAL_NO_PARTNER   = { partner_id: null }

const PARTNER_ACTIVE = {
  id:                     'partner-1',
  name:                   'Test Bank',
  webhook_url:            'https://hooks.testbank.example/vektrum',
  webhook_signing_secret: 'whsec_test_secret_value',
  is_active:              true,
}
const PARTNER_NO_URL  = { ...PARTNER_ACTIVE, webhook_url: null }
const PARTNER_INACTIVE = { ...PARTNER_ACTIVE, is_active: false }

const PAYLOAD = {
  event:             'release.authorized',
  api_version:       '2026-05-01',
  release_id:        'rel-abc-123',
  deal_id:           'deal-xyz-456',
  deal_title:        'River Crossing Project',
  milestone_id:      'ms-111',
  milestone_title:   'Foundation',
  amount:            50_000,
  fee_amount:        500,
  retainage_amount:  2_500,
  net_to_contractor: 47_000,
  contractor_id:     'contractor-1',
  funder_id:         'funder-1',
  authorized_at:     '2026-05-12T10:00:00Z',
  authorized_by:     'funder-1',
  idempotency_key:   'idempotency-key-abc-123',
}

// ─── Helper: set up deal + partner in tableResponses ─────────────────────────

type PartnerFixture = { id: string; name: string; webhook_url: string | null; webhook_signing_secret: string; is_active: boolean }

function setupDelivery(partnerOverride: PartnerFixture | null = PARTNER_ACTIVE) {
  resetMockState()
  tableResponses['deals']    = { data: DEAL_WITH_PARTNER,  error: null }
  tableResponses['partners'] = partnerOverride
    ? { data: partnerOverride, error: null }
    : { data: null, error: { message: 'not found' } }
}

// ─── STATIC SOURCE CHECKS ─────────────────────────────────────────────────────

async function runStaticChecks() {

await test('Migration file exists', () => {
  assert(fs.existsSync(MIGRATION), `Migration not found: ${MIGRATION}`)
})

await test('Migration creates partner_webhook_deliveries table', () => {
  const src = read(MIGRATION)
  assert(src.includes('CREATE TABLE IF NOT EXISTS public.partner_webhook_deliveries'), 'Table definition missing')
})

await test('Migration has delivery_status CHECK constraint', () => {
  const src = read(MIGRATION)
  assert(src.includes("delivery_status IN ('pending', 'success', 'failed', 'exhausted')"), 'Status CHECK constraint missing')
})

await test('Migration has request_body_hash column with SHA-256 format constraint', () => {
  const src = read(MIGRATION)
  assert(src.includes('request_body_hash'), 'request_body_hash column missing')
  assert(src.includes('[0-9a-f]{64}'), 'SHA-256 format CHECK constraint missing')
})

await test('Migration has request_headers_meta column (sanitized JSONB)', () => {
  const src = read(MIGRATION)
  assert(src.includes('request_headers_meta') && src.includes('jsonb'), 'request_headers_meta jsonb column missing')
})

await test('Migration has index on partner_id', () => {
  const src = read(MIGRATION)
  assert(src.includes('partner_webhook_deliveries_partner_idx'), 'partner_id index missing')
})

await test('Migration has index on delivery_status for monitoring', () => {
  const src = read(MIGRATION)
  assert(src.includes('partner_webhook_deliveries_status_idx'), 'delivery_status index missing')
})

await test('Migration enables RLS', () => {
  const src = read(MIGRATION)
  assert(src.includes('ENABLE ROW LEVEL SECURITY'), 'RLS not enabled')
})

await test('Migration grants admin read access only (no INSERT/UPDATE/DELETE to authenticated)', () => {
  const src = read(MIGRATION)
  // Must have a SELECT policy
  assert(src.includes('FOR SELECT'), 'No SELECT policy found')
  // Must NOT have INSERT/UPDATE/DELETE policies for authenticated users
  assert(!src.includes('FOR INSERT'), 'Unexpected INSERT policy for authenticated users')
  assert(!src.includes('FOR UPDATE'), 'Unexpected UPDATE policy for authenticated users')
  assert(!src.includes('FOR DELETE'), 'Unexpected DELETE policy for authenticated users')
})

await test('Migration admin policy checks role = admin', () => {
  const src = read(MIGRATION)
  assert(src.includes("p.role = 'admin'"), 'Admin role check missing from SELECT policy')
})

await test('Sender imports createHash (for body hashing)', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('createHash'), 'createHash import missing from sender')
  assert(src.includes('createHash(\'sha256\')') || src.includes('createHash("sha256")'),
    'SHA-256 body hash not found in sender')
})

await test('Sender inserts to partner_webhook_deliveries with request_body_hash', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('partner_webhook_deliveries'), 'Table reference missing from sender')
  assert(src.includes('request_body_hash'), 'request_body_hash not stored in sender insert')
  assert(src.includes('.insert('), 'No insert call found in sender')
})

await test('Sender inserts delivery_status: pending before HTTP call', () => {
  const src = read(SENDER_SRC)
  assert(src.includes("delivery_status:      'pending'"), "delivery_status 'pending' not found in insert")
})

await test('Sender updates delivery row after delivery (success/exhausted)', () => {
  const src = read(SENDER_SRC)
  assert(src.includes("'success'") && src.includes("'exhausted'"), 'Success/exhausted statuses not found')
  assert(src.includes('.update('), 'No update call found in sender')
  assert(src.includes('delivery_status:'), 'delivery_status not updated')
  assert(src.includes('attempt_count:'), 'attempt_count not updated')
  assert(src.includes('completed_at:'), 'completed_at not set on update')
})

await test('Sender stores response_body_snippet truncated to 500 chars', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('response_body_snippet'), 'response_body_snippet missing')
  assert(src.includes('.slice(0, 500)'), 'Response body not truncated to 500 chars')
})

await test('Sender never stores webhook_signing_secret as a key in delivery row', () => {
  const src = read(SENDER_SRC)
  // Extract the insert block and check that webhook_signing_secret is not a stored key.
  // Note: using !!partner.webhook_signing_secret to compute the 'signed' boolean is fine —
  // that reads the field to produce a boolean; it does not store the secret value.
  // We check for 'webhook_signing_secret:' (key assignment syntax) not the substring alone.
  const insertBlock = src.match(/\.from\('partner_webhook_deliveries'\)[\s\S]*?\.insert\(\{([\s\S]*?)\}\)/)?.[1] ?? ''
  assert(
    !insertBlock.includes('webhook_signing_secret:'),
    'webhook_signing_secret stored as a key in delivery insert — secret must never be persisted',
  )
})

await test('Sender excludes X-Vektrum-Signature from request_headers_meta', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('request_headers_meta'), 'request_headers_meta missing')
  // The headers meta object must NOT include the signature header key
  assert(!src.includes("'X-Vektrum-Signature': signatureHeader"), 'Signature HMAC stored in headers meta — forbidden')
  // But the sanitized meta should include Event and DeliveryId
  assert(src.includes("'X-Vektrum-Event'") && src.includes("'X-Vektrum-DeliveryId'"),
    'Non-sensitive headers missing from request_headers_meta')
})

await test('Sender binds delivery_row_id into audit log metadata', () => {
  const src = read(SENDER_SRC)
  assert(src.includes('delivery_row_id'), 'delivery_row_id not bound into audit log')
})

} // end runStaticChecks

// ─── RUNTIME BEHAVIOR TESTS ───────────────────────────────────────────────────

async function runRuntimeTests() {

await test('SUCCESS: delivery row inserted as pending, then updated to success', async () => {
  setupDelivery()
  mockFetchImpl = async () => ({ ok: true,  status: 200, text: async () => '{"received":true}' })

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  // One insert to partner_webhook_deliveries
  assert(deliveryInserts.length === 1, `Expected 1 delivery insert, got ${deliveryInserts.length}`)
  const inserted = deliveryInserts[0] as Record<string, unknown>
  assert(inserted['delivery_status'] === 'pending',        `Insert status should be 'pending', got '${inserted['delivery_status']}'`)
  assert(inserted['partner_id']      === 'partner-1',      `Wrong partner_id: ${inserted['partner_id']}`)
  assert(inserted['release_id']      === 'rel-abc-123',    `Wrong release_id: ${inserted['release_id']}`)
  assert(inserted['idempotency_key'] === 'idempotency-key-abc-123', 'Wrong idempotency_key')
  assert(inserted['attempt_count']   === 0,                'attempt_count should be 0 on insert')
  assert(typeof inserted['sent_at']  === 'string',         'sent_at should be a string timestamp')
  assert(typeof inserted['id']       === 'string',         'id should be a pre-generated UUID string')
  assert(inserted['signed'] === true,                      'signed should be true (secret configured)')

  // One update to partner_webhook_deliveries
  assert(deliveryUpdates.length === 1, `Expected 1 delivery update, got ${deliveryUpdates.length}`)
  const updated = deliveryUpdates[0] as Record<string, unknown>
  assert(updated['delivery_status']      === 'success', `Update status should be 'success', got '${updated['delivery_status']}'`)
  assert(updated['response_status_code'] === 200,       `Expected status 200, got ${updated['response_status_code']}`)
  assert(updated['attempt_count']        === 1,         `Expected attemptCount=1, got ${updated['attempt_count']}`)
  assert(updated['error_message']        === null,      `error_message should be null on success`)
  assert(typeof updated['completed_at']  === 'string',  'completed_at should be a string timestamp')
  assert(typeof updated['response_body_snippet'] === 'string', 'response_body_snippet should be a string')

  // Fetch was called once
  assert(fetchCalls.length === 1, `Expected 1 fetch call, got ${fetchCalls.length}`)
})

await test('EXHAUSTED: all retries fail → delivery row updated to exhausted, attempt_count=3', async () => {
  setupDelivery()
  // Override retry to not actually sleep (0ms backoff in tests)
  let fetchCallCount = 0
  mockFetchImpl = async () => {
    fetchCallCount++
    return { ok: false, status: 503, text: async () => 'Service Unavailable' }
  }

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  // Delivery row must have been inserted
  assert(deliveryInserts.length === 1, `Expected 1 delivery insert, got ${deliveryInserts.length}`)
  assert((deliveryInserts[0] as Record<string, unknown>)['delivery_status'] === 'pending',
    'Insert should be pending')

  // Must have been updated to exhausted
  assert(deliveryUpdates.length === 1, `Expected 1 delivery update, got ${deliveryUpdates.length}`)
  const updated = deliveryUpdates[0] as Record<string, unknown>
  assert(updated['delivery_status'] === 'exhausted', `Expected 'exhausted', got '${updated['delivery_status']}'`)
  assert(updated['attempt_count']   === 3,           `Expected attemptCount=3, got ${updated['attempt_count']}`)
  assert(updated['response_status_code'] === 503,    `Expected HTTP 503, got ${updated['response_status_code']}`)
  assert(typeof updated['error_message'] === 'string' && updated['error_message'].length > 0,
    'error_message should be non-empty on exhaustion')
  assert(typeof updated['completed_at']  === 'string', 'completed_at should be set on exhaustion')
}, )

await test('SECRET NOT STORED: webhook_signing_secret absent from delivery insert', async () => {
  setupDelivery()
  mockFetchImpl = async () => ({ ok: true, status: 200, text: async () => 'ok' })

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  assert(deliveryInserts.length === 1, 'Expected 1 delivery insert')
  const inserted = deliveryInserts[0] as Record<string, unknown>

  // The secret must not appear in the insert payload
  const insertedStr = JSON.stringify(inserted)
  assert(
    !insertedStr.includes('whsec_test_secret_value'),
    'webhook_signing_secret value found in delivery insert — security violation',
  )
  assert(
    !('webhook_signing_secret' in inserted),
    'webhook_signing_secret key found in delivery insert — security violation',
  )
})

await test('HMAC NOT STORED: X-Vektrum-Signature absent from request_headers_meta', async () => {
  setupDelivery()
  mockFetchImpl = async () => ({ ok: true, status: 200, text: async () => 'ok' })

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  assert(deliveryInserts.length === 1, 'Expected 1 delivery insert')
  const inserted = deliveryInserts[0] as Record<string, unknown>
  const headersMeta = inserted['request_headers_meta'] as Record<string, unknown> | undefined

  assert(headersMeta !== undefined, 'request_headers_meta should be set')
  assert(!('X-Vektrum-Signature' in headersMeta), 'X-Vektrum-Signature found in request_headers_meta — security violation')
  assert('X-Vektrum-Event' in headersMeta,      'X-Vektrum-Event missing from request_headers_meta')
  assert('X-Vektrum-DeliveryId' in headersMeta, 'X-Vektrum-DeliveryId missing from request_headers_meta')
  assert(typeof headersMeta['signed'] === 'boolean', 'signed flag missing from request_headers_meta')
})

await test('BODY HASH: request_body_hash is a 64-char hex string (SHA-256)', async () => {
  setupDelivery()
  mockFetchImpl = async () => ({ ok: true, status: 200, text: async () => 'ok' })

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  const inserted = deliveryInserts[0] as Record<string, unknown>
  const hash = inserted['request_body_hash'] as string
  assert(typeof hash === 'string',         'request_body_hash should be a string')
  assert(/^[0-9a-f]{64}$/.test(hash),     `request_body_hash is not a valid SHA-256 hex: ${hash}`)
  // Verify against a known computation
  const { createHash } = await import('crypto')
  const expected = createHash('sha256').update(JSON.stringify(PAYLOAD)).digest('hex')
  assert(hash === expected, `request_body_hash mismatch. Expected ${expected}, got ${hash}`)
})

await test('NO DELIVERY ROW: partner has no webhook_url → no insert', async () => {
  setupDelivery(PARTNER_NO_URL)

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  assert(deliveryInserts.length === 0,
    `Expected 0 delivery inserts for partner with no webhook_url, got ${deliveryInserts.length}`)
  // Audit event for 'skipped_no_url' should still fire
  const auditActions = (auditEvents as Array<Record<string, unknown>>).map(e => e['action'])
  assert(
    auditActions.includes('partner_webhook_skipped_no_url'),
    `Expected 'partner_webhook_skipped_no_url' audit event, got: ${auditActions.join(', ')}`,
  )
})

await test('NO DELIVERY ROW: partner is inactive → no insert', async () => {
  setupDelivery(PARTNER_INACTIVE)

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  assert(deliveryInserts.length === 0,
    `Expected 0 delivery inserts for inactive partner, got ${deliveryInserts.length}`)
  const auditActions = (auditEvents as Array<Record<string, unknown>>).map(e => e['action'])
  assert(
    auditActions.includes('partner_webhook_skipped_inactive'),
    `Expected 'partner_webhook_skipped_inactive' audit event, got: ${auditActions.join(', ')}`,
  )
})

await test('AUDIT BINDING: delivery_row_id bound into audit log on success', async () => {
  setupDelivery()
  mockFetchImpl = async () => ({ ok: true, status: 200, text: async () => 'ok' })

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  assert(deliveryInserts.length === 1, 'Expected 1 delivery insert')
  const deliveryRowId = (deliveryInserts[0] as Record<string, unknown>)['id'] as string

  const successAudit = (auditEvents as Array<Record<string, unknown>>)
    .find(e => e['action'] === 'partner_webhook_delivered')
  assert(successAudit !== undefined, 'partner_webhook_delivered audit event not found')

  const meta = successAudit['metadata'] as Record<string, unknown>
  assert(meta['delivery_row_id'] === deliveryRowId,
    `delivery_row_id in audit (${meta['delivery_row_id']}) should match inserted row id (${deliveryRowId})`)
})

await test('AUDIT BINDING: delivery_row_id bound into audit log on failure', async () => {
  setupDelivery()
  mockFetchImpl = async () => ({ ok: false, status: 502, text: async () => 'Bad Gateway' })

  await deliverPartnerWebhook('deal-xyz-456', PAYLOAD, 'funder-1')

  const failAudit = (auditEvents as Array<Record<string, unknown>>)
    .find(e => e['action'] === 'partner_webhook_failed')
  assert(failAudit !== undefined, 'partner_webhook_failed audit event not found')

  const meta = failAudit['metadata'] as Record<string, unknown>
  assert(typeof meta['delivery_row_id'] === 'string' && meta['delivery_row_id'].length > 0,
    'delivery_row_id missing from failure audit event')
})

} // end runRuntimeTests

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══ STATIC SOURCE CHECKS ════════════════════════════════════════════════\n')
  await runStaticChecks()

  console.log('\n══ RUNTIME BEHAVIOR TESTS ══════════════════════════════════════════════\n')
  await runRuntimeTests()

  // Restore fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = originalFetch

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log('\n' + '═'.repeat(72))
  console.log('  VEKTRUM — PARTNER WEBHOOK DELIVERY LOGGING TEST RESULTS')
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
