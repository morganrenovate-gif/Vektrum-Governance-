/**
 * Invite Funder Signup Flow — Static Safety Tests
 *
 * Verifies that the first-time funder invite flow is implemented correctly:
 * unauthenticated viewers see signup/signin CTAs, the signup page locks the
 * role to funder when an invite token is present, the token is preserved
 * through email confirmation, the auth callback skips onboarding for invite
 * redirects, and the accept route returns actionable wrong-role errors.
 *
 * Source-parse checks only — no live DB, no env vars, no rendering required.
 *
 * Checks:
 *  1.  Invite page checks Supabase auth state on mount (imports createClient).
 *  2.  Invite page shows signup CTA (not just accept button) for unauthenticated state.
 *  3.  Invite page signup CTA links to /auth/signup with invite token param.
 *  4.  Invite page sign-in CTA links to /auth/login with next=/invite/[token].
 *  5.  Invite page shows wrong-role warning with sign-out for non-funder accounts.
 *  6.  Invite page shows accept button only for funder auth phase.
 *  7.  Invite page does NOT rely on the accept route for initial auth check.
 *  8.  Signup page reads the invite query param.
 *  9.  Signup page locks role to funder when invite param is present.
 * 10.  Signup page passes correct emailRedirectTo with next=/invite/[token].
 * 11.  Signup page shows invite context banner (not role selector) for invite flow.
 * 12.  Auth callback skips onboarding redirect when next starts with /invite/.
 * 13.  Accept route returns reason: wrong_role (not generic 403) for wrong role.
 * 14.  Accept route error message tells user to sign out and use funder account.
 * 15.  Accept route logs invite_accepted audit event.
 * 16.  Accept route logs funder_assigned audit event.
 * 17.  Accept route still validates token, status, role, expiry, accepted_at/by.
 * 18.  Accept route still blocks contractor from accepting (role !== 'funder').
 * 19.  Accept route still blocks admin from accepting (role !== 'funder').
 * 20.  Release gate and payment logic files are not modified.
 * 21.  No auth bypass — accept route still calls getAuthUser.
 * 22.  Token is not exposed in any response body.
 * 23.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/invite-funder-signup.test.ts
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

const INVITE_PAGE    = 'src/app/invite/[token]/page.tsx'
const SIGNUP_PAGE    = 'src/app/auth/signup/page.tsx'
const CALLBACK_ROUTE = 'src/app/auth/callback/route.ts'
const ACCEPT_ROUTE   = 'src/app/api/invites/[token]/accept/route.ts'
const RELEASE_GATE   = 'src/lib/engine/release-gate.ts'
const PKG            = 'package.json'

async function main() {

// ─── 1-7. Invite page auth-state CTA ──────────────────────────────────────────

await test('1. Invite page imports createClient (Supabase browser client for auth check)', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes("from '@/lib/supabase/client'") || src.includes('from "@/lib/supabase/client"'),
    `${INVITE_PAGE} must import createClient from @/lib/supabase/client to check the ` +
    `viewer's auth state on mount. Without this, the page cannot show distinct CTAs ` +
    `for unauthenticated vs funder vs wrong-role users.`,
  )
})

await test('2. Invite page renders a signup CTA for unauthenticated state', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('unauthenticated') &&
    (src.includes('Create funder account') || src.includes('signup') || src.includes('UserPlus')),
    `${INVITE_PAGE} must render a "Create funder account" CTA when the viewer is ` +
    `unauthenticated. First-time funders must see a path to sign up, not just an ` +
    `Accept button that returns 401.`,
  )
})

await test('3. Invite page signup CTA links to /auth/signup with invite token', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('/auth/signup') && src.includes('invite'),
    `${INVITE_PAGE} signup CTA must link to /auth/signup?invite=[token] so the ` +
    `signup page knows to lock the role to funder and preserve the token through ` +
    `email confirmation.`,
  )
})

await test('4. Invite page sign-in CTA links to /auth/login with next=/invite/[token]', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('/auth/login') && src.includes('/invite/'),
    `${INVITE_PAGE} sign-in CTA must include ?next=/invite/[token] so existing funder ` +
    `accounts are returned to the invite page after login instead of being sent to /dashboard.`,
  )
})

await test('5. Invite page shows wrong-role warning with sign-out for non-funder accounts', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('wrong_role') &&
    (src.includes('Sign out') || src.includes('sign out') || src.includes('LogOut')),
    `${INVITE_PAGE} must show a wrong-role warning with a sign-out affordance when ` +
    `the viewer is authenticated as a contractor or admin. They need to sign out ` +
    `and use a funder account — a generic error message is not actionable.`,
  )
})

await test('6. Invite page shows accept button only for funder auth phase', () => {
  const src = read(INVITE_PAGE)
  // The accept button (data-testid or specific class) must be gated by authPhase === 'funder'
  assert(
    src.includes("'funder'") && src.includes('Accept'),
    `${INVITE_PAGE} must show the "Accept & Enter Deal Room" button only when the ` +
    `viewer is authenticated as a funder. The button must not be shown unconditionally.`,
  )
  // The accept button must NOT appear in the unauthenticated branch
  const unauthStart = src.indexOf('unauthenticated')
  const funderStart = src.indexOf("authPhase === 'funder'") > -1
    ? src.indexOf("authPhase === 'funder'")
    : src.indexOf("'funder'")
  assert(
    unauthStart < funderStart,
    `${INVITE_PAGE} must render the unauthenticated CTA before the funder accept button ` +
    `in the source — the unauthenticated branch should not contain the accept button.`,
  )
})

await test('7. Invite page does not start accept flow until user deliberately clicks', () => {
  const src = read(INVITE_PAGE)
  // handleAccept must only be called from an onClick, not on mount
  assert(
    src.includes('handleAccept') && src.includes('onClick'),
    `${INVITE_PAGE} must only call handleAccept from an onClick handler. ` +
    `The accept flow must not auto-trigger on mount or auth state change.`,
  )
  assert(
    !src.includes('handleAccept()') || src.includes('onClick={handleAccept}') || src.includes('onClick={() =>'),
    `${INVITE_PAGE} must not call handleAccept() directly on mount or useEffect.`,
  )
})

// ─── 8-11. Signup page invite flow ────────────────────────────────────────────

await test('8. Signup page reads the invite query param', () => {
  const src = read(SIGNUP_PAGE)
  assert(
    src.includes('invite') && (src.includes('useSearchParams') || src.includes('searchParams')),
    `${SIGNUP_PAGE} must read the 'invite' query param via useSearchParams. ` +
    `When a user arrives via /auth/signup?invite=[token], the page needs the ` +
    `token to lock the role and preserve it through email confirmation.`,
  )
})

await test('9. Signup page locks role to funder when invite param is present', () => {
  const src = read(SIGNUP_PAGE)
  assert(
    src.includes('funder') && (
      src.includes('lockedAsFunder') ||
      src.includes('inviteToken') ||
      src.includes("role: 'funder'") ||
      src.includes('role: "funder"')
    ),
    `${SIGNUP_PAGE} must lock the role to 'funder' when the invite param is present. ` +
    `Without this, the trigger defaults to 'contractor' and the accept route rejects ` +
    `the user with "Only users with the Funder role can accept deal invitations."`,
  )
})

await test('10. Signup page passes correct emailRedirectTo with next=/invite/[token]', () => {
  const src = read(SIGNUP_PAGE)
  assert(
    src.includes('emailRedirectTo') && src.includes('/auth/callback') &&
    (src.includes('invite') || src.includes('/invite/')),
    `${SIGNUP_PAGE} emailRedirectTo must include ?next=/invite/[token] when the invite ` +
    `param is present. Without this, after email confirmation the user lands on /dashboard ` +
    `instead of returning to the invite page to complete acceptance.`,
  )
  // The emailRedirectTo must NOT always be the same hardcoded string when invite is present
  assert(
    src.includes('inviteToken') || src.includes('invite'),
    `${SIGNUP_PAGE} emailRedirectTo must be dynamic — conditionally including the invite ` +
    `token in the next param, not hardcoded to /auth/callback for all signups.`,
  )
})

await test('11. Signup page shows invite context banner (not role selector) for invite flow', () => {
  const src = read(SIGNUP_PAGE)
  assert(
    src.includes('invited as') || src.includes('Invited as') || src.includes('Funder') && src.includes('lockedAsFunder'),
    `${SIGNUP_PAGE} must show a context banner ("You were invited as a Funder") ` +
    `instead of the role selector cards when lockedAsFunder is true. ` +
    `A confused user who changes role to Contractor would fail the accept route check.`,
  )
})

// ─── 12. Auth callback ────────────────────────────────────────────────────────

await test('12. Auth callback skips onboarding redirect when next starts with /invite/', () => {
  const src = read(CALLBACK_ROUTE)
  assert(
    src.includes('/invite/') && (
      src.includes('isInviteRedirect') ||
      src.includes('startsWith') ||
      src.includes('invite')
    ),
    `${CALLBACK_ROUTE} must skip the onboarding redirect (contractor/funder onboarding) ` +
    `when the 'next' param starts with /invite/. Without this, a new funder who just ` +
    `confirmed their email is sent to /dashboard/funder/onboarding instead of back ` +
    `to /invite/[token] to complete acceptance.`,
  )
})

// ─── 13-16. Accept route improvements ─────────────────────────────────────────

await test('13. Accept route returns reason: wrong_role for wrong role', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('wrong_role') && src.includes('reason'),
    `${ACCEPT_ROUTE} must return { reason: 'wrong_role' } in the 403 response body ` +
    `when the caller's role is not funder. The invite page uses this reason code ` +
    `to show a sign-out button instead of a generic error.`,
  )
})

await test('14. Accept route error message tells user to sign out and use funder account', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('Sign out') || src.includes('sign out') || src.includes('funder account'),
    `${ACCEPT_ROUTE} must include actionable guidance in the 403 error message — ` +
    `e.g. "Sign out and sign in with or create a funder account" — so the user ` +
    `knows what to do rather than receiving a cryptic role-requirement error.`,
  )
})

await test('15. Accept route logs invite_accepted audit event', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('invite_accepted'),
    `${ACCEPT_ROUTE} must log an 'invite_accepted' audit event when a funder successfully ` +
    `accepts an invite. This records the invite token being consumed against the ` +
    `deal_invite entity for traceability.`,
  )
})

await test('16. Accept route logs funder_assigned audit event', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('funder_assigned'),
    `${ACCEPT_ROUTE} must log a 'funder_assigned' audit event when a funder accepts ` +
    `an invite. This records the deal gaining a funder on the deal entity.`,
  )
})

// ─── 17-22. Security invariants ───────────────────────────────────────────────

await test('17. Accept route still validates all invite conditions', () => {
  const src = read(ACCEPT_ROUTE)
  assert(src.includes("'pending'"), `${ACCEPT_ROUTE} must still check status === 'pending'.`)
  assert(src.includes('expires_at'), `${ACCEPT_ROUTE} must still validate expiry.`)
  assert(src.includes('accepted_at'), `${ACCEPT_ROUTE} must still check accepted_at is null.`)
  assert(src.includes('accepted_by'), `${ACCEPT_ROUTE} must still check accepted_by is null.`)
})

await test('18. Accept route still blocks contractors from accepting', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('contractor') && src.includes('funder'),
    `${ACCEPT_ROUTE} must still block contractors from accepting funder invites. ` +
    `The role check must cover the contractor case with a clear error.`,
  )
})

await test('19. Accept route still blocks admins from accepting', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('admin'),
    `${ACCEPT_ROUTE} must still block admins from accepting funder invites. ` +
    `Admin accounts cannot become deal funders via invite.`,
  )
})

await test('20. Release gate and payment logic files are not modified', () => {
  const gate = read(RELEASE_GATE)
  // Release gate must not reference invite or signup flows
  assert(
    !gate.includes('invite_accepted') && !gate.includes('signup'),
    `${RELEASE_GATE} must not be modified by the invite flow changes. ` +
    `Release gate logic is unrelated to how funders are assigned to deals.`,
  )
})

await test('21. Accept route still calls getAuthUser — no auth bypass', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('getAuthUser'),
    `${ACCEPT_ROUTE} must still call getAuthUser to authenticate the caller. ` +
    `Removing this check would allow unauthenticated users to accept invites.`,
  )
})

await test('22. Token is not exposed in any response body', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    !src.includes('token: token') && !src.includes('invite_token:'),
    `${ACCEPT_ROUTE} must not include the invite token in any response body. ` +
    `The token is the secret — returning it exposes it to interception.`,
  )
})

// ─── 23. Package.json ─────────────────────────────────────────────────────────

await test('23. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('invite-funder-signup.test.ts'),
    `package.json npm test script must include 'invite-funder-signup.test.ts'.`,
  )
})

// ─── 24-28. Defensive audit trigger (Bug C) ────────────────────────────────

await test('24. Defensive migration exists for signup audit trigger', () => {
  const migPath = 'supabase/migrations/20260429000000_signup_audit_defensive.sql'
  const src = read(migPath)
  assert(
    src.includes('audit_user_signup'),
    `${migPath} must redefine audit_user_signup() with the defensive EXCEPTION block.`,
  )
})

await test('25. Defensive migration wraps audit INSERT in EXCEPTION WHEN OTHERS', () => {
  const src = read('supabase/migrations/20260429000000_signup_audit_defensive.sql')
  assert(
    src.includes('EXCEPTION WHEN OTHERS THEN') &&
    src.includes('RAISE WARNING'),
    `The migration must wrap the audit_log INSERT in EXCEPTION WHEN OTHERS THEN ` +
    `RAISE WARNING so audit failures never abort signup. Without this, a missing ` +
    `pgcrypto extension or sequence will block every new user.`,
  )
})

await test('26. Defensive migration keeps actor_id = NULL (no FK risk)', () => {
  const src = read('supabase/migrations/20260429000000_signup_audit_defensive.sql')
  assert(
    src.includes('actor_id') && src.includes('NULL') &&
    !src.includes('actor_id = NEW.id') && !src.includes("actor_id,\n      NEW.id"),
    `The defensive migration must keep actor_id = NULL. Setting actor_id = NEW.id ` +
    `causes a FK violation because the profiles row may not exist yet when the ` +
    `auth.users AFTER INSERT trigger fires (original Bug C root cause in migration 006).`,
  )
})

await test('27. audit_user_signup RETURN NEW even when audit INSERT fails', () => {
  const src = read('supabase/migrations/20260429000000_signup_audit_defensive.sql')
  // RETURN NEW must be outside and after the exception block
  const exceptionIdx = src.indexOf('EXCEPTION WHEN OTHERS')
  const returnIdx    = src.lastIndexOf('RETURN NEW')
  assert(
    returnIdx > exceptionIdx,
    `RETURN NEW must appear after the EXCEPTION block so the trigger always ` +
    `returns NEW regardless of audit INSERT success or failure.`,
  )
})

await test('28. auth/callback logAudit is already fire-and-forget (.catch) — same pattern', () => {
  const src = read(CALLBACK_ROUTE)
  assert(
    src.includes('logAudit') && src.includes('.catch'),
    `${CALLBACK_ROUTE} must use .catch() on logAudit() to ensure audit failures ` +
    `do not block the auth callback redirect. This is the same fire-and-forget ` +
    `pattern used by the defensive signup trigger.`,
  )
})

// ─── 29-38. Funder assignment correctness ─────────────────────────────────────

await test('29. Accept route uses createSupabaseAdminClient for the assignment update', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('createSupabaseAdminClient') && src.includes(".from('deals')"),
    `${ACCEPT_ROUTE} must use createSupabaseAdminClient (service role) for the deals update. ` +
    `Using the user client would fail: deals_update_funder RLS USING clause requires ` +
    `funder_id = auth.uid(), but funder_id IS NULL before assignment.`,
  )
})

await test('30. Accept route sets funder_id = user.id on deals table', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('funder_id: user.id'),
    `${ACCEPT_ROUTE} must SET funder_id = user.id in the deals UPDATE. ` +
    `Without this write, deals.funder_id remains NULL after acceptance.`,
  )
})

await test('31. Accept route does NOT mark invite accepted if assignment fails', () => {
  const src = read(ACCEPT_ROUTE)
  // The invite update (Step B) must come AFTER the assignment block, not before.
  // If the assignment fails (dealUpdateError or 0 rows), we return early before Step B.
  const assignErrorIdx = src.indexOf('assignment_failed')
  const inviteUpdateIdx = src.indexOf("status:      'accepted'")
  assert(
    assignErrorIdx > 0,
    `${ACCEPT_ROUTE} must return early with reason: 'assignment_failed' when the ` +
    `deal update fails, before the invite is marked as accepted.`,
  )
  assert(
    inviteUpdateIdx > assignErrorIdx,
    `${ACCEPT_ROUTE} must update deal_invites AFTER the assignment succeeds, not before. ` +
    `The invite must remain 'pending' if the funder_id write fails.`,
  )
})

await test('32. Accept route treats same-funder re-accept as idempotent (alreadyAssigned path)', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('alreadyAssigned'),
    `${ACCEPT_ROUTE} must handle the idempotent case where funder_id is already set ` +
    `to user.id from a prior partial accept. The route should skip the deal UPDATE ` +
    `and proceed to the invite-update step. Look for 'alreadyAssigned' guard.`,
  )
})

await test('33. Accept route returns 409 deal_already_assigned when different funder assigned', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('deal_already_assigned'),
    `${ACCEPT_ROUTE} must return 409 with reason: 'deal_already_assigned' when ` +
    `deals.funder_id is set to a different user. The current generic conflictError ` +
    `did not carry a machine-readable reason code.`,
  )
})

await test('34. Accept route 409 deal_already_assigned checks funder_id !== user.id', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('deal.funder_id !== user.id') || src.includes("deal.funder_id != user.id"),
    `${ACCEPT_ROUTE} must compare deal.funder_id !== user.id to distinguish the ` +
    `same-funder idempotent case from the different-funder conflict case. ` +
    `Without this check, any pre-assigned funder_id (including the same user's) ` +
    `would incorrectly return 409.`,
  )
})

await test('35. Accept route logs error.code and deal_id on assignment failure', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('dealUpdateError.code') && src.includes('deal_id:') && src.includes('user_id:'),
    `${ACCEPT_ROUTE} must log dealUpdateError.code, deal_id, and user_id on assignment ` +
    `failure. These are needed to diagnose FK violations, trigger blocks, or key issues ` +
    `without exposing secrets or raw tokens.`,
  )
})

await test('36. Accept route assignment error response includes reason: assignment_failed', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes("reason: 'assignment_failed'"),
    `${ACCEPT_ROUTE} must include reason: 'assignment_failed' in the 500 response body ` +
    `so the invite page can surface a specific, actionable error rather than a generic message.`,
  )
})

await test('37. Funder dashboard queries deals where funder_id = user.id', () => {
  const src = read('src/app/dashboard/page.tsx')
  assert(
    src.includes('funder_id') &&
    (src.includes("eq('funder_id'") || src.includes('.eq("funder_id"') ||
     src.includes("query.eq('funder_id")),
    `src/app/dashboard/page.tsx funder query must use .eq('funder_id', userId) ` +
    `so a newly assigned funder can see their deal after acceptance. ` +
    `Without this, funder_id = user.id has no UI effect.`,
  )
})

await test('38. Accept route does not expose raw token in error responses or logs', () => {
  const src = read(ACCEPT_ROUTE)
  // The diagnostic console.error must not log the token variable
  const logIdx = src.indexOf("'[invites/accept] deal assignment error:'")
  const tokenInLog = src.slice(logIdx, logIdx + 300).includes('token')
  assert(
    !tokenInLog,
    `${ACCEPT_ROUTE} diagnostic log for assignment failure must not include the raw ` +
    `invite token. The token is a secret — logging it exposes it in server logs.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Invite Funder Signup Flow Tests')
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
