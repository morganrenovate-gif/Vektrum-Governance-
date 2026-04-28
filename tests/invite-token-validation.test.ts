/**
 * Invite Token Validation — Static Safety Tests
 *
 * Source-parse checks — no live DB, no email delivery, no env vars required.
 * Verifies that /invite/<token> validation is correctly wired to deal_invites.token,
 * that invalid states are handled safely, and that copy is rail-neutral.
 *
 * Checks:
 *  1.  GET /api/invites/[token] queries deal_invites.token (not slug or id).
 *  2.  Accept route queries deal_invites.token (not slug or id).
 *  3.  Creation route writes deal_invites.token and uses it in the invite URL.
 *  4.  GET route checks status === 'pending' (invalid status → 404).
 *  5.  GET route checks expires_at <= now() → 404 with background expiry update.
 *  6.  GET route validates accepted_at IS NULL (defense-in-depth).
 *  7.  GET route validates accepted_by IS NULL (defense-in-depth).
 *  8.  Accept route checks status === 'pending' (accepted invite → 404).
 *  9.  Accept route checks expires_at (expired → 404 + DB status update).
 * 10.  No reference to 'revoked_at' or 'revoked' as a status anywhere in invite routes or page.
 * 11.  UI invalid-state copy does not mention "revoked".
 * 12.  Email template does not contain "Powered by Stripe Connect".
 * 13.  Email template includes custody disclaimer (does not hold funds, act as escrow, or move money directly).
 * 14.  Invite page footer does not say "Payments powered by Stripe".
 * 15.  Invite page footer includes "does not hold funds, act as escrow, or move money directly".
 * 16.  Trust signal does not claim "Funds held by Stripe" (custody overclaim).
 * 17.  /invite/* is listed as a public route in middleware (no auth required).
 * 18.  /api/invites/* is listed as a public route in middleware.
 * 19.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/invite-token-validation.test.ts
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

// Strip comments so documentation strings don't trigger content checks
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const GET_ROUTE     = 'src/app/api/invites/[token]/route.ts'
const ACCEPT_ROUTE  = 'src/app/api/invites/[token]/accept/route.ts'
const CREATE_ROUTE  = 'src/app/api/invites/route.ts'
const INVITE_PAGE   = 'src/app/invite/[token]/page.tsx'
const MIDDLEWARE    = 'src/middleware.ts'
const PKG           = 'package.json'

async function main() {

// ─── 1-3. Token field usage ───────────────────────────────────────────────────

await test('1. GET route queries deal_invites by token column', () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes(".eq('token', token)"),
    `${GET_ROUTE} must query deal_invites using .eq('token', token) — not by slug, id, or any other field.`,
  )
  // Must NOT use slug as the lookup field
  assert(
    !src.includes(".eq('slug',"),
    `${GET_ROUTE} must not query by 'slug' — the email URL uses the 'token' column.`,
  )
})

await test('2. Accept route queries deal_invites by token column', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes(".eq('token', token)"),
    `${ACCEPT_ROUTE} must query deal_invites using .eq('token', token) — not by slug, id, or any other field.`,
  )
  assert(
    !src.includes(".eq('slug',"),
    `${ACCEPT_ROUTE} must not query by 'slug'.`,
  )
})

await test('3. Creation route writes token and builds URL with token', () => {
  const src = read(CREATE_ROUTE)
  // The insert must return the token column
  assert(
    src.includes("'token'") || src.includes('"token"') || src.includes('invite.token'),
    `${CREATE_ROUTE} must select and use the token column from the created invite row.`,
  )
  // The URL builder must use the token, not slug
  assert(
    src.includes('invite.token') || src.includes('buildInviteUrl(invite.token)'),
    `${CREATE_ROUTE} must build the invite URL using invite.token — the email link must use the token.`,
  )
  assert(
    src.includes('/invite/${token}') || src.includes("'/invite/' + token") || src.includes('`/invite/${'),
    `${CREATE_ROUTE} URL builder must produce /invite/<token> paths.`,
  )
})

// ─── 4-9. Validation logic ────────────────────────────────────────────────────

await test('4. GET route validates status === pending', () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes("status !== 'pending'") || src.includes("status != 'pending'"),
    `${GET_ROUTE} must reject invites whose status is not 'pending'.`,
  )
})

await test('5. GET route rejects expired invites and updates status in background', () => {
  const src = read(GET_ROUTE)
  assert(
    src.includes('expires_at') && src.includes('new Date()'),
    `${GET_ROUTE} must compare expires_at to the current time and reject expired invites.`,
  )
  // Background expiry update
  assert(
    src.includes("status: 'expired'") || src.includes("status:'expired'"),
    `${GET_ROUTE} must update the invite status to 'expired' when the link has passed its expiry date.`,
  )
})

await test('6. GET route validates accepted_at IS NULL (defense-in-depth)', () => {
  const src = read(GET_ROUTE)
  // Application-level check is intentionally used over a query filter so each failure
  // mode (accepted vs not-found) returns a distinct machine-readable reason code.
  assert(
    src.includes('.is(\'accepted_at\', null)') ||
    src.includes('accepted_at !== null') ||
    src.includes('accepted_at != null') ||
    src.includes('invite.accepted_at'),
    `${GET_ROUTE} must validate accepted_at — either as a query filter (.is('accepted_at', null)) ` +
    `or as an application-level check (invite.accepted_at !== null) — to prevent re-use of accepted invites.`,
  )
})

await test('7. GET route validates accepted_by IS NULL (defense-in-depth)', () => {
  const src = read(GET_ROUTE)
  // Application-level check is intentionally used over a query filter — see test 6.
  assert(
    src.includes(".is('accepted_by', null)") ||
    src.includes('accepted_by !== null') ||
    src.includes('accepted_by != null') ||
    src.includes('invite.accepted_by'),
    `${GET_ROUTE} must validate accepted_by — either as a query filter (.is('accepted_by', null)) ` +
    `or as an application-level check (invite.accepted_by !== null) — to prevent re-use of accepted invites.`,
  )
})

await test('8. Accept route rejects invites with non-pending status', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes("status !== 'pending'") || src.includes("status != 'pending'"),
    `${ACCEPT_ROUTE} must reject invites whose status is not 'pending' (e.g. already accepted).`,
  )
})

await test('9. Accept route rejects expired invites and updates DB status', () => {
  const src = read(ACCEPT_ROUTE)
  assert(
    src.includes('expires_at') && src.includes('new Date()'),
    `${ACCEPT_ROUTE} must compare expires_at to the current time and reject expired invites.`,
  )
  assert(
    src.includes("status: 'expired'"),
    `${ACCEPT_ROUTE} must mark the invite as 'expired' in the DB when it has passed its expiry date.`,
  )
})

// ─── 10-11. Revoked language ──────────────────────────────────────────────────

await test('10. No reference to revoked_at or revoked as a status in invite routes', () => {
  const routeSrc  = stripComments(read(GET_ROUTE))
  const acceptSrc = stripComments(read(ACCEPT_ROUTE))
  const createSrc = stripComments(read(CREATE_ROUTE))

  assert(
    !routeSrc.includes('revoked_at'),
    `${GET_ROUTE} must not reference 'revoked_at' — this column does not exist in deal_invites.`,
  )
  assert(
    !acceptSrc.includes('revoked_at'),
    `${ACCEPT_ROUTE} must not reference 'revoked_at'.`,
  )
  assert(
    !createSrc.includes('revoked_at'),
    `${CREATE_ROUTE} must not reference 'revoked_at'.`,
  )
  // 'revoked' as a status value is not valid
  const revokedStatusPattern = /status.*['"]\s*revoked\s*['"]|['"]\s*revoked\s*['"].*status/
  assert(
    !revokedStatusPattern.test(routeSrc),
    `${GET_ROUTE} must not use 'revoked' as a status value.`,
  )
})

await test('11. Invite page invalid-state copy does not mention "revoked"', () => {
  const src = read(INVITE_PAGE)
  // The visible UI copy for the invalid state must not say "revoked"
  // (the comment documenting that revoked used to be mentioned is OK — we strip comments)
  const strippedSrc = stripComments(src)
  assert(
    !strippedSrc.toLowerCase().includes('revoked'),
    `${INVITE_PAGE} invalid-state UI copy must not mention "revoked" — ` +
    `the deal_invites schema has no revoked_at column or revoked status. ` +
    `Use "used or expired" instead.`,
  )
})

// ─── 12-13. Email copy ────────────────────────────────────────────────────────

await test('12. Email template does not contain "Powered by Stripe Connect"', () => {
  const src = read(CREATE_ROUTE)
  assert(
    !src.includes('Powered by Stripe Connect') && !src.includes('powered by Stripe Connect'),
    `${CREATE_ROUTE} email template must not say "Powered by Stripe Connect" — ` +
    `Vektrum is rail-neutral; the execution rail is the customer's choice.`,
  )
})

await test('13. Email template includes the custody disclaimer', () => {
  const src = read(CREATE_ROUTE)
  assert(
    src.includes('does not hold funds, act as escrow, or move money directly'),
    `${CREATE_ROUTE} email template must include the custody disclaimer: ` +
    '"Vektrum does not hold funds, act as escrow, or move money directly."',
  )
})

// ─── 14-16. Invite page copy ──────────────────────────────────────────────────

await test('14. Invite page footer does not say "Payments powered by Stripe"', () => {
  const src = read(INVITE_PAGE)
  assert(
    !src.includes('Payments powered by Stripe') && !src.includes('powered by Stripe'),
    `${INVITE_PAGE} footer must not say "Payments powered by Stripe" — ` +
    `Vektrum is rail-neutral and does not hold or move funds directly.`,
  )
})

await test('15. Invite page footer includes custody disclaimer', () => {
  const src = read(INVITE_PAGE)
  assert(
    src.includes('does not hold funds, act as escrow, or move money directly'),
    `${INVITE_PAGE} footer must include the mandatory custody disclaimer: ` +
    '"Vektrum does not hold funds, act as escrow, or move money directly."',
  )
})

await test('16. Trust signal does not claim "Funds held by Stripe"', () => {
  const src = read(INVITE_PAGE)
  assert(
    !src.includes('Funds held by Stripe'),
    `${INVITE_PAGE} must not include the trust signal "Funds held by Stripe" — ` +
    `this is a custody overclaim. Vektrum does not hold or custody funds. ` +
    `Use rail-neutral language instead.`,
  )
})

// ─── 17-18. Middleware public routing ─────────────────────────────────────────

await test('17. /invite/* is a public browser route in middleware', () => {
  const src = read(MIDDLEWARE)
  assert(
    src.includes('pathname.startsWith("/invite/")') ||
    src.includes("pathname.startsWith('/invite/')"),
    `${MIDDLEWARE} must list /invite/* as a public pass-through route — ` +
    `the invite accept page must be accessible without authentication.`,
  )
})

await test('18. /api/invites/* is a public route in middleware', () => {
  const src = read(MIDDLEWARE)
  assert(
    src.includes('pathname.startsWith("/api/invites/")') ||
    src.includes("pathname.startsWith('/api/invites/')"),
    `${MIDDLEWARE} must list /api/invites/* as a public pass-through route — ` +
    `the preview GET and the accept POST both handle their own auth internally.`,
  )
})

// ─── 19. Package.json ────────────────────────────────────────────────────────

await test('19. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('invite-token-validation.test.ts'),
    `package.json npm test script must include 'invite-token-validation.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Invite Token Validation Tests')
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
