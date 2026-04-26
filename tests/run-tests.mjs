/**
 * DEPRECATED — this file previously contained an inlined copy of validateRelease
 * and an inlined state machine that did not match the production source.
 *
 * All tests now live in tests/release-gate.test.ts, which imports and exercises
 * the REAL production functions from src/lib/engine/release-gate.ts and
 * src/lib/engine/state-machine.ts.
 *
 * This shim delegates to that file so any existing CI invocation of
 * `node tests/run-tests.mjs` continues to work.
 *
 * To run tests directly:
 *   npx tsx tests/release-gate.test.ts
 *   npm test
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root      = path.resolve(__dirname, '..')
const testFile  = path.join(__dirname, 'release-gate.test.ts')

console.log('[run-tests.mjs] Delegating to release-gate.test.ts (real source, via tsx)\n')

try {
  execSync(`npx tsx "${testFile}"`, { cwd: root, stdio: 'inherit' })
} catch {
  process.exit(1)
}
