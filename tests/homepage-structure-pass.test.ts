/**
 * tests/homepage-structure-pass.test.ts
 *
 * Verifies the deferred homepage structure pass landed:
 *   1. Trust-boundary strip (verifies / authorizes / executes)
 *   2. Problem / pain section
 *   3. How Vektrum works (5 steps + workflow strip)
 *   4. Persona cards (lender, title/escrow, builder, developer)
 *   5. AI / gate boundary visual (Panel A precondition vs Panel B 10-condition gate)
 *   6. FAQ rendered with native <details>/<summary>
 *
 * Plus banned-phrase guards on the new surface so the structure pass cannot
 * silently re-introduce overclaim language.
 *
 * Run: npx tsx tests/homepage-structure-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT         = path.resolve(process.cwd())
const HOMEPAGE     = 'src/app/(marketing)/page.tsx'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\nhomepage-structure-pass.test.ts\n')

  const src   = read(HOMEPAGE)
  const lower = src.toLowerCase()
  const pkg   = read(PACKAGE_JSON)

  // ── 1. Trust-boundary strip ─────────────────────────────────────────────
  console.log('1. Trust-boundary strip')
  check(
    src.includes('Vektrum does not hold funds, act as escrow, originate loans, provide legal advice'),
    '  1a. trust-boundary disclaimer copy present',
  )
  check(
    src.includes('records release readiness and authorization evidence'),
    '  1b. "records release readiness and authorization evidence"',
  )
  check(
    src.includes('selected payment rail executes disbursement'),
    '  1c. "selected payment rail executes disbursement"',
  )
  check(
    src.includes('Vektrum verifies readiness') &&
    src.includes('Authorized party approves') &&
    src.includes('Selected rail executes'),
    '  1d. three-card structure: verify / approve / execute',
  )

  // ── 2. Problem / pain section ──────────────────────────────────────────
  console.log('\n2. Problem / pain section')
  check(
    src.includes('held together by email, PDFs, spreadsheets, and trust'),
    '  2a. headline present',
  )
  check(
    src.includes('A draw should not move just because the paperwork looks close enough'),
    '  2b. supporting body present',
  )
  check(src.includes('Missing lien waivers delay releases'),               '  2c. pain bullet — lien waivers')
  check(src.includes('Inspection evidence gets buried in email'),          '  2d. pain bullet — inspection email')
  check(src.includes('Change orders create approval confusion'),           '  2e. pain bullet — change orders')
  check(src.includes('which condition blocked the draw'),                  '  2f. pain bullet — blocking condition')
  check(src.includes('Disputes are harder to isolate'),                    '  2g. pain bullet — disputes harder')

  // ── 3. How Vektrum works ────────────────────────────────────────────────
  console.log('\n3. How Vektrum works')
  check(src.includes('How Vektrum works'),                                 '  3a. section heading')
  check(src.includes('Map required conditions.'),                          '  3b. step 1 — map')
  check(src.includes('Collect draw evidence.'),                            '  3c. step 2 — collect')
  check(src.includes('Evaluate release readiness.'),                       '  3d. step 3 — evaluate')
  check(src.includes('Record authorization evidence.'),                    '  3e. step 4 — record')
  check(src.includes('The selected rail executes.'),                       '  3f. step 5 — execute')
  // Workflow strip — six labels in order
  for (const label of ['Contract / SOV','Draw Request','Evidence','Release Gate','Authorization','Selected Rail']) {
    check(src.includes(label), `  3g. workflow strip step "${label}"`)
  }

  // ── 4. Persona cards ────────────────────────────────────────────────────
  console.log('\n4. Persona cards')
  check(src.includes('Built for teams that touch construction draws.'),    '  4a. section headline')
  check(
    src.includes('Construction lenders and private funders'),
    '  4b. persona — Construction lenders and private funders',
  )
  check(
    src.includes('Title, escrow, and fund-control partners'),
    '  4c. persona — Title, escrow, and fund-control partners',
  )
  check(
    src.includes('Builders and contractors'),
    '  4d. persona — Builders and contractors',
  )
  check(
    src.includes('Developers and owner reps'),
    '  4e. persona — Developers and owner reps',
  )

  // ── 5. AI / gate boundary visual ───────────────────────────────────────
  console.log('\n5. AI / gate boundary visual')
  check(
    src.includes('AI pre-review supports the workflow. It does not authorize release.'),
    '  5a. boundary headline present',
  )
  check(
    src.includes('Required precondition before the gate'),
    '  5b. Panel A header',
  )
  check(
    src.includes('AI draw pre-review current'),
    '  5c. Panel A precondition label',
  )
  check(
    src.includes('The 10 server-side conditions'),
    '  5d. Panel B header',
  )
  check(
    src.includes('Deterministic release gate'),
    '  5e. Panel B "Deterministic release gate" label',
  )
  // Theme labels (not numbered conditions — per spec)
  check(src.includes('Documentation failure'),       '  5f. theme — Documentation failure')
  check(src.includes('Funding coverage failure'),    '  5g. theme — Funding coverage failure')
  check(src.includes('Change order failure'),        '  5h. theme — Change order failure')
  check(src.includes('Lien waiver failure'),         '  5i. theme — Lien waiver failure')
  check(src.includes('Sequential release failure'),  '  5j. theme — Sequential release failure')
  // Explicit boundary statement: AI is NOT condition #11
  check(
    src.includes('not condition #11'),
    '  5k. explicit "AI pre-review is not condition #11" boundary line',
  )

  // ── 6. FAQ uses native <details>/<summary> ─────────────────────────────
  console.log('\n6. FAQ accessibility — native <details>/<summary>')
  // Old div-only FAQ pattern is gone; details/summary is in
  check(src.includes('<details'),                                          '  6a. FAQ uses <details> elements')
  check(src.includes('<summary'),                                          '  6b. FAQ uses <summary> elements')
  // Six required questions per spec
  const requiredQs = [
    'Does Vektrum move money?',
    'Is Vektrum escrow?',
    'Does AI approve releases?',
    'What happens if an AI review is unavailable or stale?',
    'What payment rails can Vektrum support?',
    'Does Vektrum guarantee compliance or prevent fraud?',
  ]
  for (const q of requiredQs) {
    check(src.includes(q), `  6c. FAQ question: "${q}"`)
  }
  // Anchor for /#faq deep linking
  check(src.includes('id="faq"'), '  6d. FAQ section has id="faq"')

  // The 8 FAQ items render through a single `.map(` that emits one <details>
  // per question. Verify the JSX path: <details> wraps a <summary>, and the
  // question list is rendered through .map. (Source has 1 literal <details>;
  // runtime has one per Q&A. We assert both pieces are present and ordered.)
  const detailsIdx = src.indexOf('<details')
  const summaryIdx = src.indexOf('<summary')
  const mapIdx     = src.indexOf('].map((item)')
  check(
    detailsIdx > -1 && summaryIdx > detailsIdx,
    '  6e. <summary> appears inside the <details> block',
  )
  check(
    mapIdx > -1 && detailsIdx > mapIdx,
    '  6f. FAQ Q&A list is rendered through .map() wrapping the <details> element',
  )

  // ── 7. Banned phrases must not be reintroduced ─────────────────────────
  console.log('\n7. Banned-phrase guards')
  for (const banned of [
    'vektrum moves money',
    'vektrum acts as escrow',
    'vektrum is escrow',
    'vektrum is a lender',
    'ai approves release',
    'ai approved release',
    'ai authorizes payment',
    'automatic payment',
    'guarantees compliance',
    'guarantees payment',
    'prevents fraud',
    'eliminates disputes',
    'immutable audit trail',
    'join beta',
  ]) {
    check(!lower.includes(banned), `  7. banned: "${banned}" absent`)
  }

  // ── 8. Test wired into npm test ────────────────────────────────────────
  check(
    pkg.includes('homepage-structure-pass.test.ts'),
    '8. homepage-structure-pass.test.ts wired into npm test',
  )

  console.log('\n✓ All homepage-structure-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
