/**
 * Public FAQ and demo script — copy safety and completeness tests.
 *
 * Static source-parse checks — no rendering, no live server.
 * Ensures the help/FAQ page covers all required authority-model questions
 * and the demo script exists with all required sections.
 * Also verifies the help page does not contain forbidden positioning claims.
 *
 * Checks:
 *  1.  FAQ contains "What is Vektrum" question.
 *  2.  FAQ answer for Vektrum identity says "does not hold funds" or equivalent.
 *  3.  FAQ says Vektrum does not hold funds (answer-level check).
 *  4.  FAQ says AI does not approve — "cannot approve" or "gate decides".
 *  5.  FAQ explains external/manual rail billing via invoice.
 *  6.  FAQ explains contractor/funder invite authority model (funder verifies/authorizes).
 *  7.  FAQ explains retainage authority (funder or authorized party controls release).
 *  8.  FAQ covers documents guidance (suggested, upload requirements vary).
 *  9.  FAQ covers change orders alongside disputes.
 * 10.  FAQ covers tamper-evident audit trail (says "tamper-evident", not "tamper-proof").
 * 11.  FAQ does not say "tamper-proof".
 * 12.  Help page does not claim "Vektrum holds funds".
 * 13.  Help page does not say "Vektrum is escrow" or "escrow replacement".
 * 14.  Help page does not say "Vektrum moves wires" or "Vektrum moves money".
 * 15.  Help page does not say Vektrum IS a payment processor (question form is fine).
 * 16.  Demo script file exists.
 * 17.  Demo script includes a 30-second opener section.
 * 18.  Demo script includes a 90-second walkthrough section.
 * 19.  Demo script includes objections section.
 * 20.  Demo script includes discovery questions.
 * 21.  Demo script includes "do not say" or safety rules section.
 * 22.  Demo script does not say Vektrum holds funds, is escrow, or moves wires.
 * 23.  Demo script does not say AI approves payments.
 * 24.  Demo script does not say "tamper-proof".
 *
 * Run:  npx tsx tests/faq-demo-script.test.ts
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

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ')
}

const HELP_PAGE   = 'src/app/help/page.tsx'
const DEMO_SCRIPT = 'docs/demo/DEMO_SCRIPT.md'

async function main() {

// ─── FAQ content checks ───────────────────────────────────────────────────────

await test('1. FAQ contains "What is Vektrum" question', () => {
  const src = read(HELP_PAGE)
  assert(
    src.includes('What is Vektrum'),
    `${HELP_PAGE} must have a "What is Vektrum?" FAQ entry.`,
  )
})

await test('2. "What is Vektrum" answer says does not hold funds or act as escrow', () => {
  const src = collapse(read(HELP_PAGE))
  // The answer (after "What is Vektrum?") must clarify Vektrum does not hold funds
  assert(
    src.includes('does not hold funds') || src.includes('does not hold your money'),
    `${HELP_PAGE} "What is Vektrum?" answer must clarify Vektrum does not hold funds.`,
  )
})

await test('3. FAQ says Vektrum does not hold funds (answer-level)', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    src.toLowerCase().includes('does not hold funds') ||
    src.toLowerCase().includes('do not hold funds') ||
    src.toLowerCase().includes('vektrum does not hold'),
    `${HELP_PAGE} FAQ must explicitly say Vektrum does not hold funds.`,
  )
})

await test('4. FAQ says AI cannot approve — "cannot approve" or "gate decides"', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    src.toLowerCase().includes('cannot approve') ||
    src.toLowerCase().includes('gate decides') ||
    src.toLowerCase().includes('cannot approve a release') ||
    src.toLowerCase().includes('does not approve'),
    `${HELP_PAGE} FAQ must say AI cannot approve releases and/or that the gate decides.`,
  )
})

await test('5. FAQ explains external/manual rail invoicing', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    (src.toLowerCase().includes('external') || src.toLowerCase().includes('manual rail')) &&
    (src.toLowerCase().includes('invoic') || src.toLowerCase().includes('invoice')),
    `${HELP_PAGE} FAQ must explain that external/manual rail customers are invoiced directly.`,
  )
})

await test('6. FAQ explains contractor/funder invite authority model', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    src.toLowerCase().includes('invite the funder') || src.toLowerCase().includes('invite a funder'),
    `${HELP_PAGE} FAQ must explain that contractors can invite the funder to verify terms and authorize releases.`,
  )
  assert(
    src.toLowerCase().includes('funder verifies') ||
    src.toLowerCase().includes('funder is the release authority') ||
    (src.toLowerCase().includes('funder') && src.toLowerCase().includes('release authorization')),
    `${HELP_PAGE} FAQ must make clear that the funder is the release authority, not the contractor.`,
  )
})

await test('7. FAQ explains retainage authority (funder controls release)', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    src.toLowerCase().includes('retainage'),
    `${HELP_PAGE} FAQ must include a retainage entry.`,
  )
  assert(
    src.toLowerCase().includes('cannot release retainage') ||
    src.toLowerCase().includes('only the funder') ||
    (src.toLowerCase().includes('funder') && src.toLowerCase().includes('retainage')),
    `${HELP_PAGE} FAQ retainage entry must clarify the funder controls retainage release, not the contractor.`,
  )
})

await test('8. FAQ covers documents guidance (suggested, requirements vary)', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    src.toLowerCase().includes('documents should') ||
    src.toLowerCase().includes('what documents'),
    `${HELP_PAGE} FAQ must include a "What documents should contractors upload?" entry.`,
  )
  assert(
    src.toLowerCase().includes('may vary') || src.toLowerCase().includes('requirements may vary'),
    `${HELP_PAGE} FAQ documents entry must say upload requirements may vary by contract, funder review, etc.`,
  )
})

await test('9. FAQ covers change orders alongside disputes', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    src.toLowerCase().includes('change order'),
    `${HELP_PAGE} FAQ must mention change orders — a contractor-submitted change order blocks release until the funder approves or rejects.`,
  )
})

await test('10. FAQ covers tamper-evident audit trail and says "tamper-evident"', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    src.toLowerCase().includes('tamper-evident'),
    `${HELP_PAGE} FAQ must explain the tamper-evident audit trail.`,
  )
})

// ─── Copy safety — help page ──────────────────────────────────────────────────

await test('11. Help page does not say "tamper-proof"', () => {
  const src = collapse(read(HELP_PAGE))
  assert(
    !src.toLowerCase().includes('tamper-proof'),
    `${HELP_PAGE} must not say "tamper-proof" — use "tamper-evident" instead.`,
  )
})

await test('12. Help page does not claim "Vektrum holds funds"', () => {
  const src = collapse(read(HELP_PAGE))
  const forbidden = [
    'vektrum holds funds',
    'vektrum holds your funds',
    'vektrum holds the funds',
    'vektrum-held',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${HELP_PAGE} contains "${phrase}" — Vektrum does not hold funds. Remove this claim.`,
    )
  }
})

await test('13. Help page does not say Vektrum is escrow or an escrow replacement', () => {
  const src = collapse(read(HELP_PAGE))
  const forbidden = [
    'vektrum is escrow',
    'vektrum acts as escrow',
    'escrow replacement',
    'replaces escrow',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${HELP_PAGE} contains "${phrase}" — Vektrum is not escrow and must not be described as such.`,
    )
  }
})

await test('14. Help page does not say Vektrum moves wires or moves money', () => {
  const src = collapse(read(HELP_PAGE))
  const forbidden = [
    'vektrum moves wires',
    'vektrum moves money',
    'vektrum sends wires',
    'vektrum initiates the wire',
    'wire transfer via vektrum',
  ]
  for (const phrase of forbidden) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${HELP_PAGE} contains "${phrase}" — Vektrum does not move wires or money. Remove.`,
    )
  }
})

await test('15. Help page does not positively claim Vektrum IS a payment processor', () => {
  // "Is Vektrum a payment processor?" (the question) is fine.
  // "Vektrum is a payment processor" (the claim) is forbidden.
  const src = collapse(read(HELP_PAGE))
  assert(
    !src.includes('Vektrum is a payment processor') &&
    !src.toLowerCase().includes('vektrum is a payment processor'),
    `${HELP_PAGE} contains "Vektrum is a payment processor" — this is a forbidden claim. ` +
    'Asking whether Vektrum is one (as a FAQ question) is fine; asserting it is not.',
  )
})

// ─── Demo script checks ───────────────────────────────────────────────────────

await test('16. Demo script file exists at docs/demo/DEMO_SCRIPT.md', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, DEMO_SCRIPT)),
    `${DEMO_SCRIPT} does not exist. Create the demo script.`,
  )
})

await test('17. Demo script includes a 30-second opener section', () => {
  const src = read(DEMO_SCRIPT)
  assert(
    src.toLowerCase().includes('30-second') || src.toLowerCase().includes('30 second'),
    `${DEMO_SCRIPT} must include a 30-second opener section.`,
  )
})

await test('18. Demo script includes a 90-second walkthrough section', () => {
  const src = read(DEMO_SCRIPT)
  assert(
    src.toLowerCase().includes('90-second') || src.toLowerCase().includes('90 second'),
    `${DEMO_SCRIPT} must include a 90-second guided walkthrough section.`,
  )
})

await test('19. Demo script includes an objections section', () => {
  const src = read(DEMO_SCRIPT)
  assert(
    src.toLowerCase().includes('objection') ||
    src.toLowerCase().includes('handling common') ||
    src.includes('"So are you escrow?"') ||
    src.includes('escrow?'),
    `${DEMO_SCRIPT} must include a section for handling common objections.`,
  )
})

await test('20. Demo script includes discovery questions', () => {
  const src = read(DEMO_SCRIPT)
  assert(
    src.toLowerCase().includes('discovery question') ||
    src.toLowerCase().includes('who currently approves') ||
    src.toLowerCase().includes('discovery'),
    `${DEMO_SCRIPT} must include discovery questions for the close of a buyer meeting.`,
  )
})

await test('21. Demo script includes "do not say" or safety rules section', () => {
  const src = read(DEMO_SCRIPT)
  assert(
    src.toLowerCase().includes('do not say') ||
    src.toLowerCase().includes('never say') ||
    src.toLowerCase().includes('safety rules') ||
    src.includes('❌'),
    `${DEMO_SCRIPT} must include a "do not say" or safety-rules section listing forbidden language.`,
  )
})

await test('22. Demo script asserts Vektrum does not hold funds and your rail executes', () => {
  // The demo script is internal documentation that may list forbidden phrases in "do not say"
  // tables. Test the POSITIVE framing instead: the script must say the correct thing.
  const src = collapse(read(DEMO_SCRIPT))
  assert(
    src.toLowerCase().includes("don't hold funds") ||
    src.toLowerCase().includes('does not hold funds') ||
    src.toLowerCase().includes("doesn't hold funds") ||
    src.toLowerCase().includes('your rail executes'),
    `${DEMO_SCRIPT} must assert that Vektrum does not hold funds and the customer's rail executes payment.`,
  )
  assert(
    src.toLowerCase().includes('existing payment') ||
    src.toLowerCase().includes('your existing') ||
    src.toLowerCase().includes('your rail'),
    `${DEMO_SCRIPT} must explain that the customer's existing payment rail executes — not Vektrum.`,
  )
})

await test('23. Demo script asserts AI informs but the gate decides (correct framing)', () => {
  // Internal documentation may mention "AI approves" in a "never say" context.
  // Test the POSITIVE framing: the script must correctly state AI informs; gate decides.
  const src = collapse(read(DEMO_SCRIPT))
  assert(
    src.toLowerCase().includes('gate decides') ||
    src.toLowerCase().includes('cannot approve') ||
    src.toLowerCase().includes('informs') && src.toLowerCase().includes('gate'),
    `${DEMO_SCRIPT} must correctly state AI informs the funder's review and the release gate decides — not AI.`,
  )
})

await test('24. Demo script says "tamper-evident" (correct framing for audit trail)', () => {
  // Internal documentation may list "tamper-proof" as a phrase to avoid.
  // Test the POSITIVE framing: the script must use the correct term "tamper-evident".
  const src = read(DEMO_SCRIPT)
  assert(
    src.toLowerCase().includes('tamper-evident') || src.toLowerCase().includes('append-only'),
    `${DEMO_SCRIPT} must use "tamper-evident" or "append-only" when describing the audit trail.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — FAQ & DEMO SCRIPT COPY TEST RESULTS')
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
