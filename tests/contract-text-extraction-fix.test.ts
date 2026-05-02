/**
 * tests/contract-text-extraction-fix.test.ts
 *
 * Pins the contract-text extraction fix:
 *
 *   1. extractSignedContractText returns 6 structured failure reasons
 *      (no_storage_path / download_failed / empty_pdf_text /
 *       scanned_pdf_no_ocr / parse_error / password_protected_or_corrupt)
 *      and a rich `diagnostics` object on every result (ok or err).
 *
 *   2. Source preference is signed_storage_path → storage_path with
 *      transparent fallback on EITHER download failure OR parse failure.
 *      The diagnostics record `fell_back_from_signed_to_original` so ops
 *      can tell when the original was used.
 *
 *   3. Two-stage parser: pdf-parse first, unpdf fallback. unpdf is
 *      already in package.json — no new dependency.
 *
 *   4. Generation route surfaces the new diagnostics in its failure log
 *      AND its 422 / 409 response body. Status is 409 only for
 *      no_storage_path (precondition); every other extraction failure is
 *      422 (unprocessable file). The route never calls Perplexity when
 *      extraction fails or returns empty text.
 *
 *   5. Deal page copy no longer says "signed contract" in the body — it
 *      says "contract document" so the system can transparently fall
 *      back to the original upload when the signed PDF is missing.
 *
 *   6. Webhook envelope-completed still downloads the signed PDF and
 *      writes `signed_storage_path` (existing behavior; pinned here so
 *      a regression would surface).
 *
 *   7. No release / payment / Stripe imports in the touched surfaces.
 *
 *   8. Banned product claims absent.
 *
 * Run: npx tsx tests/contract-text-extraction-fix.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const HELPER       = 'src/lib/engine/contract-text.ts'
const ROUTE        = 'src/app/api/deals/[dealId]/release-rules/generate-from-contract/route.ts'
const WEBHOOK      = 'src/app/api/webhooks/docusign/route.ts'
const DEAL_PAGE    = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'
const PKG          = 'package.json'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
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
  console.log('\ncontract-text-extraction-fix.test.ts\n')

  const helper     = read(HELPER)
  const helperCode = stripComments(helper)
  const route      = read(ROUTE)
  const routeCode  = stripComments(route)
  const webhook    = read(WEBHOOK)
  const deal       = read(DEAL_PAGE)
  const pkg        = read(PKG)

  // ── 1. Structured failure reasons ──────────────────────────────────────
  console.log('1. Structured failure reasons')
  for (const reason of [
    'no_storage_path',
    'download_failed',
    'empty_pdf_text',
    'scanned_pdf_no_ocr',
    'parse_error',
    'password_protected_or_corrupt',
  ]) {
    check(
      new RegExp(`reason:\\s*['"]${reason}['"]`).test(helperCode) ||
      helperCode.includes(`'${reason}'`),
      `  1a. helper emits failure reason "${reason}"`,
    )
  }
  // The legacy reasons must be gone (or at least subsumed). The old union
  // had only 'no_path' / 'download_failed' / 'parse_failed' / 'empty'.
  check(
    !/reason:\s*['"]no_path['"]/.test(helperCode) &&
    !/reason:\s*['"]parse_failed['"]/.test(helperCode),
    '  1b. legacy "no_path" / "parse_failed" reasons are gone',
  )

  // Discriminated result type is exported
  check(
    helper.includes('export type ExtractFailureReason'),
    '  1c. exports ExtractFailureReason union type',
  )
  check(
    helper.includes('export interface ExtractDiagnostics'),
    '  1d. exports ExtractDiagnostics interface',
  )

  // Every diagnostic field the spec requires is present in the type
  for (const field of [
    'contract_id',
    'has_storage_path',
    'has_signed_storage_path',
    'selected_source',
    'bucket',
    'attempted_paths',
    'file_size_bytes',
    'extracted_text_length',
    'extraction_method',
    'fell_back_from_signed_to_original',
  ]) {
    check(helper.includes(field), `  1e. diagnostics declares "${field}"`)
  }

  // selected_source enum
  check(
    helper.includes("'signed'") &&
    helper.includes("'original'") &&
    helper.includes("'none'"),
    '  1f. selected_source values: signed | original | none',
  )
  // extraction_method enum
  check(
    helper.includes("'pdf-parse'") && helper.includes("'unpdf'"),
    '  1g. extraction_method values: pdf-parse | unpdf | null',
  )

  // ── 2. Source preference + transparent fall-through ────────────────────
  console.log('\n2. Source preference + fall-through')
  // Candidates list pushes signed first, then original
  check(
    /candidates\.push\(\s*\{\s*source:\s*['"]signed['"]/.test(helperCode) &&
    /candidates\.push\(\s*\{\s*source:\s*['"]original['"]/.test(helperCode),
    '  2a. candidates array: signed first, original second',
  )
  // for-of loop iterates and continues on download failure
  check(
    /for\s*\(\s*const\s+candidate\s+of\s+candidates\s*\)/.test(helperCode) &&
    /continue\b/.test(helperCode),
    '  2b. iterates candidates with `continue` on download failure',
  )
  // fell_back_from_signed_to_original is set when signed path fails and we move on
  check(
    /fell_back_from_signed_to_original\s*=\s*true/.test(helperCode),
    '  2c. sets fell_back_from_signed_to_original=true on signed→original fallback',
  )
  // Empty/scanned PDF stops iteration (don't try original — it won't be more readable)
  check(
    /scanned_pdf_no_ocr[\s\S]{0,500}break/.test(helperCode) ||
    /empty_pdf_text[\s\S]{0,500}break/.test(helperCode),
    '  2d. empty/scanned PDF breaks iteration (no point trying the original)',
  )

  // ── 3. Two-stage parser (pdf-parse → unpdf fallback) ───────────────────
  console.log('\n3. Two-stage parser')
  check(
    /pdf-parse[\s\S]*?unpdf/.test(helperCode),
    '  3a. attempts pdf-parse before unpdf',
  )
  check(
    /import\(\s*['"]unpdf['"]\s*\)/.test(helperCode),
    '  3b. lazy-imports unpdf as the fallback parser',
  )
  // unpdf must already be in package.json (no new dep)
  check(
    /"unpdf"\s*:/.test(pkg),
    '  3c. unpdf is already declared in package.json (no new dependency)',
  )
  check(
    /password|encrypt/i.test(helperCode),
    '  3d. classifies password-protected/encrypted PDFs distinctly',
  )

  // ── 4. Route surfaces diagnostics + correct status codes ───────────────
  console.log('\n4. Route surfaces diagnostics + status codes')
  check(
    /diagnostics:\s*extraction\.diagnostics/.test(routeCode),
    '  4a. failure log includes diagnostics: extraction.diagnostics',
  )
  check(
    /extraction\.reason\s*===\s*['"]no_storage_path['"]\s*\?\s*409\s*:\s*422/.test(routeCode),
    '  4b. status 409 only for no_storage_path; everything else 422',
  )
  // Response body carries the structured failure reason + diagnostics
  check(
    /reason:\s*extraction\.reason/.test(routeCode) &&
    /diagnostics:\s*extraction\.diagnostics/.test(routeCode),
    '  4c. response body returns reason + diagnostics so the UI can render specific copy',
  )
  // Success path also logs diagnostics for symmetry
  check(
    /\[release-rules\] extraction ok[\s\S]{0,200}diagnostics:\s*extraction\.diagnostics/.test(route),
    '  4d. success path also logs diagnostics (audit symmetry)',
  )
  // Perplexity is NOT called before the extraction.ok check
  const extractIdx     = route.indexOf('extractSignedContractText')
  const perplexityIdx  = route.indexOf('generateDraftReleaseRules')
  check(
    extractIdx > -1 && perplexityIdx > extractIdx,
    '  4e. extractSignedContractText runs BEFORE generateDraftReleaseRules',
  )
  // Failure path returns BEFORE the Perplexity call
  check(
    /if\s*\(\s*!extraction\.ok\s*\)\s*\{[\s\S]*?return NextResponse\.json/.test(routeCode),
    '  4f. failure path early-returns BEFORE the Perplexity call',
  )

  // ── 5. Deal page copy: "contract document" not "signed contract" ──────
  console.log('\n5. Deal page UI copy')
  check(
    deal.includes('contract document as the source of truth'),
    '  5a. body says "contract document as the source of truth" (not "signed contract")',
  )
  // The "signed contract" wording must be gone from the release-rules body
  // (it's still allowed elsewhere — fully-executed banner, etc.)
  const dealCollapsed = deal.replace(/\s+/g, ' ')
  check(
    !dealCollapsed.includes('signed contract as the source of truth'),
    '  5b. legacy "signed contract as the source of truth" wording removed from body',
  )
  // Microcopy preserved
  check(
    deal.includes('Draft rules must be reviewed and approved'),
    '  5c. safety microcopy preserved',
  )

  // ── 6. Webhook envelope-completed still stores signed PDF ─────────────
  console.log('\n6. Webhook envelope-completed signed-document storage')
  check(
    webhook.includes('downloadSignedDocument') &&
    webhook.includes("eventType === 'envelope-completed'"),
    '  6a. envelope-completed handler still calls downloadSignedDocument',
  )
  check(
    webhook.includes("storage\n        .from('contracts')") ||
    webhook.includes(".from('contracts')"),
    '  6b. webhook still uploads the signed PDF to the contracts bucket',
  )
  check(
    /signed_storage_path:\s*signedStoragePath/.test(webhook),
    '  6c. webhook still writes signed_storage_path on the contracts row',
  )
  // Idempotency — the contract.status === 'signed' early-return is preserved
  check(
    /contract\.status\s*===\s*['"]signed['"][\s\S]{0,300}return NextResponse\.json/.test(webhook),
    '  6d. envelope-completed is idempotent (early-returns when already signed)',
  )

  // ── 7. No release / payment / Stripe imports leaked ────────────────────
  console.log('\n7. No release / payment / Stripe imports leaked')
  for (const banned of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!helper.includes(banned),  `  7a. helper does NOT import / call "${banned}"`)
    check(!route.includes(banned),   `  7b. route does NOT import / call "${banned}"`)
  }

  // ── 8. Banned product claims absent ────────────────────────────────────
  console.log('\n8. Banned product claims absent on touched surfaces')
  const all = (helper + '\n' + route + '\n' + deal).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'ai approves release',
    'ai approves',
    'ai authorizes',
    'funds are released automatically',
    'funds released automatically',
    'guaranteed extraction',
    'guarantees compliance',
    'contractor authorizes release',
  ]) {
    check(!all.includes(banned), `  8. banned: "${banned}" absent`)
  }

  // ── 9. Test wired into npm test ───────────────────────────────────────
  check(
    pkg.includes('contract-text-extraction-fix.test.ts'),
    '9. contract-text-extraction-fix.test.ts wired into npm test',
  )

  console.log('\n✓ All contract-text-extraction-fix tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
