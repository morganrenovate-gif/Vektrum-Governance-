/**
 * tests/mfa-call-signatures.test.ts
 *
 * Regression guard for BUG-1: requireMFA was called as requireMFA(authContext)
 * in admin/env-health/route.ts — passing an AuthContext object where a Supabase
 * client is expected and leaving profile undefined, causing the MFA guard to throw
 * a TypeError that was swallowed, effectively bypassing MFA on that route.
 *
 * This test reads every admin route that calls requireMFA and asserts:
 *   1. requireMFA is called with two arguments (supabase + profile)
 *   2. The second argument includes .profile (not bare authContext as sole arg)
 *   3. No call site uses a single-argument form: requireMFA(authContext)
 *
 * Run: npx tsx tests/mfa-call-signatures.test.ts
 */

import fs   from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

// All admin route files (add new ones here as they are created)
const ADMIN_ROUTES = [
  'src/app/api/admin/env-health/route.ts',
  'src/app/api/admin/reconciliation/route.ts',
  'src/app/api/admin/reconciliation/[issueId]/route.ts',
  'src/app/api/admin/audit-log/route.ts',
  'src/app/api/admin/partners/route.ts',
  'src/app/api/admin/tokens/[jti]/revoke/route.ts',
]

async function main() {

console.log('\n── 1. env-health: fixed requireMFA call ────────────────────────────────')

const envHealth = read('src/app/api/admin/env-health/route.ts')

check(
  envHealth.includes("import { createClient }") ||
  envHealth.includes("import { createClient,"),
  'env-health imports createClient from @/lib/supabase/server',
)
check(
  envHealth.includes('await createClient()'),
  'env-health calls createClient() to obtain a supabase client',
)
check(
  envHealth.includes('await requireMFA(supabase, authContext.profile)'),
  'env-health calls requireMFA(supabase, authContext.profile) — correct two-argument form',
)
check(
  !envHealth.includes('requireMFA(authContext)'),
  'env-health does NOT call requireMFA(authContext) — single-argument bypass removed',
)

console.log('\n── 2. All admin routes: no single-argument requireMFA call ─────────────')

for (const relPath of ADMIN_ROUTES) {
  const fullPath = path.join(ROOT, relPath)
  if (!fs.existsSync(fullPath)) {
    pass(`${relPath} — file not present, skipped`)
    continue
  }

  const src = read(relPath)

  if (!src.includes('requireMFA')) {
    pass(`${relPath} — does not call requireMFA, skipped`)
    continue
  }

  // The single-argument bypass form: requireMFA(authContext) or requireMFA(ctx)
  // where the argument is NOT followed by a comma (i.e. only one argument)
  const singleArgPattern = /requireMFA\(\s*\w+\s*\)/
  check(
    !singleArgPattern.test(src),
    `${relPath}: requireMFA is not called with a single argument`,
  )

  // Must include .profile as part of the second argument
  check(
    src.includes('requireMFA(supabase, authContext.profile)') ||
    src.includes('requireMFA(supabase, profile)') ||
    src.includes('.profile)'),
    `${relPath}: requireMFA receives a .profile reference as the second argument`,
  )
}

console.log('\n── 3. requireMFA signature in middleware ────────────────────────────────')

const middleware = read('src/lib/auth/middleware.ts')

check(
  /export async function requireMFA\(\s*\n?\s*supabase/.test(middleware) ||
  middleware.includes('export async function requireMFA(\n  supabase') ||
  middleware.includes('supabase: ReturnType<typeof createServerClient>'),
  'requireMFA signature accepts supabase as first parameter',
)
check(
  middleware.includes('profile: Profile'),
  'requireMFA signature accepts profile as second parameter',
)

console.log('\n✅  mfa-call-signatures: all checks passed\n')
}

main().catch(err => { console.error(err); process.exit(1) })
