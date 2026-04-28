/**
 * Demo activity log — static safety tests.
 *
 * No rendering, no live API. Parses source files and asserts hard guarantees
 * about the DemoActivityLog component, the useDemoActivityLog hook, and the
 * harbor-dispute page's activity logging wiring.
 *
 * Checks:
 *  1.  DemoActivityLog renders "Demo Activity Log" heading.
 *  2.  DemoActivityLog shows "Client-side demo only" disclaimer.
 *  3.  DemoActivityLog does not import the Supabase client.
 *  4.  DemoActivityLog does not call /api/ routes.
 *  5.  DemoActivityLog does not call DB write methods (.insert/.update/.delete/.upsert).
 *  6.  DemoActivityLog does not use "tamper-proof" language.
 *  7.  useDemoActivityLog hook is purely client-side (no Supabase, no fetch).
 *  8.  Harbor dispute page imports useDemoActivityLog.
 *  9.  Harbor dispute page imports DemoActivityLog.
 * 10.  Harbor dispute page renders DemoActivityLog with entries prop.
 * 11.  Harbor dispute page adds "AI Draw Review Requested" activity entry.
 * 12.  Harbor dispute page adds "AI Draw Review Completed" via onReviewComplete.
 * 13.  Harbor dispute page adds "Dispute Claim Rejected" activity entry.
 * 14.  Harbor dispute page adds "Dispute Resolved — Full Release" activity entry.
 * 15.  Harbor dispute page adds "Dispute Resolved — Partial Release" activity entry.
 * 16.  Harbor dispute page adds "Demo Notification Queued" activity entry.
 * 17.  Harbor dispute page adds "No Notification Sent" activity entry.
 * 18.  Harbor dispute page resets activity log in useDemoAutoReset.
 * 19.  AiReviewModal accepts onReviewComplete callback prop.
 * 20.  AiReviewModal calls onReviewComplete with score and risk.
 * 21.  ResolveDisputeModal onConfirm passes notifyParties to caller.
 * 22.  Harbor dispute page does not call /api/ routes for activity logging.
 * 23.  Harbor dispute page does not call production audit endpoints.
 * 24.  DemoActivityLog shows empty-state copy when no entries.
 *
 * Run:  npx tsx tests/demo-activity-log.test.ts
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

/** Strip comments and string literals — safety regexes only see executable code. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

const DEMO_LOG      = 'src/components/demo/DemoActivityLog.tsx'
const LOG_HOOK      = 'src/lib/demo-data/use-demo-activity-log.ts'
const HARBOR_PAGE   = 'src/app/demo-live/deal/harbor-dispute/page.tsx'
const AI_MODAL      = 'src/components/demo/AiReviewModal.tsx'
const RESOLVE_MODAL = 'src/components/demo/ResolveDisputeModal.tsx'

async function main() {

// ─── 1. DemoActivityLog component ────────────────────────────────────────────

await test('1. DemoActivityLog renders "Demo Activity Log" heading', () => {
  const src = read(DEMO_LOG)
  assert(
    src.includes('Demo Activity Log'),
    'DemoActivityLog.tsx does not render a "Demo Activity Log" heading.',
  )
})

await test('2. DemoActivityLog shows "Client-side demo only" disclaimer', () => {
  const src = read(DEMO_LOG)
  assert(
    src.includes('Client-side demo only') || src.includes('client-side demo only'),
    'DemoActivityLog.tsx does not show a "Client-side demo only" disclaimer.',
  )
})

await test('3. DemoActivityLog does not import Supabase client', () => {
  const src = read(DEMO_LOG)
  assert(
    !src.includes('@/lib/supabase'),
    'DemoActivityLog.tsx imports the Supabase client — this is a demo-only component.',
  )
})

await test('4. DemoActivityLog does not call /api/ routes', () => {
  const src = read(DEMO_LOG)
  assert(
    !src.includes('/api/'),
    'DemoActivityLog.tsx references a /api/ route — demo log must be client-side only.',
  )
})

await test('5. DemoActivityLog does not call DB write methods', () => {
  const code = codeOnly(read(DEMO_LOG))
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(code), `DemoActivityLog.tsx calls .${verb}() — must not touch the DB.`)
  }
})

await test('6. DemoActivityLog does not use "tamper-proof" language', () => {
  const src = read(DEMO_LOG)
  assert(
    !src.toLowerCase().includes('tamper-proof'),
    'DemoActivityLog.tsx uses "tamper-proof" — use "tamper-evident" only for the real production audit model.',
  )
})

// ─── 2. useDemoActivityLog hook ───────────────────────────────────────────────

await test('7. useDemoActivityLog hook has no Supabase or API calls', () => {
  const src = read(LOG_HOOK)
  assert(
    !src.includes('@/lib/supabase'),
    'use-demo-activity-log.ts imports Supabase — hook must be client-side only.',
  )
  assert(
    !src.includes('fetch('),
    'use-demo-activity-log.ts calls fetch() — hook must not make any network requests.',
  )
})

// ─── 3. Harbor dispute page wiring ───────────────────────────────────────────

await test('8. Harbor dispute page imports useDemoActivityLog', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('useDemoActivityLog'),
    'harbor-dispute/page.tsx does not import useDemoActivityLog.',
  )
})

await test('9. Harbor dispute page imports DemoActivityLog', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('DemoActivityLog'),
    'harbor-dispute/page.tsx does not import the DemoActivityLog component.',
  )
})

await test('10. Harbor dispute page renders DemoActivityLog with entries prop', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('<DemoActivityLog') && src.includes('entries='),
    'harbor-dispute/page.tsx does not render <DemoActivityLog entries={...} />.',
  )
})

// ─── 4. Activity log entries ──────────────────────────────────────────────────

await test('11. Harbor dispute page logs "AI Draw Review Requested"', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('AI Draw Review Requested'),
    'harbor-dispute/page.tsx does not add an "AI Draw Review Requested" activity entry.',
  )
})

await test('12. Harbor dispute page logs "AI Draw Review Completed" via onReviewComplete', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('onReviewComplete') && src.includes('AI Draw Review Completed'),
    'harbor-dispute/page.tsx does not add an "AI Draw Review Completed" entry via onReviewComplete.',
  )
})

await test('13. Harbor dispute page logs "Dispute Claim Rejected"', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('Dispute Claim Rejected'),
    'harbor-dispute/page.tsx does not add a "Dispute Claim Rejected" activity entry for reject resolution.',
  )
})

await test('14. Harbor dispute page logs "Dispute Resolved — Full Release"', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('Dispute Resolved — Full Release') ||
    src.includes("Dispute Resolved — Full Release"),
    'harbor-dispute/page.tsx does not add a "Dispute Resolved — Full Release" activity entry.',
  )
})

await test('15. Harbor dispute page logs "Dispute Resolved — Partial Release"', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('Dispute Resolved — Partial Release') ||
    src.includes("Dispute Resolved — Partial Release"),
    'harbor-dispute/page.tsx does not add a "Dispute Resolved — Partial Release" activity entry.',
  )
})

await test('16. Harbor dispute page logs "Demo Notification Queued" when notified', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('Demo Notification Queued'),
    'harbor-dispute/page.tsx does not add a "Demo Notification Queued" activity entry.',
  )
})

await test('17. Harbor dispute page logs "No Notification Sent" when unchecked', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('No Notification Sent'),
    'harbor-dispute/page.tsx does not add a "No Notification Sent" activity entry.',
  )
})

await test('18. Harbor dispute page resets activity log in useDemoAutoReset', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('resetLog()'),
    'harbor-dispute/page.tsx does not call resetLog() inside useDemoAutoReset.',
  )
})

// ─── 5. Modal callback extensions ────────────────────────────────────────────

await test('19. AiReviewModal accepts onReviewComplete callback prop', () => {
  const src = read(AI_MODAL)
  assert(
    src.includes('onReviewComplete'),
    'AiReviewModal.tsx does not declare an onReviewComplete prop.',
  )
})

await test('20. AiReviewModal calls onReviewComplete with score and risk', () => {
  const src = read(AI_MODAL)
  assert(
    /onReviewComplete\?\.\(.*score.*risk|onReviewComplete\?\.\(effectScore.*effectRisk/.test(src.replace(/\s+/g, ' ')),
    'AiReviewModal.tsx does not call onReviewComplete?(score, risk) when the review phase completes.',
  )
})

await test('21. ResolveDisputeModal onConfirm passes notifyParties to caller', () => {
  const src = read(RESOLVE_MODAL)
  assert(
    /onConfirm.*notifyParties/.test(src.replace(/\s+/g, ' ')),
    'ResolveDisputeModal.tsx onConfirm signature does not include notifyParties.',
  )
  assert(
    /onConfirm\(resolution.*notifyParties\)/.test(src.replace(/\s+/g, ' ')),
    'ResolveDisputeModal.tsx does not pass notifyParties to onConfirm at call site.',
  )
})

// ─── 6. Production safety ─────────────────────────────────────────────────────

await test('22. Harbor dispute page does not call /api/ routes for activity logging', () => {
  // The page can call /api/ routes for other reasons (none currently), but
  // the activity logging block specifically must not introduce any API calls.
  // We verify there is no fetch to audit, admin, releases, or email routes.
  const src = read(HARBOR_PAGE)
  assert(
    !src.includes('/api/audit'),
    'harbor-dispute/page.tsx calls /api/audit — activity log must be client-side only.',
  )
  assert(
    !src.includes('/api/admin'),
    'harbor-dispute/page.tsx calls /api/admin — activity log must be client-side only.',
  )
  assert(
    !src.includes('/api/releases'),
    'harbor-dispute/page.tsx calls /api/releases — activity log must be client-side only.',
  )
})

await test('23. Harbor dispute page does not import real audit engine', () => {
  const src = read(HARBOR_PAGE)
  assert(
    !src.includes('@/lib/engine/audit'),
    'harbor-dispute/page.tsx imports the real audit engine — demo pages must not touch production audit_log.',
  )
  assert(
    !src.includes('logAudit'),
    'harbor-dispute/page.tsx calls logAudit() — demo pages must not write to production audit_log.',
  )
})

await test('24. DemoActivityLog shows empty-state copy when no entries', () => {
  const src = read(DEMO_LOG)
  assert(
    src.includes('No activity yet') ||
    src.includes('no activity yet') ||
    src.includes('Perform an action') ||
    src.includes('perform an action'),
    'DemoActivityLog.tsx does not show an empty-state message when no entries are present.',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — DEMO ACTIVITY LOG SAFETY TEST RESULTS')
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
