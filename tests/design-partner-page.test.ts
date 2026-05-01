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

  // ── 21. Strict CTA wiring ──────────────────────────────────────────────
  //
  // The page must surface a visible, styled "Apply to become a design partner"
  // button (a) above the fold in the hero, (b) wrapping the form section with
  // id="apply", and (c) again in the final CTA section. Both buttons must be
  // visibly styled (bg-vektrum-blue), have a 48px minimum tap target, and link
  // to #apply.

  // Form section uses id="apply"
  check(
    /id="apply"/.test(src),
    '21a. form section wrapper has id="apply"',
  )

  // The href="#apply" anchor is used at least twice (hero + final CTA)
  const anchorCount = (src.match(/href="#apply"/g) || []).length
  check(
    anchorCount >= 2,
    `21b. href="#apply" appears >=2 times (hero + final CTA) — found ${anchorCount}`,
  )

  // Each href="#apply" Link must wrap the CTA text in the same JSX block.
  // Capture the entire <Link …>…</Link> for each #apply anchor.
  const linkBlocks = src.match(/<Link[^>]*href="#apply"[^>]*>[\s\S]*?<\/Link>/g) || []
  check(
    linkBlocks.length >= 2,
    `21c. found >=2 <Link href="#apply">…</Link> blocks — found ${linkBlocks.length}`,
  )

  // Every #apply Link must contain the CTA text inside the JSX block
  const allHaveCtaText = linkBlocks.every((b) =>
    b.includes('Apply to become a design partner'),
  )
  check(
    allHaveCtaText,
    '21d. every <Link href="#apply"> wraps the text "Apply to become a design partner"',
  )

  // Every #apply Link must use the primary button style (bg-vektrum-blue)
  // and NOT be styled as plain text
  const allStyledAsButton = linkBlocks.every((b) =>
    b.includes('bg-vektrum-blue') && b.includes('rounded-xl'),
  )
  check(
    allStyledAsButton,
    '21e. every #apply CTA Link is styled as a button (bg-vektrum-blue, rounded-xl)',
  )

  // Mobile tap target: min-h-[48px] on every #apply CTA Link
  const allHave48pxTap = linkBlocks.every((b) => b.includes('min-h-[48px]'))
  check(
    allHave48pxTap,
    '21f. every #apply CTA Link has min-h-[48px] tap target (mobile-tappable)',
  )

  // Hero CTA must appear before the form section (above the fold check —
  // hero CTA text appears earlier in the source than id="apply").
  const firstCtaIdx = src.indexOf('Apply to become a design partner')
  const formSectionIdx = src.indexOf('id="apply"')
  check(
    firstCtaIdx > -1 && formSectionIdx > -1 && firstCtaIdx < formSectionIdx,
    '21g. hero CTA appears in source before the form section (above-the-fold)',
  )

  // Hero CTA text must be inside a <Link> block, not a plain <p> or <span>
  const heroLinkIdx = src.indexOf('<Link\n              href="#apply"')
  check(
    heroLinkIdx > -1 && heroLinkIdx < formSectionIdx,
    '21h. hero CTA is a <Link href="#apply"> element (not plain text)',
  )

  // Final CTA must appear AFTER the form section
  const lastCtaIdx = src.lastIndexOf('Apply to become a design partner')
  check(
    lastCtaIdx > formSectionIdx,
    '21i. final CTA appears in source after the form section',
  )

  // CTA must not be "Join beta" (re-asserted explicitly per fix spec)
  check(
    !lower.includes('join beta'),
    '21j. CTA is NOT "Join beta" (verified again per fix spec)',
  )

  // Form submit button is also labelled with the same CTA text (consistency)
  check(
    form.includes('Apply to become a design partner'),
    '21k. form submit button label is "Apply to become a design partner"',
  )

  // ── 22. Backend wiring — API route, migration, email helper ─────────────
  const API_ROUTE = 'src/app/api/design-partner-applications/route.ts'
  const EMAIL_LIB = 'src/lib/email/design-partner-alert.ts'
  const MIGRATION = 'supabase/migrations/20260430000000_design_partner_applications.sql'

  check(exists(API_ROUTE),  '22a. POST /api/design-partner-applications route exists')
  check(exists(EMAIL_LIB),  '22b. design-partner alert email helper exists')
  check(exists(MIGRATION),  '22c. design_partner_applications migration exists')

  const api  = read(API_ROUTE)
  const mail = read(EMAIL_LIB)
  const sql  = read(MIGRATION)

  // Migration: table + RLS + check constraints + no public policy
  check(sql.includes('CREATE TABLE') && sql.includes('design_partner_applications'),
    '22d. migration creates design_partner_applications')
  check(sql.includes('ENABLE ROW LEVEL SECURITY'),
    '22e. migration enables RLS on the table')
  // No permissive public SELECT/INSERT/UPDATE/DELETE policy
  check(
    !/CREATE\s+POLICY[^;]*FOR\s+SELECT[^;]*USING\s*\(\s*true\s*\)/i.test(sql) &&
    !/CREATE\s+POLICY[^;]*TO\s+anon/i.test(sql),
    '22f. migration does NOT grant public select access',
  )
  // Required columns
  for (const col of [
    'name', 'company', 'role', 'email', 'audience_type', 'draw_exposure',
    'biggest_bottleneck', 'utm_source', 'utm_medium', 'utm_campaign',
    'utm_content', 'utm_term', 'referrer', 'user_agent',
    'status', 'admin_email_sent_at', 'created_at',
  ]) {
    check(sql.includes(col), `22g. migration column "${col}" present`)
  }
  // CHECK constraints for enums
  check(
    sql.includes("audience_type IN") &&
    sql.includes("'Lender'") && sql.includes("'Title / escrow'") &&
    sql.includes("'Builder'") && sql.includes("'Developer'") &&
    sql.includes("'Fund control'") && sql.includes("'Contractor'") &&
    sql.includes("'Other'"),
    '22h. audience_type CHECK constraint enumerates the 7 values',
  )
  check(
    sql.includes("draw_exposure IN") &&
    sql.includes("'Yes'") && sql.includes("'No'") &&
    sql.includes("'Not directly, but my team does'"),
    '22i. draw_exposure CHECK constraint enumerates Yes/No/team',
  )
  check(
    sql.includes("status IN") && sql.includes("'new'"),
    '22j. status CHECK constraint includes default "new"',
  )

  // ── 23. API route ───────────────────────────────────────────────────────
  check(api.includes("export async function POST"),
    '23a. API exports POST handler')
  check(api.includes("createSupabaseAdminClient") && api.includes("@/lib/supabase/admin"),
    '23b. API inserts via service-role admin client (bypasses RLS)')
  check(api.includes("'design_partner_applications'") || api.includes('design_partner_applications'),
    '23c. API targets the design_partner_applications table')

  // Required field validation — error strings present in source
  check(api.includes('Name is required'),              '23d. API validates: name required')
  check(api.includes('Company is required'),           '23e. API validates: company required')
  check(api.includes('Role is required'),              '23f. API validates: role required')
  check(api.includes('Email is required'),             '23g. API validates: email required')
  check(api.includes('Email is invalid'),              '23h. API validates: email format')
  check(api.includes('audienceType is invalid'),       '23i. API validates: audienceType enum')
  check(api.includes('drawExposure is invalid'),       '23j. API validates: drawExposure enum')
  check(api.includes('biggestBottleneck is required'), '23k. API validates: biggestBottleneck required')

  // Payload size cap
  check(api.includes('Payload too large') || api.includes('MAX_PAYLOAD_BYTES'),
    '23l. API rejects oversized payloads')

  // Honeypot
  check(api.includes('honeypot') || api.includes('website'),
    '23m. API supports a honeypot field for basic abuse control')

  // Insert before email; admin_email_sent_at only on email success
  const insertIdx = api.indexOf('.insert(')
  const sendIdx   = api.indexOf('await sendDesignPartnerAlertEmail')
  check(insertIdx > -1 && sendIdx > insertIdx,
    '23n. API inserts the row BEFORE attempting the admin email')
  check(api.includes('admin_email_sent_at') && api.includes('emailSent'),
    '23o. API updates admin_email_sent_at conditioned on email success')

  // Insert failure → 500, no success
  check(api.includes('insertError') && api.includes('status: 500'),
    '23p. API returns 500 if DB insert fails')

  // Email failure → still success (DO NOT throw / DO NOT 500)
  // The presence of try/catch around the send + the success response after
  // emailSent assignment is sufficient.
  check(
    api.includes("ok: true") &&
    api.includes("emailSent") &&
    api.includes('catch'),
    '23q. API still returns success when admin email fails after DB insert',
  )

  // Public visitor path — no auth check required, no cookies()/headers() pull
  check(
    !api.includes("@/lib/supabase/server") &&
    !api.includes("'next/headers'"),
    '23r. API does not require an authenticated session (public route)',
  )

  // ── 24. Email helper ────────────────────────────────────────────────────
  check(mail.includes('Resend'),
    '24a. email helper imports Resend')
  check(mail.includes('RESEND_API_KEY'),
    '24b. email helper reads RESEND_API_KEY')
  check(
    mail.includes('DESIGN_PARTNER_ALERT_EMAIL') &&
    mail.includes('ADMIN_SIGNUP_ALERT_EMAIL') &&
    mail.includes('ADMIN_EMAIL'),
    '24c. recipient resolution: DESIGN_PARTNER_ALERT_EMAIL → ADMIN_SIGNUP_ALERT_EMAIL → ADMIN_EMAIL',
  )
  check(mail.includes('EMAIL_FROM'),
    '24d. email helper reads EMAIL_FROM (sender address env var)')
  check(mail.includes('replyTo'),
    '24e. email helper sets replyTo to applicant email')
  check(mail.includes('New Vektrum design partner application'),
    '24f. admin email subject "New Vektrum design partner application"')
  // Never throws
  check(mail.includes('try {') && mail.includes('catch'),
    '24g. email helper wraps the send in try/catch (never throws)')
  // Returns boolean for caller (success → true, otherwise false)
  check(mail.includes(': Promise<boolean>') || mail.includes('Promise<boolean>'),
    '24h. email helper returns Promise<boolean> for caller decisioning')

  // ── 25. Form posts to API with UTMs/referrer + Lead AFTER success ───────
  check(
    form.includes("'/api/design-partner-applications'"),
    '25a. form POSTs to /api/design-partner-applications',
  )
  check(
    form.includes("method:  'POST'") || form.includes("method: 'POST'"),
    '25b. form uses POST method',
  )
  check(
    form.includes('utmSource')   && form.includes('utmMedium') &&
    form.includes('utmCampaign') && form.includes('utmContent') &&
    form.includes('utmTerm'),
    '25c. form payload includes utmSource/Medium/Campaign/Content/Term',
  )
  check(
    form.includes('referrer:'),
    '25d. form payload includes referrer',
  )
  check(
    form.includes('readUrlParam') && form.includes("'utm_source'"),
    '25e. form reads UTM params from window.location at submit time',
  )
  // Lead must fire only after successful response — i.e. the actual call
  // (lastIndexOf skips the docstring example at the top of the file)
  // appears AFTER the `if (!res.ok)` guard returns.
  const okGuardIdx = form.indexOf('if (!res.ok)')
  const leadIdx    = form.lastIndexOf("trackMetaEvent('Lead'")
  check(
    okGuardIdx > -1 && leadIdx > okGuardIdx,
    '25f. trackMetaEvent("Lead") call site is AFTER the !res.ok guard (success only)',
  )
  // Honeypot field rendered
  check(
    form.includes('name="website"') &&
    (form.includes('left: \'-10000px\'') || form.includes('aria-hidden')),
    '25g. form includes a hidden honeypot "website" field',
  )

  // Success state copy
  check(
    form.includes('Application received.') &&
    form.includes('design-partner cohort'),
    '25h. success state shows "Application received." + cohort follow-up copy',
  )

  // Error state — surfaced when API returns non-2xx
  check(
    form.includes('errorMsg') && form.includes('role="alert"'),
    '25i. form surfaces an inline error message with role="alert" on failure',
  )

  // ── 26. No banned phrases re-introduced in any of the new files ─────────
  const newSurface = [src, form, api, mail].join('\n').toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum acts as escrow',
    'ai approves release',
    'ai approved release',
    'automatic payment',
    'guarantees compliance',
    'guarantees payment',
    'prevents fraud',
    'join beta',
  ]) {
    check(!newSurface.includes(banned),
      `26. no banned phrase: "${banned}" in design-partner surface`,
    )
  }

  console.log('\n✓ All design-partner-page tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
