/**
 * scripts/add-marketing-revalidate.mjs
 *
 * Adds `export const revalidate = 3600` to every static marketing page so it
 * becomes ISR-eligible.
 *
 * Skips:
 *   - pages already declaring `revalidate`
 *   - pages that opt into `dynamic = 'force-dynamic'`
 *   - the demo-live tree (uses runtime demo state — revisit later)
 *
 * Insertion strategy: walk lines, track when we exit the import region
 * (handles multi-line `import { ... }` blocks correctly by waiting for the
 * matching brace before counting the import as complete), and insert
 * immediately after the last import block.
 *
 * Run: node scripts/add-marketing-revalidate.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const MARKETING_ROOT = resolve(ROOT, 'src/app/(marketing)')

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) walk(full, files)
    else if (full.endsWith('page.tsx')) files.push(full)
  }
  return files
}

const REVALIDATE_LINES = [
  '',
  '// ISR: re-render at most every hour. Public marketing — no per-user data.',
  'export const revalidate = 3600',
  '',
]

/**
 * Returns the line index immediately after the last import statement.
 * Handles multi-line `import { ... }` blocks by tracking brace depth.
 */
function findInsertLineIndex(lines) {
  let lastImportEndLine = -1
  let inImport = false
  let braceDepth = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!inImport) {
      if (trimmed.startsWith('import ')) {
        inImport = true
        // Count braces on this line
        for (const ch of line) {
          if (ch === '{') braceDepth++
          else if (ch === '}') braceDepth--
        }
        // Single-line import (no open brace remaining, ends with `;` or 'from "x"')
        if (braceDepth === 0) {
          lastImportEndLine = i
          inImport = false
        }
      } else if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
        // Blank or comment between imports — keep walking
        continue
      } else {
        // First non-import non-comment line — stop
        break
      }
    } else {
      for (const ch of line) {
        if (ch === '{') braceDepth++
        else if (ch === '}') braceDepth--
      }
      if (braceDepth === 0) {
        lastImportEndLine = i
        inImport = false
      }
    }
  }
  return lastImportEndLine === -1 ? -1 : lastImportEndLine + 1
}

let added = 0, skipped = 0
for (const full of walk(MARKETING_ROOT)) {
  if (full.includes('/demo-live/')) { skipped++; continue }

  const src = readFileSync(full, 'utf-8')
  if (/export\s+const\s+revalidate\b/.test(src)) { skipped++; continue }
  if (/export\s+const\s+dynamic\s*=/.test(src))  { skipped++; continue }

  const lines = src.split('\n')
  const insertAt = findInsertLineIndex(lines)
  if (insertAt < 0) {
    console.warn('  no imports found, skipping:', full.replace(ROOT + '/', ''))
    skipped++
    continue
  }

  const out = [
    ...lines.slice(0, insertAt),
    ...REVALIDATE_LINES,
    ...lines.slice(insertAt),
  ].join('\n')

  writeFileSync(full, out, 'utf-8')
  console.log('  +revalidate:', full.replace(ROOT + '/', ''))
  added++
}

console.log(`\n${added} file(s) updated, ${skipped} skipped.`)
