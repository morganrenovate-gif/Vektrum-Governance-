/**
 * tests/homepage-hero-cta.test.ts
 *
 * Static checks that the homepage hero has been re-pointed at the
 * design-partner conversion path.
 *
 *  1. Hero contains "Stop releasing draws on incomplete evidence."
 *  2. Hero contains "Workflow tools track. Vektrum enforces."
 *  3. Hero subhead names lenders / title / escrow / builders / developers / finance
 *  4. Primary CTA text is "Apply to become a design partner"
 *  5. Primary CTA href is "/design-partners#apply"
 *  6. Secondary CTA is "Review the live demo" linking to /demo-live
 *  7. CTA microcopy "Limited first cohort. 30-minute workflow review. No obligation."
 *  8. Hero CTA appears in source before the closing of the H1 wrapper
 *  9. Old "Start your first deal" CTA is gone
 * 10. No banned positioning phrases reintroduced
 * 11. Test wired into npm test
 *
 * Run: npx tsx tests/homepage-hero-cta.test.ts
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
  console.log('\nhomepage-hero-cta.test.ts\n')

  const src   = read(HOMEPAGE)
  const lower = src.toLowerCase()

  // 1. Hero headline
  check(
    src.includes('Stop releasing draws on incomplete evidence.'),
    '1. hero contains "Stop releasing draws on incomplete evidence."',
  )

  // 2. Supporting line
  check(
    src.includes('Workflow tools track. Vektrum enforces.'),
    '2. hero contains "Workflow tools track. Vektrum enforces."',
  )

  // 3. Subheadline names target audience
  check(
    src.includes('construction lenders') &&
    src.includes('title/escrow partners') &&
    src.includes('builders') &&
    src.includes('developers') &&
    src.includes('construction finance'),
    '3. hero subhead names lenders / title-escrow / builders / developers / finance',
  )

  // 4. Primary CTA text
  check(
    src.includes('Apply to become a design partner'),
    '4. primary CTA text "Apply to become a design partner" present',
  )

  // 5. Primary CTA href
  check(
    src.includes('href="/design-partners#apply"'),
    '5. primary CTA href is "/design-partners#apply"',
  )

  // Primary CTA Link block contains both the href and the CTA text
  const primary = src.match(
    /<Link[^>]*href="\/design-partners#apply"[^>]*>[\s\S]*?<\/Link>/,
  )
  check(
    !!primary && primary[0].includes('Apply to become a design partner'),
    '5b. <Link href="/design-partners#apply"> wraps the CTA text',
  )

  // 6. Secondary CTA
  check(
    src.includes('Review the live demo'),
    '6. secondary CTA text "Review the live demo" present',
  )
  const secondary = src.match(
    /<Link[^>]*href="\/demo-live"[^>]*>[\s\S]*?<\/Link>/,
  )
  check(
    !!secondary && secondary[0].includes('Review the live demo'),
    '6b. secondary CTA <Link href="/demo-live"> wraps the text',
  )

  // 7. Microcopy
  check(
    src.includes('Limited first cohort. 30-minute workflow review. No obligation.'),
    '7. CTA microcopy "Limited first cohort. 30-minute workflow review. No obligation."',
  )

  // 8. Primary CTA appears in source before the gate-card block (above-the-fold)
  const heroCtaIdx = src.indexOf('href="/design-partners#apply"')
  const gateIdx    = src.indexOf('Gate Evaluation')
  check(
    heroCtaIdx > -1 && gateIdx > -1 && heroCtaIdx < gateIdx,
    '8. hero CTA appears in source before the gate evaluation card',
  )

  // 9. Old CTA is gone
  check(
    !src.includes('Start your first deal'),
    '9. old "Start your first deal" CTA removed from homepage',
  )

  // 10. Banned positioning phrases must not be re-introduced
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
    'join beta',
  ]) {
    check(!lower.includes(banned), `10. banned phrase absent: "${banned}"`)
  }

  // 11. Test wired
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('homepage-hero-cta.test.ts'),
    '11. homepage-hero-cta.test.ts wired into npm test',
  )

  console.log('\n✓ All homepage-hero-cta tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
