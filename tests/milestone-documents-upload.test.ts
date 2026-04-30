/**
 * Milestone Documents Upload — Static Safety Tests
 *
 * Verifies the fix for the "file upload fails silently" bug on the contractor
 * dashboard. Root cause: the 'milestone-documents' Supabase Storage bucket was
 * never created in any migration.
 *
 * Checks:
 *  1.  Migration exists and creates the 'milestone-documents' bucket
 *  2.  Bucket is configured public: true (required for getPublicUrl to work)
 *  3.  Bucket has the correct file size limit (20 MB)
 *  4.  Bucket allows only PDF, PNG, and JPEG (matches route validation)
 *  5.  Migration uses ON CONFLICT DO NOTHING (safe to re-run)
 *  6.  Upload route exists at the correct path
 *  7.  Upload route calls getAuthUser (auth cannot be bypassed)
 *  8.  Upload route enforces contractor or admin role
 *  9.  Upload route calls requireDealAccess (milestone isolation)
 * 10.  Upload route checks milestone.contractor_id === user.id
 * 11.  Upload route validates milestone status
 * 12.  Upload route validates file MIME type
 * 13.  Upload route enforces 20 MB file size limit
 * 14.  Upload route uses createSupabaseAdminClient for storage (correct)
 * 15.  Upload route uses getPublicUrl not createSignedUrl (correct for public bucket)
 * 16.  Upload route returns structured JSON error on storage failure
 * 17.  Upload route returns structured JSON error on DB insert failure
 * 18.  Upload route logs audit event on DB insert failure (reconciliation trail)
 * 19.  Upload route logs audit event on success
 * 20.  Upload route does not expose service-role secrets
 * 21.  Milestone card sends FormData to the /upload sub-route
 * 22.  Milestone card checks res.ok and surfaces data.error (no silent swallow)
 * 23.  Contractor documents page fetches milestone_documents with correct join
 * 24.  Test file is wired into npm test in package.json
 *
 * Source-parse checks only — no live DB, no env vars, no rendering required.
 * Run:  npx tsx tests/milestone-documents-upload.test.ts
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

const MIGRATION = 'supabase/migrations/20260428000001_milestone_documents_bucket.sql'
const UPLOAD_RT = 'src/app/api/milestones/[milestoneId]/documents/upload/route.ts'
const CARD      = 'src/components/deal/milestone-card.tsx'
const DOCS_PAGE = 'src/app/(app)/dashboard/contractor/documents/page.tsx'
const PKG       = 'package.json'

async function main() {

// ─── 1-5. Migration correctness ───────────────────────────────────────────────

await test('1. Migration file exists', () => {
  assert(fs.existsSync(path.resolve(ROOT, MIGRATION)), `${MIGRATION} must exist.`)
})

await test('2. Bucket is created with public: true', () => {
  const sql = read(MIGRATION)
  assert(
    sql.includes("'milestone-documents'") &&
    (sql.includes('true,') || sql.match(/true\s*,?\s*--\s*public/) !== null),
    `${MIGRATION} must create the 'milestone-documents' bucket with public: true so getPublicUrl() works.`,
  )
})

await test('3. Bucket has 20 MB file size limit', () => {
  const sql = read(MIGRATION)
  assert(
    sql.includes('20971520'),
    `${MIGRATION} must set file_size_limit to 20971520 (20 MB) to match the route-level check.`,
  )
})

await test('4. Bucket allows only PDF, PNG, and JPEG', () => {
  const sql = read(MIGRATION)
  assert(
    sql.includes('application/pdf') && sql.includes('image/png') && sql.includes('image/jpeg'),
    `${MIGRATION} must allow 'application/pdf', 'image/png', 'image/jpeg' — matching the upload route.`,
  )
})

await test('5. Migration uses ON CONFLICT DO NOTHING (safe to re-run)', () => {
  const sql = read(MIGRATION)
  assert(
    sql.includes('ON CONFLICT') && sql.includes('DO NOTHING'),
    `${MIGRATION} must use ON CONFLICT (id) DO NOTHING so re-running the migration is safe.`,
  )
})

// ─── 6-9. Upload route — auth and access control ─────────────────────────────

await test('6. Upload route exists', () => {
  assert(fs.existsSync(path.resolve(ROOT, UPLOAD_RT)), `${UPLOAD_RT} must exist.`)
})

await test('7. Upload route calls getAuthUser (auth cannot be bypassed)', () => {
  const src = read(UPLOAD_RT)
  assert(src.includes('getAuthUser'), `${UPLOAD_RT} must call getAuthUser to authenticate the request.`)
})

await test('8. Upload route enforces contractor or admin role', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('requireRole') && src.includes("'contractor'") && src.includes("'admin'"),
    `${UPLOAD_RT} must call requireRole(profile, 'contractor', 'admin').`,
  )
})

await test('9. Upload route calls requireDealAccess (milestone isolation)', () => {
  const src = read(UPLOAD_RT)
  assert(src.includes('requireDealAccess'), `${UPLOAD_RT} must call requireDealAccess.`)
})

// ─── 10-13. Business-rule validation ─────────────────────────────────────────

await test('10. Upload route checks contractor_id ownership', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('contractor_id') && src.includes('user.id'),
    `${UPLOAD_RT} must verify milestone.contractor_id === user.id for contractor role.`,
  )
})

await test('11. Upload route validates milestone status', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes("'in_progress'") && src.includes("'ready_for_review'"),
    `${UPLOAD_RT} must reject uploads for milestones not in 'in_progress' or 'ready_for_review'.`,
  )
})

await test('12. Upload route validates file MIME type', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('allowedTypes') &&
    src.includes('application/pdf') &&
    src.includes('image/png') &&
    src.includes('image/jpeg'),
    `${UPLOAD_RT} must validate the file MIME type against the allowed list.`,
  )
})

await test('13. Upload route enforces 20 MB file size limit', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('20 * 1024 * 1024') || src.includes('20971520'),
    `${UPLOAD_RT} must reject files larger than 20 MB.`,
  )
})

// ─── 14-15. Storage access pattern ───────────────────────────────────────────

await test('14. Upload route uses admin client for storage (correct — bypasses RLS)', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('createSupabaseAdminClient') && src.includes("from('milestone-documents')"),
    `${UPLOAD_RT} must use createSupabaseAdminClient() for the storage upload.`,
  )
})

await test('15. Upload route uses getPublicUrl, not createSignedUrl', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('getPublicUrl'),
    `${UPLOAD_RT} must use getPublicUrl — the milestone-documents bucket is public.`,
  )
  assert(
    !src.includes('createSignedUrl'),
    `${UPLOAD_RT} must not use createSignedUrl for a public bucket — that produces expiring URLs stored permanently in DB.`,
  )
})

// ─── 16-19. Error handling and audit trail ────────────────────────────────────

await test('16. Upload route returns structured JSON error on storage failure', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('storageError') && src.includes('internalError'),
    `${UPLOAD_RT} must return a structured JSON error via internalError() when storage upload fails.`,
  )
})

await test('17. Upload route returns structured JSON error on DB insert failure', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('insertError') && src.includes('internalError'),
    `${UPLOAD_RT} must return a structured JSON error via internalError() when the DB insert fails.`,
  )
})

await test('18. Upload route logs audit event on DB insert failure (reconciliation trail)', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes('document_upload_db_failed') || (src.includes('logAudit') && src.includes('storage')),
    `${UPLOAD_RT} must call logAudit when the file uploads to storage but the DB insert fails.`,
  )
})

await test('19. Upload route logs audit event on success', () => {
  const src = read(UPLOAD_RT)
  assert(
    src.includes("'document_uploaded'"),
    `${UPLOAD_RT} must call logAudit with action 'document_uploaded' on success.`,
  )
})

// ─── 20. No secret exposure ───────────────────────────────────────────────────

await test('20. Upload route does not expose service-role secrets', () => {
  const src = read(UPLOAD_RT)
  assert(
    !src.includes('SUPABASE_SERVICE_ROLE_KEY') && !src.includes('STRIPE_SECRET'),
    `${UPLOAD_RT} must not reference service-role secrets — use createSupabaseAdminClient().`,
  )
})

// ─── 21-22. Frontend (milestone-card) correctness ─────────────────────────────

await test('21. Milestone card sends FormData to /documents/upload sub-route', () => {
  const src = read(CARD)
  assert(
    src.includes('/documents/upload') && src.includes('FormData') && src.includes('fd.append'),
    `${CARD} must send multipart FormData to the /documents/upload endpoint.`,
  )
})

await test('22. Milestone card checks res.ok and surfaces data.error (no silent swallow)', () => {
  const src = read(CARD)
  const fnStart = src.indexOf('handleDocUpload')
  assert(fnStart >= 0, `${CARD} must contain handleDocUpload.`)
  const fn = src.slice(fnStart, fnStart + 1500)
  assert(
    fn.includes('res.ok') && fn.includes('data.error'),
    `${CARD} handleDocUpload must check res.ok and surface data.error.`,
  )
})

// ─── 23. Documents list page ──────────────────────────────────────────────────

await test('23. Contractor documents page fetches milestone_documents with join', () => {
  const src = read(DOCS_PAGE)
  assert(
    src.includes('milestone_documents'),
    `${DOCS_PAGE} must query the milestone_documents table.`,
  )
  assert(
    src.includes('milestones'),
    `${DOCS_PAGE} must join to milestones to resolve deal context.`,
  )
})

// ─── 24. Package.json wiring ──────────────────────────────────────────────────

await test('24. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('milestone-documents-upload.test.ts'),
    `${PKG} must include 'milestone-documents-upload.test.ts' in the test script.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Milestone Documents Upload Tests')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter((r) => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)

} // end main()

main()
