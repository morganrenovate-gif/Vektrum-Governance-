/**
 * Invite Public Access — Static Safety Tests
 *
 * Source-parse checks — no live DB, no env vars required.
 * Verifies that the public invite preview route correctly uses the admin client,
 * guards against missing service role key, returns distinct reason codes for
 * every failure mode, does not expose secrets, and does not collapse query
 * errors into not_found.
 *
 * Checks:
 *  1.  GET preview route imports createSupabaseAdminClient (not session client).
 *  2.  GET route guards SUPABASE_SERVICE_ROLE_KEY — source contains the guard.
 *  3.  GET route returns 503 when service role key is missing.
 *  4.  GET route uses maybeSingle() not single() for token lookup.
 *  5.  GET route contains all six invalid-invite reason codes.
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
 * 21.  GET route returns lookup_error (500) on Supabase query error — not not_found.
 * 22.  GET route uses flat separate queries — no fragile nested relationship select.
 * 23.  GET route returns not_found only when query succeeds and data is null.
 * 24.  Accept route returns lookup_error (not not_found) on invite query error.
 * 25.  Accept route returns lookup_error (not not_found) on deal query error.
 * 26.  GET route logs safe diagnostics only (code, message, token_present, token_length).
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

await test('5. GET route contains all six invalid-invite reason codes', () => {
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
  assert(
    !src.includes('token: invite.token') && !src.includes("token: token"),
    `${GET_ROUTE} must not include the raw token in the preview response. ` +
    `The token is the secret — returning it would allow a listener to re-use it.`,
  )
})

await test('7. GET route does not expose SUPABASE_SERVICE_ROLE_KEY in response', () => {
  const src = read(GET_ROUTE)
  const lines = src.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
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

// ─── 21-26. Error-handling and flat-query invariants ──────────────────────────

await test('21. GET route returns lookup_error (500) on Supabase query error — not not_found', () => {
  const src = read(GET_ROUTE)
  // The route must define a lookupErrorResponse function or equivalent that returns 500
  assert(
    src.includes('lookup_error') && src.includes('500'),
    `${GET_ROUTE} must return HTTP 500 with reason 'lookup_error' when Supabase returns ` +
    `a query error. Collapsing query errors into 'not_found' hides configuration problems ` +
    `(wrong service role key, DB connectivity issues) and makes them indistinguishable ` +
    `from genuinely missing tokens.`,
  )
  // The inviteError block must call lookupErrorResponse — check that the line immediately
  // after the inviteError console.error calls lookupErrorResponse, not invalidResponse/notFoundError.
  assert(
    src.includes('lookupErrorResponse'),
    `${GET_ROUTE} must call lookupErrorResponse() when inviteError is truthy. ` +
    `This returns HTTP 500 with reason 'lookup_error', not a 404 not_found.`,
  )
  // Double-check: inviteError path must never call invalidResponse with 'not_found'
  // Extract the block between `if (inviteError) {` and `if (!invite)`
  const inviteErrStart = src.indexOf('if (inviteError)')
  const noInviteStart  = src.indexOf('if (!invite)', inviteErrStart)
  const inviteErrBlock = inviteErrStart !== -1 && noInviteStart !== -1
    ? src.slice(inviteErrStart, noInviteStart)
    : ''
  assert(
    inviteErrBlock !== '' && !inviteErrBlock.includes("'not_found'"),
    `${GET_ROUTE} must not call invalidResponse('not_found', ...) inside the inviteError block. ` +
    `The not_found reason is reserved for when the query succeeds but returns null data.`,
  )
})

await test('22. GET route uses flat separate queries — no nested relationship select', () => {
  const src = read(GET_ROUTE)
  // Nested relationship selects use the pattern: table:related_table ( columns )
  // e.g. deal:deals ( id, title, contractor:profiles!fkey ( full_name ) )
  assert(
    !src.includes('deal:deals') && !src.includes('contractor:profiles'),
    `${GET_ROUTE} must not use nested PostgREST relationship selects like ` +
    `"deal:deals ( ... contractor:profiles!fkey ( ... ) )". These can fail silently ` +
    `if the foreign-key hint is wrong or the relationship inference differs from ` +
    `expectations. Use three flat queries (invite → deal → profile) instead.`,
  )
  // Must have three separate .from() calls
  const fromMatches = src.match(/\.from\(/g) ?? []
  assert(
    fromMatches.length >= 3,
    `${GET_ROUTE} must have at least 3 separate .from() calls (deal_invites, deals, profiles). ` +
    `Found ${fromMatches.length}. Flat queries are explicit, debuggable, and produce distinct ` +
    `error messages per query — nested selects give a single opaque error for all joins.`,
  )
})

await test('23. GET route returns not_found only when query succeeds and data is null', () => {
  const src = read(GET_ROUTE)
  // The not_found path must follow !invite (null data) — not an error path
  // Check that the structure is: if (inviteError) { ... lookup_error ... } if (!invite) { ... not_found ... }
  const inviteErrorIdx = src.indexOf('if (inviteError)')
  const noInviteIdx    = src.indexOf('if (!invite)')
  assert(
    inviteErrorIdx !== -1 && noInviteIdx !== -1,
    `${GET_ROUTE} must have both 'if (inviteError)' and 'if (!invite)' checks for the ` +
    `invite query. The error check returns lookup_error; the null check returns not_found.`,
  )
  assert(
    inviteErrorIdx < noInviteIdx,
    `${GET_ROUTE} must check for inviteError BEFORE checking for null invite. ` +
    `Checking null first and skipping the error check would collapse errors into not_found.`,
  )
})

await test('24. Accept route returns lookup_error (not not_found) on invite query error', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('lookup_error'),
    `${ACCEPT_ROUTE} must return reason 'lookup_error' (HTTP 500) when the invite query ` +
    `fails with a Supabase error. Returning notFoundError for a query error hides ` +
    `configuration problems from callers and makes debugging impossible.`,
  )
  // The inviteError block must not call notFoundError
  const inviteErrorBlock = src.split('if (inviteError)')[1]?.split('\n  }')[0] ?? ''
  assert(
    !inviteErrorBlock.includes('notFoundError'),
    `${ACCEPT_ROUTE} must not call notFoundError() inside the inviteError block. ` +
    `Query errors must return lookup_error, not not_found.`,
  )
})

await test('25. Accept route returns lookup_error (not not_found) on deal query error', () => {
  const src = read(ACCEPT_ROUTE)
  // After deal lookup, dealError must lead to lookup_error — not notFoundError
  const dealErrorBlock = src.split('if (dealError)')[1]?.split('\n  }')[0] ?? ''
  assert(
    dealErrorBlock.includes('lookup_error') || dealErrorBlock.includes('lookupErrorResponse'),
    `${ACCEPT_ROUTE} must return 'lookup_error' (via lookupErrorResponse) when the deal ` +
    `query fails. The deal-not-found case (null data, no error) uses notFoundError separately.`,
  )
})

await test('26. GET route logs safe diagnostics only — no raw token or key in logs', () => {
  const src = read(GET_ROUTE)
  // Safe diagnostics: token_present (boolean), token_length (number), service_key_present (boolean)
  assert(
    src.includes('token_present') && src.includes('token_length') && src.includes('service_key_present'),
    `${GET_ROUTE} must log safe diagnostics: token_present (boolean), token_length (number), ` +
    `service_key_present (boolean). These confirm whether the token and key exist without ` +
    `logging their values.`,
  )
  // Must NOT log the raw token value
  assert(
    !src.includes('token: token,') && !src.includes('token: token\n') && !src.includes('rawToken'),
    `${GET_ROUTE} must not log the raw token value — the token is the secret. ` +
    `Log token_present and token_length instead.`,
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
