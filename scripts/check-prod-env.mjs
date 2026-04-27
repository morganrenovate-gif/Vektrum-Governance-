#!/usr/bin/env node
/**
 * CLI shim around src/lib/env/validate-production-env.ts.
 *
 * Run with:
 *   npm run env:check        # uses current process.env
 *   NODE_ENV=production npx tsx scripts/check-prod-env.mjs
 *
 * Exits 0 when the report is OK, 1 when there are errors. Warnings do not
 * change the exit code. Output is line-oriented and safe to grep in CI logs.
 *
 * NEVER prints variable VALUES — only names, presence, length, and the
 * structured error/warning messages from the validator.
 */

import { pathToFileURL } from 'node:url'
import path from 'node:path'

const validatorPath = path.resolve(
  process.cwd(),
  'src/lib/env/validate-production-env.ts',
)

// tsx is a devDependency; it registers a TS loader so we can import .ts files
// from a .mjs entry. The npm script wires it via `tsx` directly.
const { validateProductionEnv } = await import(pathToFileURL(validatorPath).href)

const report = validateProductionEnv()

const line = '─'.repeat(72)
console.log('')
console.log(line)
console.log(`  VEKTRUM — production env validation  (NODE_ENV=${report.environment})`)
console.log(line)

if (report.errors.length === 0 && report.warnings.length === 0) {
  console.log('  All tracked variables are present and well-formed.')
} else {
  for (const f of report.errors) {
    console.log(`  ✗  [${f.category}] ${f.variable}: ${f.message}`)
  }
  for (const f of report.warnings) {
    console.log(`  ⚠  [${f.category}] ${f.variable}: ${f.message}`)
  }
}

console.log(line)
console.log(`  ${report.errors.length} errors  |  ${report.warnings.length} warnings`)
console.log(line)
console.log('')

// Variables summary — presence + length only (never values).
console.log('  Variables (present / length):')
for (const [name, info] of Object.entries(report.variables)) {
  const flag = info.present ? '✓' : '·'
  const len  = info.present ? `len=${info.length}` : 'unset'
  console.log(`    ${flag}  ${name.padEnd(34)} ${len}`)
}
console.log('')

process.exit(report.ok ? 0 : 1)
