/**
 * Contractor deal-creation & funder invite — authority-model copy tests.
 *
 * Static source-parse checks — no rendering, no live server.
 * Ensures the contractor deal-creation page and invite funder panel
 * accurately reflect who controls what:
 *   - Funder verifies terms and authorizes releases.
 *   - Contractor proposes retainage; does not control release.
 *   - Vektrum records retainage but does not hold funds, act as escrow, or
 *     approve releases with AI.
 *
 * Checks:
 *  1.  Retainage heading is "Contract Retainage Term" (contractor view).
 *  2.  Retainage copy includes "funder will verify".
 *  3.  Retainage copy includes "does not hold funds".
 *  4.  Retainage copy includes "Contractors cannot release retainage".
 *  5.  Post-submit helper text says funder "verify terms" and "release authorization".
 *  6.  Invite funder panel says funder manages "release authorization".
 *  7.  No copy implies Vektrum holds funds, acts as escrow, or moves wires.
 *  8.  No copy implies AI approves payments or releases.
 *
 * Run:  npx tsx tests/contractor-deal-authority.test.ts
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

const NEW_DEAL_PAGE  = 'src/app/(app)/dashboard/deals/new/page.tsx'
const DEAL_PAGE      = 'src/app/(app)/dashboard/deals/[dealId]/page.tsx'

async function main() {

// ─── 1. Retainage heading ─────────────────────────────────────────────────────

await test('1. Retainage heading is "Contract Retainage Term"', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Contract Retainage Term'),
    `${NEW_DEAL_PAGE} retainage heading should be "Contract Retainage Term", not "Retainage Withholding".`,
  )
  assert(
    !src.includes('Retainage Withholding'),
    `${NEW_DEAL_PAGE} still contains "Retainage Withholding" — replace with "Contract Retainage Term".`,
  )
})

// ─── 2. Funder verifies retainage ────────────────────────────────────────────

await test('2. Retainage copy says funder will verify', () => {
  const src = read(NEW_DEAL_PAGE)
  // JSX source wraps across lines; collapse whitespace before matching
  const collapsed = src.replace(/\s+/g, ' ')
  assert(
    collapsed.toLowerCase().includes('funder will verify'),
    `${NEW_DEAL_PAGE} retainage description must say the funder will verify before releases.`,
  )
})

// ─── 3. Vektrum records but does not hold funds ───────────────────────────────

await test('3. Retainage copy says Vektrum does not hold funds', () => {
  const src = read(NEW_DEAL_PAGE)
  const collapsed = src.replace(/\s+/g, ' ')
  assert(
    collapsed.includes('does not hold funds'),
    `${NEW_DEAL_PAGE} retainage description must say Vektrum does not hold funds.`,
  )
})

// ─── 4. Contractors cannot release retainage ─────────────────────────────────

await test('4. Retainage copy says "Contractors cannot release retainage"', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('Contractors cannot release retainage'),
    `${NEW_DEAL_PAGE} retainage section must explicitly say "Contractors cannot release retainage".`,
  )
})

// ─── 5. Post-submit helper text ───────────────────────────────────────────────

await test('5. Post-submit helper text mentions "verify terms" and "release authorization"', () => {
  const src = read(NEW_DEAL_PAGE)
  assert(
    src.includes('verify terms') || src.toLowerCase().includes('verify terms'),
    `${NEW_DEAL_PAGE} post-submit helper text must mention funder "verify terms".`,
  )
  assert(
    src.includes('release authorization') || src.toLowerCase().includes('release authorization'),
    `${NEW_DEAL_PAGE} post-submit helper text must mention "release authorization".`,
  )
})

// ─── 6. Invite funder panel authority copy ────────────────────────────────────

await test('6. Invite funder panel says funder manages "release authorization"', () => {
  const src = read(DEAL_PAGE)
  assert(
    src.includes('release authorization'),
    `${DEAL_PAGE} invite funder panel must say funder manages "release authorization".`,
  )
  // Must NOT say only "funding the project" as primary authority framing
  // (acceptable if it appears elsewhere but invite panel should add the authorization framing)
})

// ─── 7. No fund-holding / escrow / wire claims ────────────────────────────────

await test('7. No copy implies Vektrum holds funds, acts as escrow, or moves wires', () => {
  const newSrc  = read(NEW_DEAL_PAGE)
  const dealSrc = read(DEAL_PAGE)

  const combined = newSrc + '\n' + dealSrc

  const forbidden = [
    'Vektrum holds',
    'Vektrum-managed account',
    'escrow account',
    'trust account',
    'moves wires',
    'wire transfer via Vektrum',
  ]
  for (const phrase of forbidden) {
    assert(
      !combined.toLowerCase().includes(phrase.toLowerCase()),
      `Found forbidden phrase "${phrase}" — Vektrum must not be positioned as escrow, a fund holder, or wire mover.`,
    )
  }
})

// ─── 8. No AI-approves-payments claim ────────────────────────────────────────

await test('8. No copy implies AI approves payments or releases', () => {
  const newSrc  = read(NEW_DEAL_PAGE)
  const dealSrc = read(DEAL_PAGE)

  const combined = newSrc + '\n' + dealSrc

  const forbidden = [
    'AI approves',
    'AI-approved',
    'AI will approve',
    'automatically approved by',
  ]
  for (const phrase of forbidden) {
    assert(
      !combined.toLowerCase().includes(phrase.toLowerCase()),
      `Found forbidden phrase "${phrase}" — AI informs; the gate decides. AI must not be described as approving payments.`,
    )
  }
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — CONTRACTOR DEAL AUTHORITY COPY TEST RESULTS')
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
