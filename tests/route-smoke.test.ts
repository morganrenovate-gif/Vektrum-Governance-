/**
 * Route smoke tests — static file-existence and export-shape checks.
 *
 * These tests do NOT require a running Next.js server. They verify:
 *   1. Critical route files exist (no 404 on navigation)
 *   2. Key route handlers export the expected HTTP methods
 *   3. Known-broken source patterns have been corrected
 *
 * Covered routes:
 *   /auth/logout                          ← was a 404; now requires the file to exist
 *   /dashboard/admin/users/[userId]       ← admin user-detail navigation
 *   /api/demo/reset                       ← demo reset endpoint
 *   /demo-live/* (contractor, funder, admin, deal pages)
 *
 * Run:  npx tsx tests/route-smoke.test.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

// ─── Test runner ──────────────────────────────────────────────────────────────

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

function src(...segments: string[]): string {
  return path.join(ROOT, 'src', ...segments)
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

function fileContains(filePath: string, pattern: string | RegExp): boolean {
  if (!fileExists(filePath)) return false
  const content = fs.readFileSync(filePath, 'utf-8')
  if (typeof pattern === 'string') return content.includes(pattern)
  return pattern.test(content)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

// ── /auth/logout route ────────────────────────────────────────────────────────

await test('ROUTE: /auth/logout/route.ts exists', () => {
  const routePath = src('app', 'auth', 'logout', 'route.ts')
  assert(
    fileExists(routePath),
    `/auth/logout/route.ts does not exist — navigating to /auth/logout will 404.\n` +
    `Create src/app/auth/logout/route.ts with a GET handler that calls signOut() and redirects to /.`,
  )
})

await test('ROUTE: /auth/logout exports GET handler', () => {
  const routePath = src('app', 'auth', 'logout', 'route.ts')
  assert(
    fileExists(routePath),
    `/auth/logout/route.ts does not exist (see previous test)`,
  )
  assert(
    fileContains(routePath, 'export async function GET') ||
    fileContains(routePath, 'export function GET'),
    `/auth/logout/route.ts exists but does not export a GET handler. ` +
    `The <a href="/auth/logout"> link in dashboard/page.tsx makes a GET request.`,
  )
})

await test('ROUTE: /auth/logout handler calls signOut', () => {
  const routePath = src('app', 'auth', 'logout', 'route.ts')
  assert(
    fileExists(routePath),
    `/auth/logout/route.ts does not exist`,
  )
  assert(
    fileContains(routePath, 'signOut'),
    `/auth/logout/route.ts does not call supabase.auth.signOut() — ` +
    `the user's session will not be cleared on logout.`,
  )
})

await test('ROUTE: /auth/logout handler redirects after sign-out', () => {
  const routePath = src('app', 'auth', 'logout', 'route.ts')
  assert(
    fileExists(routePath),
    `/auth/logout/route.ts does not exist`,
  )
  assert(
    fileContains(routePath, 'redirect'),
    `/auth/logout/route.ts does not redirect after sign-out — ` +
    `the user would land on a blank response.`,
  )
})

// ── dashboard/page.tsx: /auth/logout link is now backed by a real route ───────

await test('ROUTE: dashboard/page.tsx href="/auth/logout" is backed by a real route', () => {
  const dashPage  = src('app', 'dashboard', 'page.tsx')
  const logoutRoute = src('app', 'auth', 'logout', 'route.ts')

  // Confirm the link still exists in dashboard (so we know it's covered)
  assert(
    fileContains(dashPage, '/auth/logout'),
    `dashboard/page.tsx no longer links to /auth/logout — ` +
    `remove this test if the link was intentionally removed.`,
  )
  // Confirm the destination now exists
  assert(
    fileExists(logoutRoute),
    `dashboard/page.tsx links to /auth/logout but that route does not exist (404). ` +
    `Create src/app/auth/logout/route.ts.`,
  )
})

// ── Admin user-detail route ───────────────────────────────────────────────────

await test('ROUTE: /dashboard/admin/users/[userId]/page.tsx exists', () => {
  const filePath = src('app', 'dashboard', 'admin', 'users', '[userId]', 'page.tsx')
  assert(
    fileExists(filePath),
    `/dashboard/admin/users/[userId]/page.tsx does not exist. ` +
    `The admin dashboard user-detail navigation will 404.`,
  )
})

// ── Demo-live pages ───────────────────────────────────────────────────────────

const demoPages: Array<[string, string]> = [
  ['contractor', src('app', 'demo-live', 'contractor', 'page.tsx')],
  ['funder',     src('app', 'demo-live', 'funder', 'page.tsx')],
  ['admin',      src('app', 'demo-live', 'admin', 'page.tsx')],
  ['deal/riverside', src('app', 'demo-live', 'deal', 'riverside', 'page.tsx')],
  ['deal/harbor',    src('app', 'demo-live', 'deal', 'harbor', 'page.tsx')],
  ['deal/westside',  src('app', 'demo-live', 'deal', 'westside', 'page.tsx')],
  ['deal/harbor-dispute', src('app', 'demo-live', 'deal', 'harbor-dispute', 'page.tsx')],
]

for (const [name, filePath] of demoPages) {
  await test(`ROUTE: /demo-live/${name}/page.tsx exists`, () => {
    assert(
      fileExists(filePath),
      `/demo-live/${name}/page.tsx does not exist — demo navigation will 404.`,
    )
  })
}

// ── API: demo reset route ──────────────────────────────────────────────────────

await test('ROUTE: /api/demo/reset/route.ts exists and exports POST', () => {
  const routePath = src('app', 'api', 'demo', 'reset', 'route.ts')
  assert(
    fileExists(routePath),
    `/api/demo/reset/route.ts does not exist.`,
  )
  assert(
    fileContains(routePath, 'export async function POST') ||
    fileContains(routePath, 'export function POST'),
    `/api/demo/reset/route.ts does not export a POST handler.`,
  )
})

await test('ROUTE: /api/demo/reset/route.ts has auth guard', () => {
  const routePath = src('app', 'api', 'demo', 'reset', 'route.ts')
  assert(
    fileExists(routePath),
    `/api/demo/reset/route.ts does not exist`,
  )
  assert(
    fileContains(routePath, 'getUser') || fileContains(routePath, 'createClient'),
    `/api/demo/reset/route.ts has no auth guard — any unauthenticated caller can invoke it. ` +
    `Add a session check using createClient().auth.getUser().`,
  )
})

// ── Results ───────────────────────────────────────────────────────────────────

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length

console.log('\n' + '═'.repeat(72))
console.log('  VEKTRUM — ROUTE SMOKE TEST RESULTS')
console.log('═'.repeat(72))

for (const r of results) {
  console.log(`  ${r.passed ? '✓' : '✗'}  ${r.name}`)
  if (!r.passed) console.log(`       → ${r.error}`)
}

console.log('═'.repeat(72))
console.log(`  ${passed} passed  |  ${failed} failed  |  ${results.length} total`)
console.log('═'.repeat(72) + '\n')

if (failed > 0) process.exit(1)

} // end main()

main().catch(e => { console.error(e); process.exit(1) })
