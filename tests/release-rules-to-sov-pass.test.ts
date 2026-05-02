/**
 * tests/release-rules-to-sov-pass.test.ts
 *
 * Pins the release-rule-approval → SOV-draft materialisation pass.
 *
 *   1. Migration adds sov_line_items.source_draft_id (nullable, FK to
 *      contract_release_rule_drafts.id, ON DELETE SET NULL) + a partial
 *      index. Manual entries continue to work with NULL source_draft_id.
 *
 *   2. PATCH /api/deals/[dealId]/release-rules/[draftId]
 *      - On 'approve': insert one sov_line_items row per
 *        payload.sov_line_items entry with:
 *          - status='draft'           (NEVER 'approved')
 *          - source_draft_id=draft.id (idempotency anchor)
 *          - scheduled_value/revised_value/balance_to_finish from amount
 *          - all numerics ≥ 0 (negatives clamped to 0)
 *          - sort_order from the array index
 *      - Idempotent: short-circuits when ≥1 sov_line_items row already
 *        references this draft.
 *      - Never touches milestones, deals.funded_amount,
 *        deals.released_amount, contracts, or Stripe.
 *      - Never marks SOV approved automatically.
 *      - Materialisation is wrapped in try/catch — failure is non-fatal
 *        to the status transition (draft still flips to 'accepted').
 *      - Audits 'sov_draft_created_from_release_rules' with
 *        {deal_id, draft_id, line_item_count, total_amount, warnings_count}.
 *      - Approval response includes sov_rows_created + sov_total_amount.
 *
 *   3. Discard path is untouched — no SOV writes on discard.
 *
 *   4. Existing access controls preserved (funder/admin only,
 *      requireDealAccess, terminal-state 409).
 *
 *   5. Banned product claims absent on the touched surface.
 *
 * Run: npx tsx tests/release-rules-to-sov-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const ROUTE        = 'src/app/api/deals/[dealId]/release-rules/[draftId]/route.ts'
const MIGRATION    = 'supabase/migrations/20260502000000_sov_source_draft_id.sql'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

async function main() {
  console.log('\nrelease-rules-to-sov-pass.test.ts\n')

  // ── 1. Migration ───────────────────────────────────────────────────────
  console.log('1. Migration adds source_draft_id to sov_line_items')
  check(exists(MIGRATION), '  1a. migration file exists')
  const sql = read(MIGRATION)

  check(
    /ALTER TABLE\s+public\.sov_line_items\s+ADD COLUMN IF NOT EXISTS\s+source_draft_id/i.test(sql),
    '  1b. ALTER TABLE adds source_draft_id column',
  )
  check(
    /uuid[\s\S]*REFERENCES\s+public\.contract_release_rule_drafts\(id\)/i.test(sql),
    '  1c. source_draft_id is a UUID FK to contract_release_rule_drafts(id)',
  )
  check(
    /ON DELETE SET NULL/i.test(sql),
    '  1d. ON DELETE SET NULL — discarding a draft does not delete SOV rows',
  )
  check(
    /CREATE INDEX IF NOT EXISTS\s+sov_line_items_source_draft_id_idx[\s\S]*WHERE source_draft_id IS NOT NULL/i.test(sql),
    '  1e. partial index on source_draft_id (excludes manual NULL entries)',
  )

  // ── 2. Route — materialise SOV draft rows on approve ──────────────────
  console.log('\n2. Approve path materialises SOV draft rows')
  const route     = read(ROUTE)
  const routeCode = stripComments(route)

  // Only fires on 'approve'
  check(
    /if\s*\(\s*action\s*===\s*['"]approve['"]\s*&&\s*lineItemCount\s*>\s*0\s*\)/.test(routeCode),
    "  2a. SOV materialisation guarded by action === 'approve' && lineItemCount > 0",
  )

  // Idempotency check — looks for existing rows by source_draft_id
  check(
    /\.from\(\s*['"]sov_line_items['"]\s*\)[\s\S]{0,200}\.eq\(\s*['"]source_draft_id['"]\s*,\s*draft\.id\)/.test(routeCode),
    '  2b. idempotency check: SELECT existing sov_line_items WHERE source_draft_id = draft.id',
  )
  check(
    /existingFromDraft[\s\S]{0,300}skipping/.test(routeCode),
    '  2c. logs and skips when SOV rows already materialised for this draft',
  )

  // Insert builds rows with status='draft' and source_draft_id=draft.id
  check(
    /\.from\(\s*['"]sov_line_items['"]\s*\)[\s\S]{0,400}\.insert\(\s*rows\s*\)/.test(routeCode),
    '  2d. inserts an array of SOV rows in one call',
  )
  check(
    /status:\s*['"]draft['"]/.test(routeCode),
    "  2e. every inserted row has status='draft' (NEVER 'approved')",
  )
  check(
    /source_draft_id:\s*draft\.id/.test(routeCode),
    '  2f. every inserted row stamps source_draft_id = draft.id',
  )
  check(
    /created_by:\s*user\.id/.test(routeCode),
    '  2g. created_by = approving user',
  )
  // Numeric mapping
  check(
    /scheduled_value:\s*scheduledValue[\s\S]{0,400}revised_value:\s*scheduledValue[\s\S]{0,400}balance_to_finish:\s*scheduledValue/.test(routeCode),
    '  2h. scheduled_value / revised_value / balance_to_finish all = scheduledValue',
  )
  check(
    /approved_change_orders:\s*0[\s\S]{0,200}previous_released:\s*0[\s\S]{0,200}current_requested:\s*0[\s\S]{0,200}retainage_amount:\s*0/.test(routeCode),
    '  2i. derived numerics initialised to 0',
  )
  check(
    /scheduledValue\s*=[\s\S]{0,200}item\.amount\s*>=\s*0/.test(routeCode),
    '  2j. negative amounts clamped to 0 (no negative scheduled_value)',
  )
  // sort_order from index
  check(
    /sort_order:\s*idx/.test(routeCode),
    '  2k. sort_order taken from the array index',
  )
  // item_number stamped
  check(
    /item_number:\s*String\(idx\s*\+\s*1\)/.test(routeCode),
    '  2l. item_number = String(idx + 1)',
  )

  // ── 3. Hard guarantees — no SOV-approved / no milestones / no Stripe ─
  console.log('\n3. Hard guarantees on the approve path')
  // Status='approved' must NEVER appear in the insert payload.
  // The only 'approved' literal allowed is in the existing CHECK / status enum
  // references — confirm by ensuring no `status: 'approved'` in the route.
  check(
    !/status:\s*['"]approved['"]/.test(routeCode),
    "  3a. route NEVER inserts SOV with status='approved'",
  )
  // No milestone writes
  check(
    !/from\(\s*['"]milestones['"]\s*\)[\s\S]{0,200}\.(insert|update)/.test(routeCode),
    '  3b. route NEVER touches milestones',
  )
  // No deal financial writes
  check(
    !/funded_amount/.test(routeCode) &&
    !/released_amount/.test(routeCode),
    '  3c. route NEVER writes deal.funded_amount / deal.released_amount',
  )
  // No contracts write (only the existing draft-status update + SOV insert)
  check(
    !/from\(\s*['"]contracts['"]\s*\)[\s\S]{0,200}\.(insert|update)/.test(routeCode),
    '  3d. route NEVER writes to contracts table',
  )
  // No Stripe / release-execution imports
  for (const banned of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!route.includes(banned),
      `  3e. route does NOT import / call "${banned}"`)
  }
  // milestone_sov_links untouched (linking is a separate human step)
  check(
    !/from\(\s*['"]milestone_sov_links['"]\s*\)[\s\S]{0,200}\.(insert|update|delete)/.test(routeCode),
    '  3f. route NEVER writes to milestone_sov_links',
  )

  // ── 4. Materialisation is non-fatal to the status transition ──────────
  console.log('\n4. SOV materialisation is non-fatal')
  // The whole materialisation block is wrapped in try/catch
  check(
    /try\s*\{[\s\S]{0,80}existingFromDraft[\s\S]{0,3000}\}\s*catch\s*\(\s*err/.test(routeCode),
    '  4a. SOV materialisation block is wrapped in try/catch',
  )
  // Insert error path logs but does NOT return — the function continues to
  // the response below.
  check(
    /insertErr[\s\S]{0,400}console\.error\([\s\S]{0,200}sov_line_items insert failed/.test(routeCode),
    '  4b. insert failure is logged (not thrown) so the draft stays accepted',
  )
  // Status transition happens BEFORE the SOV materialisation block in source
  const statusUpdateIdx = route.indexOf("'contract_release_rule_drafts'")
  const sovInsertIdx    = route.indexOf("'sov_line_items'")
  check(
    statusUpdateIdx > -1 && sovInsertIdx > statusUpdateIdx,
    '  4c. draft status flip happens BEFORE sov_line_items insert',
  )

  // ── 5. Audit + response envelope ──────────────────────────────────────
  console.log('\n5. Audit + response envelope')
  check(
    /action:\s*['"]sov_draft_created_from_release_rules['"]/.test(routeCode),
    "  5a. audits 'sov_draft_created_from_release_rules' on materialisation",
  )
  for (const field of ['deal_id', 'draft_id', 'line_item_count', 'total_amount', 'warnings_count']) {
    check(
      /sov_draft_created_from_release_rules[\s\S]{0,800}metadata:\s*\{[\s\S]*?\}/.test(routeCode) &&
      route.includes(field),
      `  5b. audit metadata includes "${field}"`,
    )
  }
  // Existing approve audit ('contract_release_rules_draft_approved') still wired
  check(
    /['"]contract_release_rules_draft_approved['"]/.test(routeCode),
    '  5c. existing contract_release_rules_draft_approved audit preserved',
  )
  // Response carries new fields
  check(
    /sov_rows_created:\s*sovRowsCreated/.test(routeCode) &&
    /sov_total_amount:\s*sovTotalAmount/.test(routeCode),
    '  5d. response includes sov_rows_created + sov_total_amount',
  )

  // ── 6. Discard path untouched ────────────────────────────────────────
  console.log('\n6. Discard path does NOT materialise SOV')
  // The materialisation is gated on action === 'approve'; verify discard is
  // not even mentioned in the SOV block.
  const sovBlockMatch = routeCode.match(
    /if\s*\(\s*action\s*===\s*['"]approve['"][\s\S]*?\}\s*\n\s*\}/,
  )
  check(
    !!sovBlockMatch && !sovBlockMatch[0].includes("'discard'"),
    '  6a. SOV materialisation block does not reference "discard"',
  )

  // ── 7. Existing access controls + terminal-state 409 preserved ────────
  console.log('\n7. Existing access controls preserved')
  check(
    /profile\.role\s*!==\s*['"]funder['"][\s\S]*profile\.role\s*!==\s*['"]admin['"]/.test(routeCode),
    '  7a. funder/admin only — contractor 403',
  )
  check(routeCode.includes('requireDealAccess'),
    '  7b. requireDealAccess enforced (non-participant 403)')
  check(
    /draft\.status\s*===\s*ACCEPTED_STATUS\s*\|\|\s*draft\.status\s*===\s*DISCARDED_STATUS/.test(routeCode),
    '  7c. terminal-state re-transition is rejected (409)',
  )

  // ── 8. Banned product claims absent ───────────────────────────────────
  console.log('\n8. Banned product claims absent')
  const lower = route.toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'vektrum is a lender',
    'ai approves release',
    'ai approves',
    'ai authorizes',
    'funds are released automatically',
    'funds released automatically',
    'guarantees compliance',
    'guaranteed extraction',
    'contractor authorizes release',
  ]) {
    check(!lower.includes(banned),
      `  8. banned: "${banned}" absent`)
  }

  // ── 9. Test wired into npm test ───────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(pkg.includes('release-rules-to-sov-pass.test.ts'),
    '9. release-rules-to-sov-pass.test.ts wired into npm test')

  console.log('\n✓ All release-rules-to-sov-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
