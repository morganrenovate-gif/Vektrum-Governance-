/**
 * scripts/migrate-test-paths.mjs
 *
 * One-off codemod: rewrites test file path strings from the pre-route-group
 * layout to the new (marketing)/(app) layout. Idempotent.
 *
 * Mappings (string-literal substring replacement, only inside tests/):
 *   src/app/page.tsx                          → src/app/(marketing)/page.tsx
 *   src/app/<marketing-segment>/...           → src/app/(marketing)/<segment>/...
 *   src/app/dashboard/...                     → src/app/(app)/dashboard/...
 *   src/app/demo-live/...                     → src/app/(marketing)/demo-live/...
 *
 * The path strings appear inside fs.readFileSync(...) and similar calls; we
 * do a literal-substring rewrite. Quotes are preserved by leaving the
 * surrounding characters alone.
 *
 * Run: node scripts/migrate-test-paths.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const TESTS_ROOT = resolve(ROOT, 'tests')

const MARKETING_SEGMENTS = [
  'about', 'careers', 'contact', 'contractors', 'demo',
  'founders', 'funders', 'help', 'partners', 'pricing',
  'privacy', 'resources', 'security', 'terms',
  'demo-live',
]

const REPLACEMENTS = [
  // homepage
  ['src/app/page.tsx', 'src/app/(marketing)/page.tsx'],
  // dashboard tree
  ['src/app/dashboard/', 'src/app/(app)/dashboard/'],
  // marketing segments
  ...MARKETING_SEGMENTS.map((seg) => [`src/app/${seg}/`, `src/app/(marketing)/${seg}/`]),
]

function listTests(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    if (statSync(full).isFile() && full.endsWith('.test.ts')) out.push(full)
  }
  return out
}

let totalChanged = 0, totalFiles = 0
for (const file of listTests(TESTS_ROOT)) {
  const original = readFileSync(file, 'utf-8')
  let modified = original
  let changed = 0

  for (const [from, to] of REPLACEMENTS) {
    // Avoid re-rewriting if already migrated
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    const before = modified
    modified = modified.replace(re, (match, offset) => {
      // If this is already a (marketing) or (app) path, skip
      const surrounding = before.slice(Math.max(0, offset - 20), offset + match.length + 5)
      if (surrounding.includes('(marketing)') || surrounding.includes('(app)')) return match
      changed++
      return to
    })
  }

  if (changed > 0) {
    writeFileSync(file, modified, 'utf-8')
    console.log(`  ${file.replace(ROOT + '/', '')}: ${changed} replacements`)
    totalChanged += changed
    totalFiles++
  }
}

console.log(`\n${totalFiles} test file(s) updated, ${totalChanged} replacements total.`)
