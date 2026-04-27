/**
 * Demo-live fresh-state architecture tests
 *
 * Pins two changes that close the "demo can appear completed" leak:
 *
 *   1. useDemoAutoReset now also resets on bfcache restore. Without this,
 *      Browser back/forward into the demo can restore the page wholesale
 *      from the back/forward cache with all useState retained — a previous
 *      visitor's released milestone, appended activity rows, and open
 *      modals would visibly persist.
 *
 *   2. Canonical demo data is now exposed via fresh-deal factories that
 *      return deep clones. The 4 dedicated client demo deal pages use the
 *      factories at mount time so any future mutation cannot leak across
 *      mounts or back into the shared canonical exports.
 *
 *   A. BFCACHE RESET
 *      A1. useDemoAutoReset listens for `pageshow`
 *      A2. The pageshow handler checks `event.persisted` (so initial loads
 *          do not double-reset)
 *      A3. The pageshow handler is removed in the cleanup callback
 *
 *   B. FACTORIES
 *      B1. demo-data exports getFreshHarborDeal / Riverside / Westside /
 *          HarborDisputeMilestones
 *      B2. Each factory returns a value that is NOT === the canonical export
 *      B3. Each factory returns a deep clone — mutating the returned value
 *          does not affect the canonical export
 *      B4. Each factory preserves all canonical data (deep equality)
 *
 *   C. PAGE INTEGRATION
 *      C1. harbor/page.tsx uses getFreshHarborDeal (no direct `harbor` ref)
 *      C2. riverside/page.tsx uses getFreshRiversideDeal
 *      C3. westside/page.tsx uses getFreshWestsideDeal
 *      C4. harbor-dispute/page.tsx uses getFreshHarborDisputeMilestones
 *      C5. Each of those pages calls the factory inside useMemo so the
 *          clone is created per-mount, not once per module load
 *
 *   D. NO PERSISTENCE
 *      D1. No demo file declares localStorage, sessionStorage, or
 *          document.cookie writes (already pinned in demo-reset-safety,
 *          re-asserted here for the fresh-state contract)
 *      D2. The 4 dedicated demo deal pages do not import the canonical
 *          objects directly (only via factories)
 *
 * Run:  npx tsx tests/demo-fresh-state.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import {
  harbor,
  riverside,
  westside,
  harborDisputeMilestones,
  getFreshHarborDeal,
  getFreshRiversideDeal,
  getFreshWestsideDeal,
  getFreshHarborDisputeMilestones,
} from '../src/lib/demo-data/index'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function src(rel: string) {
  return readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

const HOOK             = src('src/lib/demo-data/use-demo-auto-reset.ts')
const HARBOR_PAGE      = src('src/app/demo-live/deal/harbor/page.tsx')
const RIVERSIDE_PAGE   = src('src/app/demo-live/deal/riverside/page.tsx')
const WESTSIDE_PAGE    = src('src/app/demo-live/deal/westside/page.tsx')
const DISPUTE_PAGE     = src('src/app/demo-live/deal/harbor-dispute/page.tsx')

const results: { name: string; passed: boolean; error?: string }[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    results.push({ name, passed: true })
  } catch (e) {
    results.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) })
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// ─── A. BFCACHE RESET ────────────────────────────────────────────────────────

test('A1: useDemoAutoReset registers a pageshow listener', () => {
  assert(
    HOOK.includes("addEventListener('pageshow'") || HOOK.includes('addEventListener("pageshow"'),
    'useDemoAutoReset must add a pageshow listener to reset on bfcache restore',
  )
})

test('A2: pageshow handler checks event.persisted', () => {
  // The handler must fire onReset only on bfcache restores
  // (event.persisted === true), never on the initial page load.
  assert(
    HOOK.includes('event.persisted'),
    'pageshow handler must check event.persisted so initial loads do not double-reset',
  )
})

test('A3: pageshow listener is removed on cleanup', () => {
  assert(
    HOOK.includes("removeEventListener('pageshow'") || HOOK.includes('removeEventListener("pageshow"'),
    'pageshow listener must be removed in the useEffect cleanup callback',
  )
})

// ─── B. FACTORIES ────────────────────────────────────────────────────────────

test('B1: demo-data exports all four fresh-deal factories', () => {
  assert(typeof getFreshHarborDeal === 'function',           'getFreshHarborDeal not exported')
  assert(typeof getFreshRiversideDeal === 'function',        'getFreshRiversideDeal not exported')
  assert(typeof getFreshWestsideDeal === 'function',         'getFreshWestsideDeal not exported')
  assert(typeof getFreshHarborDisputeMilestones === 'function',
    'getFreshHarborDisputeMilestones not exported')
})

test('B2: each factory returns a fresh top-level reference (not === canonical)', () => {
  assert(getFreshHarborDeal()    !== harbor,    'getFreshHarborDeal returned the canonical reference')
  assert(getFreshRiversideDeal() !== riverside, 'getFreshRiversideDeal returned the canonical reference')
  assert(getFreshWestsideDeal()  !== westside,  'getFreshWestsideDeal returned the canonical reference')
  assert(getFreshHarborDisputeMilestones() !== harborDisputeMilestones,
    'getFreshHarborDisputeMilestones returned the canonical reference')
})

test('B3: factories return DEEP clones — mutating result does not affect canonical', () => {
  // Snapshot canonical state first.
  const canonicalHarborSteelStatus = harbor.milestones.find((m) => m.id === 'ms-hb-3')!.status
  const canonicalRiversideMs1Name  = riverside.milestones[0].name
  const canonicalWestsideTotal     = westside.total
  const canonicalHvacAmount        = harborDisputeMilestones.find((m) => m.id === 'ms-hbd-5')!.amount

  // Mutate clones aggressively.
  const h = getFreshHarborDeal()
  h.milestones.find((m) => m.id === 'ms-hb-3')!.status = 'released'
  h.released = 99_999_999

  const r = getFreshRiversideDeal()
  r.milestones[0].name = 'TAMPERED'

  const w = getFreshWestsideDeal()
  w.total = 0

  const d = getFreshHarborDisputeMilestones()
  d.find((m) => m.id === 'ms-hbd-5')!.amount = 0

  // Canonical state must remain identical.
  assert(
    harbor.milestones.find((m) => m.id === 'ms-hb-3')!.status === canonicalHarborSteelStatus,
    `Mutating Harbor clone leaked into canonical (status changed to "${harbor.milestones.find((m) => m.id === 'ms-hb-3')!.status}")`,
  )
  assert(
    harbor.released !== 99_999_999,
    'Mutating Harbor clone leaked into canonical (released changed)',
  )
  assert(
    riverside.milestones[0].name === canonicalRiversideMs1Name,
    'Mutating Riverside clone leaked into canonical (milestone name changed)',
  )
  assert(
    westside.total === canonicalWestsideTotal,
    'Mutating Westside clone leaked into canonical (total changed)',
  )
  assert(
    harborDisputeMilestones.find((m) => m.id === 'ms-hbd-5')!.amount === canonicalHvacAmount,
    'Mutating dispute milestones clone leaked into canonical (HVAC amount changed)',
  )
})

test('B4: factory output is structurally equal to canonical at first call', () => {
  // After any prior tests, the canonical export must still be intact and
  // a fresh factory call must produce a JSON-equal copy.
  assert(
    JSON.stringify(getFreshHarborDeal()) === JSON.stringify(harbor),
    'getFreshHarborDeal output is not structurally equal to the canonical Harbor export',
  )
  assert(
    JSON.stringify(getFreshRiversideDeal()) === JSON.stringify(riverside),
    'getFreshRiversideDeal output is not structurally equal to canonical',
  )
  assert(
    JSON.stringify(getFreshWestsideDeal()) === JSON.stringify(westside),
    'getFreshWestsideDeal output is not structurally equal to canonical',
  )
  assert(
    JSON.stringify(getFreshHarborDisputeMilestones()) === JSON.stringify(harborDisputeMilestones),
    'getFreshHarborDisputeMilestones output is not structurally equal to canonical',
  )
})

// ─── C. PAGE INTEGRATION ─────────────────────────────────────────────────────

test('C1: harbor/page.tsx uses getFreshHarborDeal (no direct `harbor` import)', () => {
  assert(
    HARBOR_PAGE.includes('getFreshHarborDeal'),
    'harbor/page.tsx does not import or call getFreshHarborDeal',
  )
  // The factory call must be inside useMemo so each mount gets its own clone.
  assert(
    HARBOR_PAGE.includes('useMemo(() => getFreshHarborDeal()'),
    'harbor/page.tsx must call getFreshHarborDeal inside useMemo (per-mount clone)',
  )
  // The previous module-level `const deal = harbor` pattern must be gone.
  // We check for the literal pattern in code (excluding comments) so the
  // factory is the only data source.
  const codeOnly = HARBOR_PAGE
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
    })
    .join('\n')
  assert(
    !/^\s*const deal = harbor\b/m.test(codeOnly),
    'harbor/page.tsx still has `const deal = harbor` — must use the fresh-deal factory',
  )
})

test('C2: riverside/page.tsx uses getFreshRiversideDeal in useMemo', () => {
  assert(
    RIVERSIDE_PAGE.includes('getFreshRiversideDeal') &&
    RIVERSIDE_PAGE.includes('useMemo(() => getFreshRiversideDeal()'),
    'riverside/page.tsx must call getFreshRiversideDeal inside useMemo',
  )
})

test('C3: westside/page.tsx uses getFreshWestsideDeal in useMemo', () => {
  assert(
    WESTSIDE_PAGE.includes('getFreshWestsideDeal') &&
    WESTSIDE_PAGE.includes('useMemo(() => getFreshWestsideDeal()'),
    'westside/page.tsx must call getFreshWestsideDeal inside useMemo',
  )
})

test('C4: harbor-dispute/page.tsx uses getFreshHarborDisputeMilestones in useMemo', () => {
  assert(
    DISPUTE_PAGE.includes('getFreshHarborDisputeMilestones') &&
    DISPUTE_PAGE.includes('useMemo(() => getFreshHarborDisputeMilestones()'),
    'harbor-dispute/page.tsx must call getFreshHarborDisputeMilestones inside useMemo',
  )
})

test('C5: harbor-dispute HVAC reference reads from the cloned milestones array', () => {
  // The HVAC_MS const should be derived from the cloned milestones, not from
  // the canonical export.
  assert(
    DISPUTE_PAGE.includes('milestones.find') &&
    !/harborDisputeMilestones\.find/.test(DISPUTE_PAGE),
    'harbor-dispute/page.tsx must derive HVAC_MS from the cloned milestones array, not the canonical export',
  )
})

// ─── D. NO PERSISTENCE ───────────────────────────────────────────────────────

test('D1: no localStorage / sessionStorage / cookie writes in demo files', () => {
  const { execSync } = require('child_process')
  let output = ''
  try {
    output = execSync(
      // Look for localStorage, sessionStorage, or document.cookie WRITES in
      // demo source. Exclude comment lines so JSDoc mentions don't trip.
      `grep -rn --include="*.ts" --include="*.tsx" "localStorage\\|sessionStorage\\|document.cookie" \
         src/app/demo-live src/components/demo src/lib/demo-data \
         | grep -v ":[0-9]*:[[:space:]]*//" \
         | grep -v ":[0-9]*:[[:space:]]*\\*"`,
      { cwd: ROOT, encoding: 'utf-8' },
    ).trim()
  } catch {
    output = ''
  }
  assert(
    output === '',
    `Found persistence write in demo files (in code, not comments):\n${output}`,
  )
})

test('D2: the 4 dedicated demo deal pages do not import canonical exports directly', () => {
  // After the factory migration, none of these pages should import the
  // canonical objects by name — the factories are the single entry point.
  const pages = [
    { name: 'harbor',         src: HARBOR_PAGE,    canonical: 'harbor'                  },
    { name: 'riverside',      src: RIVERSIDE_PAGE, canonical: 'riverside'               },
    { name: 'westside',       src: WESTSIDE_PAGE,  canonical: 'westside'                },
    { name: 'harbor-dispute', src: DISPUTE_PAGE,   canonical: 'harborDisputeMilestones' },
  ]
  for (const { name, src: s, canonical } of pages) {
    // Match imports that pull the canonical export by name, e.g.:
    //   import { harbor } from '@/lib/demo-data'
    // We construct a regex that matches an import block referencing this
    // exact symbol from @/lib/demo-data.
    const importRe = new RegExp(
      `import\\s*\\{[^}]*\\b${canonical}\\b[^}]*\\}\\s*from\\s*['"]@/lib/demo-data['"]`,
    )
    assert(
      !importRe.test(s),
      `${name}/page.tsx imports the canonical "${canonical}" export directly — must use the fresh-deal factory instead`,
    )
  }
})

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — DEMO FRESH-STATE TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
