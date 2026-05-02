/**
 * tests/production-readiness-pass.test.ts
 *
 * Final guardrail pass — pins the static side of the production smoke test
 * checklist (docs/PRODUCTION_SMOKE_TEST.md). Verifies that:
 *
 *   1. Every critical route file from the focused passes still exists.
 *   2. Every critical helper/migration still exists.
 *   3. The homepage primary CTA still points at the design-partner funnel.
 *   4. Banned positioning claims are absent across the most user-visible
 *      surfaces (homepage, design-partners, dashboard, deal page,
 *      contract upload section, contract signing section, demo pages).
 *   5. The smoke-test doc itself exists and lists the spec'd sections.
 *
 * This test does not duplicate per-pass tests — it covers the cross-cutting
 * "did anything obviously regress" surface. If any single line fails,
 * something landed that broke a prior pass's invariant.
 *
 * Run: npx tsx tests/production-readiness-pass.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

// ─── Critical files ──────────────────────────────────────────────────────
//
// One per focused pass. Adding a new pass? Append the file here so a future
// regression that deletes the surface fails this guard.
const CRITICAL_FILES: Array<[string, string]> = [
  // Design-partner funnel
  ['design-partner page',              'src/app/(marketing)/design-partners/page.tsx'],
  ['design-partner form',              'src/app/(marketing)/design-partners/design-partner-apply-form.tsx'],
  ['design-partner API',               'src/app/api/design-partner-applications/route.ts'],
  ['design-partner email helper',      'src/lib/email/design-partner-alert.ts'],
  ['design-partner migration',         'supabase/migrations/20260430000000_design_partner_applications.sql'],

  // Marketing
  ['homepage',                         'src/app/(marketing)/page.tsx'],
  ['marketing layout',                 'src/app/(marketing)/layout.tsx'],
  ['demo-live layout',                 'src/app/(marketing)/demo-live/layout.tsx'],
  ['public meta.json',                 'public/meta.json'],

  // Dashboard / setup
  ['dashboard',                        'src/app/(app)/dashboard/page.tsx'],
  ['new-deal page',                    'src/app/(app)/dashboard/deals/new/page.tsx'],
  ['new-deal form',                    'src/app/(app)/dashboard/deals/new/new-deal-form.tsx'],
  ['deal page',                        'src/app/(app)/dashboard/deals/[dealId]/page.tsx'],

  // Contract / DocuSign
  ['contract upload section',          'src/components/deal/contract-upload-section.tsx'],
  ['contract signing section',         'src/components/deal/contract-signing-section.tsx'],
  ['contract sign route',              'src/app/api/deals/[dealId]/contract/sign/route.ts'],
  ['contract send-envelope route',     'src/app/api/deals/[dealId]/contract/send-envelope/route.ts'],
  ['contract refresh-signing-status',  'src/app/api/deals/[dealId]/contract/refresh-signing-status/route.ts'],
  ['DocuSign engine',                  'src/lib/engine/docusign.ts'],
  ['DocuSign signer-identity helper',  'src/lib/engine/docusign-signer-identity.ts'],
  ['DocuSign notify helper',           'src/lib/engine/docusign-notify.ts'],
  ['DocuSign webhook',                 'src/app/api/webhooks/docusign/route.ts'],

  // Notifications + activity
  ['notification engine',              'src/lib/engine/notify.ts'],
  ['notifications API',                'src/app/api/notifications/route.ts'],
  ['notification bell',                'src/components/nav/notification-bell.tsx'],

  // Demo
  ['demo contractor',                  'src/app/(marketing)/demo-live/contractor/page.tsx'],
  ['demo funder',                      'src/app/(marketing)/demo-live/funder/page.tsx'],
  ['demo harbor deal',                 'src/app/(marketing)/demo-live/deal/harbor/page.tsx'],

  // Smoke-test doc
  ['production smoke-test doc',        'docs/PRODUCTION_SMOKE_TEST.md'],
]

// ─── Surfaces that must remain free of banned positioning claims ─────────
const SURFACES_FOR_BANNED_PHRASE_GUARD: Array<[string, string]> = [
  ['homepage',                  'src/app/(marketing)/page.tsx'],
  ['design-partner page',       'src/app/(marketing)/design-partners/page.tsx'],
  ['design-partner form',       'src/app/(marketing)/design-partners/design-partner-apply-form.tsx'],
  ['dashboard',                 'src/app/(app)/dashboard/page.tsx'],
  ['new-deal form',             'src/app/(app)/dashboard/deals/new/new-deal-form.tsx'],
  ['contract upload section',   'src/components/deal/contract-upload-section.tsx'],
  ['contract signing section',  'src/components/deal/contract-signing-section.tsx'],
  ['demo contractor',           'src/app/(marketing)/demo-live/contractor/page.tsx'],
  ['demo funder',               'src/app/(marketing)/demo-live/funder/page.tsx'],
]

const BANNED_PHRASES = [
  'vektrum moves money',
  'vektrum holds funds',
  'vektrum acts as escrow',
  'vektrum is escrow',
  'vektrum is a lender',
  'vektrum releases funds',
  'vektrum guarantees compliance',
  'vektrum prevents fraud',
  'ai approves release',
  'ai approved release',
  'ai authorizes payment',
  'automatic payment',
  'funds move automatically',
  'contractor authorizes release',
  'guarantees compliance',
  'join beta',
] as const

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel))
}

// Strip JS/TS line + block comments and JSX comments so we don't false-fail
// on documentation text that explicitly mentions banned phrases as denials.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

async function main() {
  console.log('\nproduction-readiness-pass.test.ts\n')

  // ── 1. Critical files exist ──────────────────────────────────────────────
  console.log('1. Critical files exist')
  for (const [label, p] of CRITICAL_FILES) {
    check(exists(p), `  1. ${label}: ${p}`)
  }

  // ── 2. Homepage primary CTA points at the design-partner funnel ──────────
  console.log('\n2. Homepage primary CTA wiring')
  const home = read('src/app/(marketing)/page.tsx')
  check(home.includes('href="/design-partners#apply"'),
    '  2a. homepage links to /design-partners#apply')
  // Primary CTA Link wraps the spec'd CTA text
  const primaryLink = home.match(/<Link[^>]*href="\/design-partners#apply"[^>]*>[\s\S]*?<\/Link>/)
  check(
    !!primaryLink && primaryLink[0].includes('Apply to become a design partner'),
    '  2b. <Link href="/design-partners#apply"> wraps "Apply to become a design partner"',
  )
  check(
    home.includes('Stop releasing draws on incomplete evidence'),
    '  2c. homepage hero H1 unchanged',
  )
  check(
    home.includes('Workflow tools track. Vektrum enforces.'),
    '  2d. homepage supporting line unchanged',
  )
  // Old CTA must remain gone
  check(
    !home.includes('Start your first deal'),
    '  2e. old "Start your first deal" CTA still removed',
  )

  // ── 3. Design-partner page still has the form + ISR + canonical ─────────
  console.log('\n3. Design-partner funnel intact')
  const dp = read('src/app/(marketing)/design-partners/page.tsx')
  check(dp.includes('export const revalidate'),
    '  3a. /design-partners declares ISR via revalidate')
  check(dp.includes('alternates: { canonical: \'https://vektrum.io/design-partners\' }'),
    '  3b. /design-partners self-canonical')
  check(dp.includes('id="apply"'),
    '  3c. /design-partners has #apply form anchor')

  const dpApi = read('src/app/api/design-partner-applications/route.ts')
  check(dpApi.includes('createSupabaseAdminClient'),
    '  3d. design-partner API uses the admin client (RLS bypass)')
  check(dpApi.includes('design_partner_applications'),
    '  3e. design-partner API targets the correct table')

  // ── 4. Dashboard role-correct empty states still in place ───────────────
  console.log('\n4. Dashboard role-correct empty states')
  const dash = read('src/app/(app)/dashboard/page.tsx')
  // Funder
  check(dash.includes('No governed deals yet'),                       '  4a. funder empty title')
  check(dash.includes('"Create governed deal"') &&
        dash.includes('href: "/dashboard/deals/new"'),                 '  4b. funder CTA wiring')
  // Contractor
  check(dash.includes('No projects yet'),                              '  4c. contractor empty title')
  check(dash.includes('"Submit project information"') &&
        dash.includes('href: "/dashboard/deals/new"'),                 '  4d. contractor CTA wiring')
  // Unknown role
  check(dash.includes('Complete your profile to continue.'),          '  4e. unknown-role prompt preserved')

  // ── 5. Contract sign route uses the shared resolver ─────────────────────
  console.log('\n5. DocuSign signer identity resolver wired')
  const sign  = read('src/app/api/deals/[dealId]/contract/sign/route.ts')
  const send  = read('src/app/api/deals/[dealId]/contract/send-envelope/route.ts')
  for (const [label, src] of [['sign route', sign], ['send-envelope route', send]] as const) {
    check(src.includes('resolveSignerIdentity') &&
          src.includes('@/lib/engine/docusign-signer-identity'),
      `  5. ${label} uses resolveSignerIdentity`)
  }

  // ── 6. Notification helpers wired into the routes that fire them ────────
  console.log('\n6. Notification helpers wired')
  const helper = read('src/lib/engine/docusign-notify.ts')
  for (const fn of [
    'notifyContractorTurnToSign',
    'notifyContractEnvelopeSent',
    'notifyContractFullyExecuted',
  ]) {
    check(helper.includes(`export async function ${fn}`),
      `  6a. helper exports ${fn}`)
  }
  check(send.includes('notifyContractEnvelopeSent'),
    '  6b. send-envelope wires notifyContractEnvelopeSent')
  const webhook = read('src/app/api/webhooks/docusign/route.ts')
  check(webhook.includes('notifyContractFullyExecuted') &&
        webhook.includes('notifyContractorTurnToSign'),
    '  6c. webhook wires both contractor-turn and fully-executed helpers')
  const refresh = read('src/app/api/deals/[dealId]/contract/refresh-signing-status/route.ts')
  check(refresh.includes('notifyContractFullyExecuted') &&
        refresh.includes('notifyContractorTurnToSign'),
    '  6d. refresh route wires both helpers')

  // ── 7. NotificationBell labels for the contract types ──────────────────
  console.log('\n7. Notification bell labels')
  const bell = read('src/components/nav/notification-bell.tsx')
  for (const [type, label] of [
    ['contract_envelope_sent',  'Contract sent for signature'],
    ['contract_signing_turn',   'Contract signing'],
    ['contract_fully_executed', 'Contract executed'],
  ] as const) {
    check(bell.includes(type) && bell.includes(`'${label}'`),
      `  7. typeLabel maps "${type}" → "${label}"`)
  }

  // ── 8. public/meta.json is safe ────────────────────────────────────────
  console.log('\n8. public/meta.json safe')
  const meta = JSON.parse(read('public/meta.json')) as Record<string, unknown>
  check(meta.name === 'Vektrum',                              '  8a. name')
  check(meta.url === 'https://vektrum.io',                    '  8b. url')
  check(meta.type === 'website',                              '  8c. type')
  check(typeof meta.description === 'string',                 '  8d. description string')
  const metaKeys = Object.keys(meta).sort()
  check(JSON.stringify(metaKeys) === JSON.stringify(['description','name','type','url']),
    `  8e. exactly four documented keys (got ${JSON.stringify(metaKeys)})`)

  // ── 9. Banned positioning phrases absent across user-visible surfaces ──
  console.log('\n9. Banned positioning phrases absent')
  for (const [label, p] of SURFACES_FOR_BANNED_PHRASE_GUARD) {
    const lower = stripComments(read(p)).toLowerCase()
    for (const banned of BANNED_PHRASES) {
      check(!lower.includes(banned),
        `  9. ${label}: "${banned}" absent`)
    }
  }

  // ── 10. Smoke-test doc has the spec'd sections ─────────────────────────
  console.log('\n10. Smoke-test doc contents')
  const doc = read('docs/PRODUCTION_SMOKE_TEST.md')
  for (const heading of [
    'Public marketing pages',
    'Cache headers',
    'Design Partner application funnel',
    'Signup / login',
    'Funder empty dashboard',
    'Contractor empty dashboard',
    'Deal creation / setup',
    'Contract upload + DocuSign signing',
    'Release-gate safety',
    'Notifications',
    'Demo / live demo',
    'Stripe / payment guardrails',
    'Analytics',
    'Known non-goals',
  ]) {
    check(doc.includes(heading), `  10. doc covers section "${heading}"`)
  }
  // Doc explicitly includes curl commands the spec asked for
  check(doc.includes('curl -I https://vektrum.io/'),
    '  10. doc includes curl -I https://vektrum.io/')
  check(doc.includes('x-vercel-cache: HIT'),
    '  10. doc explains x-vercel-cache: HIT expectation')

  // ── 11. Test wired into npm test ───────────────────────────────────────
  const pkg = read('package.json')
  check(pkg.includes('production-readiness-pass.test.ts'),
    '11. production-readiness-pass.test.ts wired into npm test')

  console.log('\n✓ All production-readiness-pass tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
