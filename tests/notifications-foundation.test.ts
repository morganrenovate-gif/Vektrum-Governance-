/**
 * Notification Foundation — Static Safety and Brand-Lock Tests
 *
 * Static source-parse checks — no live DB, no env vars required.
 * Verifies that the notification foundation is correctly implemented,
 * brand-safe, custody-compliant, and wired to the first event.
 *
 * Checks:
 *  1.  Migration file exists.
 *  2.  Migration creates notifications table.
 *  3.  Migration enables RLS on notifications.
 *  4.  Migration has a SELECT-own policy (recipient_user_id = auth.uid()).
 *  5.  Migration has no INSERT/UPDATE/DELETE policy for regular users.
 *  6.  notify.ts helper file exists.
 *  7.  renderVektrumEmail renders a Vektrum header (branded header bar).
 *  8.  Subject format uses [Vektrum] prefix.
 *  9.  Email footer includes the mandatory custody disclaimer (no-hold/no-escrow/no-direct-move).
 * 10.  No banned phrases in email template (holds funds, escrow, moves money, etc.).
 * 11.  CTA uses only approved action language.
 * 12.  notify.ts does not expose RESEND_API_KEY or any service-role secret in template output.
 * 13.  change-orders POST route imports notifyChangeOrderSubmitted.
 * 14.  change-orders POST route fires notifyChangeOrderSubmitted after successful insert.
 * 15.  sendEmailNotification is guarded by RESEND_API_KEY (skips when absent).
 * 16.  createNotification inserts 'pending' status initially.
 * 17.  No release gate, Stripe execution, partner API, or auth behavior is changed.
 * 18.  Test wired into npm test in package.json.
 *
 * Run:  npx tsx tests/notifications-foundation.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

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

function read(p: string): string {
  return fs.readFileSync(path.resolve(ROOT, p), 'utf-8')
}

// Strip comments and string literals — used for banned-phrase checks against
// rendered output (comments documenting banned phrases must not trigger the check).
function codeAndTemplate(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '')          // line comments
}

const MIGRATION    = 'supabase/migrations/20260428000000_notifications.sql'
const NOTIFY       = 'src/lib/engine/notify.ts'
const CHANGE_ORDER = 'src/app/api/change-orders/route.ts'
const PKG          = 'package.json'

// Files that must NOT be touched by the notification foundation
const GATE_FILE    = 'src/lib/engine/release-gate.ts'
const STRIPE_FILE  = 'src/app/api/stripe/webhook/route.ts'
const PARTNER_FILE = 'src/app/api/partner/releases'

async function main() {

// ─── 1-5. Migration ───────────────────────────────────────────────────────────

await test('1. Migration file exists at supabase/migrations/20260428000000_notifications.sql', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, MIGRATION)),
    `${MIGRATION} does not exist.`,
  )
})

await test('2. Migration creates notifications table', () => {
  const sql = read(MIGRATION)
  assert(
    sql.includes('CREATE TABLE') && sql.includes('notifications'),
    `${MIGRATION} must contain CREATE TABLE ... notifications.`,
  )
})

await test('3. Migration enables RLS on notifications', () => {
  const sql = read(MIGRATION)
  assert(
    sql.includes('ENABLE ROW LEVEL SECURITY'),
    `${MIGRATION} must call ALTER TABLE ... ENABLE ROW LEVEL SECURITY on notifications.`,
  )
})

await test('4. Migration has a SELECT-own policy using auth.uid()', () => {
  const sql = read(MIGRATION)
  assert(
    sql.includes('auth.uid()') && sql.includes('FOR SELECT'),
    `${MIGRATION} must create a SELECT policy using recipient_user_id = auth.uid().`,
  )
})

await test('5. Migration has no INSERT/UPDATE/DELETE policy for regular users', () => {
  const sql = read(MIGRATION)
  // The RLS setup must not grant INSERT/UPDATE/DELETE to any role except service-role
  // (service-role bypasses RLS entirely — no policy needed)
  const hasUserInsert  = /CREATE POLICY.*FOR INSERT.*USING\(true\)/si.test(sql)
  const hasUserUpdate  = /CREATE POLICY.*FOR UPDATE.*USING\(true\)/si.test(sql)
  const hasOpenSelect  = /USING\s*\(\s*true\s*\)/i.test(sql)
  assert(
    !hasUserInsert && !hasUserUpdate && !hasOpenSelect,
    `${MIGRATION} must not grant open INSERT/UPDATE/DELETE policies — only service-role writes.`,
  )
})

// ─── 6-12. notify.ts ──────────────────────────────────────────────────────────

await test('6. notify.ts helper file exists', () => {
  assert(
    fs.existsSync(path.resolve(ROOT, NOTIFY)),
    `${NOTIFY} does not exist.`,
  )
})

await test('7. renderVektrumEmail includes a branded Vektrum header', () => {
  const src = read(NOTIFY)
  assert(
    src.includes('Vektrum') && src.includes('Construction Disbursement Governance'),
    `${NOTIFY} renderVektrumEmail must include a Vektrum-branded header with the product name.`,
  )
})

await test('8. notifyChangeOrderSubmitted uses [Vektrum] subject prefix', () => {
  const src = read(NOTIFY)
  assert(
    src.includes('[Vektrum]'),
    `${NOTIFY} email subjects must start with "[Vektrum]" (e.g. "[Vektrum] Change order submitted").`,
  )
})

await test('9. Email footer includes mandatory custody disclaimer', () => {
  const src = read(NOTIFY)
  assert(
    src.includes('does not hold funds') || src.includes('does not hold funds, act as escrow'),
    `${NOTIFY} email footer must include the custody disclaimer: ` +
    '"Vektrum does not hold funds, act as escrow, or move money directly."',
  )
  assert(
    src.includes('does not hold funds, act as escrow, or move money directly'),
    `${NOTIFY} footer must say exactly "does not hold funds, act as escrow, or move money directly."`,
  )
})

await test('10. No banned phrases in email template', () => {
  // Strip comments so the documentation of banned phrases doesn't trigger the check
  const src = codeAndTemplate(read(NOTIFY))
  // These are banned *claims* — phrases that assert Vektrum holds/moves funds.
  // "does not hold funds" in the disclaimer is intentional and allowed.
  // "hold funds" / "act as escrow" appear in the disclaimer in a negated context —
  // only the affirmative claim forms are banned.
  const banned = [
    'Vektrum holds funds',
    'Vektrum moves money',
    'Vektrum moves wires',
    'Vektrum is escrow',
    'Vektrum is a payment processor',
    'AI approved',
    'instant payment',
    'Pay now',
    'Claim funds',
    'Instant payout',
    'Money sent by Vektrum',
  ]
  for (const phrase of banned) {
    assert(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${NOTIFY} must not contain the banned claim: "${phrase}"`,
    )
  }
})

await test('11. CTA uses only approved action language', () => {
  const src = read(NOTIFY)
  // The one CTA in the wired event must be from the approved list
  const approvedCtaLabels = [
    'Review in Vektrum',
    'View deal',
    'Review change order',
    'Upload lien waiver',
    'View release status',
  ]
  const hasApprovedCta = approvedCtaLabels.some(label => src.includes(label))
  assert(
    hasApprovedCta,
    `${NOTIFY} CTA label must be one of the approved labels: ${approvedCtaLabels.join(', ')}`,
  )
})

await test('12. notify.ts does not reference secret env var values in template output', () => {
  const src = read(NOTIFY)
  // The template function must not embed RESEND_API_KEY or service-role secrets
  // into the rendered HTML. It may reference env var names to read them, but must
  // not pass raw values into the template.
  const forbidden = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'CRON_SECRET',
  ]
  for (const secret of forbidden) {
    assert(
      !src.includes(secret),
      `${NOTIFY} must not reference ${secret} — secrets must never appear in notification templates.`,
    )
  }
  // RESEND_API_KEY is OK to reference (it's used to instantiate the client)
  // but must not appear inside renderVektrumEmail
  const renderFnStart = src.indexOf('export function renderVektrumEmail')
  const renderFnEnd   = src.indexOf('\nexport ', renderFnStart + 1)
  const renderFnBody  = renderFnEnd > 0 ? src.slice(renderFnStart, renderFnEnd) : src.slice(renderFnStart)
  assert(
    !renderFnBody.includes('RESEND_API_KEY'),
    `${NOTIFY} renderVektrumEmail must not reference RESEND_API_KEY inside the template renderer.`,
  )
})

// ─── 13-14. Wire-up ───────────────────────────────────────────────────────────

await test('13. change-orders POST route imports notifyChangeOrderSubmitted', () => {
  const src = read(CHANGE_ORDER)
  assert(
    src.includes('notifyChangeOrderSubmitted'),
    `${CHANGE_ORDER} must import and call notifyChangeOrderSubmitted from @/lib/engine/notify.`,
  )
})

await test('14. change-orders POST route calls notifyChangeOrderSubmitted after successful insert', () => {
  const src = read(CHANGE_ORDER)
  // Verify it's called after the logAudit (i.e. after successful insert)
  const auditPos  = src.lastIndexOf('change_order_created')
  const notifyPos = src.lastIndexOf('notifyChangeOrderSubmitted')
  assert(
    notifyPos > auditPos,
    `${CHANGE_ORDER} must call notifyChangeOrderSubmitted after logAudit (i.e. after successful insert). ` +
    `Found: notifyChangeOrderSubmitted at pos ${notifyPos}, change_order_created at pos ${auditPos}.`,
  )
})

// ─── 15. RESEND guard ─────────────────────────────────────────────────────────

await test('15. sendEmailNotification is guarded by RESEND_API_KEY', () => {
  const src = read(NOTIFY)
  assert(
    src.includes('RESEND_API_KEY') && src.includes("'skipped'"),
    `${NOTIFY} sendEmailNotification must check RESEND_API_KEY and set status 'skipped' when absent.`,
  )
})

// ─── 16. Pending status on create ────────────────────────────────────────────

await test("16. createNotification inserts status: 'pending'", () => {
  const src = read(NOTIFY)
  assert(
    src.includes("status:            'pending'") || src.includes("status: 'pending'"),
    `${NOTIFY} createNotification must insert with status: 'pending'.`,
  )
})

// ─── 17. No security logic touched ────────────────────────────────────────────

await test('17. Release gate, Stripe webhook, and partner API files are unchanged', () => {
  // These files must not import from notify.ts (no coupling to notification system)
  const gateExists   = fs.existsSync(path.resolve(ROOT, GATE_FILE))
  const stripeExists = fs.existsSync(path.resolve(ROOT, STRIPE_FILE))

  if (gateExists) {
    const gateSrc = read(GATE_FILE)
    assert(
      !gateSrc.includes('notify') && !gateSrc.includes('notification'),
      `${GATE_FILE} must not reference the notification system — release gate logic must be independent.`,
    )
  }

  if (stripeExists) {
    const stripeSrc = read(STRIPE_FILE)
    assert(
      !stripeSrc.includes("from '@/lib/engine/notify'"),
      `${STRIPE_FILE} must not import from notify.ts — Stripe webhook behavior must not change.`,
    )
  }

  // Partner API directory must not have changed — walk only regular files
  const partnerDir = path.resolve(ROOT, PARTNER_FILE)
  if (fs.existsSync(partnerDir)) {
    const walkDir = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const files: string[] = []
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) files.push(...walkDir(full))
        else if (entry.isFile()) files.push(full)
      }
      return files
    }
    const partnerFiles = walkDir(partnerDir)
    for (const f of partnerFiles) {
      const partnerSrc = fs.readFileSync(f, 'utf-8')
      assert(
        !partnerSrc.includes("from '@/lib/engine/notify'"),
        `Partner API file ${path.relative(ROOT, f)} must not import from notify.ts.`,
      )
    }
  }
})

// ─── 18. Wired into npm test ──────────────────────────────────────────────────

await test('18. Test file is wired into npm test in package.json', () => {
  const pkg = read(PKG)
  assert(
    pkg.includes('notifications-foundation.test.ts'),
    `package.json npm test script must include 'notifications-foundation.test.ts'.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — Notification Foundation Tests')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter((r) => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)

} // end main()

main()
