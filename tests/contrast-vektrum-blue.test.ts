/**
 * Vektrum-blue contrast guard
 *
 * `text-vektrum-blue` resolves to #1A3A96 — high contrast on white/light
 * backgrounds (correct on the marketing pages' light sections), but ~1.3:1
 * on the dark navy backgrounds the rest of the app uses (#031226, #0D1B2A,
 * #111827, surface-0/2/3). It must never be the text colour of content
 * inside a known-dark container.
 *
 * This guard fails if any page or component containing a dark background
 * (bg-[#0...], bg-[#1...], bg-vektrum-canvas, bg-surface-*) also uses
 * `text-vektrum-blue` as a TEXT colour. The class is permitted on
 * intentionally light pages (contact, security, and the light sections of
 * the homepage) — those are listed in ALLOWLIST below.
 *
 * The guard is intentionally structural: it doesn't render anything, it
 * just greps the source tree. That's enough to catch the most common
 * regression — a developer pasting a marketing-style accent label into a
 * dark dashboard or demo page without realising it.
 *
 * Run: npx tsx tests/contrast-vektrum-blue.test.ts
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// Files where `text-vektrum-blue` is permitted because the surrounding
// section is intentionally on a light background. Each entry must justify
// itself with a comment.
const ALLOWLIST: string[] = [
  // Homepage has both dark and light sections; the light sections (Role
  // clarity, Category difference, Every-party, etc.) keep text-vektrum-blue
  // because dark blue on white reads correctly. The dark sections were
  // migrated to text-blue-300; a separate test (D1 below) pins zero matches
  // inside their line ranges.
  'src/app/page.tsx',
  // Contact page is a light-themed form layout.
  'src/app/contact/page.tsx',
  // Security page is mostly a light copy block; no dark sections.
  'src/app/security/page.tsx',
]

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

/**
 * Returns the relative paths of every file under src/ that mentions
 * `text-vektrum-blue` (as a class — opacity modifiers permitted).
 */
function findFilesUsingTextVektrumBlue(): string[] {
  const out = execSync(
    'grep -rln "text-vektrum-blue" src/app src/components src/lib --include="*.tsx" --include="*.ts" || true',
    { cwd: ROOT, encoding: 'utf-8' },
  ).trim()
  return out ? out.split('\n').map((p) => p.replace(/\\/g, '/')) : []
}

// ─── A. ALLOWLIST IS THE ONLY PLACE text-vektrum-blue MAY APPEAR ─────────────

test('A1: every file with text-vektrum-blue is on the allowlist', () => {
  const files = findFilesUsingTextVektrumBlue()
  const offenders = files.filter((f) => !ALLOWLIST.includes(f))
  assert(
    offenders.length === 0,
    'These files contain text-vektrum-blue but are not on the contrast-safe allowlist:\n' +
      offenders.map((f) => '  ' + f).join('\n') +
      '\n\nIf the file is on a dark background, replace text-vektrum-blue with ' +
      'text-blue-300 (or text-blue-200 / text-blue-400). If it is genuinely ' +
      'on a light background, add it to ALLOWLIST in this test with a comment ' +
      'justifying the placement.',
  )
})

// ─── B. NO text-vektrum-blue INSIDE A KNOWN-DARK SECTION OF page.tsx ────────

test('B1: page.tsx dark sections do not use text-vektrum-blue', () => {
  // The homepage interleaves dark + light sections. Light section line
  // ranges are documented at the top of the file; everything else is dark.
  // We extract the line numbers of every text-vektrum-blue match and assert
  // they all fall inside the documented light ranges.
  const out = execSync(
    'grep -n "text-vektrum-blue" src/app/page.tsx || true',
    { cwd: ROOT, encoding: 'utf-8' },
  ).trim()
  if (!out) return // no matches at all is also fine

  const matches = out.split('\n').map((line) => {
    const [n] = line.split(':', 1)
    return parseInt(n, 10)
  })

  // Light sections of page.tsx, identified by their <section bg-[#F8F9FB]>
  // and <section bg-white> wrappers. These ranges must be updated if the
  // page is restructured.
  const LIGHT_RANGES: Array<[number, number]> = [
    [538, 723], // Role clarity / category difference (bg-[#F8F9FB] + bg-white)
    [804, 984], // Every party protected / process (bg-[#F8F9FB] + bg-white)
  ]

  for (const lineNo of matches) {
    const inLight = LIGHT_RANGES.some(([lo, hi]) => lineNo >= lo && lineNo <= hi)
    assert(
      inLight,
      `page.tsx line ${lineNo} uses text-vektrum-blue but is NOT inside a known-light section. ` +
        `Light ranges are ${JSON.stringify(LIGHT_RANGES)}. ` +
        `If you intentionally added a new light section, extend LIGHT_RANGES in this test.`,
    )
  }
})

// ─── C. SPECIFIC REGRESSION PIN — gate-stops-this card uses readable blue ───

test('C1: "Condition" rows under the "gate stops this" cards use text-blue-200/300/400', () => {
  // The user-visible failure that triggered this work was the "Condition X"
  // text inside the dark "The gate stops this." cards. Pin the readable
  // class so a future revert can't re-introduce text-vektrum-blue on this
  // exact element.
  const homepage = execSync('cat src/app/page.tsx', { cwd: ROOT, encoding: 'utf-8' })
  // Find the section block by its heading.
  const sectionIdx = homepage.indexOf('The gate stops this.')
  assert(sectionIdx !== -1, 'Could not locate the "gate stops this" section in homepage')
  // Look ~6000 chars after the heading — the section has 7 prevention cards
  // declared in an inline array before the JSX render block, so the
  // `{scenario.condition}` token appears well past the heading.
  const block = homepage.slice(sectionIdx, sectionIdx + 6000)
  assert(
    block.includes('{scenario.condition}'),
    '"gate stops this" card body no longer renders {scenario.condition} — test target may have moved',
  )
  // The condition <p> must use a light blue text class.
  const conditionMatch = block.match(/text-blue-(?:100|200|300|400)[^"]*"[^>]*>\{scenario\.condition\}/)
  assert(
    conditionMatch !== null,
    '"gate stops this" condition rows must render {scenario.condition} with a text-blue-100/200/300/400 class for contrast on dark cards',
  )
})

// ─── D. ALLOWLIST IS UP-TO-DATE ──────────────────────────────────────────────

test('D1: every allowlisted file actually still contains text-vektrum-blue', () => {
  // If a file is removed from product code but stays on the allowlist, the
  // allowlist becomes stale. Fail so the next contributor cleans it up.
  for (const rel of ALLOWLIST) {
    const out = execSync(
      `grep -c "text-vektrum-blue" ${rel} || true`,
      { cwd: ROOT, encoding: 'utf-8' },
    ).trim()
    const count = parseInt(out, 10) || 0
    assert(
      count > 0,
      `Allowlist entry "${rel}" no longer contains text-vektrum-blue. Remove it from ALLOWLIST.`,
    )
  }
})

// ─── Results ─────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — TEXT-VEKTRUM-BLUE CONTRAST GUARD RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)
