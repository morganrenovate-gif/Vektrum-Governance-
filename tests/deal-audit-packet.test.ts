/**
 * Deal Audit Packet — Static Safety and Coverage Tests
 *
 * Static source-parse checks — no live DB, no env vars required.
 * Verifies that GET /api/deals/[dealId]/audit-packet is correct,
 * safe, and covers all required sections.
 *
 * Checks:
 *  1.  Route file exists at correct path.
 *  2.  Route is a GET handler only (no POST, PATCH, DELETE, PUT exports).
 *  3.  Route calls getAuthUser (auth is not skippable).
 *  4.  Route calls requireDealAccess (deal-scope enforced).
 *  5.  Route blocks contractors (role === 'contractor' triggers forbidden).
 *  6.  Route never returns api_key_hash.
 *  7.  Route never returns webhook_signing_secret.
 *  8.  Route never returns STRIPE_SECRET_KEY or service-role secrets.
 *  9.  Route is read-only (no INSERT, UPDATE, DELETE, UPSERT calls in code).
 * 10.  Route covers all 14 required sections (packet_metadata through closeout_summary).
 * 11.  closeout_summary includes a disclaimer mentioning tamper-evident (not tamper-proof).
 * 12.  closeout_summary disclaimer states Vektrum does not hold funds.
 * 13.  Route logs the export to audit_log (calls logAudit / audit_packet_exported).
 * 14.  Partner is projected to id+name only (no webhook_url, no credentials).
 * 15.  Route uses createSupabaseAdminClient for DB access.
 * 16.  Route is force-dynamic (no static caching of sensitive financial data).
 * 17.  Test file itself is wired into npm test in package.json.
 *
 * Run:  npx tsx tests/deal-audit-packet.test.ts
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

// Strip comments and string literals for write-verb safety checks
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, '')
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '')
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '')
}

const ROUTE = 'src/app/api/deals/[dealId]/audit-packet/route.ts'
const PKG   = 'package.json'

async function main() {

// ─── 1. File existence ────────────────────────────────────────────────────────

await test('1. Route file exists at src/app/api/deals/[dealId]/audit-packet/route.ts', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, ROUTE)),
    `${ROUTE} does not exist.`,
  )
})

// ─── 2. HTTP method ───────────────────────────────────────────────────────────

await test('2. Route exports only a GET handler (no POST/PATCH/DELETE/PUT)', () => {
  const src = read(ROUTE)
  assert(
    src.includes('export async function GET'),
    `${ROUTE} must export a GET function.`,
  )
  const forbidden = ['export async function POST', 'export async function PATCH',
                     'export async function DELETE', 'export async function PUT']
  for (const verb of forbidden) {
    assert(!src.includes(verb), `${ROUTE} must not export ${verb} — audit-packet is read-only.`)
  }
})

// ─── 3-4. Auth ────────────────────────────────────────────────────────────────

await test('3. Route calls getAuthUser (auth cannot be skipped)', () => {
  const src = read(ROUTE)
  assert(src.includes('getAuthUser'), `${ROUTE} must call getAuthUser.`)
})

await test('4. Route calls requireDealAccess (deal-scope enforced)', () => {
  const src = read(ROUTE)
  assert(src.includes('requireDealAccess'), `${ROUTE} must call requireDealAccess.`)
})

// ─── 5. Contractor block ──────────────────────────────────────────────────────

await test("5. Route blocks contractors (role === 'contractor' branch present)", () => {
  const src = read(ROUTE)
  assert(
    src.includes("profile.role === 'contractor'"),
    `${ROUTE} must explicitly block contractor role from downloading the audit packet.`,
  )
})

// ─── 6-8. Secret exclusion ────────────────────────────────────────────────────

await test('6. Route never selects or returns api_key_hash', () => {
  const src = read(ROUTE)
  assert(
    !src.includes('api_key_hash'),
    `${ROUTE} must never select or return api_key_hash.`,
  )
})

await test('7. Route never selects or returns webhook_signing_secret', () => {
  const src = read(ROUTE)
  assert(
    !src.includes('webhook_signing_secret'),
    `${ROUTE} must never select or return webhook_signing_secret.`,
  )
})

await test('8. Route does not reference service-role or Stripe secret env vars', () => {
  const src = read(ROUTE)
  const forbidden = ['STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_WEBHOOK_SECRET']
  for (const secret of forbidden) {
    assert(
      !src.includes(secret),
      `${ROUTE} must not reference ${secret} — all secrets must flow through shared admin client.`,
    )
  }
})

// ─── 9. Read-only ─────────────────────────────────────────────────────────────

await test('9. Route is read-only (no INSERT, UPDATE, DELETE, UPSERT in code)', () => {
  const code = codeOnly(read(ROUTE))
  const forbidden = ['.insert(', '.update(', '.delete(', '.upsert(']
  for (const verb of forbidden) {
    assert(
      !code.includes(verb),
      `${ROUTE} must be read-only. Found write verb: ${verb}`,
    )
  }
})

// ─── 10. All 14 sections present ──────────────────────────────────────────────

await test('10. Route covers all 14 required packet sections', () => {
  const src = read(ROUTE)
  const required = [
    'packet_metadata',
    'deal_summary',
    'milestones',
    'releases',
    'billing_records',
    'transaction_receipts',
    'contracts',
    'lien_waivers',
    'change_orders',
    'milestone_documents',
    'retainage_releases',
    'reconciliation_issues',
    'audit_log',
    'closeout_summary',
  ]
  for (const section of required) {
    assert(
      src.includes(section),
      `${ROUTE} must include the '${section}' section in the packet.`,
    )
  }
})

// ─── 11-12. closeout_summary disclaimer ──────────────────────────────────────

await test('11. closeout_summary disclaimer uses tamper-evident (not tamper-proof)', () => {
  const src = read(ROUTE)
  assert(
    src.includes('tamper-evident'),
    `${ROUTE} closeout_summary disclaimer must use 'tamper-evident' not 'tamper-proof'.`,
  )
  assert(
    !src.includes('tamper-proof'),
    `${ROUTE} must not use 'tamper-proof' — say 'tamper-evident' instead.`,
  )
})

await test('12. closeout_summary disclaimer states Vektrum does not hold funds', () => {
  const src = read(ROUTE)
  assert(
    src.includes('does not hold') || src.includes('does not custody'),
    `${ROUTE} closeout_summary must include a disclaimer that Vektrum does not hold or custody funds.`,
  )
})

// ─── 13. Export is logged ─────────────────────────────────────────────────────

await test('13. Route logs the export via logAudit with audit_packet_exported action', () => {
  const src = read(ROUTE)
  assert(src.includes('logAudit'), `${ROUTE} must call logAudit to record the export.`)
  assert(
    src.includes('audit_packet_exported'),
    `${ROUTE} must use 'audit_packet_exported' as the audit action.`,
  )
})

// ─── 14. Partner projection ───────────────────────────────────────────────────

await test('14. Partner is projected to id+name only (no webhook_url, no key fields)', () => {
  const src = read(ROUTE)
  // Must select only id, name from partner
  assert(
    src.includes('( id, name )') || src.includes('(id, name)') ||
    src.includes('id, name'),
    `${ROUTE} must project partner to { id, name } only — no credentials or webhook_url.`,
  )
  // Must NOT select webhook_url directly from partners table join
  assert(
    !src.includes('webhook_url'),
    `${ROUTE} must not include webhook_url in the partner projection.`,
  )
})

// ─── 15. Admin client ─────────────────────────────────────────────────────────

await test('15. Route uses createSupabaseAdminClient for DB access', () => {
  const src = read(ROUTE)
  assert(
    src.includes('createSupabaseAdminClient'),
    `${ROUTE} must use createSupabaseAdminClient (admin bypass) to read all deal sections.`,
  )
})

// ─── 16. force-dynamic ───────────────────────────────────────────────────────

await test("16. Route sets dynamic = 'force-dynamic' (no static caching)", () => {
  const src = read(ROUTE)
  assert(
    src.includes("force-dynamic"),
    `${ROUTE} must set dynamic = 'force-dynamic' to prevent static caching of financial data.`,
  )
})

// ─── 17. Wired into npm test ──────────────────────────────────────────────────

await test('17. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('deal-audit-packet.test.ts'),
    `package.json npm test script must include 'deal-audit-packet.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Deal Audit Packet Export Tests')
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
