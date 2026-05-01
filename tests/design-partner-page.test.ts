/**
 * tests/design-partner-page.test.ts
 *
 * Static source-parse checks for the /design-partners landing page. No browser,
 * no DB, no env vars required. Verifies:
 *   - route exists (page.tsx + form client component)
 *   - hero, pain, before/after, design-partner offer, audience, scope, final CTA
 *   - form has the required qualifying fields and the conversion event fires
 *   - approved Vektrum copy, no banned escrow/lender/bank/payment claims
 *   - SEO metadata is in place
 *   - test wired into npm test
 *
 * Run: npx tsx tests/design-partner-page.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const PAGE         = 'src/app/(marketing)/design-partners/page.tsx'
const FORM         = 'src/app/(marketing)/design-partners/design-partner-apply-form.tsx'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  const full = path.resolve(ROOT, rel)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${rel}`)
  return fs.readFileSync(full, 'utf-8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\ndesign-partner-page.test.ts\n')

  // ── 1. Route exists ──────────────────────────────────────────────────────
  check(exists(PAGE), '1. /design-partners page.tsx exists')
  check(exists(FORM), '1b. design-partner-apply-form.tsx exists')

  const src   = read(PAGE)
  const form  = read(FORM)
  const both  = src + '\n' + form
  const lower = both.toLowerCase()

  // ── 2. Eyebrow ───────────────────────────────────────────────────────────
  check(src.includes('Design Partner Program'), '2. page contains "Design Partner Program"')

  // ── 3. Hero headline + supporting line ───────────────────────────────────
  check(
    src.includes('Stop releasing draws on incomplete evidence'),
    '3. hero contains "Stop releasing draws on incomplete evidence"',
  )
  check(
    src.includes('Workflow tools track. Vektrum enforces.'),
    '3b. hero contains "Workflow tools track. Vektrum enforces."',
  )

  // ── 4. Primary CTA (appears at least twice — hero + final CTA) ──────────
  const ctaCount = (src.match(/Apply to become a design partner/g) || []).length
  check(
    ctaCount >= 2,
    `4. "Apply to become a design partner" CTA appears >=2 times (found ${ctaCount})`,
  )

  // ── 5. CTA microcopy ────────────────────────────────────────────────────
  check(
    src.includes('Limited first cohort. 30-minute fit call. No obligation.'),
    '5. CTA microcopy "Limited first cohort. 30-minute fit call. No obligation."',
  )

  // ── 6. Subhead — audience description ───────────────────────────────────
  check(
    src.includes('construction lenders') &&
    src.includes('title/escrow partners') &&
    src.includes('builders'),
    '6. hero subhead names construction lenders, title/escrow, builders',
  )
  check(
    src.includes('lien waivers') &&
    src.includes('inspections') &&
    src.includes('change orders') &&
    src.includes('approvals'),
    '6b. hero/audience copy lists lien waivers, inspections, change orders, approvals',
  )

  // ── 7. Pain section ─────────────────────────────────────────────────────
  check(
    src.includes('held together by email, PDFs, spreadsheets, and trust'),
    '7. pain headline present',
  )
  check(src.includes('Missing lien waivers delay releases'), '7a. pain bullet — lien waivers')
  check(src.includes('Inspection evidence gets buried in email'), '7b. pain bullet — inspection email')
  check(src.includes('Change orders create approval confusion'), '7c. pain bullet — change orders')
  check(src.includes('which condition actually blocked the draw'), '7d. pain bullet — blocking condition')
  check(src.includes('clean audit trail when a dispute'), '7e. pain bullet — audit trail')

  // ── 8. Before / After ───────────────────────────────────────────────────
  check(src.includes('Before Vektrum'), '8. "Before Vektrum" section present')
  check(src.includes('With Vektrum'),   '8b. "With Vektrum" section present')
  check(
    src.includes('From scattered draw evidence to release-ready authorization'),
    '8c. before/after headline present',
  )
  // workflow strip
  check(
    src.includes('Contract / SOV') &&
    src.includes('Draw request') &&
    src.includes('Evidence') &&
    src.includes('Conditions checked') &&
    src.includes('Funder authorization') &&
    src.includes('Selected rail executes'),
    '8d. workflow strip lists all 6 steps',
  )

  // ── 9. Design partner offer ─────────────────────────────────────────────
  check(
    src.includes('Join the first Vektrum design partner cohort'),
    '9. offer headline present',
  )
  check(src.includes('What design partners get'), '9a. "What design partners get" present')
  check(src.includes('What Vektrum asks for'),    '9b. "What Vektrum asks for" present')
  check(
    src.includes('Early access to the draw governance workflow') &&
    src.includes('Direct influence on product requirements') &&
    src.includes('private working session') &&
    src.includes('Priority onboarding') &&
    src.includes('founding-partner pricing'),
    '9c. design-partner-get bullets present',
  )
  check(
    src.includes('One kickoff call') &&
    src.includes('feedback sessions') &&
    src.includes('anonymized draw workflow') &&
    src.includes('Honest feedback'),
    '9d. vektrum-asks-for bullets present',
  )
  check(
    src.includes('45–60 day') || src.includes('45-60 day'),
    '9e. structured 45–60 day window mentioned',
  )

  // ── 10. Who it is for ───────────────────────────────────────────────────
  check(src.includes('Construction lenders'),  '10a. audience: Construction lenders')
  check(src.includes('Private funders'),       '10b. audience: Private funders')
  check(src.includes('Title and escrow partners'), '10c. audience: Title and escrow partners')
  check(src.includes('Fund control teams'),    '10d. audience: Fund control teams')
  check(src.includes('Developers and owner reps'), '10e. audience: Developers and owner reps')
  check(src.includes('Builders and contractors'),  '10f. audience: Builders and contractors')
  check(src.includes('Construction finance operators'), '10g. audience: Construction finance operators')
  check(src.includes('Draw administrators'),   '10h. audience: Draw administrators')

  // ── 11. Application form ────────────────────────────────────────────────
  check(form.includes("'use client'") || form.includes('"use client"'), '11. form is a client component')
  check(form.includes('name="name"'),        '11a. form field: name')
  check(form.includes('name="company"'),     '11b. form field: company')
  check(form.includes('name="title"'),       '11c. form field: role/title')
  check(form.includes('name="email"'),       '11d. form field: email')
  check(form.includes('name="audience"'),    '11e. form field: audience (which best describes you)')
  check(form.includes('name="draw_exposure"'), '11f. form field: draw_exposure (yes/no/team)')
  check(form.includes('name="bottleneck"'),  '11g. form field: bottleneck (short text)')
  // Audience options
  check(
    form.includes('Lender') &&
    form.includes('Title / escrow') &&
    form.includes('Builder') &&
    form.includes('Developer') &&
    form.includes('Fund control') &&
    form.includes('Contractor') &&
    form.includes('Other'),
    '11h. audience dropdown lists all 7 options',
  )
  // Draw exposure options
  check(
    form.includes('Yes') && form.includes('No') &&
    form.includes('Not directly, but my team does'),
    '11i. draw exposure dropdown has Yes / No / Not directly, but my team does',
  )

  // ── 12. Conversion event fires on submit ────────────────────────────────
  check(
    form.includes('trackMetaEvent') && form.includes('@/lib/meta-pixel'),
    '12. form imports trackMetaEvent from @/lib/meta-pixel',
  )
  check(
    form.includes("trackMetaEvent('Lead'"),
    '12b. form fires trackMetaEvent("Lead", …) on submit',
  )
  check(
    form.includes("content_name: 'Design Partner Application'"),
    '12c. Lead event includes content_name: "Design Partner Application"',
  )
  // Single-fire ref
  check(
    form.includes('useRef') && form.includes('fired'),
    '12d. form uses fired ref to prevent duplicate Lead events',
  )

  // ── 13. ViewContent fires on page mount ─────────────────────────────────
  check(
    src.includes('MetaViewContent') &&
    src.includes('@/components/analytics/MetaViewContent'),
    '13. page imports MetaViewContent',
  )
  check(
    src.includes('contentName="Design Partners"'),
    '13b. <MetaViewContent contentName="Design Partners" /> mounted',
  )

  // ── 14. UTM-tagged booking link ─────────────────────────────────────────
  check(
    form.includes('utm_source=design_partner_page') &&
    form.includes('utm_medium=site') &&
    form.includes('utm_campaign=design_partner'),
    '14. UTM params present on follow-up booking link',
  )

  // ── 15. What Vektrum is — and is not (scope) ────────────────────────────
  check(
    src.includes('What Vektrum is — and what it is not'),
    '15. scope section heading present',
  )
  check(
    src.includes('does not hold funds') && src.includes('move money'),
    '15a. page contains "does not hold funds" and "move money"',
  )
  check(
    src.includes('not an escrow service') ||
    src.includes('not an escrow') ||
    (src.includes('not') && src.includes('escrow service')),
    '15b. page says Vektrum is not an escrow service',
  )
  check(
    src.includes('selected rail') || src.includes('Selected rail'),
    '15c. page mentions the selected rail executes funds',
  )
  check(
    src.includes('Stripe Connect') &&
    src.includes('treasury') &&
    src.includes('loan servicer'),
    '15d. selected-rail examples include Stripe Connect, treasury, loan servicer',
  )

  // ── 16. Banned phrases — copy guardrails ────────────────────────────────
  // CTA must not be "Join beta"
  check(!lower.includes('join beta'), '16a. page does not contain "Join beta"')
  check(!lower.includes('newsletter'), '16b. page does not solicit newsletter signup')
  // Must not claim Vektrum acts as escrow / is a lender / bank / money transmitter
  check(
    !src.includes('Vektrum acts as escrow'),
    '16c. page does not contain "Vektrum acts as escrow"',
  )
  check(
    !src.includes('Vektrum is a lender'),
    '16d. page does not contain "Vektrum is a lender"',
  )
  check(
    !src.includes('Vektrum is a bank') && !src.includes('Vektrum is a money transmitter'),
    '16e. page does not call Vektrum a bank or money transmitter',
  )
  // Must not claim AI approves release / automatic payment
  check(!lower.includes('ai approves release'),       '16f. no "AI approves release"')
  check(!lower.includes('ai approved release'),       '16g. no "AI approved release"')
  check(!lower.includes('automatic payment'),         '16h. no "automatic payment"')
  check(!lower.includes('payment released automatically'), '16i. no "payment released automatically"')
  check(!lower.includes('guarantees payment'),        '16j. no "guarantees payment"')
  check(!lower.includes('free testing'),              '16k. no "free testing"')
  // Vektrum Moves Money / Vektrum Holds Funds (specific bad claims)
  check(
    !src.includes('Vektrum moves money') && !src.includes('Vektrum holds funds'),
    '16l. page does not claim Vektrum moves money or holds funds',
  )

  // ── 17. Final CTA section ───────────────────────────────────────────────
  check(src.includes('Interested in shaping Vektrum'), '17. final CTA headline present')

  // ── 18. SEO metadata ────────────────────────────────────────────────────
  check(
    src.includes('Vektrum Design Partner Program | Construction Draw Governance'),
    '18a. metadata title present',
  )
  check(
    src.includes('Apply to become a Vektrum design partner') &&
    src.includes('construction draw governance'),
    '18b. metadata description present',
  )
  check(
    src.includes('Stop releasing draws on incomplete evidence'),
    '18c. OG title is the hero headline',
  )
  check(
    src.includes("alternates: { canonical: 'https://vektrum.io/design-partners' }"),
    '18d. canonical url set',
  )

  // ── 19. ISR ────────────────────────────────────────────────────────────
  check(src.includes('export const revalidate'), '19. ISR (export const revalidate) set')

  // ── 20. Test wired ─────────────────────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('design-partner-page.test.ts'),
    '20. design-partner-page.test.ts wired into npm test',
  )

  console.log('\n✓ All design-partner-page tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
