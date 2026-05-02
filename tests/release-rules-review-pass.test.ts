/**
 * tests/release-rules-review-pass.test.ts
 *
 * Pins the release-rule draft review + approval workflow:
 *
 *   1. PATCH /api/deals/[dealId]/release-rules/[draftId] route
 *      - funder/admin only (contractor + non-participant blocked)
 *      - body { action: 'approve' | 'discard', reviewer_notes? }
 *      - approve → status='accepted'; discard → status='discarded'
 *      - never deletes the row (audit history preserved)
 *      - re-transition out of terminal state → 409
 *      - audit actions: contract_release_rules_draft_approved /
 *                       contract_release_rules_draft_discarded
 *      - never imports / calls release / payment / Stripe
 *      - never inserts SOV line items, never marks SOV approved, never
 *        touches milestones / deals.funded_amount / deals.released_amount
 *
 *   2. ReleaseRulesReviewCard component
 *      - is a client component
 *      - PATCHes the draft route on Approve / Discard
 *      - funder/admin sees Approve + Edit manually + Discard actions
 *      - contractor sees read-only "Release rules under review" copy
 *      - terminal status hides the action row
 *      - shows SOV line items with confidence + review_required badges
 *      - shows retainage, release conditions, evidence requirements,
 *        warnings, assumptions, source snippets
 *      - shows the document-source diagnostic (signed | original)
 *      - safety microcopy says approving does NOT authorize release
 *      - never imports release / payment / Stripe code
 *
 *   3. Deal page wiring
 *      - imports + renders ReleaseRulesReviewCard
 *      - passes the latest draft (any status) so accepted/discarded
 *        history stays visible
 *      - viewerRole is plumbed correctly
 *      - setup checklist gains "Release rules approved" row in the
 *        right order (drafted → approved → SOV created → SOV approved)
 *
 *   4. Banned product claims absent across the touched surfaces.
 *
 * Run: npx tsx tests/release-rules-review-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const ROUTE        = 'src/app/api/deals/[dealId]/release-rules/[draftId]/route.ts'
const CARD         = 'src/components/deal/release-rules-review-card.tsx'
const DEAL_PAGE    = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const MIGRATION    = 'supabase/migrations/20260501000000_contract_release_rule_drafts.sql'
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
  console.log('\nrelease-rules-review-pass.test.ts\n')

  // ── 1. PATCH route ─────────────────────────────────────────────────────
  console.log('1. PATCH /api/deals/[dealId]/release-rules/[draftId]')
  check(exists(ROUTE), '  1a. route file exists')

  const route     = read(ROUTE)
  const routeCode = stripComments(route)

  check(/export\s+async\s+function\s+PATCH/.test(route),
    '  1b. exports PATCH handler')
  check(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(route),
    '  1c. dynamic = "force-dynamic"')

  // Auth — funder/admin only
  check(
    /profile\.role\s*!==\s*['"]funder['"][\s\S]*profile\.role\s*!==\s*['"]admin['"]/.test(routeCode),
    '  1d. funder/admin only — contractor 403',
  )
  check(routeCode.includes('requireDealAccess'),
    '  1e. requireDealAccess enforced (non-participant 403)')
  check(routeCode.includes('getAuthUser'),
    '  1f. getAuthUser enforced')

  // Body validation
  check(
    /VALID_ACTIONS\s*:\s*DraftAction\[\]\s*=\s*\[\s*['"]approve['"]\s*,\s*['"]discard['"]\s*\]/.test(routeCode),
    '  1g. body.action restricted to approve | discard',
  )
  check(
    /reviewer_notes[\s\S]{0,80}\.slice\(0,\s*2000\)/.test(routeCode),
    '  1h. reviewer_notes is bounded to 2000 chars',
  )

  // Status transitions
  check(
    /approve:\s*ACCEPTED_STATUS/.test(routeCode) ||
    /approve:\s*['"]accepted['"]/.test(routeCode),
    '  1i. approve → status=accepted',
  )
  check(
    /discard:\s*DISCARDED_STATUS/.test(routeCode) ||
    /discard:\s*['"]discarded['"]/.test(routeCode),
    '  1j. discard → status=discarded',
  )

  // Re-transition out of terminal state → 409
  check(
    /draft\.status\s*===\s*ACCEPTED_STATUS\s*\|\|\s*draft\.status\s*===\s*DISCARDED_STATUS/.test(routeCode),
    '  1k. terminal-state re-transition is rejected (409)',
  )

  // Update writes status + reviewer fields only — no SOV / milestone writes
  check(
    /\.update\(\s*\{[\s\S]*?status:\s*newStatus[\s\S]*?reviewer_notes:[\s\S]*?reviewed_by:[\s\S]*?reviewed_at:/.test(routeCode),
    '  1l. update writes status + reviewer_notes + reviewed_by + reviewed_at',
  )
  // Verify no inserts into sov_line_items / milestones / deals
  check(
    !/from\(\s*['"]sov_line_items['"]\s*\)[\s\S]{0,200}\.insert/.test(routeCode),
    '  1m. route does NOT insert into sov_line_items',
  )
  check(
    !/from\(\s*['"]milestones['"]\s*\)[\s\S]{0,200}\.insert/.test(routeCode) &&
    !/from\(\s*['"]milestones['"]\s*\)[\s\S]{0,200}\.update/.test(routeCode),
    '  1n. route does NOT touch milestones',
  )
  check(
    !/funded_amount/.test(routeCode) &&
    !/released_amount/.test(routeCode),
    '  1o. route does NOT touch deal.funded_amount / deal.released_amount',
  )

  // Audit actions
  check(
    routeCode.includes("'contract_release_rules_draft_approved'") &&
    routeCode.includes("'contract_release_rules_draft_discarded'"),
    '  1p. audit actions for approve + discard wired',
  )
  for (const field of ['line_item_count', 'warnings_count', 'has_reviewer_notes', 'draft_id']) {
    check(routeCode.includes(field), `  1q. audit metadata includes "${field}"`)
  }

  // Status enum matches the migration
  const sql = read(MIGRATION)
  for (const s of ['draft', 'reviewed', 'accepted', 'discarded']) {
    check(sql.includes(`'${s}'`), `  1r. migration includes status "${s}"`)
  }

  // No release / payment / Stripe imports
  for (const banned of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!route.includes(banned),
      `  1s. route does NOT import / call "${banned}"`)
  }

  // ── 2. ReleaseRulesReviewCard component ───────────────────────────────
  console.log('\n2. ReleaseRulesReviewCard component')
  check(exists(CARD), '  2a. component file exists')
  const card = read(CARD)
  check(card.includes("'use client'") || card.includes('"use client"'),
    '  2b. is a client component')

  // PATCHes the draft route
  check(
    /fetch\(\s*`\/api\/deals\/\$\{dealId\}\/release-rules\/\$\{draft\.id\}`/.test(card) &&
    /method:\s*['"]PATCH['"]/.test(card),
    '  2c. PATCHes /api/deals/{dealId}/release-rules/{draftId}',
  )
  check(
    /JSON\.stringify\(\s*\{\s*action[\s\S]{0,40}\}/.test(card),
    '  2d. body shape is { action }',
  )

  // Funder/admin: actions present
  check(
    card.includes('Approve draft release rules'),
    '  2e. Approve action label present',
  )
  check(
    card.includes('Edit manually'),
    '  2f. Edit manually link present',
  )
  check(
    card.includes('Discard draft'),
    '  2g. Discard action label present',
  )

  // Contractor: read-only copy
  check(
    card.includes('Release rules under review'),
    '  2h. contractor heading "Release rules under review"',
  )
  check(
    card.includes('The funder is reviewing the draft SOV and release rules'),
    '  2i. contractor body explains funder is reviewing',
  )

  // Funder/admin heading
  check(
    card.includes('Review draft release rules'),
    '  2j. funder/admin heading "Review draft release rules"',
  )

  // Terminal-state action hide — guarded by isTerminal
  check(
    /isTerminal\s*=\s*draft\.status\s*===\s*['"]accepted['"]\s*\|\|\s*draft\.status\s*===\s*['"]discarded['"]/.test(card),
    '  2k. isTerminal computed from status',
  )
  check(
    /\{canAct\s*&&\s*!isTerminal\s*&&\s*\(/.test(card),
    '  2l. action row hidden once draft is in a terminal status',
  )

  // Payload rendering — every section the spec requires
  for (const section of [
    'sov_line_items',
    'retainage',
    'release_conditions',
    'evidence_requirements',
    'warnings',
    'assumptions',
  ]) {
    check(card.includes(section), `  2m. card renders payload.${section}`)
  }

  // Confidence + review_required badges
  check(card.includes('ConfidencePill'),
    '  2n. card renders ConfidencePill for confidence values')
  check(/review_required[\s\S]{0,400}Review/.test(card),
    '  2o. card renders a "Review" badge when review_required=true')

  // Document-source diagnostic
  check(
    card.includes('document_source') &&
    /signed DocuSign PDF/.test(card) &&
    /uploaded contract document/.test(card),
    '  2p. card renders the document-source diagnostic (signed vs original)',
  )

  // Safety microcopy. JSX wraps long copy across lines so we collapse
  // whitespace before substring match.
  const cardCollapsed = card.replace(/\s+/g, ' ')
  check(
    cardCollapsed.includes('Approving the draft does not authorize release') &&
    cardCollapsed.includes('deterministic release gate and funder authorization still control release'),
    '  2q. safety microcopy: approval is NOT release authorization',
  )

  // No release / payment / Stripe imports
  for (const banned of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!card.includes(banned),
      `  2r. card does NOT import / call "${banned}"`)
  }

  // ── 3. Deal page wiring ──────────────────────────────────────────────
  console.log('\n3. Deal page wiring')
  const deal = read(DEAL_PAGE)

  check(
    deal.includes('ReleaseRulesReviewCard') &&
    deal.includes("@/components/deal/release-rules-review-card"),
    '  3a. deal page imports + renders ReleaseRulesReviewCard',
  )
  check(
    /viewerRole=\{typedProfile\.role/.test(deal),
    '  3b. viewerRole prop plumbed from typedProfile.role',
  )
  check(
    /<ReleaseRulesReviewCard[\s\S]{0,400}status:\s*latestReleaseRulesDraft\.status/.test(deal),
    '  3c. status forwarded so the card can render the post-review state',
  )

  // Setup checklist: Release rules approved row in the right place
  check(
    /['"]Release rules drafted['"]/.test(deal) &&
    /['"]Release rules approved['"]/.test(deal),
    '  3d. checklist includes "Release rules drafted" + "Release rules approved" rows',
  )
  const idxDrafted  = deal.indexOf('Release rules drafted')
  const idxApproved = deal.indexOf('Release rules approved')
  const idxSov      = deal.indexOf('SOV created')
  check(
    idxDrafted > -1 && idxApproved > idxDrafted && idxSov > idxApproved,
    '  3e. checklist order: Release rules drafted → Release rules approved → SOV created',
  )
  // "Release rules approved" done = releaseRulesAccepted || sovApproved
  check(
    /['"]Release rules approved['"][\s\S]{0,80}done:\s*releaseRulesAccepted\s*\|\|\s*sovApproved/.test(deal),
    '  3f. "Release rules approved" done = releaseRulesAccepted || sovApproved',
  )

  // Latest draft fetch includes payload (so the card has the full data)
  check(
    /from\(\s*['"]contract_release_rule_drafts['"]\s*\)[\s\S]{0,400}\.select\(\s*['"]id, status, created_at, warnings, payload['"]/.test(deal),
    '  3g. deal page selects the draft `payload` field for the review card',
  )

  // ── 4. Banned product claims absent ───────────────────────────────────
  console.log('\n4. Banned product claims absent')
  const all = (route + '\n' + card + '\n' + deal).toLowerCase()
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
    'guaranteed extraction',
    'guarantees compliance',
    'contractor authorizes release',
  ]) {
    check(!all.includes(banned),
      `  4. banned: "${banned}" absent`)
  }

  // ── 5. Test wired into npm test ───────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(pkg.includes('release-rules-review-pass.test.ts'),
    '5. release-rules-review-pass.test.ts wired into npm test')

  console.log('\n✓ All release-rules-review-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
