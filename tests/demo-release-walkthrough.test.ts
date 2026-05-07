/**
 * tests/demo-release-walkthrough.test.ts
 *
 * Verifies the guided 6-step release walkthrough page safety and content.
 *
 *   1. Page exists at src/app/(marketing)/demo-live/walkthrough/page.tsx
 *   2. Page shows all 6 steps of the release cycle
 *   3. Lien waiver blocker scenario is present (step 3 → step 4 fix)
 *   4. No escrow/holds/moves-money/AI-approves language
 *   5. No real DB calls or auth imports
 *   6. Links back to demo-live landing page
 *   7. Wired into npm test
 *
 * Run: npx tsx tests/demo-release-walkthrough.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {

const PAGE_PATH = 'src/app/(marketing)/demo-live/walkthrough/page.tsx'
const PKG       = 'package.json'

// ── 1. Page exists ────────────────────────────────────────────────────────────

console.log('\n── 1. Walkthrough page exists ──────────────────────────────────────')

check(
  fs.existsSync(path.join(ROOT, PAGE_PATH)),
  `${PAGE_PATH} exists`,
)

const src = read(PAGE_PATH)

// ── 2. All 6 steps of the release cycle are present ──────────────────────────

console.log('\n── 2. All 6 steps are represented ──────────────────────────────────')

const stepIndicators = [
  // Step 1: contractor submits
  'contractor',
  // Step 2: AI review
  'Draw Control Brief',
  // Step 3: gate check / blocker
  'lien waiver',
  // Step 4: funder requests waiver
  'request',
  // Step 5: waiver uploaded / condition resolved
  'upload',
  // Step 6: authorization / audit proof
  'authorized',
]

for (const indicator of stepIndicators) {
  check(
    new RegExp(indicator, 'i').test(src),
    `Step content includes "${indicator}"`,
  )
}

// ── 3. Lien waiver blocker scenario is present ────────────────────────────────

console.log('\n── 3. Lien waiver blocker + resolution scenario present ────────────')

check(
  /lien waiver/i.test(src),
  'Page includes "lien waiver" blocker language',
)
check(
  /gate/i.test(src) || /condition/i.test(src),
  'Page references the release gate or conditions',
)
check(
  /10.*condition|condition.*10/i.test(src) || /10 conditions/i.test(src) || /ten conditions/i.test(src),
  'Page mentions the 10-condition release gate',
)

// ── 4. No prohibited product/legal claims ─────────────────────────────────────

console.log('\n── 4. No prohibited language ───────────────────────────────────────')

const prohibitedPhrases = [
  /Vektrum holds/i,
  /moves funds/i,
  /escrow replacement/i,
  /replaces.*escrow/i,
  /AI approves/i,
  /tamper-proof/i,
]

for (const re of prohibitedPhrases) {
  check(!re.test(src), `No prohibited phrase: ${re.source}`)
}

// ── 5. No real DB or auth imports ─────────────────────────────────────────────

console.log('\n── 5. No real DB or auth calls ─────────────────────────────────────')

check(
  !src.includes('@/lib/supabase'),
  'Page does not import Supabase client',
)
check(
  !src.includes('@/lib/auth'),
  'Page does not import auth middleware',
)
check(
  !src.includes('@/lib/stripe'),
  'Page does not import Stripe',
)

// ── 6. Links back to demo-live landing ────────────────────────────────────────

console.log('\n── 6. Navigation back to demo-live ─────────────────────────────────')

check(
  src.includes('/demo-live'),
  'Page links back to /demo-live',
)

// ── 7. Wired into npm test ────────────────────────────────────────────────────

console.log('\n── 7. Test wired into npm test ─────────────────────────────────────')

const pkg = read(PKG)
check(
  pkg.includes('demo-release-walkthrough.test.ts'),
  'demo-release-walkthrough.test.ts is wired into npm test',
)

console.log('\n✅  demo-release-walkthrough: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
