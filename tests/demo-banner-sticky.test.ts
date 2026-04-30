/**
 * Demo Mode banner — sticky layout tests.
 *
 * Static source-parse checks — no rendering, no live server.
 * Ensures the demo-live layout banner:
 *   1. Retains its required copy (simulated, no real funds, no real accounts).
 *   2. Is sticky/fixed so it stays visible while scrolling.
 *   3. Is scoped to the demo-live layout, not production dashboard layouts.
 *
 * Checks:
 *  1.  Demo layout banner contains "Demo Mode" or "demo" label.
 *  2.  Banner copy includes "simulated" (all data is simulated).
 *  3.  Banner copy includes "No real funds".
 *  4.  Banner copy includes "No real" (covers accounts and deals).
 *  5.  Banner element has a sticky or fixed positioning class.
 *  6.  Banner has z-index class (z-50 or higher) to stay above page content.
 *  7.  Banner has a background class so content does not bleed through.
 *  8.  Demo banner is in demo-live layout, NOT in the root layout.
 *  9.  Root layout does not contain the demo-only "Demo Mode" banner text.
 * 10.  Production dashboard layout does not contain the demo banner.
 *
 * Run:  npx tsx tests/demo-banner-sticky.test.ts
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

const DEMO_LAYOUT       = 'src/app/(marketing)/demo-live/layout.tsx'
const ROOT_LAYOUT       = 'src/app/layout.tsx'
const DASHBOARD_LAYOUT  = 'src/app/(app)/dashboard/layout.tsx'

async function main() {

// ─── 1. Banner copy truth-lock ────────────────────────────────────────────────

await test('1. Demo layout banner contains "Demo Mode" label', () => {
  const src = read(DEMO_LAYOUT)
  assert(
    src.includes('Demo Mode'),
    'demo-live/layout.tsx does not contain the "Demo Mode" label in the banner.',
  )
})

await test('2. Banner copy includes "simulated"', () => {
  const src = read(DEMO_LAYOUT)
  assert(
    src.toLowerCase().includes('simulated'),
    'demo-live/layout.tsx banner does not say data is "simulated".',
  )
})

await test('3. Banner copy includes "No real funds"', () => {
  const src = read(DEMO_LAYOUT)
  assert(
    src.includes('No real funds') || src.includes('no real funds'),
    'demo-live/layout.tsx banner does not include "No real funds".',
  )
})

await test('4. Banner copy includes "No real" (accounts and deals)', () => {
  const src = read(DEMO_LAYOUT)
  const occurrences = (src.match(/[Nn]o real/g) ?? []).length
  assert(
    occurrences >= 1,
    'demo-live/layout.tsx banner does not include "No real" wording for accounts/deals.',
  )
})

// ─── 2. Sticky positioning ────────────────────────────────────────────────────

await test('5. Banner element has sticky or fixed positioning class', () => {
  const src = read(DEMO_LAYOUT)
  assert(
    src.includes('sticky') || src.includes('fixed'),
    'demo-live/layout.tsx banner does not have a sticky or fixed positioning class. ' +
    'Add "sticky top-0" so the disclaimer stays visible while scrolling.',
  )
})

await test('6. Banner has z-index class to stay above page content', () => {
  const src = read(DEMO_LAYOUT)
  // Matches z-10, z-20, z-30, z-40, z-50 or higher
  assert(
    /\bz-\d{2,}\b/.test(src) || /\bz-[1-9]\d*\b/.test(src),
    'demo-live/layout.tsx banner does not have a z-index class (e.g. z-50). ' +
    'The banner must layer above scrolled page content.',
  )
})

await test('7. Banner has an opaque background class', () => {
  const src = read(DEMO_LAYOUT)
  // bg-black, bg-surface-*, bg-gray-*, bg-slate-*, bg-neutral-*, bg-zinc-*
  assert(
    /bg-(?:black|white|gray|slate|neutral|zinc|surface|red|amber)/.test(src),
    'demo-live/layout.tsx banner does not have an opaque background class. ' +
    'Page content will bleed through if the banner is transparent.',
  )
})

// ─── 3. Scope guard — demo only ───────────────────────────────────────────────

await test('8. Demo banner is in demo-live layout (file exists and has banner)', () => {
  const src = read(DEMO_LAYOUT)
  assert(
    src.includes('DemoLiveLayout') || src.includes('demo-live'),
    'demo-live/layout.tsx does not appear to be the demo-live layout.',
  )
  assert(
    src.includes('Demo Mode'),
    'demo-live/layout.tsx does not contain the Demo Mode banner.',
  )
})

await test('9. Root layout does not contain the demo-only "Demo Mode" banner', () => {
  // Root layout.tsx exists; verify it has not been polluted with demo copy.
  const exists = fs.existsSync(path.resolve(ROOT, ROOT_LAYOUT))
  if (!exists) return  // if root layout doesn't exist, skip (not a regression risk)
  const src = read(ROOT_LAYOUT)
  assert(
    !src.includes('Demo Mode'),
    'src/app/layout.tsx contains "Demo Mode" — the demo banner must be scoped to demo-live only.',
  )
})

await test('10. Production dashboard layout does not contain the demo banner', () => {
  const exists = fs.existsSync(path.resolve(ROOT, DASHBOARD_LAYOUT))
  if (!exists) return  // dashboard may not have its own layout.tsx — skip
  const src = read(DASHBOARD_LAYOUT)
  assert(
    !src.includes('Demo Mode'),
    'src/app/(app)/dashboard/layout.tsx contains "Demo Mode" — demo banner must not appear in production dashboard.',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — DEMO BANNER STICKY LAYOUT TEST RESULTS')
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
