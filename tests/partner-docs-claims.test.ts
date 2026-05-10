/**
 * tests/partner-docs-claims.test.ts
 *
 * Guards against overclaimed partner API documentation.
 *
 * Specific fixes verified:
 *   1. "immediately fires" webhook language removed (delivery is async + retried)
 *   2. "sandbox" isolation claims removed from partners/docs/page.tsx
 *   3. "sandbox" isolation claims removed from partners/page.tsx
 *   4. vkp_test_ keys are NOT described as accessing isolated sandbox data
 *   5. Pre-go-live checklist uses "test deal" not "sandbox release"
 *
 * Run: npx tsx tests/partner-docs-claims.test.ts
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

const PARTNERS_PAGE = 'src/app/(marketing)/partners/page.tsx'
const DOCS_PAGE     = 'src/app/(marketing)/partners/docs/page.tsx'

async function main() {

console.log('\n── 1. partners/page: webhook delivery claim ────────────────────────────')

const partnersSrc = read(PARTNERS_PAGE)

check(
  !partnersSrc.includes('immediately fires'),
  'partners/page does not claim "immediately fires" a webhook (delivery is async)',
)
check(
  !(/immediately\s+fires/i.test(partnersSrc)),
  'partners/page does not contain "immediately fires" in any case',
)
check(
  partnersSrc.includes('delivers a signed release.authorized webhook') ||
  partnersSrc.includes('delivers a signed'),
  'partners/page uses accurate delivery language (e.g. "delivers a signed webhook")',
)

console.log('\n── 2. partners/page: sandbox isolation claims ──────────────────────────')

// "sandbox releases" is the specific overclaim — isolated test environment that doesn't exist
check(
  !partnersSrc.includes('sandbox releases'),
  'partners/page does not reference "sandbox releases" (no isolated sandbox environment exists)',
)
check(
  !partnersSrc.includes('Sandbox testing'),
  'partners/page section header does not say "Sandbox testing"',
)

console.log('\n── 3. partners/docs: sandbox release checklist items removed ───────────')

const docsSrc = read(DOCS_PAGE)

check(
  !docsSrc.includes('sandbox release'),
  'partners/docs checklist does not reference "sandbox release"',
)
check(
  !docsSrc.includes('Tested confirm endpoint with a sandbox release'),
  'partners/docs does not claim "Tested confirm endpoint with a sandbox release"',
)
check(
  !docsSrc.includes('Tested fail endpoint with a sandbox release'),
  'partners/docs does not claim "Tested fail endpoint with a sandbox release"',
)

console.log('\n── 4. partners/docs: vkp_test_ key description is accurate ─────────────')

// vkp_test_ should not be described as accessing a separate/isolated sandbox
check(
  !docsSrc.includes('for sandbox'),
  'partners/docs does not describe vkp_test_ as "for sandbox" (no isolated sandbox exists)',
)
check(
  docsSrc.includes('vkp_test_'),
  'partners/docs still documents the vkp_test_ key prefix (useful naming convention)',
)
// Must clarify that both key types share the same data environment
check(
  docsSrc.includes('test deals') || docsSrc.includes('dedicated test deal') ||
  docsSrc.includes('same data environment') || docsSrc.includes('development and integration testing'),
  'partners/docs clarifies that test keys share the production data environment',
)

console.log('\n── 5. partners/docs: checklist uses accurate test language ─────────────')

check(
  docsSrc.includes('test deal') || docsSrc.includes('dedicated test'),
  'partners/docs pre-go-live checklist uses "test deal" or "dedicated test" language',
)

console.log('\n✅  partner-docs-claims: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
