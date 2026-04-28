/**
 * External/manual rail billing model — copy and ADR tests.
 *
 * Static source-parse checks — no rendering, no live server.
 * Ensures the pricing page and ADR accurately document the billing model
 * for external/manual rail customers and do not make forbidden claims.
 *
 * Checks:
 *  1.  Pricing page mentions external/manual rail billing or invoicing.
 *  2.  Pricing page says Vektrum does not deduct fees from contractor
 *      disbursements on external/manual rails.
 *  3.  Pricing page does not say Vektrum holds funds.
 *  4.  Pricing page does not say Vektrum moves wires.
 *  5.  Pricing page does not say Vektrum is escrow or acts as a payment processor.
 *  6.  Pricing copy does not use the word "skim" or imply contractor-payment
 *      deduction for external/manual rails.
 *  7.  ADR file exists at docs/adr/ADR-001-external-manual-rail-billing.md.
 *  8.  ADR includes a Decision section.
 *  9.  ADR includes a Non-Goals section.
 * 10.  ADR explicitly states Vektrum does not deduct from contractor disbursements.
 * 11.  Pricing copy does not invent exact dollar prices for external rail
 *      without qualification (no hard-coded invoice amounts).
 * 12.  Pricing page references the "Keep your payment rail" or equivalent framing.
 *
 * Run:  npx tsx tests/external-rail-billing.test.ts
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

// Collapse JSX/markdown multi-line whitespace for string matching
function collapse(s: string): string {
  return s.replace(/\s+/g, ' ')
}

const PRICING_PAGE = 'src/app/pricing/page.tsx'
const ADR_FILE     = 'docs/adr/ADR-001-external-manual-rail-billing.md'

async function main() {

// ─── 1. External rail billing mentioned on pricing page ───────────────────────

await test('1. Pricing page mentions external/manual rail billing or invoicing', () => {
  const src = collapse(read(PRICING_PAGE))
  assert(
    src.toLowerCase().includes('external') &&
    (src.toLowerCase().includes('invoic') || src.toLowerCase().includes('billed')),
    `${PRICING_PAGE} must mention how external/manual rail customers are billed or invoiced.`,
  )
})

// ─── 2. No deduction from contractor payments ─────────────────────────────────

await test('2. Pricing page says Vektrum does not deduct fees from contractor disbursements', () => {
  const src = collapse(read(PRICING_PAGE))
  assert(
    src.toLowerCase().includes('does not deduct') ||
    src.toLowerCase().includes('not deduct fees'),
    `${PRICING_PAGE} must clearly say Vektrum does not deduct fees from contractor disbursements on external/manual rails.`,
  )
})

// ─── 3. Vektrum does not hold funds ──────────────────────────────────────────

await test('3. Pricing page does not say Vektrum holds funds', () => {
  const src = collapse(read(PRICING_PAGE))
  const forbidden = [
    'vektrum holds funds',
    'vektrum holds your funds',
    'funds held by vektrum',
    'vektrum-held funds',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${PRICING_PAGE} contains "${phrase}" — Vektrum does not hold funds. Remove this claim.`,
    )
  }
})

// ─── 4. No "Vektrum moves wires" claim ───────────────────────────────────────

await test('4. Pricing page does not say Vektrum moves wires', () => {
  const src = collapse(read(PRICING_PAGE))
  const forbidden = [
    'vektrum moves wires',
    'vektrum sends wires',
    'vektrum wires funds',
    'wire transfer via vektrum',
    'vektrum initiates the wire',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${PRICING_PAGE} contains "${phrase}" — Vektrum does not move wires. Remove this claim.`,
    )
  }
})

// ─── 5. No escrow / payment-processor claim ──────────────────────────────────

await test('5. Pricing page does not say Vektrum is escrow or a payment processor', () => {
  const src = collapse(read(PRICING_PAGE))
  const forbidden = [
    'vektrum is escrow',
    'vektrum acts as escrow',
    'vektrum is a payment processor',
    'escrow replacement',
    'escrow service',
    'escrow account',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${PRICING_PAGE} contains "${phrase}" — Vektrum must not be described as escrow or a payment processor.`,
    )
  }
})

// ─── 6. No "skim" or contractor-payment deduction language ───────────────────

await test('6. Pricing copy does not use "skim" or imply contractor-payment deduction for external rail', () => {
  const src = collapse(read(PRICING_PAGE))
  assert(
    !src.toLowerCase().includes('skim'),
    `${PRICING_PAGE} contains the word "skim" — remove it. Vektrum does not skim payments.`,
  )
  const deductionPhrases = [
    'deducted from the contractor',
    'deducted from contractor',
    'deduct from contractor',
    'taken from the contractor',
  ]
  for (const phrase of deductionPhrases) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${PRICING_PAGE} implies contractor-payment deduction with "${phrase}". Remove — Vektrum invoices the funder, not the contractor.`,
    )
  }
})

// ─── 7. ADR file exists ───────────────────────────────────────────────────────

await test('7. ADR file exists at docs/adr/ADR-001-external-manual-rail-billing.md', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, ADR_FILE)),
    `${ADR_FILE} does not exist. Create the ADR to document the external rail billing model decision.`,
  )
})

// ─── 8. ADR has a Decision section ───────────────────────────────────────────

await test('8. ADR includes a Decision section', () => {
  const src = read(ADR_FILE)
  assert(
    src.includes('## Decision') || src.includes('# Decision'),
    `${ADR_FILE} does not contain a Decision section. ADRs must document the decision made.`,
  )
})

// ─── 9. ADR has a Non-Goals section ──────────────────────────────────────────

await test('9. ADR includes a Non-Goals section', () => {
  const src = read(ADR_FILE)
  assert(
    src.includes('Non-Goal') || src.includes('non-goal'),
    `${ADR_FILE} does not contain a Non-Goals section. Document what the ADR explicitly does not authorize.`,
  )
})

// ─── 10. ADR explicitly forbids contractor-payment deduction ─────────────────

await test('10. ADR explicitly states Vektrum does not deduct from contractor disbursements', () => {
  const src = collapse(read(ADR_FILE))
  assert(
    src.toLowerCase().includes('does not deduct') ||
    src.toLowerCase().includes('not deduct fees') ||
    src.toLowerCase().includes('contractor-payment deduction'),
    `${ADR_FILE} must explicitly document that Vektrum does not deduct fees from contractor disbursements on external/manual rail.`,
  )
})

// ─── 11. No hard-coded unqualified invoice amounts for external rail ──────────

await test('11. Pricing copy does not invent hard-coded invoice amounts without qualification', () => {
  // The pricing page may show per-release fee examples (% × release amount).
  // It must NOT say things like "external rail invoiced at $X/month" with a specific
  // dollar figure that is not yet contracted.
  // We check that any dollar figures near "external" copy include "%" or are
  // clearly labeled as retainer rates (which are already defined in the card data).
  // This is a soft guard — it checks for fabricated monthly invoice amounts.
  const src = collapse(read(PRICING_PAGE))
  const fabricatedPhrases = [
    '$500/month for external',
    '$1,000/month for external',
    '$2,000 invoice for external',
    'flat fee of $',
  ]
  for (const phrase of fabricatedPhrases) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${PRICING_PAGE} appears to contain fabricated pricing: "${phrase}". Use "custom institutional pricing" or "contact us" for external rail pricing not yet contracted.`,
    )
  }
})

// ─── 12. "Keep your payment rail" framing ────────────────────────────────────

await test('12. Pricing page includes "Keep your payment rail" or equivalent framing', () => {
  const src = collapse(read(PRICING_PAGE))
  assert(
    src.includes('Keep your payment rail') ||
    src.toLowerCase().includes('keep your payment') ||
    src.toLowerCase().includes('your existing rail') ||
    src.toLowerCase().includes('your existing payment'),
    `${PRICING_PAGE} should include the "Keep your payment rail" framing for external/institutional rail customers. ` +
    `This communicates that Vektrum adds governance without replacing the customer's payment infrastructure.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — EXTERNAL RAIL BILLING COPY & ADR TEST RESULTS')
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
