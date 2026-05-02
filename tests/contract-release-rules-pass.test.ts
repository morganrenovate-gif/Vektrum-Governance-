/**
 * tests/contract-release-rules-pass.test.ts
 *
 * Pins the contract → draft release-rules pass:
 *
 *   1. Migration creates contract_release_rule_drafts with the spec'd
 *      columns + status CHECK ('draft','reviewed','accepted','discarded')
 *      + active-draft uniqueness + RLS that denies user writes.
 *
 *   2. Helper src/lib/engine/contract-release-rules.ts
 *      - reads PERPLEXITY_API_KEY from process.env (server-only, no
 *        NEXT_PUBLIC_ leak)
 *      - exports generateDraftReleaseRules
 *      - returns ok:false reason='unreadable_contract' when text < 500 chars
 *      - returns ok:false reason='config' when the key is missing
 *      - validates schema; clamps confidence; rejects negatives;
 *        flags total mismatch with review_required=true on every line
 *      - never lowers funder_authorization_required (forced true)
 *
 *   3. PDF text extractor src/lib/engine/contract-text.ts
 *      - reads from Supabase storage 'contracts' bucket via admin client
 *      - prefers signed_storage_path, falls back to storage_path
 *      - returns ok:false with safe error message on failure
 *
 *   4. API route POST /api/deals/[dealId]/release-rules/generate-from-contract
 *      - funder/admin only (contractor → 403)
 *      - requires fully-signed contract (both timestamps OR status='signed')
 *      - rejects when active draft already exists (409)
 *      - rejects when approved SOV already exists (409)
 *      - rejects when contract is voided (409)
 *      - inserts as status='draft' (never approved)
 *      - audit action 'contract_release_rules_draft_generated'
 *      - never imports Stripe / release / payment-execution code
 *      - dynamic = 'force-dynamic'
 *
 *   5. Deal page UI
 *      - funder/admin sees "Generate draft SOV & release rules" + "Enter manually"
 *      - draft-generated state replaces the action CTAs with "Review required"
 *      - contractor sees "Waiting for release-rule setup"
 *      - setup checklist gains "Release rules drafted" between
 *        "Contract fully signed" and "SOV created"
 *
 *   6. Banned product claims absent across all touched surfaces.
 *
 * Run: npx tsx tests/contract-release-rules-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const MIGRATION    = 'supabase/migrations/20260501000000_contract_release_rule_drafts.sql'
const HELPER       = 'src/lib/engine/contract-release-rules.ts'
const TEXT_HELPER  = 'src/lib/engine/contract-text.ts'
const ROUTE        = 'src/app/api/deals/[dealId]/release-rules/generate-from-contract/route.ts'
const BUTTON       = 'src/components/deal/generate-release-rules-button.tsx'
const DEAL_PAGE    = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
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

function walkSync(dir: string, files: string[] = []): string[] {
  const full = path.resolve(ROOT, dir)
  if (!fs.existsSync(full)) return files
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name)
    if (entry.isDirectory()) walkSync(rel, files)
    else if (rel.endsWith('.tsx') || rel.endsWith('.ts')) files.push(rel)
  }
  return files
}

async function main() {
  console.log('\ncontract-release-rules-pass.test.ts\n')

  // ── 1. Migration ───────────────────────────────────────────────────────
  console.log('1. Migration')
  check(exists(MIGRATION), '  1a. migration file exists')
  const sql = read(MIGRATION)
  check(/CREATE TABLE IF NOT EXISTS public\.contract_release_rule_drafts/i.test(sql),
    '  1b. CREATE TABLE contract_release_rule_drafts')

  for (const col of [
    'id', 'deal_id', 'contract_id', 'generated_by', 'status',
    'source', 'payload', 'warnings', 'created_at', 'updated_at',
  ]) {
    check(new RegExp(`\\b${col}\\b`).test(sql),
      `  1c. column "${col}" defined`)
  }

  // status CHECK matches the spec values
  for (const s of ['draft', 'reviewed', 'accepted', 'discarded']) {
    check(sql.includes(`'${s}'`), `  1d. status enum contains "${s}"`)
  }
  check(/CHECK\s*\(\s*status\s+IN\s*\(/i.test(sql),
    '  1e. status has a CHECK constraint')

  // active-draft uniqueness
  check(
    /UNIQUE INDEX[\s\S]*contract_release_rule_drafts[\s\S]*WHERE\s+status IN\s*\(\s*['"]draft['"]\s*,\s*['"]reviewed['"]/i.test(sql),
    '  1f. partial unique index on (contract_id) WHERE status IN (draft, reviewed)',
  )

  // RLS enabled, user writes denied
  check(/ENABLE ROW LEVEL SECURITY/i.test(sql), '  1g. RLS enabled')
  check(/FOR INSERT[\s\S]*WITH CHECK \(false\)/i.test(sql), '  1h. INSERT policy denies user writes')
  check(/FOR UPDATE[\s\S]*USING \(false\)[\s\S]*WITH CHECK \(false\)/i.test(sql),
    '  1i. UPDATE policy denies user writes')
  check(/FOR DELETE[\s\S]*USING \(false\)/i.test(sql), '  1j. DELETE policy denies user writes')

  // ── 2. Helper ──────────────────────────────────────────────────────────
  console.log('\n2. Perplexity helper')
  check(exists(HELPER), '  2a. src/lib/engine/contract-release-rules.ts exists')
  const helper     = read(HELPER)
  const helperCode = stripComments(helper)

  check(helper.includes('export async function generateDraftReleaseRules'),
    '  2b. exports generateDraftReleaseRules')
  // Server-only — process.env, no NEXT_PUBLIC_
  check(helperCode.includes('process.env.PERPLEXITY_API_KEY'),
    '  2c. reads PERPLEXITY_API_KEY from process.env')
  check(!helperCode.includes('NEXT_PUBLIC_PERPLEXITY'),
    '  2d. helper does NOT use NEXT_PUBLIC_ (would ship key to client)')
  // System prompt explicitly tells the model not to authorize / approve
  check(
    helper.includes('You do not approve releases') &&
    helper.includes('authorize payment'),
    '  2e. system prompt forbids approval / payment authority',
  )
  // Schema includes the spec'd top-level keys
  for (const key of [
    'project_name', 'contract_total', 'currency',
    'retainage', 'sov_line_items', 'release_conditions',
    'evidence_requirements', 'warnings', 'assumptions',
  ]) {
    check(helper.includes(key), `  2f. schema field "${key}" referenced`)
  }
  // Release-conditions sub-fields
  for (const key of [
    'sequential_release_required',
    'lien_waiver_required',
    'inspection_required',
    'change_order_approval_required',
    'funder_authorization_required',
  ]) {
    check(helper.includes(key), `  2g. release_conditions field "${key}"`)
  }
  // Validation rules
  check(/clampConfidence/.test(helperCode), '  2h. clamps confidence to [0,1]')
  check(
    /coerceTrueField/.test(helperCode) &&
    /value:\s*true,\s*\/\/ product invariant|value:\s*true,/.test(helperCode),
    '  2i. funder_authorization_required is forced true (product invariant)',
  )
  // Negative amounts → null with warning
  check(
    /Negative amount on line item/.test(helperCode),
    '  2j. negative amounts produce a warning + null',
  )
  // Total mismatch sets review_required on every line
  check(
    /does not match[\s\S]{0,200}contract_total[\s\S]{0,400}review_required\s*=\s*true/.test(helperCode),
    '  2k. line-item total mismatch sets review_required=true on every line',
  )
  // Min text guard
  check(/MIN_CONTRACT_TEXT_CHARS/.test(helperCode) &&
        helper.includes('Could not read enough text from the signed contract'),
    '  2l. returns "unreadable_contract" with safe message when text is too short')
  // Config guard
  check(
    helper.includes('AI extraction is not configured'),
    '  2m. returns "config" with safe message when PERPLEXITY_API_KEY missing',
  )

  // ── 3. PDF text extractor ─────────────────────────────────────────────
  console.log('\n3. PDF text extractor')
  check(exists(TEXT_HELPER), '  3a. src/lib/engine/contract-text.ts exists')
  const textHelper = read(TEXT_HELPER)
  check(textHelper.includes('export async function extractSignedContractText'),
    '  3b. exports extractSignedContractText')
  check(
    textHelper.includes('signed_storage_path') &&
    textHelper.includes('storage_path'),
    '  3c. prefers signed_storage_path, falls back to storage_path',
  )
  check(
    textHelper.includes("createSupabaseAdminClient") &&
    textHelper.includes("'contracts'"),
    '  3d. reads from the "contracts" storage bucket via the admin client',
  )
  check(
    textHelper.includes("require('pdf-parse')") || textHelper.includes('pdf-parse'),
    '  3e. uses pdf-parse to extract text',
  )
  // Returns safe failure messages
  check(
    textHelper.includes('Enter release rules manually'),
    '  3f. returns "Enter release rules manually" on every failure path',
  )

  // ── 4. API route ──────────────────────────────────────────────────────
  console.log('\n4. API route')
  check(exists(ROUTE), '  4a. route file exists')
  const route     = read(ROUTE)
  const routeCode = stripComments(route)

  check(/export\s+async\s+function\s+POST/.test(route),
    '  4b. exports POST handler')
  check(/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(route),
    '  4c. dynamic = "force-dynamic"')

  // Auth gates
  check(
    /profile\.role\s*!==\s*['"]funder['"][\s\S]*profile\.role\s*!==\s*['"]admin['"]/.test(routeCode),
    '  4d. funder/admin only — contractor 403',
  )
  check(routeCode.includes('requireDealAccess'),
    '  4e. requireDealAccess enforced')
  check(routeCode.includes('getAuthUser'),
    '  4f. getAuthUser enforced')

  // Preconditions
  check(
    /contract\.funder_signed_at[\s\S]*contract\.contractor_signed_at/.test(routeCode),
    '  4g. requires both funder + contractor signed timestamps',
  )
  check(
    /contract\.status\s*===\s*['"]voided['"]/.test(routeCode),
    '  4h. rejects voided contract (409)',
  )
  check(
    /contract_release_rule_drafts[\s\S]*\.in\(\s*['"]status['"]\s*,\s*\[['"]draft['"]\s*,\s*['"]reviewed['"]\]/.test(routeCode),
    '  4i. rejects when an active draft already exists (409)',
  )
  check(
    /sov_line_items[\s\S]*\.eq\(\s*['"]status['"]\s*,\s*['"]approved['"]\)/.test(routeCode),
    '  4j. rejects when an approved SOV already exists (409)',
  )

  // Insert as draft only
  check(
    /\.from\(\s*['"]contract_release_rule_drafts['"]\s*\)[\s\S]*\.insert\(\s*\{[\s\S]*status:\s*['"]draft['"]/.test(routeCode),
    '  4k. inserts as status="draft"',
  )
  check(
    !/status:\s*['"]accepted['"]/.test(routeCode),
    '  4l. never inserts with status="accepted"',
  )

  // Audit action
  check(
    /action:\s*['"]contract_release_rules_draft_generated['"]/.test(routeCode),
    '  4m. audits contract_release_rules_draft_generated',
  )
  // Audit metadata
  for (const field of ['line_item_count', 'warnings_count', 'total_amount']) {
    check(routeCode.includes(field),
      `  4n. audit metadata includes "${field}"`)
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
      `  4o. route does NOT import / call "${banned}"`)
  }

  // ── 5. Deal page UI + button ─────────────────────────────────────────
  console.log('\n5. Deal page UI')
  check(exists(BUTTON), '  5a. GenerateReleaseRulesButton component exists')
  const btn = read(BUTTON)
  check(
    btn.includes('Generate draft SOV & release rules') &&
    btn.includes('/api/deals/${dealId}/release-rules/generate-from-contract'),
    '  5b. button posts to the generate-from-contract route',
  )
  check(
    btn.includes("'use client'") || btn.includes('"use client"'),
    '  5c. button is a client component',
  )

  const deal = read(DEAL_PAGE)
  check(
    deal.includes('GenerateReleaseRulesButton') &&
    deal.includes("@/components/deal/generate-release-rules-button"),
    '  5d. deal page imports + renders GenerateReleaseRulesButton',
  )

  // Funder/admin: heading + body + manual fallback. JSX line wrapping puts
  // "draft SOV line" on one line and "items," on the next; collapse whitespace
  // before substring match.
  const dealCollapsed = deal.replace(/\s+/g, ' ')
  check(
    dealCollapsed.includes('Create release rules') &&
    dealCollapsed.includes('source of truth for draft SOV line items'),
    '  5e. funder/admin: "Create release rules" heading + spec body',
  )
  check(
    deal.includes('Enter manually'),
    '  5f. funder/admin: "Enter manually" secondary CTA present',
  )
  check(
    deal.includes('Draft rules must be reviewed and approved'),
    '  5g. funder/admin: safety microcopy "Draft rules must be reviewed and approved"',
  )

  // Draft-generated review state
  check(
    deal.includes('Draft release rules generated. Review required before release setup can continue.'),
    '  5h. draft-generated state shows review-required message',
  )

  // Contractor: waiting copy
  check(
    deal.includes('Waiting for release-rule setup'),
    '  5i. contractor: "Waiting for release-rule setup" heading',
  )
  check(
    dealCollapsed.includes('The funder must create or approve the SOV and release rules'),
    '  5j. contractor: spec body "funder must create or approve the SOV and release rules"',
  )

  // Setup checklist row
  check(
    /['"]Release rules drafted['"]/.test(deal),
    '  5k. setup checklist includes "Release rules drafted" row',
  )
  // Order: Contract fully signed → Release rules drafted → SOV created
  const idxSigned = deal.indexOf('Contract fully signed')
  const idxRules  = deal.indexOf('Release rules drafted')
  const idxSov    = deal.indexOf('SOV created')
  check(
    idxSigned > -1 && idxRules > idxSigned && idxSov > idxRules,
    '  5l. checklist order: Contract fully signed → Release rules drafted → SOV created',
  )

  // ── 6. No service-role key / PERPLEXITY_API_KEY in any client component ─
  console.log('\n6. No secret leaks into client bundle')
  const allFiles = [
    ...walkSync('src/app'),
    ...walkSync('src/components'),
  ]
  const leaks: string[] = []
  for (const f of allFiles) {
    const c = read(f)
    const isClient = c.includes("'use client'") || c.includes('"use client"')
    if (!isClient) continue
    if (c.includes('PERPLEXITY_API_KEY') || c.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      leaks.push(f)
    }
  }
  check(leaks.length === 0,
    `  6a. no client component references PERPLEXITY_API_KEY or service-role key (${leaks.length} leaks)`)

  // ── 7. Banned product claims absent on touched surfaces ───────────────
  console.log('\n7. Banned product claims absent')
  const all = (helper + '\n' + textHelper + '\n' + route + '\n' + btn + '\n' + deal).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'vektrum is a lender',
    'ai approves release',
    'ai approved release',
    'ai approves',
    'ai authorizes',
    'funds are released automatically',
    'funds released automatically',
    'guarantees compliance',
    'guaranteed extraction',
    'contractor authorizes release',
  ]) {
    check(!all.includes(banned),
      `  7. banned: "${banned}" absent`)
  }

  // ── 8. Test wired into npm test ───────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(pkg.includes('contract-release-rules-pass.test.ts'),
    '8. contract-release-rules-pass.test.ts wired into npm test')

  console.log('\n✓ All contract-release-rules-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
