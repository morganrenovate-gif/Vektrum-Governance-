/**
 * tests/ops-release-health-clarity.test.ts
 *
 * Static source-parse checks verifying ops dashboard release health clarity:
 *
 *  Stuck-release detection preserved
 *   1. release-health route still queries milestones with status='approved' + cutoff
 *   2. release-health route still returns stuck_releases + failed_payouts
 *   3. ReleaseHealthPanel still renders stuck approval list
 *   4. ReleaseHealthPanel still renders failed payout list
 *
 *  Failed-payout detection preserved
 *   5. release-health route still queries status='payout_failed'
 *   6. ReleaseHealthPanel still has FailedRow component
 *
 *  Stripe webhook warning preserved
 *   7. WebhookHealthPanel still has 'Webhook feed critical' path
 *   8. WebhookHealthPanel still has 'Webhook feed degraded' path
 *   9. webhook-health route still derives feedHealth = 'critical'
 *
 *  Test-mode clarity added
 *  10. release-health route exposes stripe_mode field
 *  11. webhook-health route exposes stripe_mode field
 *  12. ReleaseHealthPanel has test-mode banner (FlaskConical / "Stripe test mode")
 *  13. ReleaseHealthPanel distinguishes test-only-stuck from live-alarm copy
 *  14. ReleaseHealthPanel preserves "needs attention" language for production path
 *  15. WebhookHealthPanel has test-mode webhook note
 *
 *  Deal link added to stuck rows
 *  16. StuckRow expanded section links to /dashboard/deals/[deal_id]
 *  17. FailedRow expanded section links to /dashboard/deals/[deal_id]
 *
 *  No payment/gate logic changed
 *  18. release-health route: no .insert/.update/.delete/.upsert (still read-only)
 *  19. webhook-health route: no .insert/.update/.delete/.upsert (still read-only)
 *  20. stripe_mode derived from env var only — no Stripe SDK call added
 *
 *  package.json
 *  21. Test wired into npm test
 *
 * Run: npx tsx tests/ops-release-health-clarity.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

function read(rel: string): string {
  const full = path.resolve(ROOT, rel)
  if (!fs.existsSync(full)) throw new Error(`File not found: ${rel}`)
  return fs.readFileSync(full, 'utf-8')
}

// Strip comments so safety checks don't match comment text
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

const RELEASE_HEALTH_ROUTE    = 'src/app/api/admin/ops/release-health/route.ts'
const WEBHOOK_HEALTH_ROUTE    = 'src/app/api/admin/ops/webhook-health/route.ts'
const RELEASE_HEALTH_PANEL    = 'src/components/admin/ops/ReleaseHealthPanel.tsx'
const WEBHOOK_HEALTH_PANEL    = 'src/components/admin/ops/WebhookHealthPanel.tsx'
const PACKAGE_JSON            = 'package.json'

async function main() {
  console.log('\nops-release-health-clarity.test.ts\n')

  const releaseRoute   = read(RELEASE_HEALTH_ROUTE)
  const webhookRoute   = read(WEBHOOK_HEALTH_ROUTE)
  const releasePanel   = read(RELEASE_HEALTH_PANEL)
  const webhookPanel   = read(WEBHOOK_HEALTH_PANEL)
  const pkg            = read(PACKAGE_JSON)

  const releaseCode    = codeOnly(releaseRoute)
  const webhookCode    = codeOnly(webhookRoute)

  // ── 1–4: Stuck-release detection preserved ───────────────────────────────────
  console.log('Stuck-release detection — preserved')

  check(
    releaseRoute.includes("status', 'approved'") || releaseRoute.includes("eq('status', 'approved')"),
    ' 1. release-health route still queries approved milestones',
  )
  check(
    releaseRoute.includes('stuck_releases') && releaseRoute.includes('failed_payouts'),
    ' 2. release-health route still returns stuck_releases + failed_payouts',
  )
  check(
    releasePanel.includes('stuck_releases') || releasePanel.includes('StuckRow'),
    ' 3. ReleaseHealthPanel still renders stuck release list',
  )
  check(
    releasePanel.includes('failed_payouts') || releasePanel.includes('FailedRow'),
    ' 4. ReleaseHealthPanel still renders failed payout list',
  )

  // ── 5–6: Failed-payout detection preserved ───────────────────────────────────
  console.log('\nFailed-payout detection — preserved')

  check(
    releaseRoute.includes("'payout_failed'") || releaseRoute.includes('"payout_failed"'),
    ' 5. release-health route still queries payout_failed milestones',
  )
  check(
    releasePanel.includes('function FailedRow') || releasePanel.includes('FailedRow'),
    ' 6. ReleaseHealthPanel still has FailedRow component',
  )

  // ── 7–9: Stripe webhook warning preserved ────────────────────────────────────
  console.log('\nStripe webhook warning — preserved')

  check(webhookPanel.includes('Webhook feed critical'),    ' 7. WebhookHealthPanel still has critical feed path')
  check(webhookPanel.includes('Webhook feed degraded'),    ' 8. WebhookHealthPanel still has degraded feed path')
  check(
    webhookCode.includes("feedHealth = 'critical'") || webhookRoute.includes("feedHealth = 'critical'"),
    ' 9. webhook-health route still has critical feedHealth path',
  )

  // ── 10–15: Test-mode clarity added ───────────────────────────────────────────
  console.log('\nTest-mode clarity — added')

  check(
    releaseRoute.includes('stripe_mode') && releaseRoute.includes('sk_test_'),
    '10. release-health route exposes stripe_mode field',
  )
  check(
    webhookRoute.includes('stripe_mode') && webhookRoute.includes('sk_test_'),
    '11. webhook-health route exposes stripe_mode field',
  )
  check(
    releasePanel.includes('FlaskConical') && (
      releasePanel.includes('Stripe test mode') || releasePanel.includes('test mode active')
    ),
    '12. ReleaseHealthPanel has test-mode banner',
  )
  check(
    releasePanel.includes('isTestOnlyStuck') || releasePanel.includes('test rail, no live funds'),
    '13. ReleaseHealthPanel distinguishes test-only-stuck from live-alarm',
  )
  check(
    releasePanel.includes('needs attention'),
    '14. ReleaseHealthPanel preserves "needs attention" copy for production path',
  )
  check(
    webhookPanel.includes('FlaskConical') && (
      webhookPanel.includes('webhook gaps expected') || webhookPanel.includes('test mode')
    ),
    '15. WebhookHealthPanel has test-mode webhook note',
  )

  // ── 16–17: Deal links added ───────────────────────────────────────────────────
  console.log('\nDeal links — added to expanded rows')

  check(
    releasePanel.includes('/dashboard/deals/${item.deal_id}') ||
    releasePanel.includes('/dashboard/deals/'),
    '16. StuckRow links to /dashboard/deals/[deal_id]',
  )
  check(
    (releasePanel.match(/dashboard\/deals/g) ?? []).length >= 2,
    '17. FailedRow also links to /dashboard/deals/[deal_id]',
  )

  // ── 18–20: No payment/gate logic changed ─────────────────────────────────────
  console.log('\nPayment/gate logic — unchanged')

  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    check(
      !new RegExp(`\\.${verb}\\s*\\(`).test(releaseCode),
      `18/19. release-health route has no .${verb}() call (still read-only)`,
    )
  }
  for (const verb of ['insert', 'update', 'delete', 'upsert']) {
    check(
      !new RegExp(`\\.${verb}\\s*\\(`).test(webhookCode),
      `18/19. webhook-health route has no .${verb}() call (still read-only)`,
    )
  }
  check(
    releaseRoute.includes('STRIPE_SECRET_KEY') && !releaseRoute.includes('stripe.transfers'),
    '20. stripe_mode derived from env var only — no Stripe SDK transfer call added',
  )

  // ── 21: package.json ─────────────────────────────────────────────────────────
  check(pkg.includes('ops-release-health-clarity.test.ts'), '21. Test wired into npm test in package.json')

  console.log('\n✓ All ops-release-health-clarity tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
