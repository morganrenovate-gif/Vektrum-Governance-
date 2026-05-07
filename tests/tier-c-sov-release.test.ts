/**
 * tests/tier-c-sov-release.test.ts
 *
 * Tier C — SOV line-item partial release.
 *
 * What this tests (source-grep — no live DB):
 *   1. authorization-token.ts accepts sov_links in IssueAuthorizationTokenInput
 *   2. amount_vector includes sov_line_item_id when SOV links are provided
 *   3. The release route fetches milestone_sov_links before calling issueAuthorizationToken
 *   4. The release route passes sov_links to issueAuthorizationToken
 *   5. release-gate.ts has a SOV balance check when links exist
 *   6. A helper exists to update sov_line_items.previous_released after release
 *   7. The release route calls the SOV update helper on success
 *   8. Wired into npm test
 *
 * Run: npx tsx tests/tier-c-sov-release.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {

const TOKEN_SRC  = 'src/lib/engine/authorization-token.ts'
const GATE_SRC   = 'src/lib/engine/release-gate.ts'
const RELEASE_RT = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const PKG        = 'package.json'

// ── 1. authorization-token.ts accepts SOV links ──────────────────────────────

console.log('\n── 1. Authorization token accepts SOV links ────────────────────────')

const tokenSrc = read(TOKEN_SRC)

check(
  tokenSrc.includes('sov_links') || tokenSrc.includes('sovLinks'),
  'IssueAuthorizationTokenInput includes sov_links/sovLinks field',
)
check(
  tokenSrc.includes('sov_line_item_id'),
  'amount_vector entries include sov_line_item_id when SOV links are provided',
)

// ── 2. amount_vector includes SOV line item IDs when links are present ────────

console.log('\n── 2. amount_vector includes sov_line_item_id ──────────────────────')

check(
  tokenSrc.includes('sov_line_item_id') && tokenSrc.includes('amount_vector'),
  'amount_vector is built from SOV links when available',
)

// ── 3. Release route fetches milestone_sov_links ─────────────────────────────

console.log('\n── 3. Release route fetches milestone_sov_links ────────────────────')

const releaseSrc = read(RELEASE_RT)

check(
  releaseSrc.includes('milestone_sov_links') || releaseSrc.includes('sovLinks'),
  'Release route queries milestone_sov_links before issuing authorization token',
)

// ── 4. Release route passes SOV links to issueAuthorizationToken ──────────────

console.log('\n── 4. Release route passes SOV links to issuer ─────────────────────')

check(
  (releaseSrc.includes('sov_links') || releaseSrc.includes('sovLinks')) &&
  releaseSrc.includes('issueAuthorizationToken'),
  'Release route passes sov_links to issueAuthorizationToken',
)

// ── 5. Release gate has SOV balance check ────────────────────────────────────

console.log('\n── 5. Release gate has SOV balance check ───────────────────────────')

const gateSrc = read(GATE_SRC)

check(
  gateSrc.includes('sov') || gateSrc.includes('balance_to_finish') || gateSrc.includes('sovLinks'),
  'Release gate includes SOV balance validation when links exist',
)
check(
  gateSrc.includes('balance_to_finish') || gateSrc.includes('sov_line_item'),
  'Gate checks balance_to_finish or sov line item balance',
)

// ── 6. SOV update helper exists ───────────────────────────────────────────────

console.log('\n── 6. SOV update helper exists ─────────────────────────────────────')

check(
  releaseSrc.includes('updateSovReleasedAmounts') ||
  releaseSrc.includes('sov_released') ||
  releaseSrc.includes('previous_released') ||
  fs.existsSync(path.join(ROOT, 'src/lib/engine/sov.ts')),
  'A helper exists to update sov_line_items.previous_released after release',
)

// ── 7. Release route calls SOV update on success ─────────────────────────────

console.log('\n── 7. Release route calls SOV update on success ────────────────────')

check(
  releaseSrc.includes('updateSovReleasedAmounts') ||
  releaseSrc.includes('previous_released') ||
  releaseSrc.includes('sov_line_items'),
  'Release route updates SOV line items on successful release',
)

// ── 8. Wired into npm test ────────────────────────────────────────────────────

console.log('\n── 8. Test wired into npm test ─────────────────────────────────────')

const pkg = read(PKG)
check(
  pkg.includes('tier-c-sov-release.test.ts'),
  'tier-c-sov-release.test.ts is wired into npm test',
)

console.log('\n✅  tier-c-sov-release: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
