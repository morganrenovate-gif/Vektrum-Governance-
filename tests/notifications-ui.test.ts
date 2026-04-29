/**
 * In-App Notification Center — Static Safety Tests
 *
 * Verifies the notification center is correctly implemented:
 * - API routes fetch and update the authenticated user's own notifications
 * - Mark-as-read enforces ownership before updating
 * - NotificationBell component renders unread count, notification list, and controls
 * - RLS and access control are not weakened
 * - Release gate, Stripe, and audit logic are unchanged
 *
 * Source-parse checks only — no live DB, no rendering, no env vars required.
 *
 * Checks:
 *  1.  GET /api/notifications route file exists
 *  2.  GET route uses getAuthUser (not unauthenticated)
 *  3.  GET route restricts query to recipient_user_id = user.id
 *  4.  GET route returns notifications and unread_count
 *  5.  GET route computes unread_count from read_at IS NULL
 *  6.  POST /api/notifications/mark-read route file exists
 *  7.  Mark-read route uses getAuthUser
 *  8.  Mark-read single: verifies notification belongs to calling user
 *  9.  Mark-read single: uses admin client to update (not session client)
 * 10.  Mark-read all: filters by recipient_user_id = user.id
 * 11.  Mark-read all: uses admin client to update
 * 12.  Mark-read returns { updated: number }
 * 13.  Mark-read blocks body with neither id nor all
 * 14.  AppNotification type exported from types.ts
 * 15.  AppNotification type includes read_at field
 * 16.  read_at migration file exists
 * 17.  Migration adds read_at column with DEFAULT NULL
 * 18.  Migration creates unread index on notifications
 * 19.  NotificationBell component file exists
 * 20.  NotificationBell fetches from /api/notifications
 * 21.  NotificationBell renders unread count badge
 * 22.  NotificationBell renders notification list (role="list")
 * 23.  NotificationBell renders "Mark all read" control
 * 24.  NotificationBell calls /api/notifications/mark-read on mark-read
 * 25.  NotificationBell renders deal link when deal_id is available
 * 26.  NotificationBell strips "[Vektrum]" prefix from subjects
 * 27.  NotificationBell is imported in layout.tsx
 * 28.  NotificationBell is rendered next to UserMenu in layout.tsx
 * 29.  Release gate is unchanged (no notification references added)
 * 30.  Stripe payment route is unchanged
 * 31.  Test file is wired into npm test in package.json
 *
 * Run: npx tsx tests/notifications-ui.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ─── Runner ───────────────────────────────────────────────────────────────────

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

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf-8')
}

function exists(relPath: string): boolean {
  return fs.existsSync(path.resolve(ROOT, relPath))
}

// ─── File paths ───────────────────────────────────────────────────────────────

const NOTIF_ROUTE      = 'src/app/api/notifications/route.ts'
const MARK_READ_ROUTE  = 'src/app/api/notifications/mark-read/route.ts'
const TYPES            = 'src/lib/types.ts'
const MIGRATION        = 'supabase/migrations/20260429000003_notifications_read_at.sql'
const BELL             = 'src/components/nav/notification-bell.tsx'
const LAYOUT           = 'src/app/layout.tsx'
const GATE             = 'src/lib/engine/release-gate.ts'
const STRIPE_ROUTE     = 'src/app/api/stripe/webhooks/route.ts'
const PACKAGE_JSON     = 'package.json'

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── GET route ─────────────────────────────────────────────────────────────────

await test('1. GET /api/notifications route file exists', () => {
  assert(exists(NOTIF_ROUTE), `${NOTIF_ROUTE} must exist.`)
})

await test('2. GET route uses getAuthUser (not unauthenticated)', () => {
  const src = read(NOTIF_ROUTE)
  assert(
    src.includes('getAuthUser'),
    `${NOTIF_ROUTE} must call getAuthUser to authenticate the request before returning notifications.`,
  )
})

await test('3. GET route restricts query to recipient_user_id = user.id', () => {
  const src = read(NOTIF_ROUTE)
  assert(
    src.includes('recipient_user_id') && src.includes('user.id'),
    `${NOTIF_ROUTE} must filter notifications by recipient_user_id = user.id — users only see their own notifications.`,
  )
})

await test('4. GET route returns notifications and unread_count', () => {
  const src = read(NOTIF_ROUTE)
  assert(
    src.includes('notifications') && src.includes('unread_count'),
    `${NOTIF_ROUTE} must return both a notifications array and an unread_count in the response.`,
  )
})

await test('5. GET route computes unread_count from read_at IS NULL', () => {
  const src = read(NOTIF_ROUTE)
  assert(
    src.includes('read_at') && (src.includes('=== null') || src.includes('read_at') && src.includes('null')),
    `${NOTIF_ROUTE} must compute unread_count by counting notifications where read_at is null.`,
  )
})

// ── Mark-read route ───────────────────────────────────────────────────────────

await test('6. POST /api/notifications/mark-read route file exists', () => {
  assert(exists(MARK_READ_ROUTE), `${MARK_READ_ROUTE} must exist.`)
})

await test('7. Mark-read route uses getAuthUser', () => {
  const src = read(MARK_READ_ROUTE)
  assert(
    src.includes('getAuthUser'),
    `${MARK_READ_ROUTE} must call getAuthUser to authenticate the request.`,
  )
})

await test('8. Mark-read single: verifies notification belongs to calling user', () => {
  const src = read(MARK_READ_ROUTE)
  assert(
    src.includes('recipient_user_id') && src.includes('user.id'),
    `${MARK_READ_ROUTE} must verify recipient_user_id === user.id before marking a single notification as read.`,
  )
})

await test('9. Mark-read single: uses admin client to update', () => {
  const src = read(MARK_READ_ROUTE)
  assert(
    src.includes('createSupabaseAdminClient') || src.includes('adminClient') || src.includes('admin'),
    `${MARK_READ_ROUTE} must use the admin client to perform the UPDATE (no RLS UPDATE policy on notifications).`,
  )
})

await test('10. Mark-read all: filters by recipient_user_id = user.id', () => {
  const src = read(MARK_READ_ROUTE)
  assert(
    src.includes('all') && src.includes('recipient_user_id') && src.includes('user.id'),
    `${MARK_READ_ROUTE} must filter by recipient_user_id when marking all notifications as read.`,
  )
})

await test('11. Mark-read all: uses admin client to update', () => {
  const src = read(MARK_READ_ROUTE)
  assert(
    src.includes('createSupabaseAdminClient'),
    `${MARK_READ_ROUTE} must import and use createSupabaseAdminClient for the UPDATE query.`,
  )
})

await test('12. Mark-read returns { updated: number }', () => {
  const src = read(MARK_READ_ROUTE)
  assert(
    src.includes('updated'),
    `${MARK_READ_ROUTE} must return { updated: number } indicating how many rows were updated.`,
  )
})

await test('13. Mark-read rejects body with neither id nor all', () => {
  const src = read(MARK_READ_ROUTE)
  assert(
    src.includes('400'),
    `${MARK_READ_ROUTE} must return 400 when the body contains neither { id } nor { all: true }.`,
  )
})

// ── Types ─────────────────────────────────────────────────────────────────────

await test('14. AppNotification type exported from types.ts', () => {
  const src = read(TYPES)
  assert(
    src.includes('AppNotification'),
    `${TYPES} must export an AppNotification interface for use by the API routes and NotificationBell component.`,
  )
})

await test('15. AppNotification type includes read_at field', () => {
  const src = read(TYPES)
  assert(
    src.includes('read_at'),
    `${TYPES} AppNotification must include a read_at field (null = unread).`,
  )
})

// ── Migration ─────────────────────────────────────────────────────────────────

await test('16. read_at migration file exists', () => {
  assert(exists(MIGRATION), `${MIGRATION} must exist — adds read_at column to notifications.`)
})

await test('17. Migration adds read_at column with DEFAULT NULL', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('read_at') && (src.includes('DEFAULT NULL') || src.includes('DEFAULT null')),
    `${MIGRATION} must add read_at column with DEFAULT NULL so existing rows start as unread.`,
  )
})

await test('18. Migration creates unread index on notifications', () => {
  const src = read(MIGRATION)
  assert(
    src.includes('CREATE INDEX') && src.includes('read_at'),
    `${MIGRATION} must create an index that includes read_at to support efficient unread-count lookups.`,
  )
})

// ── NotificationBell component ────────────────────────────────────────────────

await test('19. NotificationBell component file exists', () => {
  assert(exists(BELL), `${BELL} must exist.`)
})

await test('20. NotificationBell fetches from /api/notifications', () => {
  const src = read(BELL)
  assert(
    src.includes('/api/notifications'),
    `${BELL} must fetch from /api/notifications to load the user's notification list.`,
  )
})

await test('21. NotificationBell renders unread count badge', () => {
  const src = read(BELL)
  assert(
    src.includes('unreadCount') && (src.includes('unread_count') || src.includes('unreadCount')),
    `${BELL} must render a visible badge showing the unread notification count.`,
  )
})

await test('22. NotificationBell renders notification list (role="list")', () => {
  const src = read(BELL)
  assert(
    src.includes('role="list"') || src.includes("role='list'"),
    `${BELL} must include role="list" on the notification list container for accessibility.`,
  )
})

await test('23. NotificationBell renders "Mark all read" control', () => {
  const src = read(BELL)
  assert(
    src.includes('Mark all read') || src.includes('mark all'),
    `${BELL} must render a "Mark all read" button or control so users can dismiss all notifications at once.`,
  )
})

await test('24. NotificationBell calls /api/notifications/mark-read on mark-read', () => {
  const src = read(BELL)
  assert(
    src.includes('/api/notifications/mark-read'),
    `${BELL} must POST to /api/notifications/mark-read when marking a notification as read.`,
  )
})

await test('25. NotificationBell renders deal link when deal_id is available', () => {
  const src = read(BELL)
  assert(
    src.includes('deal_id') && src.includes('/dashboard/deals/'),
    `${BELL} must render a link to /dashboard/deals/[dealId] when the notification has a deal_id.`,
  )
})

await test('26. NotificationBell strips "[Vektrum]" prefix from subjects', () => {
  const src = read(BELL)
  // The prefix is stripped via a regex — the source will contain \[Vektrum\]
  // (escaped for regex) or the literal string, depending on implementation style.
  assert(
    src.includes('Vektrum') && src.includes('replace'),
    `${BELL} must call .replace() on subject to strip the "[Vektrum]" email prefix from in-app display.`,
  )
})

// ── Layout wiring ─────────────────────────────────────────────────────────────

await test('27. NotificationBell is imported in layout.tsx', () => {
  const src = read(LAYOUT)
  assert(
    src.includes('NotificationBell'),
    `${LAYOUT} must import NotificationBell from @/components/nav/notification-bell.`,
  )
})

await test('28. NotificationBell is rendered next to UserMenu in layout.tsx', () => {
  const src = read(LAYOUT)
  // Both components must appear in the same section of the nav
  const notifIdx = src.indexOf('NotificationBell')
  const menuIdx  = src.indexOf('UserMenu')
  assert(
    notifIdx > -1 && menuIdx > -1 && Math.abs(notifIdx - menuIdx) < 500,
    `${LAYOUT} must render <NotificationBell /> adjacent to <UserMenu> in the authenticated nav bar.`,
  )
})

// ── Safety: release gate and payment routes unchanged ─────────────────────────

await test('29. Release gate is unchanged (no notification references added)', () => {
  if (!exists(GATE)) return
  const src = read(GATE)
  assert(
    !src.includes('notification') && !src.includes('read_at'),
    `${GATE} must not reference notifications — release gate logic is unchanged.`,
  )
})

await test('30. Stripe payment route is unchanged', () => {
  if (!exists(STRIPE_ROUTE)) return
  const src = read(STRIPE_ROUTE)
  assert(
    !src.includes('mark-read') && !src.includes('NotificationBell'),
    `${STRIPE_ROUTE} must not reference notification UI — payment execution is unchanged.`,
  )
})

// ── Package.json ──────────────────────────────────────────────────────────────

await test('31. Test file is wired into npm test in package.json', () => {
  const src = read(PACKAGE_JSON)
  assert(
    src.includes('notifications-ui.test.ts'),
    `${PACKAGE_JSON} must include notifications-ui.test.ts in the test script.`,
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — IN-APP NOTIFICATION CENTER')
console.log('════════════════════════════════════════════════════════════════════════')
for (const r of results) {
  if (r.passed) console.log(`  ✓  ${r.name}`)
  else          console.log(`  ✗  ${r.name}\n     ${r.error}`)
}
const passed = results.filter(r => r.passed).length
const failed = results.length - passed
console.log('════════════════════════════════════════════════════════════════════════')
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('════════════════════════════════════════════════════════════════════════')
console.log('')

if (failed > 0) process.exit(1)
}

main()
