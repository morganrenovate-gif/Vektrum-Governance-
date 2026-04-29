/**
 * Static safety tests for GET /api/lien-waivers/[waiverId]/signed-url.
 *
 * No live DB or network. These tests verify the route source satisfies
 * security properties:
 *
 *   1. The route file exists (route is reachable, no 404).
 *   2. Auth is required — getAuthUser is called before any DB access.
 *   3. Only funder or admin may proceed — contractor role is rejected.
 *   4. The raw file_path is never serialized into the JSON response.
 *   5. The service-role key is not embedded in the source.
 *   6. createSignedUrl is used (not getPublicUrl — bucket is private).
 *   7. requireDealAccess is called (non-participants cannot fetch URLs).
 *   8. dynamic = 'force-dynamic' is exported (no stale cached URLs).
 *
 * Run:  npx tsx tests/lien-waiver-signed-url.test.ts
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

function read(p: string): string { return fs.readFileSync(p, 'utf-8') }

// Strip comments and string literals so regexes only see executable code.
function codeOnly(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

// ─── Route under test ─────────────────────────────────────────────────────────

const ROUTE_PATH = path.join(
  ROOT,
  'src/app/api/lien-waivers/[waiverId]/signed-url/route.ts',
)

// ─── Tests ────────────────────────────────────────────────────────────────────

async function main() {

await test('route file exists', () => {
  assert(fs.existsSync(ROUTE_PATH), `Route not found: ${ROUTE_PATH}`)
})

await test('exports a GET handler', () => {
  const src = read(ROUTE_PATH)
  assert(
    /export\s+async\s+function\s+GET\b/.test(src),
    'No exported GET function found — route will not respond to GET requests',
  )
})

await test('uses getAuthUser before any DB call', () => {
  const src = read(ROUTE_PATH)
  const getAuthIdx   = src.indexOf('getAuthUser')
  const adminClientIdx = src.indexOf('adminClient')
  assert(getAuthIdx !== -1, 'getAuthUser is not called — route has no auth check')
  assert(adminClientIdx !== -1, 'adminClient is not used — unexpected')
  assert(
    getAuthIdx < adminClientIdx,
    'adminClient is used before getAuthUser — unauthenticated callers reach DB queries',
  )
})

await test('gates to funder and admin roles only', () => {
  const src = read(ROUTE_PATH)
  // Must reference "funder" as an allowed role
  assert(src.includes("'funder'") || src.includes('"funder"'), 'funder role is not explicitly allowed')
  // Must reference "admin" as an allowed role
  assert(src.includes("'admin'") || src.includes('"admin"'), 'admin role is not explicitly allowed')
  // Must have a role check that returns an error response
  const code = codeOnly(src)
  assert(
    /profile\.role\s*!==|profile\.role\s*===/.test(code),
    'No role check found — any authenticated user can generate signed URLs',
  )
})

await test('does not return file_path in JSON response', () => {
  const code = codeOnly(read(ROUTE_PATH))
  // Check that file_path is not a key in a NextResponse.json call
  assert(
    !(/NextResponse\.json\s*\(\s*\{[^}]*file_path/.test(code)),
    'file_path appears in a NextResponse.json call — raw storage path may be exposed to client',
  )
})

await test('does not embed service-role key in source', () => {
  const src = read(ROUTE_PATH)
  // Real Supabase service-role JWTs start with "eyJ" and are long
  assert(
    !/eyJ[A-Za-z0-9_-]{20,}/.test(src),
    'A JWT-shaped string was found in the route source — check for embedded service-role key',
  )
})

await test('uses createSignedUrl not getPublicUrl', () => {
  const src = read(ROUTE_PATH)
  assert(
    src.includes('createSignedUrl'),
    'createSignedUrl not called — bucket may be public or URL generation is missing',
  )
  assert(
    !src.includes('getPublicUrl'),
    'getPublicUrl is used — private bucket objects require createSignedUrl',
  )
})

await test('calls requireDealAccess', () => {
  const src = read(ROUTE_PATH)
  assert(
    src.includes('requireDealAccess'),
    'requireDealAccess not called — non-participants of the deal can fetch signed URLs',
  )
})

await test('exports dynamic = force-dynamic', () => {
  const src = read(ROUTE_PATH)
  assert(
    src.includes("dynamic = 'force-dynamic'") || src.includes('dynamic = "force-dynamic"'),
    'dynamic = force-dynamic not exported — signed URLs may be cached and reused after expiry',
  )
})

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('')
console.log('════════════════════════════════════════════════════════════════════════')
console.log('  VEKTRUM — LIEN WAIVER SIGNED-URL ROUTE SAFETY')
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
