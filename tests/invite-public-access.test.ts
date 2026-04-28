/**
 * Invite Public Access — Static Safety Tests
 *
 * Source-parse checks — no live DB, no env vars required.
 * Verifies that the public invite preview route correctly uses the admin client,
 * guards against missing service role key, returns distinct reason codes for
 * every failure mode, and does not expose secrets or weaken global RLS.
 *
 * Checks:
 *  1.  GET preview route imports createSupabaseAdminClient (not session client).
 *  2.  GET route guards SUPABASE_SERVICE_ROLE_KEY — source contains the guard.
 *  3.  GET route returns 503 when service role key is missing.
 *  4.  GET route uses maybeSingle() not single() for token lookup.
 *  5.  GET route contains all six reason codes in its source.
 *  6.  GET route does not include the raw token in the response JSON.
 *  7.  GET route does not reference SUPABASE_SERVICE_ROLE_KEY in response body.
 *  8.  Middleware passes /invite/ routes through without auth redirect.
 *  9.  Accept route selects role, accepted_at, accepted_by for defense-in-depth.
 * 10.  Accept route validates !invite.role (missing role).
 * 11.  Accept route validates invite.role !== 'funder' (wrong role).
 * 12.  Accept route uses maybeSingle() not single() for token lookup.
 * 13.  Accept route does NOT allow self-funding (contractor_id check).
 * 14.  Page reason union includes 'already_accepted' and 'wrong_status'.
 * 15.  Page fetchPreview parses 'expired' from 404 body.
 * 16.  Page fetchPreview parses 'already_accepted' from 404 body.
 * 17.  Page fetchPreview parses 'wrong_status' from 404 body.
 * 18.  Page shows distinct copy for 'expired' reason.
 * 19.  Page shows distinct copy for 'already_accepted' reason.
 * 20.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/invite-public-access.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

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
  return fs.readFileSync(path.resolve(ROOT, p), 'utf-8')
}

const GET_ROUTE    = 'src/app/api/invites/[token]/route.ts'
const ACCEPT_ROUTE = 'src/app/api/invites/[token]/accept/route.ts'
const INVITE_PAGE  = 'src/app/invite/[token]/page.tsx'
const MIDDLEWARE   = 'src/middleware.ts'
const PKG          = 'package.json'

async function main() {

// ─── 1-7. GET preview route ────────────────────────────────────────────────────

await test('1. GET preview route imports createSupabaseAdminClient', () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes('createSupabaseAdminClient'),
    `${GET_ROUTE} must use createSupabaseAdminClient (service-role admin client) to bypass ` +
    `RLS on deal_invites — the anon/session client will always return 0 rows for unauthenticated ` +
    `readers, making all valid tokens appear invalid.`,
  )
  assert(
    !src.includes('createSupabaseServerClient') && !src.includes('createServerClient') && !src.includes('getAuthUser'),
    `${GET_ROUTE} must NOT use the session/auth client — this is a public endpoint and the ` +
    `caller will not have a session cookie, so the session client would fail silently.`,
  )
})

await test('2. GET route contains SUPABASE_SERVICE_ROLE_KEY guard', () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes('SUPABASE_SERVICE_ROLE_KEY'),
    `${GET_ROUTE} must guard against missing SUPABASE_SERVICE_ROLE_KEY. Without this guard, ` +
    `createSupabaseAdminClient() creates an unauthorized client whose queries are silently ` +
    `blocked by RLS, returning false "not found" responses for valid tokens.`,
  )
})

await test('3. GET route returns 503 when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes('503'),
    `${GET_ROUTE} must return HTTP 503 when SUPABASE_SERVICE_ROLE_KEY is not set. ` +
    `This prevents the silent false-404 failure mode where valid tokens appear invalid ` +
    `because the client operates without service-role authorization.`,
  )
})

await test('4. GET route uses maybeSingle() not single() for token lookup', () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes('.maybeSingle()'),
    `${GET_ROUTE} must use .maybeSingle() for the token lookup. Unlike .single(), ` +
    `maybeSingle() returns { data: null, error: null } for 0 rows and only returns ` +
    `an error on query failure — enabling clean distinction between "token not found" ` +
    `and "database error."`,
  )
  assert(
    !src.includes('.single()'),
    `${GET_ROUTE} must not use .single() — it returns an error for both 0 rows AND ` +
    `query failures, collapsing two very different conditions into the same code path.`,
  )
})

await test('5. GET route contains all six reason codes', () => {
  const src = read(GET_ROUTE)
  const requiredReasons = [
    'not_found',
    'already_accepted',
    'wrong_status',
    'expired',
    'missing_role',
    'wrong_role',
  ]
  for (const reason of requiredReasons) {
    assert(
      src.includes(reason),
      `${GET_ROUTE} must include reason code '${reason}' so the UI can show targeted ` +
      `copy for each failure mode instead of a generic error.`,
    )
  }
})

await test('6. GET route does not include raw token in response JSON', () => {
  const src = read(GET_ROUTE)
  // The response JSON object block (after "Build safe preview response") must not
  // include 'token:' as a key. We look for token: in the response NextResponse.json block.
  // Strategy: check that the returned invite object does not include a token property.
  assert(
    !src.includes('token: invite.token') && !src.includes("token: token"),
    `${GET_ROUTE} must not include the raw token in the preview response. ` +
    `The token is the secret — returning it would allow a listener to re-use it.`,
  )
})

await test('7. GET route does not expose SUPABASE_SERVICE_ROLE_KEY in response', () => {
  const src = read(GET_ROUTE)
  // The service role key guard logs to console.error but must not appear in the JSON response
  const lines = src.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip console.error and comment lines — only flag if it appears in JSON output
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.includes('console.error') || trimmed.includes('process.env')) continue
    assert(
      !trimmed.includes('SUPABASE_SERVICE_ROLE_KEY'),
      `${GET_ROUTE} must not include SUPABASE_SERVICE_ROLE_KEY in any response body. ` +
      `Found suspicious reference on non-env line: ${trimmed}`,
    )
  }
})

// ─── 8. Middleware ─────────────────────────────────────────────────────────────

await test('8. Middleware passes /invite/ routes without auth redirect', () => {
  const src = read(MIDDLEWARE)
  // The middleware must have a pass-through for /invite/ paths
  assert(
    src.includes('/invite/') || src.includes("'/invite'") || src.includes('invite'),
    `${MIDDLEWARE} must explicitly pass through /invite/ routes so unauthenticated ` +
    `users can view the public invite preview page. Without this, the middleware ` +
    `redirects them to /auth/login before the invite page can load.`,
  )
})

// ─── 9-13. Accept route defense-in-depth ──────────────────────────────────────

await test('9. Accept route selects role, accepted_at, accepted_by', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('accepted_at') && src.includes('accepted_by') && src.includes('role'),
    `${ACCEPT_ROUTE} must select 'role', 'accepted_at', and 'accepted_by' in its invite ` +
    `query for defense-in-depth validation. Without these, a race condition or data ` +
    `integrity issue could allow double-acceptance or wrong-role assignment.`,
  )
})

await test('10. Accept route validates missing role (!invite.role)', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('!invite.role'),
    `${ACCEPT_ROUTE} must guard against null/missing role — stale invites from older ` +
    `code paths may have role=null. These must be rejected before acceptance proceeds.`,
  )
})

await test("11. Accept route validates invite.role !== 'funder'", () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes("invite.role !== 'funder'"),
    `${ACCEPT_ROUTE} must explicitly check invite.role !== 'funder' and reject ` +
    `non-funder invites. This prevents misuse of invite links created with wrong roles.`,
  )
})

await test('12. Accept route uses maybeSingle() not single()', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('.maybeSingle()'),
    `${ACCEPT_ROUTE} must use .maybeSingle() for the token lookup to cleanly distinguish ` +
    `"invite not found" (null, no error) from "database error" (null + error).`,
  )
})

await test('13. Accept route prevents self-funding (contractor_id === user.id check)', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('contractor_id') && src.includes('user.id'),
    `${ACCEPT_ROUTE} must check deal.contractor_id !== user.id to prevent a contractor ` +
    `from funding their own deal. This is a belt-and-suspenders check against RLS.`,
  )
})

// ─── 14-19. Page reason union and copy ────────────────────────────────────────

await test("14. Page reason union includes 'already_accepted' and 'wrong_status'", () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes("'already_accepted'"),
    `${INVITE_PAGE} PageState reason union must include 'already_accepted' to distinguish ` +
    `"invite was used" from "invite never existed."`,
  )
  assert(
    src.includes("'wrong_status'"),
    `${INVITE_PAGE} PageState reason union must include 'wrong_status' so expired/revoked ` +
    `invites show actionable copy (ask for new link) rather than a generic error.`,
  )
})

await test("15. Page fetchPreview parses 'expired' from 404 body", () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes("body.reason === 'expired'") || src.includes(`reason === 'expired'`),
    `${INVITE_PAGE} fetchPreview must map reason='expired' from the 404 JSON body ` +
    `so the UI can show an "Invite expired" message instead of a generic "not found."`,
  )
})

await test("16. Page fetchPreview parses 'already_accepted' from 404 body", () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes("body.reason === 'already_accepted'") || src.includes(`reason === 'already_accepted'`),
    `${INVITE_PAGE} fetchPreview must map reason='already_accepted' from the 404 JSON body ` +
    `so the UI can tell the user the link was already used.`,
  )
})

await test("17. Page fetchPreview parses 'wrong_status' from 404 body", () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes("body.reason === 'wrong_status'") || src.includes(`reason === 'wrong_status'`),
    `${INVITE_PAGE} fetchPreview must map reason='wrong_status' from the 404 JSON body ` +
    `so the UI can direct the user to request a new link.`,
  )
})

await test("18. Page shows distinct copy for 'expired' reason", () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('expired') && (
      src.includes('has expired') ||
      src.includes('Invite link has expired') ||
      src.includes('generate a new invite link')
    ),
    `${INVITE_PAGE} must render distinct copy when reason === 'expired' ` +
    `(e.g. "This invite link has expired. Ask the contractor to generate a new one.").`,
  )
})

await test("19. Page shows distinct copy for 'already_accepted' reason", () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('already_accepted') && (
      src.includes('already been used') ||
      src.includes('already used') ||
      src.includes('can only be accepted once')
    ),
    `${INVITE_PAGE} must render distinct copy when reason === 'already_accepted' ` +
    `(e.g. "This invite link has already been used. Each invite link can only be accepted once.").`,
  )
})

// ─── 20. Package.json ─────────────────────────────────────────────────────────

await test('20. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('invite-public-access.test.ts'),
    `package.json npm test script must include 'invite-public-access.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Invite Public Access Tests')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter(r => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)

} // end main()

main()
