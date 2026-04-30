/**
 * Booking-CTA tests — static checks that every public "Book a call",
 * "Schedule a call", and "Talk to us" CTA points at the canonical
 * Cal.com booking URL via the shared BOOK_CALL_URL module.
 *
 * Why this matters:
 *   The CTA was silently dead because src/lib/book-call.ts defaulted to
 *   "/contact" when NEXT_PUBLIC_BOOK_CALL_URL was unset. These tests lock
 *   in the live default, prevent reintroducing href="#" or other dead
 *   destinations, and ensure every public booking surface uses the same
 *   single source of truth.
 *
 * Run:  npx tsx tests/booking-cta.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ─── Test runner ──────────────────────────────────────────────────────────────

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

function rel(...segments: string[]): string {
  return path.join(ROOT, ...segments)
}

function read(p: string): string {
  if (!fs.existsSync(p)) throw new Error(`Required file does not exist: ${p}`)
  return fs.readFileSync(p, 'utf-8')
}

const CTA_PATTERNS = [
  /Book a call/,
  /Schedule a call/,
  /Talk to us/,
  /Schedule demo/,
  /Book demo/,
] as const

// Discover every public .tsx file (under src/app and src/components, but NOT
// under dashboard/ or demo-live/) that contains booking CTA copy. We use
// discovery rather than a static list so newly-added marketing pages with
// a booking CTA are automatically covered — and pages that legitimately do
// NOT have a booking CTA (e.g. contractors → signup flow) are not falsely
// required to import the module.
function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Exclude authenticated/app surfaces — they are not public marketing CTAs.
      if (entry.name === 'dashboard' || entry.name === 'demo-live') continue
      walk(full, acc)
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      acc.push(full)
    }
  }
  return acc
}

const PUBLIC_TSX = [
  ...walk(rel('src/app')),
  ...walk(rel('src/components')),
]

function hasBookingCtaCopy(src: string): boolean {
  return CTA_PATTERNS.some(p => p.test(src))
}

const PUBLIC_CTA_FILES = PUBLIC_TSX
  .filter(p => hasBookingCtaCopy(read(p)))
  // Normalise to repo-relative paths for stable test output.
  .map(p => path.relative(ROOT, p))
  .sort()

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── 1. Module default points at the live Cal.com booking URL ─────────────────

await test('MODULE: BOOK_CALL_URL defaults to https://cal.com/vektrum', () => {
  const src = read(rel('src/lib/book-call.ts'))
  assert(
    src.includes("'https://cal.com/vektrum'") || src.includes('"https://cal.com/vektrum"'),
    'src/lib/book-call.ts must default BOOK_CALL_URL to https://cal.com/vektrum so the ' +
    'CTA navigates correctly when NEXT_PUBLIC_BOOK_CALL_URL is unset (e.g. in production).',
  )
})

await test('MODULE: BOOK_CALL_URL default does NOT fall back to /contact', () => {
  const src = read(rel('src/lib/book-call.ts'))
  // The fallback used to be '/contact', which silently broke the booking flow.
  // Allow the literal to appear in comments, but not as a string fallback after `??`.
  const codeOnly = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert(
    !/\?\?\s*['"]\/contact['"]/.test(codeOnly),
    "src/lib/book-call.ts must not use ?? '/contact' as the BOOK_CALL_URL fallback. " +
    'Use the live Cal.com URL instead.',
  )
})

await test('MODULE: BOOK_CALL_EXTERNAL is true for the default URL', () => {
  const src = read(rel('src/lib/book-call.ts'))
  // Sanity-check the derivation logic so call sites that conditionally apply
  // target="_blank" + rel="noopener noreferrer" actually do so for the default.
  assert(
    /BOOK_CALL_URL\.startsWith\(['"]http['"]\)/.test(src),
    'BOOK_CALL_EXTERNAL must derive from BOOK_CALL_URL.startsWith("http") so call sites ' +
    'apply target="_blank" + rel="noopener noreferrer" for external URLs.',
  )
})

// ── 2. Every public CTA file imports the module ──────────────────────────────

for (const fileRel of PUBLIC_CTA_FILES) {
  const fullPath = rel(fileRel)

  await test(`CTA: ${fileRel} imports BOOK_CALL_URL`, () => {
    const src = read(fullPath)
    // Match either a named-import line OR a require call referencing the module.
    const hasImport =
      /import\s*\{[^}]*\bBOOK_CALL_URL\b[^}]*\}\s*from\s*['"]@\/lib\/book-call['"]/.test(src) ||
      /from\s*['"]@\/lib\/book-call['"]/.test(src)
    assert(
      hasImport,
      `${fileRel} must import BOOK_CALL_URL from '@/lib/book-call' so the booking destination ` +
      'is centralised. Hardcoded URLs drift over time.',
    )
  })

  await test(`CTA: ${fileRel} renders booking CTA via {BOOK_CALL_URL}`, () => {
    const src = read(fullPath)
    assert(
      src.includes('href={BOOK_CALL_URL}') || src.includes('ctaHref={BOOK_CALL_URL}'),
      `${fileRel} contains booking CTA copy but does not bind href={BOOK_CALL_URL}. ` +
      'Every public booking CTA must point at the shared module value.',
    )
  })
}

// ── 3. No public CTA uses href="#" or empty href on a booking button ─────────

await test('CTA: no public booking CTA uses href="#"', () => {
  const offenders: string[] = []
  for (const fileRel of PUBLIC_CTA_FILES) {
    const src   = read(rel(fileRel))
    const lines = src.split('\n')

    // Walk lines that mention any CTA pattern, then look at the surrounding
    // ±6 lines (typical JSX button block) for href="#".
    for (let i = 0; i < lines.length; i++) {
      if (!CTA_PATTERNS.some(p => p.test(lines[i]))) continue
      const start = Math.max(0, i - 6)
      const end   = Math.min(lines.length, i + 2)
      const block = lines.slice(start, end).join('\n')
      if (/href\s*=\s*["']#["']/.test(block) || /href\s*=\s*["']["']/.test(block)) {
        offenders.push(`${fileRel}:${i + 1}`)
      }
    }
  }
  assert(
    offenders.length === 0,
    `Booking CTA(s) using href="#" or href="" detected:\n  - ${offenders.join('\n  - ')}\n` +
    `These render as dead buttons. Replace with href={BOOK_CALL_URL}.`,
  )
})

// ── 4. No public CTA uses an empty/no-op onClick on a booking button ─────────

await test('CTA: no public booking CTA renders as a dead onClick={() => {}} button', () => {
  const offenders: string[] = []
  for (const fileRel of PUBLIC_CTA_FILES) {
    const src   = read(rel(fileRel))
    const lines = src.split('\n')

    for (let i = 0; i < lines.length; i++) {
      if (!CTA_PATTERNS.some(p => p.test(lines[i]))) continue
      const start = Math.max(0, i - 6)
      const end   = Math.min(lines.length, i + 2)
      const block = lines.slice(start, end).join('\n')

      // <button onClick={() => {}}> or onClick={() => undefined} or onClick={undefined}
      if (
        /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(block) ||
        /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*undefined\s*\}/.test(block) ||
        /onClick\s*=\s*\{\s*undefined\s*\}/.test(block)
      ) {
        offenders.push(`${fileRel}:${i + 1}`)
      }
    }
  }
  assert(
    offenders.length === 0,
    `Booking CTA(s) with empty/no-op onClick detected:\n  - ${offenders.join('\n  - ')}`,
  )
})

// ── 5. Header (layout.tsx) and mobile nav both wire to BOOK_CALL_URL ─────────

await test('CTA: marketing header + shared footer wire to BOOK_CALL_URL', () => {
  // After the route-group split, the desktop "Book a call" CTA lives in
  // (marketing)/layout.tsx; the footer lives in components/nav/site-footer.tsx.
  const marketing = read(rel('src/app/(marketing)/layout.tsx'))
  const footer    = read(rel('src/components/nav/site-footer.tsx'))
  assert(
    marketing.includes('href={BOOK_CALL_URL}') && /Book a call/.test(marketing),
    '(marketing)/layout.tsx must render a "Book a call" CTA bound to BOOK_CALL_URL.',
  )
  assert(
    footer.includes('href={BOOK_CALL_URL}') && /Book a call/.test(footer),
    'components/nav/site-footer.tsx must render a "Book a call" CTA bound to BOOK_CALL_URL.',
  )
})

await test('CTA: mobile nav wires to BOOK_CALL_URL', () => {
  const src = read(rel('src/components/nav/mobile-nav.tsx'))
  assert(
    src.includes('href={BOOK_CALL_URL}') && /Book a call/.test(src),
    'src/components/nav/mobile-nav.tsx must render a "Book a call" CTA bound to BOOK_CALL_URL.',
  )
})

// ── 6. Every external (http) CTA also applies target/rel hardening ───────────
// Required for cross-tab booking UX and to avoid reverse-tabnabbing on external links.

await test('CTA: every public booking <Link> conditionally applies target/rel for external URLs', () => {
  const offenders: string[] = []
  for (const fileRel of PUBLIC_CTA_FILES) {
    const src = read(rel(fileRel))
    if (!src.includes('href={BOOK_CALL_URL}')) continue   // only check files that bind directly
    if (!src.includes('BOOK_CALL_EXTERNAL')) {
      offenders.push(fileRel)
    }
  }
  assert(
    offenders.length === 0,
    `Files binding href={BOOK_CALL_URL} must also reference BOOK_CALL_EXTERNAL to apply ` +
    `target="_blank" + rel="noopener noreferrer":\n  - ${offenders.join('\n  - ')}`,
  )
})

// ── Report ───────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — BOOKING CTA TEST RESULTS')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter(r => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)
}

main()
