/**
 * tests/partner-fail-route-audit-binding.test.ts
 *
 * Regression guard for BUG-5: the partner fail route did not bind
 * partner_ack_hash to its audit events, leaving fail audit rows without
 * cryptographic evidence of the inbound partner payload.
 *
 * This mirrors the binding pattern required by the confirm route and
 * enforced by tier-a-audit-graph-binding.test.ts for the confirm path.
 *
 * Checks:
 *  1. Fail route file exists
 *  2. Fail route imports createHash from node:crypto
 *  3. Fail route reads request body as raw bytes (arrayBuffer or text)
 *  4. Fail route computes partnerAckHash from the raw body
 *  5. Fail route does NOT use request.json() for the initial body read
 *     (would consume the stream before the raw hash can be computed)
 *  6. Every logAudit call in the fail route receives partner_ack_hash
 *  7. logAudit call count equals partner_ack_hash binding count (no gaps)
 *  8. partner_ack_hash value is partnerAckHash (not hardcoded or null)
 *
 * Run: npx tsx tests/partner-fail-route-audit-binding.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

const FAIL_ROUTE    = 'src/app/api/partner/releases/[releaseId]/fail/route.ts'
const CONFIRM_ROUTE = 'src/app/api/partner/releases/[releaseId]/confirm/route.ts'

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {

console.log('\n── 1. Fail route exists ────────────────────────────────────────────────')

check(
  fs.existsSync(path.join(ROOT, FAIL_ROUTE)),
  `${FAIL_ROUTE} exists`,
)

const failSrc = read(FAIL_ROUTE)

console.log('\n── 2. Fail route imports createHash ────────────────────────────────────')

check(
  failSrc.includes("import { createHash }") && failSrc.includes("'node:crypto'"),
  "Fail route imports createHash from 'node:crypto'",
)

console.log('\n── 3. Fail route reads body as raw bytes ───────────────────────────────')

check(
  failSrc.includes('request.arrayBuffer()') || failSrc.includes('request.text()'),
  'Fail route reads body as arrayBuffer() or text() for raw hash computation',
)

console.log('\n── 4. Fail route computes partnerAckHash ───────────────────────────────')

check(
  failSrc.includes('partnerAckHash') &&
  failSrc.includes("createHash('sha256')") &&
  failSrc.includes(".digest('hex')"),
  'Fail route computes partnerAckHash via SHA-256 of the raw body',
)

console.log('\n── 5. Fail route does not call request.json() for body read ────────────')

// The original bug: request.json() consumes the stream. After the fix the body
// must be read as raw bytes first, then parsed via JSON.parse(rawBody...).
// request.json() should not appear in a body-read context.
// We allow it to appear if it's only in a comment but not as an await call.
const requestJsonCalls = (failSrc.match(/await\s+request\.json\(\)/g) ?? []).length
check(
  requestJsonCalls === 0,
  `Fail route does not call 'await request.json()' (uses JSON.parse(rawBody) instead) — found ${requestJsonCalls} calls`,
)

console.log('\n── 6. Every logAudit call in fail route receives partner_ack_hash ──────')

const auditCallCount   = (failSrc.match(/await logAudit\(\{/g) ?? []).length
const bindingCount     = (failSrc.match(/partner_ack_hash:\s*partnerAckHash/g) ?? []).length

check(
  auditCallCount > 0,
  `Fail route has at least one logAudit call (found ${auditCallCount})`,
)
check(
  bindingCount === auditCallCount,
  `Every logAudit call includes partner_ack_hash: partnerAckHash ` +
  `(${bindingCount} bindings / ${auditCallCount} audit calls)`,
)

console.log('\n── 7. partner_ack_hash value is partnerAckHash not null/undefined ───────')

check(
  !failSrc.includes('partner_ack_hash: null') &&
  !failSrc.includes('partner_ack_hash: undefined'),
  'partner_ack_hash is not hardcoded to null or undefined',
)
check(
  failSrc.includes('partner_ack_hash: partnerAckHash'),
  "partner_ack_hash is set to the computed partnerAckHash variable",
)

console.log('\n── 8. Confirm route still has its own partner_ack_hash binding ──────────')

// Regression guard: confirm route must not have been accidentally touched
const confirmSrc     = read(CONFIRM_ROUTE)
const confirmAudits  = (confirmSrc.match(/await logAudit\(\{/g) ?? []).length
const confirmBinding = (confirmSrc.match(/partner_ack_hash:\s*partnerAckHash/g) ?? []).length
check(
  confirmAudits > 0 && confirmBinding === confirmAudits,
  `Confirm route still binds partner_ack_hash in all ${confirmAudits} audit events (${confirmBinding} bindings)`,
)

console.log('\n✅  partner-fail-route-audit-binding: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
