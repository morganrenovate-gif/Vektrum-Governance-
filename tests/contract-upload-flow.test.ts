/**
 * Contract Upload Flow — Static Safety Tests
 *
 * Verifies that the "Upload Contract" dead-button fix is correctly implemented.
 * The buttons in the contract-required setup card and SOV empty state previously
 * used href="#contract" with no anchor target. This test suite ensures the full
 * upload flow (API route → client component → deal page integration) is wired.
 *
 * Checks:
 *  1.  Upload API route file exists
 *  2.  Upload API route exports POST
 *  3.  Upload API route calls getAuthUser (auth cannot be bypassed)
 *  4.  Upload API route enforces contractor or admin role (funders blocked)
 *  5.  Upload API route calls requireDealAccess (deal isolation)
 *  6.  Upload API route checks contractor ownership for contractor role
 *  7.  Upload API route validates PDF-only (rejects other MIME types)
 *  8.  Upload API route enforces 20 MB size limit
 *  9.  Upload API route checks for existing non-voided contract (409 conflict)
 * 10.  Upload API route uses admin client for storage (correct for private bucket)
 * 11.  Upload API route uploads to the 'contracts' bucket
 * 12.  Upload API route inserts into contracts table with status='pending_signatures'
 * 13.  Upload API route logs contract_uploaded audit event
 * 14.  Upload API route returns 201 on success
 * 15.  ContractUploadSection component file exists
 * 16.  ContractUploadSection has id="contract" anchor (href="#contract" target)
 * 17.  ContractUploadSection accepts PDF files only (accept attribute)
 * 18.  ContractUploadSection posts to /api/deals/[dealId]/contracts
 * 19.  ContractUploadSection calls router.refresh() on success
 * 20.  ContractUploadSection handles error state (sets error message)
 * 21.  ContractUploadSection enforces 20 MB client-side size check
 * 22.  Deal page imports ContractUploadSection
 * 23.  Deal page renders ContractUploadSection for contractor/admin + !hasContract
 * 24.  Setup card Upload Contract link still uses href="#contract" (anchor scroll)
 * 25.  SOV section contractUploadHref prop still passes "#contract"
 * 26.  Import SOV from Contract remains disabled/coming soon (no live wiring)
 * 27.  Test file is wired into npm test in package.json
 * 28.  Contracts bucket migration file exists
 * 29.  Contracts bucket is created with public = false (private)
 * 30.  Contracts bucket sets 20 MB file size limit
 * 31.  Contracts bucket allows only application/pdf
 * 32.  Contracts bucket migration uses ON CONFLICT DO NOTHING (idempotent)
 *
 * Source-parse checks only — no live DB, no rendering, no env vars required.
 * Run:  npx tsx tests/contract-upload-flow.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ─── Runner ───────────────────────────────────────────────────────────────────

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

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8')
}

function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

// ─── File paths ───────────────────────────────────────────────────────────────

const UPLOAD_ROUTE  = 'src/app/api/deals/[dealId]/contracts/route.ts'
const COMPONENT     = 'src/components/deal/contract-upload-section.tsx'
const PAGE          = 'src/app/dashboard/deals/[dealId]/page.tsx'
const SOV_SECTION   = 'src/components/deal/sov-section.tsx'
const BUCKET_MIG    = 'supabase/migrations/20260429000002_contracts_bucket.sql'
const PACKAGE_JSON  = 'package.json'

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── API route ─────────────────────────────────────────────────────────────────

await test('1. Upload API route file exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, UPLOAD_ROUTE)),
    `${UPLOAD_ROUTE} must exist.`,
  )
})

await test('2. Upload API route exports POST', () => {
  const src = read(UPLOAD_ROUTE)
  assert(src.includes('export async function POST'), `${UPLOAD_ROUTE} must export POST.`)
})

await test('3. Upload API route calls getAuthUser', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes('getAuthUser'),
    `${UPLOAD_ROUTE} must call getAuthUser to prevent unauthenticated uploads.`,
  )
})

await test('4. Upload API route blocks funders (contractor/admin only)', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes("role !== 'contractor'") || src.includes('role !== "contractor"'),
    `${UPLOAD_ROUTE} must check that only contractors/admins can upload.`,
  )
  assert(
    src.includes("role !== 'admin'") || src.includes('role !== "admin"'),
    `${UPLOAD_ROUTE} must check that only contractors/admins can upload.`,
  )
})

await test('5. Upload API route calls requireDealAccess', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes('requireDealAccess'),
    `${UPLOAD_ROUTE} must call requireDealAccess to isolate deals.`,
  )
})

await test('6. Upload API route checks contractor ownership', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes('contractor_id') && src.includes('user.id'),
    `${UPLOAD_ROUTE} must verify contractor_id === user.id for contractor uploads.`,
  )
})

await test('7. Upload API route validates PDF only', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes('application/pdf'),
    `${UPLOAD_ROUTE} must accept only 'application/pdf' and reject other MIME types.`,
  )
  assert(
    src.includes('file.type') && (src.includes('!== ') || src.includes('!=')),
    `${UPLOAD_ROUTE} must reject non-PDF files.`,
  )
})

await test('8. Upload API route enforces 20 MB size limit', () => {
  const src = read(UPLOAD_ROUTE)
  const code = codeOnly(src)
  assert(
    src.includes('20 * 1024 * 1024') || src.includes('20MB') || src.includes('20 MB'),
    `${UPLOAD_ROUTE} must enforce a 20 MB file size limit.`,
  )
  assert(
    code.includes('file.size'),
    `${UPLOAD_ROUTE} must check file.size against the size limit.`,
  )
})

await test('9. Upload API route checks for existing non-voided contract (conflict)', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes("neq('status', 'voided'") || src.includes('neq("status", "voided"') ||
    src.includes("status', 'voided'") || src.includes('voided'),
    `${UPLOAD_ROUTE} must query for an existing non-voided contract and return 409 on conflict.`,
  )
  assert(
    src.includes('409'),
    `${UPLOAD_ROUTE} must return HTTP 409 when an active contract already exists.`,
  )
})

await test('10. Upload API route uses admin client for storage', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes('createSupabaseAdminClient'),
    `${UPLOAD_ROUTE} must use createSupabaseAdminClient for storage uploads (private bucket).`,
  )
  assert(
    src.includes('adminClient.storage'),
    `${UPLOAD_ROUTE} must access storage via the admin client, not the session client.`,
  )
})

await test('11. Upload API route uploads to the contracts bucket', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes("from('contracts')"),
    `${UPLOAD_ROUTE} must upload to the 'contracts' Supabase Storage bucket.`,
  )
})

await test('12. Upload API route inserts contract with pending_signatures status', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes("status") && src.includes("pending_signatures"),
    `${UPLOAD_ROUTE} must insert a contract record with status = 'pending_signatures'.`,
  )
  assert(
    src.includes('.insert('),
    `${UPLOAD_ROUTE} must call .insert() to create the contracts record.`,
  )
})

await test('13. Upload API route logs contract_uploaded audit event', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes('logAudit'),
    `${UPLOAD_ROUTE} must call logAudit to record the contract upload in the audit trail.`,
  )
  assert(
    src.includes('contract_uploaded'),
    `${UPLOAD_ROUTE} must log the action 'contract_uploaded'.`,
  )
})

await test('14. Upload API route returns 201 on success', () => {
  const src = read(UPLOAD_ROUTE)
  assert(
    src.includes('status: 201'),
    `${UPLOAD_ROUTE} must return HTTP 201 (Created) on successful upload.`,
  )
})

// ── Client component ──────────────────────────────────────────────────────────

await test('15. ContractUploadSection component file exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, COMPONENT)),
    `${COMPONENT} must exist.`,
  )
})

await test('16. ContractUploadSection has id="contract" anchor', () => {
  const src = read(COMPONENT)
  assert(
    src.includes('id="contract"') || src.includes("id='contract'"),
    `${COMPONENT} must have id="contract" so href="#contract" buttons scroll to it.`,
  )
})

await test('17. ContractUploadSection accepts PDF files only', () => {
  const src = read(COMPONENT)
  assert(
    src.includes('application/pdf') || src.includes('.pdf'),
    `${COMPONENT} file input must include accept="application/pdf,.pdf".`,
  )
})

await test('18. ContractUploadSection posts to /api/deals/[dealId]/contracts', () => {
  const src = read(COMPONENT)
  assert(
    src.includes('/api/deals/') && src.includes('/contracts'),
    `${COMPONENT} must POST to /api/deals/[dealId]/contracts.`,
  )
  assert(
    src.includes("method: 'POST'") || src.includes('method: "POST"'),
    `${COMPONENT} must use POST method for the upload request.`,
  )
})

await test('19. ContractUploadSection calls router.refresh() on success', () => {
  const src = read(COMPONENT)
  assert(
    src.includes('router.refresh()'),
    `${COMPONENT} must call router.refresh() after a successful upload to reload server data.`,
  )
})

await test('20. ContractUploadSection handles error state', () => {
  const src = read(COMPONENT)
  assert(
    src.includes('setErrorMsg') || src.includes('errorMsg'),
    `${COMPONENT} must track and display upload error messages.`,
  )
})

await test('21. ContractUploadSection enforces 20 MB client-side size check', () => {
  const src = read(COMPONENT)
  assert(
    src.includes('20 * 1024 * 1024') || src.includes('MAX_FILE_BYTES'),
    `${COMPONENT} must enforce a 20 MB client-side size check before uploading.`,
  )
})

// ── Deal page integration ─────────────────────────────────────────────────────

await test('22. Deal page imports ContractUploadSection', () => {
  const src = read(PAGE)
  assert(
    src.includes('ContractUploadSection'),
    `${PAGE} must import and render ContractUploadSection.`,
  )
})

await test('23. Deal page renders ContractUploadSection for contractor/admin + !hasContract', () => {
  const src = read(PAGE)
  const code = codeOnly(src)
  assert(
    src.includes('ContractUploadSection'),
    `${PAGE} must render <ContractUploadSection>.`,
  )
  assert(
    code.includes('hasContract'),
    `${PAGE} ContractUploadSection must be conditional on !hasContract.`,
  )
})

await test('24. Setup card Upload Contract link uses href="#contract" (anchor scroll)', () => {
  const src = read(PAGE)
  assert(
    src.includes('href="#contract"') || src.includes("href='#contract'"),
    `${PAGE} setup card "Upload Contract" button must use href="#contract" to scroll to the upload section.`,
  )
})

await test('25. SOV section contractUploadHref prop passes "#contract"', () => {
  const src = read(PAGE)
  assert(
    src.includes('contractUploadHref="#contract"') || src.includes("contractUploadHref='#contract'"),
    `${PAGE} must pass contractUploadHref="#contract" to SovSection.`,
  )
})

await test('26. Import SOV from Contract remains coming soon (not live)', () => {
  const pageSrc    = read(PAGE)
  const sectionSrc = read(SOV_SECTION)
  assert(
    pageSrc.includes('Coming soon') || pageSrc.includes('coming soon'),
    `${PAGE} "Import SOV from Contract" must still be marked as coming soon.`,
  )
  assert(
    sectionSrc.includes('Coming soon') || sectionSrc.includes('coming soon') || sectionSrc.includes('disabled'),
    `${SOV_SECTION} "Import SOV from Contract" must still be disabled/coming soon.`,
  )
})

// ── Package.json ──────────────────────────────────────────────────────────────

await test('27. Test file is wired into npm test in package.json', () => {
  const src = read(PACKAGE_JSON)
  assert(
    src.includes('contract-upload-flow.test.ts'),
    `${PACKAGE_JSON} must include contract-upload-flow.test.ts in the test script.`,
  )
})

// ── Contracts storage bucket migration ───────────────────────────────────────

await test('28. Contracts bucket migration file exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, BUCKET_MIG)),
    `${BUCKET_MIG} must exist. The 'contracts' storage bucket must be created by migration, not manually.`,
  )
})

await test('29. Contracts bucket is created with public = false (private)', () => {
  const sql = read(BUCKET_MIG)
  assert(
    sql.includes('false') && (sql.includes("public") || sql.includes("public,")),
    `${BUCKET_MIG} must set public = false so contract PDFs require signed URLs for access.`,
  )
  // Must not accidentally be set to true
  assert(
    !sql.includes('true,') && !sql.includes('true)') && !sql.includes('true --'),
    `${BUCKET_MIG} must not set public = true — contract PDFs must be private.`,
  )
})

await test('30. Contracts bucket sets 20 MB file size limit', () => {
  const sql = read(BUCKET_MIG)
  assert(
    sql.includes('20971520'),
    `${BUCKET_MIG} must set file_size_limit = 20971520 (20 MB) to match route validation.`,
  )
})

await test('31. Contracts bucket allows only application/pdf', () => {
  const sql = read(BUCKET_MIG)
  assert(
    sql.includes('application/pdf'),
    `${BUCKET_MIG} must restrict allowed_mime_types to 'application/pdf'.`,
  )
  // Must not accidentally permit image types
  assert(
    !sql.includes('image/png') && !sql.includes('image/jpeg'),
    `${BUCKET_MIG} must not permit image MIME types — contracts are PDF only.`,
  )
})

await test('32. Contracts bucket migration uses ON CONFLICT DO NOTHING (idempotent)', () => {
  const sql = read(BUCKET_MIG)
  assert(
    sql.includes('ON CONFLICT') && sql.includes('DO NOTHING'),
    `${BUCKET_MIG} must use ON CONFLICT DO NOTHING so re-running the migration is safe.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — CONTRACT UPLOAD FLOW')
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
}

main()
