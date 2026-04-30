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
  'src/app/(marketing)/page.tsx',
  // Contact page is a light-themed form layout.
  'src/app/(marketing)/contact/page.tsx',
  // Security page was migrated from bg-vektrum-bg (light) to bg-surface-0
  // (dark navy). All text-vektrum-blue instances replaced with text-blue-300/400.
  // It is intentionally NOT on this allowlist — any reintroduction will fail A1.
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
    'grep -n "text-vektrum-blue" "src/app/(marketing)/page.tsx" || true',
    { cwd: ROOT, encoding: 'utf-8' },
  ).trim()
  if (!out) return // no matches at all is also fine

  const matches = out.split('\n').map((line) => {
    const [n] = line.split(':', 1)
    return parseInt(n, 10)
  })

  // Light sections of page.tsx, identified by their <section bg-white>
  // and <section bg-[#F8F9FB]> wrappers. These ranges must be updated if
  // the page is restructured. Each range starts at the opening <section>
  // tag and ends at the closing </section> immediately before the next
  // dark section's opening tag (currently bg-[#031226] / bg-[#0D1B2A]).
  //
  // Last verified by walking section boundaries:
  //   582  bg-white                ┐
  //   655  bg-[#F8F9FB]            ├─ first light run
  //   766  bg-white                │  (3 sequential light sections)
  //   838  </section>              ┘  → 841 bg-[#031226] (dark)
  //
  //   921  bg-[#F8F9FB]            ┐── second light run
  //  1028  bg-white                │   (2 sequential light sections)
  //  1101  </section>              ┘   → 1102 bg-[#031226] (dark)
  //
  // To re-derive after edits:
  //   grep -n "<section className" src/app/(marketing)/page.tsx
  //
  // Previous ranges [538,723] and [804,984] were stale after Sprint-1
  // additions (Release Workflow Spine section + metadata/schema block at
  // the top of the file) shifted line numbers by ~44 lines. The
  // text-vektrum-blue matches were never on a dark background — the
  // ranges had simply drifted.
  const LIGHT_RANGES: Array<[number, number]> = [
    [582, 838],   // First light run: Release workflow spine → How it works → Category difference
    [921, 1101],  // Second light run: Role clarity → The process
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
  const homepage = execSync('cat "src/app/(marketing)/page.tsx"', { cwd: ROOT, encoding: 'utf-8' })
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
      `grep -c "text-vektrum-blue" "${rel}" || true`,
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
