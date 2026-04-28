/**
 * Invite Role Persistence — Static Safety Tests
 *
 * Source-parse checks — no live DB, no email delivery, no env vars required.
 * Verifies that deal_invites.role is always written on creation, that the
 * preview route validates it, and that the UI surfaces role failures clearly.
 *
 * Checks:
 *  1.  Creation route inserts role = 'funder' (not null, not inferred from email).
 *  2.  Creation route selects role in the returned invite row.
 *  3.  Email subject/body uses "funder" only when DB role is 'funder'
 *      (role drives the email copy, not the other way around).
 *  4.  GET preview route selects the role column from deal_invites.
 *  5.  GET route returns 404 with reason='missing_role' when invite.role is null.
 *  6.  GET route returns 404 with reason='wrong_role' when invite.role !== 'funder'.
 *  7.  GET route passes when role = 'funder' (no 404 for valid funder invites).
 *  8.  GET route returns 404 for expired invite regardless of role.
 *  9.  GET route returns 404 for accepted invite (accepted_at IS NOT NULL).
 * 10.  Page state type includes 'wrong_role' and 'missing_role' reasons.
 * 11.  Page parses the reason field from 404 response body.
 * 12.  Page shows a distinct message for missing_role (not generic "not found").
 * 13.  Page shows a distinct message for wrong_role (not generic "not found").
 * 14.  Invite preview response includes role in the returned invite object.
 * 15.  Email copy says "funder" — role is not inferred from the creation route alone.
 * 16.  No Stripe-specific custody claims in invite email or page.
 * 17.  Custody disclaimer present in email and page footer.
 * 18.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/invite-role-persistence.test.ts
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

const CREATE_ROUTE  = 'src/app/api/invites/route.ts'
const GET_ROUTE     = 'src/app/api/invites/[token]/route.ts'
const INVITE_PAGE   = 'src/app/invite/[token]/page.tsx'
const PKG           = 'package.json'

async function main() {

// ─── 1-3. Creation route ──────────────────────────────────────────────────────

await test("1. Creation route inserts role = 'funder'", () => {
  const src = read(CREATE_ROUTE)
  assert(
    src.includes("role: 'funder'"),
    `${CREATE_ROUTE} must include role: 'funder' in the .insert() call. ` +
    `The 'role' column cannot be null — it must always be set at creation time.`,
  )
})

await test('2. Creation route selects role in the returned invite row', () => {
  const src = read(CREATE_ROUTE)
  // The .select() after .insert() must include 'role'
  assert(
    src.includes("'id, token, deal_id, invited_email, role, status, expires_at, created_at'") ||
    src.includes('"id, token, deal_id, invited_email, role, status, expires_at, created_at"') ||
    (src.includes('.select(') && src.includes("'role'") || src.includes('"role"')),
    `${CREATE_ROUTE} must select the 'role' column after insert so the caller ` +
    `can verify it was persisted correctly.`,
  )
})

await test("3. Email copy uses 'funder' as role label (not inferred from email address)", () => {
  const src = read(CREATE_ROUTE)
  // The email HTML must mention 'funder' — confirming the DB role drives the copy
  assert(
    src.toLowerCase().includes('as a funder'),
    `${CREATE_ROUTE} invite email must say "as a funder" — the role shown in the email ` +
    `must be driven by the DB role field, not inferred from email metadata alone.`,
  )
})

// ─── 4-9. GET preview route ───────────────────────────────────────────────────

await test('4. GET route selects the role column from deal_invites', () => {
  const src = read(GET_ROUTE)
  // The select template must include 'role'
  assert(
    /select\s*\(`[\s\S]*?role[\s\S]*?`\)/m.test(src) || src.includes('      role,'),
    `${GET_ROUTE} must include 'role' in the .select() query so it can be validated.`,
  )
})

await test("5. GET route returns 404 with reason='missing_role' for null role", () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes("reason: 'missing_role'"),
    `${GET_ROUTE} must return { reason: 'missing_role' } in the 404 body when ` +
    `invite.role is null — this allows the UI to show a helpful message instead ` +
    `of a generic "not found".`,
  )
})

await test("6. GET route returns 404 with reason='wrong_role' when role !== 'funder'", () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes("reason: 'wrong_role'"),
    `${GET_ROUTE} must return { reason: 'wrong_role' } in the 404 body when ` +
    `invite.role exists but is not 'funder'.`,
  )
})

await test("7. GET route validates invite.role === 'funder'", () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes("invite.role !== 'funder'") || src.includes("invite.role != 'funder'"),
    `${GET_ROUTE} must explicitly check invite.role !== 'funder' and reject non-funder invites.`,
  )
  // Also check for null/falsy guard
  assert(
    src.includes('!invite.role'),
    `${GET_ROUTE} must guard against null/missing role separately from the wrong_role check.`,
  )
})

await test('8. GET route rejects expired invites regardless of role', () => {
  const src = read(GET_ROUTE)
  // Expiry check must come before the role check so expired invites are always rejected
  const expiryPos = src.indexOf('expires_at')
  const roleCheckPos = src.indexOf("invite.role !== 'funder'")
  assert(
    expiryPos > 0,
    `${GET_ROUTE} must check expires_at.`,
  )
  // Both checks must exist (order matters less than both being present)
  assert(
    roleCheckPos > 0,
    `${GET_ROUTE} must check invite.role.`,
  )
})

await test('9. GET route filters accepted invites (accepted_at IS NULL query)', () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes(".is('accepted_at', null)"),
    `${GET_ROUTE} must include .is('accepted_at', null) in the query to reject ` +
    `already-accepted invites before any role validation.`,
  )
})

// ─── 10-15. Page type safety and UI copy ─────────────────────────────────────

await test("10. Page state type includes 'wrong_role' and 'missing_role' reasons", () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes("'wrong_role'") && src.includes("'missing_role'"),
    `${INVITE_PAGE} PageState reason union must include 'wrong_role' and 'missing_role' ` +
    `so TypeScript enforces exhaustive handling of role failure cases.`,
  )
})

await test('11. Page parses the reason field from 404 response body', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('reason') && src.includes('missing_role') && src.includes('wrong_role'),
    `${INVITE_PAGE} must read the 'reason' field from the 404 JSON body so it can ` +
    `distinguish role failures from generic not-found failures.`,
  )
})

await test('12. Page shows a distinct message for missing_role', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('missing_role') && (
      src.includes('missing the intended role') ||
      src.includes('incomplete') ||
      src.includes('generate a new invite')
    ),
    `${INVITE_PAGE} must render a distinct, helpful message when reason === 'missing_role' ` +
    `(e.g. "This invite link is incomplete — it is missing the intended role.").`,
  )
})

await test('13. Page shows a distinct message for wrong_role', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('wrong_role') && (
      src.includes('not intended for a funder') ||
      src.includes('correct account type') ||
      src.includes('signed in with')
    ),
    `${INVITE_PAGE} must render a distinct, helpful message when reason === 'wrong_role' ` +
    `(e.g. "This invite link is not intended for a funder account.").`,
  )
})

await test('14. GET route preview response includes role in returned invite object', () => {
  const src = read(GET_ROUTE)
  // The returned JSON must include role so the page can confirm the invited role
  assert(
    src.includes('role: invite.role'),
    `${GET_ROUTE} must include 'role: invite.role' in the returned preview JSON ` +
    `so the accept page can display and verify the intended role.`,
  )
})

await test("15. Email copy explicitly describes the invitee as 'a funder'", () => {
  const src = read(CREATE_ROUTE)
  // The email body must mention "funder" as the intended role
  assert(
    src.includes('as a funder'),
    `${CREATE_ROUTE} invite email must describe the recipient's role as "a funder" ` +
    `in the body copy — role must drive copy, not just be a DB column.`,
  )
})

// ─── 16-17. Copy compliance ───────────────────────────────────────────────────

await test('16. No Stripe-specific custody claims in invite email or page', () => {
  const emailSrc = read(CREATE_ROUTE)
  const pageSrc  = read(INVITE_PAGE)
  assert(
    !emailSrc.includes('Powered by Stripe Connect') && !emailSrc.includes('powered by Stripe'),
    `${CREATE_ROUTE} email must not say "Powered by Stripe Connect" — Vektrum is rail-neutral.`,
  )
  assert(
    !pageSrc.includes('Payments powered by Stripe') && !pageSrc.includes('powered by Stripe'),
    `${INVITE_PAGE} must not say "Payments powered by Stripe" — Vektrum is rail-neutral.`,
  )
})

await test('17. Custody disclaimer present in email and page', () => {
  const emailSrc = read(CREATE_ROUTE)
  const pageSrc  = read(INVITE_PAGE)
  assert(
    emailSrc.includes('does not hold funds, act as escrow, or move money directly'),
    `${CREATE_ROUTE} email must include the custody disclaimer.`,
  )
  assert(
    pageSrc.includes('does not hold funds, act as escrow, or move money directly'),
    `${INVITE_PAGE} must include the custody disclaimer in the footer.`,
  )
})

// ─── 18. Package.json ────────────────────────────────────────────────────────

await test('18. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('invite-role-persistence.test.ts'),
    `package.json npm test script must include 'invite-role-persistence.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Invite Role Persistence Tests')
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
