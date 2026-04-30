/**
 * Demo dispute resolution — static safety tests.
 *
 * No rendering, no live API. Parses source files and asserts hard guarantees
 * about the ResolveDisputeModal component and the harbor-dispute page so that
 * future edits cannot silently regress resolution behavior.
 *
 * Checks:
 *  1.  ResolveDisputeModal accepts disputedAmount prop.
 *  2.  ResolveDisputeModal onConfirm includes resolution type.
 *  3.  ResolveDisputeModal declares all three resolution values (reject/partial/full).
 *  4.  ResolveDisputeModal shows partial amount input when resolution === 'partial'.
 *  5.  ResolveDisputeModal validates partial amount > 0.
 *  6.  ResolveDisputeModal validates partial amount <= disputedAmount.
 *  7.  ResolveDisputeModal success message is resolution-specific (not hardcoded).
 *  8.  ResolveDisputeModal shows reject-specific success message.
 *  9.  ResolveDisputeModal shows full-release success message.
 * 10.  ResolveDisputeModal shows partial-specific success message (remaining held).
 * 11.  ResolveDisputeModal notification checkbox is NOT disabled.
 * 12.  ResolveDisputeModal shows notify message when checked.
 * 13.  ResolveDisputeModal shows no-notification message when unchecked.
 * 14.  ResolveDisputeModal textarea label is resolution-specific.
 * 15.  Harbor dispute page passes disputedAmount to ResolveDisputeModal.
 * 16.  Harbor dispute page onConfirm receives resolution and partialAmount.
 * 17.  Harbor dispute page shows PartialReleaseCard for partial resolution.
 * 18.  Harbor dispute page shows ResolvedCard for reject/full resolution.
 * 19.  ResolvedCard message is dynamic (no hardcoded "rejected" text in component).
 * 20.  PartialReleaseCard accepts releasedOverride and heldOverride props.
 * 21.  No production API calls — modal does not fetch /api/ routes.
 * 22.  No direct DB writes — modal does not call .insert/.update/.delete/.upsert.
 * 23.  Modal is demo-isolated — no import of production supabase client.
 * 24.  Harbor dispute page resets disputeOutcome to null in useDemoAutoReset.
 *
 * Run:  npx tsx tests/demo-dispute-resolution.test.ts
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

const MODAL        = 'src/components/demo/ResolveDisputeModal.tsx'
const HARBOR_PAGE  = 'src/app/(marketing)/demo-live/deal/harbor-dispute/page.tsx'

async function main() {

// ─── 1. Modal prop contract ───────────────────────────────────────────────────

await test('1. ResolveDisputeModal accepts disputedAmount prop', () => {
  const src = read(MODAL)
  assert(
    src.includes('disputedAmount'),
    'ResolveDisputeModal does not declare a disputedAmount prop.',
  )
  assert(
    src.includes('disputedAmount: number'),
    'ResolveDisputeModal does not type disputedAmount as number.',
  )
})

await test('2. ResolveDisputeModal onConfirm includes resolution type', () => {
  const src = read(MODAL)
  assert(
    /onConfirm\s*:\s*\(resolution/.test(src),
    'ResolveDisputeModal onConfirm signature does not include resolution parameter.',
  )
})

await test('3. ResolveDisputeModal declares all three resolution values', () => {
  const src = read(MODAL)
  assert(src.includes("'reject'"), "ResolveDisputeModal is missing 'reject' resolution option.")
  assert(src.includes("'partial'"), "ResolveDisputeModal is missing 'partial' resolution option.")
  assert(src.includes("'full'"), "ResolveDisputeModal is missing 'full' resolution option.")
})

// ─── 2. Partial amount input ──────────────────────────────────────────────────

await test('4. ResolveDisputeModal shows partial amount input conditionally', () => {
  const src = read(MODAL)
  assert(
    src.includes("resolution === 'partial'"),
    "ResolveDisputeModal does not conditionally render based on resolution === 'partial'.",
  )
  assert(
    src.includes('type="number"') || src.includes("type='number'"),
    'ResolveDisputeModal does not include a number input for partial amount.',
  )
})

await test('5. ResolveDisputeModal validates partial amount > 0', () => {
  const src = read(MODAL)
  assert(
    /parsed\s*<=\s*0|amt\s*<=\s*0|amount\s*<=\s*0/.test(src) ||
    src.includes('<= 0'),
    'ResolveDisputeModal does not validate that partial amount is > 0.',
  )
})

await test('6. ResolveDisputeModal validates partial amount <= disputedAmount', () => {
  const src = read(MODAL)
  assert(
    /parsed\s*>\s*disputedAmount|amt\s*>\s*disputedAmount|amount\s*>\s*disputedAmount/.test(src) ||
    src.includes('> disputedAmount'),
    'ResolveDisputeModal does not validate that partial amount <= disputedAmount.',
  )
})

// ─── 3. Resolution-specific success messages ──────────────────────────────────

await test('7. ResolveDisputeModal success message is resolution-specific', () => {
  const src = read(MODAL)
  // Should have a conditional on resolution for the success message
  assert(
    src.includes("resolution === 'reject'") && src.includes("resolution === 'full'"),
    'ResolveDisputeModal does not branch success message by resolution type.',
  )
})

await test('8. ResolveDisputeModal shows reject-specific success message', () => {
  const src = read(MODAL)
  assert(
    src.includes('returned to funded balance'),
    "ResolveDisputeModal does not include 'returned to funded balance' for reject resolution.",
  )
})

await test('9. ResolveDisputeModal shows full-release success message', () => {
  const src = read(MODAL)
  assert(
    src.includes('Dispute resolved'),
    "ResolveDisputeModal does not include 'Dispute resolved' for full-release success.",
  )
})

await test('10. ResolveDisputeModal shows partial-specific success message', () => {
  const src = read(MODAL)
  assert(
    src.includes('remaining held under dispute'),
    "ResolveDisputeModal does not include 'remaining held under dispute' in partial success message.",
  )
})

// ─── 4. Notification checkbox ─────────────────────────────────────────────────

await test('11. ResolveDisputeModal notification checkbox is not disabled', () => {
  const src = read(MODAL)
  // The checkbox should be interactive — must NOT have `disabled` attribute on the notify checkbox
  // We look for the notify checkbox block specifically
  const notifyBlock = src.slice(src.indexOf('notifyParties'))
  // The disabled keyword should not appear next to a checkbox for notify
  assert(
    !/<input[^>]*disabled[^>]*checkbox[^>]*>/.test(src) &&
    !/<input[^>]*checkbox[^>]*disabled[^>]*>/.test(src),
    'ResolveDisputeModal notification checkbox has a disabled attribute — it must be interactive.',
  )
  // And it should reference notifyParties state
  assert(
    src.includes('notifyParties') && src.includes('setNotifyParties'),
    'ResolveDisputeModal does not wire the notification checkbox to notifyParties state.',
  )
})

await test('12. ResolveDisputeModal shows "no real email" message when notified', () => {
  const src = read(MODAL)
  assert(
    src.includes('No real email was sent'),
    "ResolveDisputeModal does not show 'No real email was sent' when notify is checked.",
  )
})

await test('13. ResolveDisputeModal shows "No notification sent" when unchecked', () => {
  const src = read(MODAL)
  assert(
    src.includes('No notification sent in demo mode'),
    "ResolveDisputeModal does not show 'No notification sent in demo mode' when notify is unchecked.",
  )
})

// ─── 5. Textarea label ────────────────────────────────────────────────────────

await test('14. ResolveDisputeModal textarea label is resolution-specific', () => {
  const src = read(MODAL)
  assert(
    src.includes('textareaLabel') ||
    (src.includes('Rejection Reason') && src.includes('Resolution Notes') && src.includes('Partial Release Notes')),
    'ResolveDisputeModal does not use a resolution-specific textarea label.',
  )
})

// ─── 6. Harbor dispute page ───────────────────────────────────────────────────

await test('15. Harbor dispute page passes disputedAmount to ResolveDisputeModal', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('disputedAmount='),
    'harbor-dispute/page.tsx does not pass disputedAmount prop to ResolveDisputeModal.',
  )
  // Should use the milestone amount, not a hardcoded literal
  assert(
    src.includes('HVAC_MS.amount') || src.includes('ms.amount'),
    'harbor-dispute/page.tsx should derive disputedAmount from HVAC_MS.amount, not hardcode it.',
  )
})

await test('16. Harbor dispute page onConfirm receives resolution and partialAmount', () => {
  const src = read(HARBOR_PAGE)
  assert(
    /onConfirm=\{.*resolution.*partialAmount/.test(src.replace(/\s+/g, ' ')) ||
    /onConfirm=\{\(resolution/.test(src),
    'harbor-dispute/page.tsx onConfirm does not receive resolution and partialAmount from modal.',
  )
})

await test('17. Harbor dispute page shows PartialReleaseCard for partial resolution', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes("resolution === 'partial'") && src.includes('PartialReleaseCard'),
    "harbor-dispute/page.tsx does not render PartialReleaseCard for partial resolution.",
  )
})

await test('18. Harbor dispute page shows ResolvedCard for reject/full resolution', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('ResolvedCard') && src.includes('resolution={disputeOutcome'),
    'harbor-dispute/page.tsx does not pass resolution to ResolvedCard.',
  )
})

// ─── 7. Component message correctness ────────────────────────────────────────

await test('19. ResolvedCard message is dynamic (not hardcoded "rejected" only)', () => {
  const src = read(HARBOR_PAGE)
  // Find the ResolvedCard function
  const start = src.indexOf('function ResolvedCard')
  const end   = src.indexOf('\nfunction ', start + 1)
  const block = start >= 0 ? src.slice(start, end > 0 ? end : undefined) : ''
  assert(
    block.includes('resolution') && !block.includes("Claim rejected — $487,000"),
    'ResolvedCard still contains hardcoded "$487,000 rejected" message — should use resolution prop.',
  )
})

await test('20. PartialReleaseCard accepts releasedOverride and heldOverride props', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('releasedOverride') && src.includes('heldOverride'),
    'PartialReleaseCard does not accept releasedOverride and heldOverride props.',
  )
})

// ─── 8. Demo isolation — no production API calls or DB writes ─────────────────

await test('21. ResolveDisputeModal does not call production API routes', () => {
  const src = read(MODAL)
  assert(
    !src.includes('/api/'),
    'ResolveDisputeModal fetches a /api/ route — demo modal must be client-only, no real API calls.',
  )
})

await test('22. ResolveDisputeModal does not call DB write methods', () => {
  const code = codeOnly(read(MODAL))
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    const re = new RegExp(`\\.${verb}\\s*\\(`)
    assert(!re.test(code), `ResolveDisputeModal calls .${verb}() — demo component must not write to DB.`)
  }
})

await test('23. ResolveDisputeModal does not import production supabase client', () => {
  const src = read(MODAL)
  assert(
    !src.includes('@/lib/supabase'),
    'ResolveDisputeModal imports supabase client — demo component must be fully client-side.',
  )
})

await test('24. Harbor dispute page resets disputeOutcome to null in useDemoAutoReset', () => {
  const src = read(HARBOR_PAGE)
  assert(
    src.includes('setDisputeOutcome(null)'),
    'harbor-dispute/page.tsx does not reset disputeOutcome to null in useDemoAutoReset.',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — DEMO DISPUTE RESOLUTION SAFETY TEST RESULTS')
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
