/**
 * Middleware API routing tests — static source-pattern checks.
 *
 * These tests do NOT require a running Next.js server. They verify that:
 *   1. /api/* routes are never redirected to /auth/login by middleware.
 *   2. The API bypass is positioned before the login redirect, not after.
 *   3. Partner auth returns JSON 401, not a redirect.
 *   4. /dashboard/* routes still redirect unauthenticated sessions to /auth/login.
 *   5. /api/cron/* routes are in the public pass-through list (own auth check).
 *
 * Why this matters:
 *   A middleware regression that re-introduces the /api/* → /auth/login redirect
 *   would break every API client (partner integrations, curl smoke tests, cron jobs)
 *   with an unexpected HTML redirect instead of a JSON error response.
 *
 * Run:  npx tsx tests/middleware-api-routing.test.ts
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

function rel(...segments: string[]): string {
  return path.join(ROOT, ...segments)
}

function read(p: string): string {
  if (!fs.existsSync(p)) throw new Error(`Required file does not exist: ${p}`)
  return fs.readFileSync(p, 'utf-8')
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

const MIDDLEWARE    = rel('src', 'middleware.ts')
const PARTNER_AUTH  = rel('src', 'lib', 'auth', 'partner.ts')
const CRON_ROUTE    = rel('src', 'app', 'api', 'cron', 'reconcile', 'route.ts')

// ── 1. Middleware: /api/* bypass exists ───────────────────────────────────────

await test('MIDDLEWARE: /api/* bypass is present (no redirect for API routes)', () => {
  const src = read(MIDDLEWARE)
  assert(
    /pathname\.startsWith\(["']\/api\/["']\)\s*\)\s*return NextResponse\.next\(\)/.test(src) ||
    /startsWith\(["']\/api\/["']\).*return NextResponse\.next\(\)/.test(src),
    'src/middleware.ts must contain an early `if (pathname.startsWith("/api/")) return NextResponse.next()` ' +
    'before the login redirect block. Without this, unauthenticated API requests are redirected ' +
    'to /auth/login instead of reaching the route handler for a JSON 401 response.',
  )
})

// ── 2. Middleware: bypass is before the login redirect ────────────────────────

await test('MIDDLEWARE: API bypass appears before the /auth/login redirect', () => {
  const src = read(MIDDLEWARE)

  const bypassIdx  = src.indexOf('startsWith("/api/") return NextResponse.next()')
  const redirectIdx = src.indexOf('/auth/login')

  // Allow the bypass pattern with or without a newline between ) and return
  const bypassMatch = src.match(/startsWith\(["']\/api\/["']\)/)
  const redirectMatch = src.match(/\/auth\/login/)

  assert(
    bypassMatch !== null,
    'src/middleware.ts: could not find the /api/ bypass pattern.',
  )
  assert(
    redirectMatch !== null,
    'src/middleware.ts: could not find the /auth/login redirect pattern.',
  )

  const bypassPos  = bypassMatch!.index!
  const redirectPos = redirectMatch!.index!

  assert(
    bypassPos < redirectPos,
    `src/middleware.ts: the /api/ bypass (char ${bypassPos}) must appear BEFORE ` +
    `the /auth/login redirect (char ${redirectPos}). ` +
    'Move the bypass block above the NextResponse.redirect(loginUrl) line.',
  )
})

// ── 3. Middleware: /dashboard paths are NOT bypassed ─────────────────────────

await test('MIDDLEWARE: /dashboard/* is not in the API bypass — still redirects to login', () => {
  const src = read(MIDDLEWARE)

  // The bypass must only match /api/ — not /dashboard/
  // Verify the bypass line does not include dashboard
  const bypassLineMatch = src.match(/if\s*\([^)]*startsWith\([^)]+\)\s*\)\s*return NextResponse\.next\(\)/)
  if (bypassLineMatch) {
    assert(
      !bypassLineMatch[0].includes('dashboard'),
      'src/middleware.ts: the NextResponse.next() early-return bypass must not include ' +
      '/dashboard paths. Dashboard pages must still redirect unauthenticated sessions to /auth/login.',
    )
  }

  // The redirect to /auth/login must still be present for non-API paths
  assert(
    src.includes('/auth/login'),
    'src/middleware.ts: the /auth/login redirect is missing. ' +
    'Dashboard and page routes must still redirect unauthenticated sessions to login.',
  )
})

// ── 4. Middleware: /api/cron/ is in the public pass-through list ──────────────

await test('MIDDLEWARE: /api/cron/* is in the public pass-through list (own auth check)', () => {
  const src = read(MIDDLEWARE)
  assert(
    src.includes('pathname.startsWith("/api/cron/")') ||
    src.includes("pathname.startsWith('/api/cron/')"),
    'src/middleware.ts must include /api/cron/ in the public pass-through block so cron ' +
    'routes reach their own CRON_SECRET auth check without a Supabase session round-trip. ' +
    'The cron route returns JSON 401 when CRON_SECRET is missing or wrong.',
  )
})

// ── 5. Partner auth: requirePartnerAuth returns JSON 401, not a redirect ──────

await test('PARTNER AUTH: requirePartnerAuth returns JSON 401, not NextResponse.redirect', () => {
  const src = read(PARTNER_AUTH)

  // Must return a JSON 401
  assert(
    /NextResponse\.json\(.*401/.test(src) ||
    /status.*401/.test(src),
    `${PARTNER_AUTH} must return NextResponse.json({ error: ... }, { status: 401 }) ` +
    'when the Authorization header is missing or the key is invalid. ' +
    'It must never call NextResponse.redirect().',
  )

  // Must NOT contain a redirect call
  assert(
    !src.includes('NextResponse.redirect('),
    `${PARTNER_AUTH} must not call NextResponse.redirect(). ` +
    'Partner API auth failures must always return JSON 401, not an HTML redirect.',
  )
})

// ── 6. Partner auth: validates Bearer scheme ──────────────────────────────────

await test('PARTNER AUTH: validates Bearer authorization scheme', () => {
  const src = read(PARTNER_AUTH)
  assert(
    src.includes('Bearer') || src.includes('bearer'),
    `${PARTNER_AUTH} must check that the Authorization header uses the Bearer scheme. ` +
    'A missing or wrong scheme (e.g. Basic, Token) must return JSON 401.',
  )
})

// ── 7. Cron route: has own CRON_SECRET auth check ────────────────────────────

await test('CRON: /api/cron/reconcile has its own CRON_SECRET auth check', () => {
  const src = read(CRON_ROUTE)
  assert(
    src.includes('CRON_SECRET'),
    `${CRON_ROUTE} must validate the CRON_SECRET before running reconciliation. ` +
    'Without this check, any unauthenticated caller can trigger reconciliation.',
  )
})

await test('CRON: /api/cron/reconcile returns JSON on auth failure, not redirect', () => {
  const src = read(CRON_ROUTE)

  // Must have a JSON error response for auth failure
  assert(
    /NextResponse\.json\(/.test(src) || /Response\.json\(/.test(src),
    `${CRON_ROUTE} must return a JSON response on auth failure, not a redirect. ` +
    'Cron callers are not browsers and cannot follow HTML redirects.',
  )

  // Must NOT redirect to login
  assert(
    !src.includes('/auth/login'),
    `${CRON_ROUTE} must not redirect to /auth/login on auth failure. ` +
    'Return JSON 401 instead.',
  )
})

// ── 8. Middleware file-level: the matcher config is present ───────────────────

await test('MIDDLEWARE: config.matcher is exported (middleware is active)', () => {
  const src = read(MIDDLEWARE)
  assert(
    src.includes('export const config') && src.includes('matcher'),
    'src/middleware.ts must export a `config` object with a `matcher` array ' +
    'so Next.js applies the middleware to the correct routes.',
  )
})

// ── Report ────────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — MIDDLEWARE API ROUTING TEST RESULTS')
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
