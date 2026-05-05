/**
 * tests/tier-b2-b3-rail-adapter.test.ts
 *
 * Stage B2 (rail adapter abstraction) and B3 (external-rail authorize-only
 * path + expire-if-stale endpoint) of the patent-readiness work.
 *
 * Pins:
 *   B2.1 — src/lib/engine/rail-adapter.ts exposes getRailAdapter,
 *          RailAdapter, RailDispatchInput, RailDispatchResult, RailScope.
 *          stripe adapter calls stripe.transfers.create; external_rail
 *          adapter returns executed=false and never calls Stripe.
 *
 *   B2.2 — milestone release route imports getRailAdapter; no longer
 *          imports `stripe` from '@/lib/stripe'; no inline
 *          stripe.transfers.create(...) call lives in the route.
 *
 *   B3.1 — milestone release route has an external-rail branch that
 *          inserts the release with execution_rail='external_manual',
 *          execution_status='pending', stripe_transfer_id=null,
 *          authorization_token_id; flips token status 'issued' →
 *          'delivered'; audits release_authorization_recorded with
 *          token_hash; returns execution_status='pending',
 *          execution_rail='external_manual', stripe_transfer_id=null.
 *
 *   B3.2 — /api/releases/[releaseId]/confirm-external and
 *          /api/partner/releases/[releaseId]/confirm both bind
 *          token_hash on the success audit row, look up the
 *          authorization_token via release.authorization_token_id,
 *          and flip token status to 'confirmed' on settlement.
 *
 *   B3.3 — /api/releases/[releaseId]/expire-if-stale exists and:
 *          - guards on funder/admin only
 *          - rejects when release.execution_status !== 'pending'
 *          - rejects when token.status not in (issued, delivered)
 *          - rejects when token.expires_at > now
 *          - flips token to 'expired', release to 'failed'
 *          - calls cancel_release_reservation
 *          - audits release_authorization_expired with token_hash + partner_ack_hash
 *
 *   Test wired into npm test in package.json.
 *
 * Run: npx tsx tests/tier-b2-b3-rail-adapter.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())
function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  try { fs.accessSync(path.resolve(ROOT, rel)); return true } catch { return false }
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

const ADAPTER       = 'src/lib/engine/rail-adapter.ts'
const ROUTE         = 'src/app/api/milestones/[milestoneId]/release/route.ts'
const CONFIRM_EXT   = 'src/app/api/releases/[releaseId]/confirm-external/route.ts'
const PARTNER_CONFIRM = 'src/app/api/partner/releases/[releaseId]/confirm/route.ts'
const EXPIRE_ENDPOINT = 'src/app/api/releases/[releaseId]/expire-if-stale/route.ts'
const PACKAGE       = 'package.json'

const adapter        = read(ADAPTER)
const route          = read(ROUTE)
const confirmExt     = read(CONFIRM_EXT)
const partnerConfirm = read(PARTNER_CONFIRM)
const pkg            = read(PACKAGE)

console.log('\n── B2.1 Rail adapter library ───────────────────────────────────────────')

check(exists(ADAPTER), 'rail-adapter.ts exists')
check(
  /export type RailScope = 'stripe' \| 'external_rail'/.test(adapter),
  'RailScope union exported',
)
check(
  /export interface RailAdapter \{/.test(adapter),
  'RailAdapter interface exported',
)
check(
  /export interface RailDispatchInput \{/.test(adapter),
  'RailDispatchInput interface exported',
)
check(
  /export interface RailDispatchResult \{/.test(adapter),
  'RailDispatchResult interface exported',
)
check(
  /export function getRailAdapter\(rail: RailScope\): RailAdapter/.test(adapter),
  'getRailAdapter factory exported',
)
check(
  /case 'stripe':\s+return stripeRailAdapter/.test(adapter),
  'stripe rail mapped to stripeRailAdapter',
)
check(
  /case 'external_rail':\s+return externalRailAdapter/.test(adapter),
  'external_rail mapped to externalRailAdapter',
)
check(
  /const _exhaustive: never = rail/.test(adapter),
  'getRailAdapter has an exhaustiveness check (TypeScript never assignment)',
)

// stripe adapter: calls stripe.transfers.create with the right args
check(
  /stripe\.transfers\.create\(/.test(adapter),
  'stripe adapter calls stripe.transfers.create',
)
check(
  /authorization_token_id:\s+input\.token\.id/.test(adapter),
  'stripe adapter threads authorization_token_id into Stripe metadata',
)
check(
  /sha256OfCanonicalJson/.test(adapter),
  'stripe adapter computes railConfirmationHash via sha256OfCanonicalJson',
)

// external_rail adapter: no Stripe call, returns executed=false
check(
  /externalRailAdapter[\s\S]+?dispatch\(input\)[\s\S]+?executed:\s+false/.test(adapter),
  'externalRailAdapter.dispatch returns executed=false',
)
check(
  /externalRailAdapter[\s\S]+?stripeTransferId:\s+null/.test(adapter),
  'externalRailAdapter never produces a stripeTransferId',
)

// Confirm: the externalRailAdapter implementation (not its mention in the
// factory) does NOT call stripe.transfers.create. Slice from the const
// declaration so we skip the factory case label.
const externalImplStart = adapter.indexOf('const externalRailAdapter')
check(externalImplStart > 0, 'externalRailAdapter implementation block locatable')
const externalBlock = adapter.slice(externalImplStart)
check(
  !/stripe\.transfers\.create/.test(externalBlock),
  'externalRailAdapter implementation never calls stripe.transfers.create',
)

console.log('\n── B2.2 Route uses adapter, no inline Stripe ──────────────────────────')

check(
  /import\s*\{\s*getRailAdapter[\s\S]*?type RailScope[\s\S]*?\}\s*from\s*'@\/lib\/engine\/rail-adapter'/.test(route),
  'Route imports getRailAdapter + RailScope from rail-adapter',
)
check(
  !/from\s+'@\/lib\/stripe'/.test(route),
  'Route NO LONGER imports `stripe` from @/lib/stripe',
)
// stripe.transfers.create may appear in a comment but not as a real call.
// Strip line comments before checking.
const routeNoLineComments = route
  .split('\n')
  .map(line => {
    // Remove `// …` portion of each line; keep block comments out of scope —
    // we don't have any block-comment-wrapped Stripe calls today.
    const idx = line.indexOf('//')
    return idx >= 0 ? line.slice(0, idx) : line
  })
  .join('\n')
check(
  !/stripe\.transfers\.create\(/.test(routeNoLineComments),
  'Route has NO live stripe.transfers.create(...) call (only commentary references)',
)
check(
  /const adapter\s*=\s*getRailAdapter\(railScope\)/.test(route),
  'Route obtains the adapter via getRailAdapter(railScope)',
)
check(
  /const dispatchResult\s*=\s*await adapter\.dispatch\(\{/.test(route),
  'Route awaits adapter.dispatch(...)',
)
check(
  /stripeTransferId\s*=\s*dispatchResult\.stripeTransferId/.test(route),
  'Route assigns stripeTransferId from dispatchResult',
)
check(
  /const railConfirmationHash\s*=\s*dispatchResult\.railConfirmationHash/.test(route),
  'Route reads railConfirmationHash from dispatchResult',
)

// Pass executionRail to validateRelease so the gate skips Condition 4 on external
check(
  /validateRelease\(supabase,\s*milestoneId,\s*profile,\s*\{\s*executionRail\s*\}\)/.test(route),
  'Route passes { executionRail } to validateRelease (gate is rail-aware)',
)

console.log('\n── B3.1 External-rail authorize-only branch ───────────────────────────')

check(
  /if \(!dispatchResult\.executed\) \{/.test(route),
  'Route branches on !dispatchResult.executed for the external-rail path',
)
check(
  /execution_rail:\s+'external_manual'/.test(route) &&
  /execution_status:\s+'pending'/.test(route),
  'External-rail release insert sets execution_rail=external_manual + execution_status=pending',
)
check(
  /authorization_token_id:\s+authorizationToken\.id/.test(route),
  'External-rail release insert binds authorization_token_id',
)
check(
  /\.update\(\{\s*status:\s*'delivered'\s*\}\)/.test(route),
  'External-rail path flips authorization_token status to delivered',
)
check(
  /action:\s+'release_authorization_recorded'/.test(route),
  'External-rail success audit uses action="release_authorization_recorded"',
)
check(
  /rail_executed:\s+false/.test(route) &&
  /settlement_pending:\s+true/.test(route),
  'External-rail audit metadata flags rail_executed=false + settlement_pending=true',
)

// External-rail response shape
check(
  /execution_status:\s+'pending'/.test(route) &&
  /execution_rail:\s+'external_manual'/.test(route) &&
  /stripe_transfer_id:\s+null/.test(route),
  'External-rail response declares execution_status=pending + execution_rail=external_manual + stripe_transfer_id=null',
)

console.log('\n── B3.2 token_hash bound on /confirm-external + /partner/confirm ─────')

// /confirm-external
check(
  /import\s*\{\s*createHash\s*\}\s*from\s*'node:crypto'/.test(confirmExt),
  '/confirm-external imports createHash from node:crypto',
)
check(
  /const partnerAckHash\s*=\s*createHash\('sha256'\)\.update\(rawBody\)\.digest\('hex'\)/.test(confirmExt),
  '/confirm-external computes partner_ack_hash from raw body bytes',
)
check(
  /'authorization_token_id'/.test(confirmExt) || /authorization_token_id/.test(confirmExt),
  '/confirm-external selects authorization_token_id from releases',
)
check(
  /\.from\('authorization_tokens'\)[\s\S]{0,400}?\.eq\('id', r\.authorization_token_id\)/.test(confirmExt),
  '/confirm-external looks up the token row by release.authorization_token_id',
)
check(
  /token_hash:\s+tokenHashForAudit/.test(confirmExt),
  '/confirm-external success audit binds token_hash',
)
check(
  /partner_ack_hash:\s+partnerAckHash/.test(confirmExt),
  '/confirm-external success audit binds partner_ack_hash',
)
check(
  /\.update\(\{[\s\S]*?status:\s*'confirmed',[\s\S]*?confirmed_at:/.test(confirmExt),
  '/confirm-external flips token status to confirmed',
)
// And on every failure-path audit
const confirmExtAuditCalls = (confirmExt.match(/await logAudit\(\{/g) ?? []).length
const confirmExtAckBindings = (confirmExt.match(/partner_ack_hash:\s+partnerAckHash/g) ?? []).length
check(
  confirmExtAuditCalls > 0 && confirmExtAckBindings === confirmExtAuditCalls,
  `/confirm-external binds partner_ack_hash on every audit call (${confirmExtAckBindings}/${confirmExtAuditCalls})`,
)

// /partner/releases/[id]/confirm
check(
  /'authorization_token_id'/.test(partnerConfirm) || /authorization_token_id/.test(partnerConfirm),
  '/partner/confirm selects authorization_token_id from releases',
)
check(
  /\.from\('authorization_tokens'\)/.test(partnerConfirm),
  '/partner/confirm looks up the authorization token row',
)
check(
  /token_hash:\s+tokenHashForAudit/.test(partnerConfirm),
  '/partner/confirm success audit binds token_hash',
)
check(
  /\.update\(\{[\s\S]*?status:\s*'confirmed',[\s\S]*?confirmed_at:/.test(partnerConfirm),
  '/partner/confirm flips token status to confirmed',
)

console.log('\n── B3.3 expire-if-stale endpoint ──────────────────────────────────────')

check(exists(EXPIRE_ENDPOINT), 'expire-if-stale route exists')
const expireRoute = read(EXPIRE_ENDPOINT)

check(
  /export async function POST\(/.test(expireRoute),
  'expire-if-stale exposes POST',
)
check(
  /profile\.role !== 'funder' && profile\.role !== 'admin'/.test(expireRoute),
  'expire-if-stale guards on funder/admin only',
)
check(
  /execution_rail !== 'external_manual'/.test(expireRoute),
  'expire-if-stale rejects non-external-rail releases',
)
check(
  /execution_status !== 'pending'/.test(expireRoute),
  'expire-if-stale rejects non-pending releases',
)
check(
  /\['issued', 'delivered'\]\.includes\(token\.status\)/.test(expireRoute),
  'expire-if-stale rejects tokens not in issued/delivered',
)
check(
  /code:\s+'TOKEN_NOT_STALE'/.test(expireRoute),
  'expire-if-stale rejects tokens whose expires_at is still in the future',
)
check(
  /\.update\(\{\s*status:\s+'expired',[\s\S]*?expired_at:/.test(expireRoute),
  'expire-if-stale flips token status to expired',
)
check(
  /\.update\(\{\s*execution_status:\s+'failed'/.test(expireRoute),
  'expire-if-stale flips release execution_status to failed',
)
check(
  /supabase\.rpc\('cancel_release_reservation'/.test(expireRoute),
  'expire-if-stale calls cancel_release_reservation',
)
check(
  /action:\s+'release_authorization_expired'/.test(expireRoute),
  'expire-if-stale writes release_authorization_expired audit',
)
check(
  /token_hash:\s+token\.token_hash/.test(expireRoute),
  'expire-if-stale binds token_hash on the success audit',
)
check(
  /partner_ack_hash:\s+partnerAckHash/.test(expireRoute),
  'expire-if-stale binds partner_ack_hash on the success audit',
)

// Idempotency — second call after release.execution_status='failed' returns 409.
check(
  /code:\s+'NOT_PENDING'/.test(expireRoute),
  'Second-call idempotency: returns 409 / NOT_PENDING when release no longer pending',
)

console.log('\n── Test wired into npm test ───────────────────────────────────────────')

check(
  pkg.includes('tier-b2-b3-rail-adapter.test.ts'),
  'tier-b2-b3-rail-adapter.test.ts is wired into the npm test pipeline',
)

console.log('\n✅  tier-b2-b3-rail-adapter: all checks passed\n')
