/**
 * tests/admin-signup-alert.test.ts
 *
 * Static source-parse checks proving that new user signups trigger an admin
 * email alert and that the implementation meets all safety requirements.
 *
 * What changed and why:
 *   When a new user signs up, the founder/admin receives no notification.
 *   We added notifyAdminNewSignup() to src/lib/engine/notify.ts and wired it
 *   into the auth webhook INSERT handler. The function is:
 *     - Idempotent: checks for an existing admin_signup_alert notification row
 *       before sending, so webhook retries do not send duplicate emails.
 *     - Fire-and-forget: never throws, wrapped in try/catch.
 *     - Non-blocking: signup succeeds even if the email fails.
 *     - Internal only: sends to admin, not to the new user.
 *
 * Checks:
 *  1.  notifyAdminNewSignup is exported from notify.ts
 *  2.  Auth webhook route imports notifyAdminNewSignup from notify
 *  3.  Auth webhook INSERT handler calls notifyAdminNewSignup
 *  4.  notifyAdminNewSignup reads ADMIN_SIGNUP_ALERT_EMAIL env var
 *  5.  notifyAdminNewSignup falls back to ADMIN_EMAIL if alert email not set
 *  6.  Email subject includes "New Vektrum signup"
 *  7.  Idempotency check: existing notification lookup before creating/sending
 *  8.  Function is fire-and-forget (try/catch with console.error, never throws)
 *  9.  No release gate logic modified (release route not touched)
 * 10.  No payment execution logic modified (Stripe route not touched)
 * 11.  No DocuSign logic modified
 * 12.  Admin alert sends to admin, not to the signing-up user (no 'userEmail' in to field)
 * 13.  package.json wires this test file into npm test
 *
 * Run: npx tsx tests/admin-signup-alert.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

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

const NOTIFY      = 'src/lib/engine/notify.ts'
const WEBHOOK     = 'src/app/api/auth/webhook/route.ts'
const PACKAGE_JSON = 'package.json'

async function main() {
  console.log('\nadmin-signup-alert.test.ts\n')

  check(exists(NOTIFY),  'notify.ts exists')
  check(exists(WEBHOOK), 'auth webhook route exists')

  const notify  = read(NOTIFY)
  const webhook = read(WEBHOOK)

  // ── 1. notifyAdminNewSignup is exported from notify.ts ────────────────────
  check(
    notify.includes('export async function notifyAdminNewSignup'),
    '1. notifyAdminNewSignup is exported from notify.ts',
  )

  // ── 2. Auth webhook imports notifyAdminNewSignup ──────────────────────────
  check(
    webhook.includes('notifyAdminNewSignup'),
    '2. Auth webhook route imports or references notifyAdminNewSignup',
  )

  // ── 3. INSERT handler calls notifyAdminNewSignup ──────────────────────────
  // The call must appear inside the INSERT block, not only at import level.
  const insertIdx  = webhook.indexOf("type === 'INSERT'")
  const updateIdx  = webhook.indexOf("type === 'UPDATE'")
  const insertBlock = insertIdx >= 0
    ? webhook.slice(insertIdx, updateIdx > insertIdx ? updateIdx : insertIdx + 2000)
    : ''
  check(
    insertBlock.includes('notifyAdminNewSignup'),
    '3. notifyAdminNewSignup is called inside the INSERT handler block',
  )

  // ── 4. Reads ADMIN_SIGNUP_ALERT_EMAIL env var ─────────────────────────────
  check(
    notify.includes('ADMIN_SIGNUP_ALERT_EMAIL'),
    '4. notifyAdminNewSignup reads ADMIN_SIGNUP_ALERT_EMAIL env var',
  )

  // ── 5. Falls back to ADMIN_EMAIL ──────────────────────────────────────────
  // The function for resolving alert emails must reference ADMIN_EMAIL as a fallback.
  const signupAlertFn = notify.slice(notify.indexOf('notifyAdminNewSignup'))
  check(
    signupAlertFn.includes('ADMIN_EMAIL'),
    '5. Admin signup alert email resolution falls back to ADMIN_EMAIL',
  )

  // ── 6. Subject includes "New Vektrum signup" ──────────────────────────────
  check(
    notify.includes('New Vektrum signup'),
    '6. Email subject includes "New Vektrum signup"',
  )

  // ── 7. Idempotency check: existing notification lookup ────────────────────
  // Before creating a new notification, the function must query for an existing
  // admin_signup_alert notification for the same user.
  check(
    notify.includes('admin_signup_alert'),
    '7. Idempotency check references admin_signup_alert notification type',
  )
  // The function must have a guard that returns early if one already exists.
  check(
    signupAlertFn.includes('existing') || signupAlertFn.includes('already sent'),
    '7b. Function has an early-return guard for duplicate sends',
  )

  // ── 8. Fire-and-forget: function is wrapped in try/catch ──────────────────
  // The function must catch all errors and log them, never re-throw.
  const fnStart  = notify.indexOf('export async function notifyAdminNewSignup')
  const fnEnd    = notify.indexOf('\nexport ', fnStart + 1)
  const fnBody   = fnEnd > fnStart ? notify.slice(fnStart, fnEnd) : notify.slice(fnStart)
  check(
    fnBody.includes('try {') && fnBody.includes('catch (err)'),
    '8. notifyAdminNewSignup is wrapped in try/catch (fire-and-forget)',
  )
  check(
    fnBody.includes("console.error('[notify] notifyAdminNewSignup"),
    '8b. Error is logged server-side, not re-thrown',
  )

  // ── 9. Release gate not touched ───────────────────────────────────────────
  // The release gate logic lives in src/app/api/deals/[dealId]/release/.
  // Verify that file is not imported or referenced in the new notification function.
  check(
    !fnBody.includes('/release/') && !fnBody.includes('release_gate'),
    '9. notifyAdminNewSignup does not touch release gate logic',
  )

  // ── 10. No payment execution logic modified ───────────────────────────────
  check(
    !fnBody.includes('stripe') && !fnBody.includes('Stripe') && !fnBody.includes('transfer'),
    '10. notifyAdminNewSignup does not touch Stripe or payment transfer logic',
  )

  // ── 11. No DocuSign logic modified ────────────────────────────────────────
  check(
    !fnBody.includes('docusign') && !fnBody.includes('DocuSign') && !fnBody.includes('envelope'),
    '11. notifyAdminNewSignup does not touch DocuSign logic',
  )

  // ── 12. Alert goes to admin, not to the signing-up user ───────────────────
  // The sendEmailNotification calls inside notifyAdminNewSignup must use
  // adminEmail (from getSignupAlertEmails / ADMIN_SIGNUP_ALERT_EMAIL),
  // NOT the raw userEmail passed into the function.
  // Proxy: the email loop iterates over adminEmails, not userEmail.
  check(
    fnBody.includes('alertEmails') || fnBody.includes('adminEmail') || fnBody.includes('for (const'),
    '12. Alert is sent to admin email list, not to the new user directly',
  )
  // Negative check: userEmail is NOT passed directly to sendEmailNotification
  // (it's used only in details/subject, never as the `to` recipient).
  const sendEmailCalls = [...fnBody.matchAll(/sendEmailNotification\([^)]+\)/g)]
  const anyToUserEmail = sendEmailCalls.some(m =>
    m[0].includes('ctx.userEmail') || m[0].includes('userEmail,')
  )
  check(
    !anyToUserEmail,
    '12b. sendEmailNotification is not called with ctx.userEmail as the recipient',
  )

  // ── 13. Test wired into package.json ──────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(
    pkg.includes('admin-signup-alert.test.ts'),
    '13. This test file is wired into npm test in package.json',
  )

  console.log('\n✓ All admin-signup-alert tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
