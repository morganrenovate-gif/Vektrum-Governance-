/**
 * Demo reset safety tests
 *
 * Proves the demo reset system is structurally isolated from production data:
 *
 *   0. AUTH: unauthenticated callers receive 401 (auth guard is enforced)
 *   1. DEMO_RESET_ENABLED missing or false → 403 in production (auth required to reach gate)
 *   2. DEMO_RESET_ENABLED=true in production → 200
 *   3. Reset only operates on frontend state — route makes zero DB calls
 *   4. User-supplied arbitrary deal IDs in the request body have no effect
 *   5. Reset is idempotent — two calls return identical structure
 *   6. Response body never contains values from env secrets
 *   7. Response carries an explicit JSON summary with ok, message, and scope
 *   9a. DEMO_RESET_EVENT constant equals the documented event name string
 *   9b. No demo files use localStorage or sessionStorage (all state is React useState)
 *
 * Design notes:
 *   - The route imports @/lib/supabase/server for auth ONLY (no DB queries).
 *   - We inject a Supabase auth mock that provides ONLY auth.getUser().
 *     The mock intentionally has NO from() method — any DB call would throw
 *     a TypeError, making the absence of DB queries self-enforcing.
 *   - process.env mutations are contained with a save/restore helper and do
 *     not leak between tests.
 *   - Demo-data IDs (ms-rv-1, ms-hb-1, etc.) are verified to be non-UUID
 *     strings that cannot match real Supabase UUID primary keys.
 *
 * Run:  npx tsx tests/demo-reset-safety.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { NextRequest, NextResponse } from 'next/server'
import {
  riverside, harbor, westside, harborDisputeMilestones, DEMO_RESET_EVENT,
} from '../src/lib/demo-data/index'

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

// ─── process.env save/restore ─────────────────────────────────────────────────
//
// The route reads process.env at call time, so we can control it between tests
// without reloading the module. Each test gets a clean env slice.

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key]
    if (overrides[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = overrides[key]
    }
  }
  return fn().finally(() => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = saved[key]
      }
    }
  })
}

// ─── Supabase auth mock ───────────────────────────────────────────────────────
//
// The route uses createClient().auth.getUser() to enforce authentication.
// We inject a mock that controls currentUser per test.
//
// Key design: the mock provides ONLY auth.getUser() — NO from() method.
// Any attempt by the route to call supabase.from(...) throws a TypeError,
// preserving the structural proof that the route makes zero DB calls.
//
// currentUser = { id: '...' }  → authenticated (default for most tests)
// currentUser = null           → unauthenticated (AUTH tests only)

let currentUser: { id: string } | null = { id: 'demo-test-user' }

const supabaseServerPath = path.resolve(ROOT, 'src/lib/supabase/server')
// Resolve the .ts extension so the tsx cache key matches
const supabaseServerPathTs = supabaseServerPath.endsWith('.ts')
  ? supabaseServerPath
  : `${supabaseServerPath}.ts`

const supabaseMockModule = {
  id:       supabaseServerPathTs,
  filename: supabaseServerPathTs,
  loaded:   true,
  children: [] as NodeModule[],
  parent:   null,
  paths:    [] as string[],
  exports: {
    createClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: currentUser }, error: null }),
      },
      // Intentionally no from() — any DB call would throw TypeError.
    }),
    createSupabaseAdminClient: () => ({}),
  },
} as unknown as NodeModule

require.cache[supabaseServerPathTs] = supabaseMockModule

// ─── Load route ───────────────────────────────────────────────────────────────
//
// Loaded once — no per-test reload needed since the route reads env at call time
// and the currentUser variable is read at request time via the auth mock above.

const resetRoutePath = path.resolve(ROOT, 'src/app/api/demo/reset/route.ts')
delete require.cache[resetRoutePath]
const { POST } = req(resetRoutePath) as { POST: (req: NextRequest) => Promise<NextResponse> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResetRequest(body?: Record<string, unknown>): NextRequest {
  const url = 'http://localhost/api/demo/reset'
  if (body) {
    return new NextRequest(url, {
      method:  'POST',
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new NextRequest(url, { method: 'POST' })
}

// UUID v4 pattern — real Supabase PKs always match this format.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── 0a. No session → 401 in development ──────────────────────────────────────
//
// Auth is checked before the env gate. An unauthenticated caller must receive
// 401 regardless of NODE_ENV or DEMO_RESET_ENABLED.

await test('AUTH: unauthenticated → 401 in development', async () => {
  currentUser = null
  await withEnv({ NODE_ENV: 'development', DEMO_RESET_ENABLED: undefined }, async () => {
    const res = await POST(makeResetRequest())
    assert(res.status === 401, `Expected 401 for unauthenticated request, got ${res.status}`)
    const body = await res.json() as { error?: string }
    assert(typeof body.error === 'string', `Expected error field in 401 body, got: ${JSON.stringify(body)}`)
  })
  currentUser = { id: 'demo-test-user' }  // restore
})

// ── 0b. No session → 401 in production with flag enabled ─────────────────────
//
// Even with DEMO_RESET_ENABLED=true, unauthenticated callers cannot reach the
// allowed path — they are blocked by the auth check first.

await test('AUTH: unauthenticated → 401 in production even with DEMO_RESET_ENABLED=true', async () => {
  currentUser = null
  await withEnv({ NODE_ENV: 'production', DEMO_RESET_ENABLED: 'true' }, async () => {
    const res = await POST(makeResetRequest())
    assert(res.status === 401, `Expected 401 for unauthenticated request, got ${res.status}`)
  })
  currentUser = { id: 'demo-test-user' }  // restore
})

// ── 1a. Production, no flag → 403 ────────────────────────────────────────────

await test('GATE: NODE_ENV=production, DEMO_RESET_ENABLED absent → 403', async () => {
  await withEnv({ NODE_ENV: 'production', DEMO_RESET_ENABLED: undefined }, async () => {
    const res = await POST(makeResetRequest())
    assert(res.status === 403, `Expected 403, got ${res.status}`)
    const body = await res.json() as { error?: string }
    assert(typeof body.error === 'string', `Expected error field, got: ${JSON.stringify(body)}`)
  })
})

// ── 1b. Production, flag explicitly false → 403 ───────────────────────────────

await test('GATE: NODE_ENV=production, DEMO_RESET_ENABLED=false → 403', async () => {
  await withEnv({ NODE_ENV: 'production', DEMO_RESET_ENABLED: 'false' }, async () => {
    const res = await POST(makeResetRequest())
    assert(res.status === 403, `Expected 403, got ${res.status}`)
  })
})

// ── 1c. Production, flag set to arbitrary non-true string → 403 ───────────────

await test('GATE: NODE_ENV=production, DEMO_RESET_ENABLED=yes → 403 (only "true" accepted)', async () => {
  await withEnv({ NODE_ENV: 'production', DEMO_RESET_ENABLED: 'yes' }, async () => {
    const res = await POST(makeResetRequest())
    assert(res.status === 403, `Expected 403 for non-"true" value, got ${res.status}`)
  })
})

// ── 2. Production + DEMO_RESET_ENABLED=true → 200 ────────────────────────────

await test('ALLOW: NODE_ENV=production, DEMO_RESET_ENABLED=true → 200', async () => {
  await withEnv({ NODE_ENV: 'production', DEMO_RESET_ENABLED: 'true' }, async () => {
    const res = await POST(makeResetRequest())
    assert(res.status === 200, `Expected 200, got ${res.status}`)
  })
})

// ── 2b. Non-production → 200 regardless of flag ───────────────────────────────
//
// Next.js sets NODE_ENV='development' for `next dev`. In local dev the flag
// is not needed — the gate only activates in production.

await test('ALLOW: NODE_ENV=development, no flag → 200 (gate inactive in non-prod)', async () => {
  await withEnv({ NODE_ENV: 'development', DEMO_RESET_ENABLED: undefined }, async () => {
    const res = await POST(makeResetRequest())
    assert(res.status === 200, `Expected 200 in development, got ${res.status}`)
  })
})

// ── 3a. Scope field proves frontend-only operation ────────────────────────────

await test('SCOPE: response declares scope=frontend_state_only', async () => {
  await withEnv({ NODE_ENV: 'development' }, async () => {
    const res = await POST(makeResetRequest())
    const body = await res.json() as { scope?: string }
    assert(
      body.scope === 'frontend_state_only',
      `Expected scope="frontend_state_only", got: "${body.scope}"`,
    )
  })
})

// ── 3b. Route makes no DB calls ───────────────────────────────────────────────
//
// Structural proof: the Supabase mock injected above provides ONLY
// auth.getUser() — there is no from() method on the mock client.
//
// If the route ever attempts a DB query (supabase.from(...)), it would throw
// "supabase.from is not a function", causing this test to fail. Three
// consecutive successful calls without an exception is machine-verifiable
// proof that no DB path exists in the route beyond the auth check.

await test('ISOLATION: route makes no DB calls (auth mock has no from() method)', async () => {
  await withEnv({ NODE_ENV: 'development' }, async () => {
    let threw = false
    try {
      await POST(makeResetRequest())
      await POST(makeResetRequest())
      await POST(makeResetRequest())
    } catch {
      threw = true
    }
    assert(!threw, 'Route threw — it may have attempted a DB call (supabase.from is not mocked)')
  })
})

// ── 4. Arbitrary deal IDs in request body are ignored ────────────────────────
//
// The route does not parse the request body. Sending real-looking deal UUIDs
// has no effect on the response — they cannot trigger any DB operation.

await test('SCOPE: arbitrary deal IDs in body are silently ignored', async () => {
  await withEnv({ NODE_ENV: 'development' }, async () => {
    const resWithIds = await POST(makeResetRequest({
      deal_id:  '550e8400-e29b-41d4-a716-446655440000',
      deal_ids: [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ],
      force: true,
      wipe_all: true,
    }))
    const resWithout = await POST(makeResetRequest())

    assert(
      resWithIds.status === resWithout.status,
      `Status changed when deal IDs were supplied (${resWithIds.status} vs ${resWithout.status})`,
    )
    const bodyWithIds  = await resWithIds.json()  as Record<string, unknown>
    const bodyWithout  = await resWithout.json()  as Record<string, unknown>
    assert(
      JSON.stringify(bodyWithIds) === JSON.stringify(bodyWithout),
      `Response body changed when deal IDs were supplied: ` +
      `with=${JSON.stringify(bodyWithIds)} without=${JSON.stringify(bodyWithout)}`,
    )
  })
})

// ── 5. Idempotency — two calls produce identical structure ────────────────────

await test('IDEMPOTENT: two consecutive calls return identical status and structure', async () => {
  await withEnv({ NODE_ENV: 'development' }, async () => {
    const res1 = await POST(makeResetRequest())
    const res2 = await POST(makeResetRequest())

    assert(res1.status === res2.status, `Status differs: ${res1.status} vs ${res2.status}`)

    const body1 = await res1.json() as Record<string, unknown>
    const body2 = await res2.json() as Record<string, unknown>

    assert(body1.ok    === body2.ok,    `ok field differs`)
    assert(body1.scope === body2.scope, `scope field differs`)
    assert(
      typeof body1.message === 'string' && typeof body2.message === 'string',
      `message is not a string`,
    )
  })
})

// ── 5b. Idempotency in production with flag ───────────────────────────────────

await test('IDEMPOTENT: two calls in production+enabled return identical 200', async () => {
  await withEnv({ NODE_ENV: 'production', DEMO_RESET_ENABLED: 'true' }, async () => {
    const res1 = await POST(makeResetRequest())
    const res2 = await POST(makeResetRequest())
    assert(res1.status === 200 && res2.status === 200, `Expected 200+200, got ${res1.status}+${res2.status}`)
    const b1 = await res1.json() as Record<string, unknown>
    const b2 = await res2.json() as Record<string, unknown>
    assert(b1.ok === true && b2.ok === true, 'Expected ok:true from both calls')
    assert(b1.scope === b2.scope, 'scope changed between calls')
  })
})

// ── 6. Response never leaks env secrets ──────────────────────────────────────
//
// Set a recognisable fake service-role key in env, call the route, and verify
// that key value never appears anywhere in the serialised response body.

await test('SECRETS: response body never contains env secret values', async () => {
  const fakeSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FAKE_SERVICE_ROLE_KEY_DO_NOT_EXPOSE'
  const fakeAnon   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FAKE_ANON_KEY'

  await withEnv({
    NODE_ENV:                 'development',
    SUPABASE_SERVICE_ROLE_KEY: fakeSecret,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeAnon,
    STRIPE_SECRET_KEY:        'sk_test_FAKE_STRIPE_KEY',
  }, async () => {
    const res  = await POST(makeResetRequest())
    const raw  = await res.text()

    assert(
      !raw.includes(fakeSecret),
      `Response contains SUPABASE_SERVICE_ROLE_KEY value — secrets are leaking`,
    )
    assert(
      !raw.includes(fakeAnon),
      `Response contains NEXT_PUBLIC_SUPABASE_ANON_KEY value — secrets are leaking`,
    )
    assert(
      !raw.includes('sk_test_FAKE_STRIPE_KEY'),
      `Response contains STRIPE_SECRET_KEY value — secrets are leaking`,
    )
  })
})

// ── 7. Response carries a clear JSON summary ──────────────────────────────────

await test('SUMMARY: 200 response has ok=true, non-empty message string, and scope field', async () => {
  await withEnv({ NODE_ENV: 'development' }, async () => {
    const res  = await POST(makeResetRequest())
    assert(res.status === 200, `Expected 200, got ${res.status}`)

    const body = await res.json() as { ok?: unknown; message?: unknown; scope?: unknown }
    assert(body.ok === true,                      `Expected ok=true, got: ${JSON.stringify(body.ok)}`)
    assert(
      typeof body.message === 'string' && body.message.length > 10,
      `Expected non-empty message string, got: ${JSON.stringify(body.message)}`,
    )
    assert(
      typeof body.scope === 'string' && body.scope.length > 0,
      `Expected non-empty scope string, got: ${JSON.stringify(body.scope)}`,
    )
  })
})

// ── 8. Demo data IDs are non-UUID strings ────────────────────────────────────
//
// All demo milestone IDs (ms-rv-1, ms-hb-1, etc.) follow a short slug pattern
// that cannot match a Supabase UUID v4 primary key. This structurally prevents
// demo data from accidentally matching real production records even if the
// reset were ever extended to write to the DB.

await test('DEMO IDs: all demo milestone IDs are non-UUID slugs (cannot match real PKs)', () => {
  const allIds = [
    ...riverside.milestones,
    ...harbor.milestones,
    ...westside.milestones,
    ...harborDisputeMilestones,
  ].map(m => m.id)

  assert(allIds.length > 0, 'Expected at least one demo milestone ID')

  for (const id of allIds) {
    assert(
      !UUID_REGEX.test(id),
      `Demo milestone ID "${id}" matches UUID v4 format — it could accidentally match a real PK`,
    )
    // IDs follow the pattern ms-<prefix>-<number>
    assert(
      /^ms-[a-z]+-\d+$/.test(id),
      `Demo ID "${id}" does not match expected slug pattern ms-<prefix>-<digit>`,
    )
  }
})

// ── 9a. DEMO_RESET_EVENT constant value is the documented event name ──────────
//
// Any component that listens for this event and any tool that dispatches it
// must use the same string. This test pins the value so a rename is caught
// immediately rather than silently breaking the reset mechanism.

await test('EVENT: DEMO_RESET_EVENT constant equals "vektrum:demo-reset"', () => {
  assert(
    DEMO_RESET_EVENT === 'vektrum:demo-reset',
    `Expected DEMO_RESET_EVENT="vektrum:demo-reset", got "${DEMO_RESET_EVENT}"`,
  )
})

// ── 9b. No demo files use localStorage or sessionStorage ─────────────────────
//
// Demo state is React useState only. If localStorage is ever introduced we
// want a failing test to remind the developer to add a clear() call to
// DemoResetButton and this test suite.

await test('STORAGE: no demo files use localStorage or sessionStorage', async () => {
  const { execSync } = await import('child_process')
  const demoFiles = [
    'src/app/demo-live',
    'src/components/demo',
    'src/lib/demo-data',
  ]

  for (const dir of demoFiles) {
    let output = ''
    try {
      // Pipe through grep -v to exclude comment lines (// ... and JSDoc * ...)
      // so that documentation mentions like "No localStorage / sessionStorage"
      // don't trip the test — we only want to flag actual runtime code usage.
      // Output format from grep -n is: "file:linenum: content"
      // We filter lines where the content (after file:linenum:) starts with * or //
      output = execSync(
        `grep -rn --include="*.ts" --include="*.tsx" "localStorage\\|sessionStorage" "${dir}" | grep -v ":[0-9]*:[[:space:]]*//" | grep -v ":[0-9]*:[[:space:]]*\\*"`,
        { cwd: ROOT, encoding: 'utf-8' },
      ).trim()
    } catch {
      // grep exits 1 when no matches — that's the expected case
      output = ''
    }
    assert(
      output === '',
      `Found localStorage/sessionStorage usage in ${dir}: ${output} — ` +
      `these keys must be cleared by DemoResetButton and documented in tests`,
    )
  }
})

// ── 10a. ms-hb-3 (Structural Steel Erection) starts non-released ─────────────
//
// Demosmith's funder flow requires releasing ms-hb-3.  If it already has
// status 'released' on load the Release Funds button is never shown and the
// demo fails.  This test pins the initial status so any accidental revert to
// 'released' is caught immediately.

await test('DEMO DATA: ms-hb-3 initial status is not "released"', () => {
  const ms = harbor.milestones.find(m => m.id === 'ms-hb-3')
  assert(ms !== undefined, 'ms-hb-3 not found in harbor.milestones')
  assert(
    ms.status !== 'released',
    `ms-hb-3 status is "${ms.status}" — must not be "released" on load (demo flow requires releasing it)`,
  )
})

// ── 10b. ms-hb-3 starts 'approved' (releasable state) ────────────────────────
//
// The Release Funds button renders only when status === 'approved'.
// Pinning the exact initial status prevents other non-released states (e.g.
// 'in_progress', 'ready_for_review') from silently breaking the demo flow.

await test('DEMO DATA: ms-hb-3 initial status is "approved" (funder release button is shown)', () => {
  const ms = harbor.milestones.find(m => m.id === 'ms-hb-3')
  assert(ms !== undefined, 'ms-hb-3 not found in harbor.milestones')
  assert(
    ms.status === 'approved',
    `ms-hb-3 status is "${ms.status}" — expected "approved" so the Release Funds button renders`,
  )
})

// ── 10c. harbor.released equals the sum of the two released milestones ────────
//
// harbor.released is used to seed the Released stat tile.  It must equal the
// sum of ms-hb-1 + ms-hb-2 only; ms-hb-3 must NOT be counted because it
// hasn't been released yet at demo start.

await test('DEMO DATA: harbor.released equals ms-hb-1 + ms-hb-2 amounts ($2,160,000)', () => {
  const ms1 = harbor.milestones.find(m => m.id === 'ms-hb-1')
  const ms2 = harbor.milestones.find(m => m.id === 'ms-hb-2')
  assert(ms1 !== undefined, 'ms-hb-1 not found')
  assert(ms2 !== undefined, 'ms-hb-2 not found')
  const expected = ms1.amount + ms2.amount
  assert(
    harbor.released === expected,
    `harbor.released is ${harbor.released}, expected ${expected} (ms-hb-1 $${ms1.amount} + ms-hb-2 $${ms2.amount})`,
  )
})

// ── 10d. useDemoAutoReset hook uses an empty dep array (no infinite loop) ─────
//
// Structural proof: grep the hook source for the empty dep array comment and
// the literal "}, [])" closing. An infinite loop would require a non-empty dep
// array or a missing dep array entirely.

await test('HOOK: useDemoAutoReset uses empty dep array — no infinite render loop', async () => {
  const { readFileSync } = await import('fs')
  const hookSrc = readFileSync(
    path.resolve(ROOT, 'src/lib/demo-data/use-demo-auto-reset.ts'),
    'utf-8',
  )
  // The hook must contain useEffect(..., []) — empty array is the only safe pattern
  // given that onReset only invokes stable React setState setters.
  assert(
    hookSrc.includes('}, [])'),
    'useDemoAutoReset does not contain }, []) — the dep array may be missing or non-empty, risking an infinite loop',
  )
  // Must NOT contain a non-empty dep array like [onReset]
  assert(
    !hookSrc.includes('[onReset]'),
    'useDemoAutoReset contains [onReset] in dep array — would cause infinite render loop',
  )
})

// ── 10e. useDemoAutoReset hook calls onReset on mount (auto-reset on entry) ───
//
// The hook must call onReset() directly inside useEffect before registering the
// event listener so fresh demo visitors start from a clean state without needing
// to click the manual reset button.

await test('HOOK: useDemoAutoReset calls onReset on mount for clean initial state', async () => {
  const { readFileSync } = await import('fs')
  const hookSrc = readFileSync(
    path.resolve(ROOT, 'src/lib/demo-data/use-demo-auto-reset.ts'),
    'utf-8',
  )
  // onReset() must be called before the addEventListener line
  const resetCallIdx   = hookSrc.indexOf('onReset()')
  const addListenerIdx = hookSrc.indexOf('addEventListener')
  assert(
    resetCallIdx !== -1,
    'useDemoAutoReset does not call onReset() directly — mount-time auto-reset is missing',
  )
  assert(
    resetCallIdx < addListenerIdx,
    'useDemoAutoReset calls onReset() after addEventListener — it should be called first (mount reset)',
  )
})

// ── 9. 403 response body matches expected error shape ─────────────────────────

await test('GATE SHAPE: 403 response body has only an error field (no secret fields)', async () => {
  await withEnv({ NODE_ENV: 'production', DEMO_RESET_ENABLED: 'false' }, async () => {
    const res  = await POST(makeResetRequest())
    const body = await res.json() as Record<string, unknown>

    assert(res.status === 403, `Expected 403, got ${res.status}`)
    assert(typeof body.error === 'string', `Expected error field, got: ${JSON.stringify(body)}`)

    // Verify no unexpected fields leak out
    const keys = Object.keys(body)
    const unexpected = keys.filter(k => !['error', 'details'].includes(k))
    assert(
      unexpected.length === 0,
      `Unexpected fields in 403 body: ${unexpected.join(', ')}`,
    )
  })
})

// ─── Results ──────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — DEMO RESET SAFETY TEST RESULTS')
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
