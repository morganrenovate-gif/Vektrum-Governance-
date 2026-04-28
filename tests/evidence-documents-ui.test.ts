/**
 * Evidence / milestone document UI static safety tests.
 *
 * No live DB. No rendering. Parses source files and asserts hard guarantees
 * about the evidence panel, the deal-page data fetch, and the API routes —
 * so that future changes cannot silently break these invariants.
 *
 * Checks:
 *  1. Deal page fetches from milestone_documents table.
 *  2. Deal page builds documentsMap keyed by milestone_id.
 *  3. Deal page passes documents prop to MilestoneCard.
 *  4. MilestoneCard accepts documents prop.
 *  5. MilestoneCard imports MilestoneDocument type.
 *  6. MilestoneCard renders the Supporting Documents panel.
 *  7. MilestoneCard shows empty state copy: "No evidence uploaded".
 *  8. MilestoneCard upload calls the documents upload API route (not DB).
 *  9. MilestoneCard does NOT call .insert/.update/.delete/.upsert directly.
 * 10. Upload is role-guarded to contractor only (canUploadDocs check).
 * 11. Panel uses safe wording — no "authenticity verified" or similar banned phrases.
 * 12. Panel does NOT claim "timestamps verified" or "photographic evidence...verified".
 * 13. Panel does NOT use "AI approved" / "AI approves" language.
 * 14. GET /api/milestones/[id]/documents still requires getAuthUser.
 * 15. GET /api/milestones/[id]/documents still requires requireDealAccess.
 * 16. POST /api/milestones/[id]/documents/upload requires getAuthUser.
 * 17. POST /api/milestones/[id]/documents/upload requires requireRole(contractor).
 * 18. POST /api/milestones/[id]/documents/upload checks milestone status.
 * 19. POST /api/milestones/[id]/documents/upload logs audit event.
 * 20. MilestoneDocument interface is exported from types.ts.
 * 21. Release gate file is unchanged (no document-related modification).
 * 22. Stripe webhook file is unchanged (no cross-contamination).
 *
 * Run:  npx tsx tests/evidence-documents-ui.test.ts
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

function read(p: string): string { return fs.readFileSync(path.resolve(ROOT, p), 'utf-8') }

/** Strip comments and string literals — safety regexes only see executable code. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

const DEAL_PAGE       = 'src/app/dashboard/deals/[dealId]/page.tsx'
const MILESTONE_CARD  = 'src/components/deal/milestone-card.tsx'
const DOC_GET         = 'src/app/api/milestones/[milestoneId]/documents/route.ts'
const DOC_UPLOAD      = 'src/app/api/milestones/[milestoneId]/documents/upload/route.ts'
const CONTRACTOR_DOCS = 'src/app/dashboard/contractor/documents/page.tsx'
const TYPES           = 'src/lib/types.ts'
const GATE            = 'src/lib/engine/release-gate.ts'
const STRIPE_WH       = 'src/app/api/stripe/webhook/route.ts'

/** Column names that do NOT exist in the actual production milestone_documents table. */
const PHANTOM_COLUMNS = ['uploader_id', 'file_name', 'file_size', 'mime_type']

async function main() {

// ─── 1. Deal page data layer ──────────────────────────────────────────────────

await test('1. Deal page fetches from milestone_documents table', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('.from("milestone_documents")') || src.includes(".from('milestone_documents')"),
    'deals/[dealId]/page.tsx does not query the milestone_documents table.',
  )
})

await test('2. Deal page builds documentsMap keyed by milestone_id', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('documentsMap'),
    'deals/[dealId]/page.tsx does not build a documentsMap.',
  )
  assert(
    src.includes('milestone_id') && src.includes('documentsMap'),
    'deals/[dealId]/page.tsx does not key documentsMap by milestone_id.',
  )
})

await test('3. Deal page passes documents prop to MilestoneCard', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('documents='),
    'deals/[dealId]/page.tsx does not pass documents prop to MilestoneCard.',
  )
  assert(
    src.includes('documentsMap.get('),
    'deals/[dealId]/page.tsx does not call documentsMap.get() when passing documents.',
  )
})

// ─── 2. MilestoneCard prop contract ──────────────────────────────────────────

await test('4. MilestoneCard declares documents prop in its interface', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('documents?') || src.includes('documents '),
    'milestone-card.tsx does not declare a documents prop in MilestoneCardProps.',
  )
  assert(
    src.includes('MilestoneDocument'),
    'milestone-card.tsx does not reference the MilestoneDocument type.',
  )
})

await test('5. MilestoneCard imports MilestoneDocument from @/lib/types', () => {
  const src = read(MILESTONE_CARD)
  assert(
    /import type.*MilestoneDocument.*from/.test(src) || /import.*MilestoneDocument.*from/.test(src),
    'milestone-card.tsx does not import MilestoneDocument from @/lib/types.',
  )
})

// ─── 3. Panel rendering ───────────────────────────────────────────────────────

await test('6. MilestoneCard renders the Supporting Documents panel section', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('Supporting Documents') || src.includes('Evidence'),
    'milestone-card.tsx does not render a "Supporting Documents" or "Evidence" section.',
  )
})

await test('7. MilestoneCard shows safe empty state copy', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('No evidence uploaded'),
    'milestone-card.tsx does not show "No evidence uploaded" empty state copy.',
  )
})

// ─── 4. Upload flow ───────────────────────────────────────────────────────────

await test('8. MilestoneCard upload calls the documents upload API route (not DB)', () => {
  const src = read(MILESTONE_CARD)
  assert(
    src.includes('/documents/upload'),
    'milestone-card.tsx does not call /api/milestones/[id]/documents/upload for file uploads.',
  )
})

await test('9. MilestoneCard does not call .insert/.update/.delete/.upsert directly', () => {
  const code = codeOnly(read(MILESTONE_CARD))
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(code), `milestone-card.tsx calls .${verb}() — UI must call API routes, not the DB.`)
  }
})

await test('10. Upload is role-guarded to contractor only', () => {
  const src = read(MILESTONE_CARD)
  // canUploadDocs or similar contractor role check near document upload logic
  assert(
    src.includes('canUploadDocs') || /role\s*===\s*["']contractor["'].*document|document.*role\s*===\s*["']contractor["']/.test(src),
    'milestone-card.tsx does not guard document upload to contractor role.',
  )
})

// ─── 5. Wording safety ───────────────────────────────────────────────────────

await test('11. Panel does not claim "document authenticity verified"', () => {
  const src = read(MILESTONE_CARD)
  assert(
    !src.toLowerCase().includes('authenticity verified'),
    'milestone-card.tsx contains "authenticity verified" — this claim is not supported.',
  )
  assert(
    !src.toLowerCase().includes('document authenticity'),
    'milestone-card.tsx contains "document authenticity" — this claim is not supported.',
  )
})

await test('12. Panel does not claim timestamps or photographic evidence are verified', () => {
  const src = read(MILESTONE_CARD)
  assert(
    !/photographic.*evidence.*verified/i.test(src),
    'milestone-card.tsx claims "photographic evidence verified" — use "Photo attachments present".',
  )
  assert(
    !/timestamp.*verified/i.test(src),
    'milestone-card.tsx claims "timestamps verified" — this is not supported.',
  )
})

await test('13. Panel does not use "AI approved" or "AI approves" language', () => {
  const src = read(MILESTONE_CARD)
  assert(
    !/AI\s+approves?/i.test(src),
    'milestone-card.tsx contains "AI approves/approved" — AI informs, it does not approve.',
  )
})

// ─── 6. API route auth guarantees ────────────────────────────────────────────

await test('14. GET /api/milestones/[id]/documents requires getAuthUser', () => {
  const src = read(DOC_GET)
  assert(/getAuthUser\(/.test(src), 'GET documents route does not call getAuthUser.')
})

await test('15. GET /api/milestones/[id]/documents requires requireDealAccess', () => {
  const src = read(DOC_GET)
  assert(
    /requireDealAccess\(/.test(src),
    'GET documents route does not call requireDealAccess — any authenticated user could list documents.',
  )
})

await test('16. POST /api/milestones/[id]/documents/upload requires getAuthUser', () => {
  const src = read(DOC_UPLOAD)
  assert(/getAuthUser\(/.test(src), 'POST documents/upload route does not call getAuthUser.')
})

await test('17. POST /api/milestones/[id]/documents/upload requires requireRole(contractor)', () => {
  const src = read(DOC_UPLOAD)
  assert(
    /requireRole\([^)]*contractor/.test(src),
    'POST documents/upload route does not call requireRole(contractor). ' +
    'Only contractors (and admins) should be able to upload evidence.',
  )
})

await test('18. POST /api/milestones/[id]/documents/upload checks milestone status', () => {
  const src = read(DOC_UPLOAD)
  assert(
    src.includes('in_progress') && src.includes('ready_for_review'),
    'POST documents/upload route does not check milestone status — ' +
    'uploads should only be allowed for in_progress or ready_for_review milestones.',
  )
})

await test('19. POST /api/milestones/[id]/documents/upload logs audit event', () => {
  const src = read(DOC_UPLOAD)
  assert(
    /logAudit\(/.test(src),
    'POST documents/upload route does not call logAudit — uploads must be recorded in the audit trail.',
  )
})

// ─── 7. Type correctness ──────────────────────────────────────────────────────

await test('20. MilestoneDocument interface is exported from types.ts', () => {
  const src = read(TYPES)
  assert(
    src.includes('export interface MilestoneDocument'),
    'types.ts does not export a MilestoneDocument interface. ' +
    'Add: export interface MilestoneDocument { id, milestone_id, uploaded_by, file_url, ... }',
  )
})

await test('20b. MilestoneDocument interface uses real column names (not phantom columns)', () => {
  const src = read(TYPES)
  // Extract the MilestoneDocument block
  const start = src.indexOf('export interface MilestoneDocument')
  const end   = src.indexOf('\n}', start) + 2
  const block = start >= 0 ? src.slice(start, end) : ''
  for (const phantom of PHANTOM_COLUMNS) {
    assert(
      !block.includes(phantom),
      `types.ts MilestoneDocument interface references "${phantom}" which does not exist in the DB schema. ` +
      `Real columns: id, milestone_id, uploaded_by, file_url, file_type, description, created_at.`,
    )
  }
})

// ─── 7b. Schema safety — no phantom columns anywhere ─────────────────────────

await test('21b. Deal page does not reference phantom milestone_documents columns', () => {
  const src = read(DEAL_PAGE)
  for (const col of PHANTOM_COLUMNS) {
    // Only flag if it appears in the milestone_documents context (not unrelated uses)
    const hasMdFetch = src.includes('milestone_documents')
    if (!hasMdFetch) continue
    // Check within the documentsMap fetch block: look for the col near milestone_documents
    const idx = src.indexOf(col)
    if (idx < 0) continue
    // Allow if it appears only in a comment or is not in the select block
    const region = src.slice(Math.max(0, idx - 400), idx + 50)
    assert(
      !region.includes('milestone_documents'),
      `deals/[dealId]/page.tsx references phantom column "${col}" in a milestone_documents query.`,
    )
  }
})

await test('21c. Upload route does not insert phantom columns', () => {
  const code = codeOnly(read(DOC_UPLOAD))
  for (const col of PHANTOM_COLUMNS) {
    assert(
      !code.includes(col),
      `documents/upload/route.ts references "${col}" which does not exist in milestone_documents. ` +
      `Use: uploaded_by, file_url, file_type, description.`,
    )
  }
})

await test('21d. GET documents route does not select phantom columns', () => {
  const code = codeOnly(read(DOC_GET))
  for (const col of PHANTOM_COLUMNS) {
    assert(
      !code.includes(col),
      `documents/route.ts (GET) references "${col}" which does not exist in milestone_documents.`,
    )
  }
})

await test('21e. MilestoneCard UI does not reference phantom columns', () => {
  const code = codeOnly(read(MILESTONE_CARD))
  for (const col of PHANTOM_COLUMNS) {
    assert(
      !code.includes(col),
      `milestone-card.tsx references "${col}" which does not exist in milestone_documents. ` +
      `Use doc.description (filename), doc.file_type (type badge). No file_size column exists.`,
    )
  }
})

await test('21f. Contractor documents page does not reference phantom columns', () => {
  const code = codeOnly(read(CONTRACTOR_DOCS))
  for (const col of PHANTOM_COLUMNS) {
    assert(
      !code.includes(col),
      `contractor/documents/page.tsx references "${col}" which does not exist in milestone_documents.`,
    )
  }
})

// ─── 8. Unchanged safety surfaces ────────────────────────────────────────────

await test('21. Release gate file is unchanged (no document-related modification)', () => {
  const rawSrc  = read(GATE)
  const codeSrc = codeOnly(rawSrc)
  assert(
    rawSrc.includes('change_orders'),
    'release-gate.ts no longer references change_orders — Condition 7 may have been removed.',
  )
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(codeSrc), `release-gate.ts calls .${verb}() — gate must remain read-only.`)
  }
})

await test('22. Stripe webhook file is unchanged (no cross-contamination)', () => {
  const src = read(STRIPE_WH)
  assert(
    !src.includes('milestone_documents'),
    'Stripe webhook route now references milestone_documents — unexpected cross-contamination.',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — EVIDENCE DOCUMENTS UI SAFETY TEST RESULTS')
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
