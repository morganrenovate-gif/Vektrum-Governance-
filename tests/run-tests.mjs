/**
 * Test runner shim — delegates to all TypeScript test files via tsx.
 *
 * Previously this file contained an inlined copy of validateRelease and an
 * inlined state machine that did not match production source. That logic has
 * been removed. All tests now import directly from src/ and exercise the real
 * production functions.
 *
 * Test files:
 *   tests/release-gate.test.ts        — release gate (10 conditions), state machine, AI precondition
 *   tests/docusign-webhook-hmac.test.ts — DocuSign HMAC gate + verifyWebhookSignature
 *
 * To run tests directly:
 *   npx tsx tests/release-gate.test.ts
 *   npx tsx tests/docusign-webhook-hmac.test.ts
 *   npm test   (runs both)
 */

import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root      = path.resolve(__dirname, '..')

const testFiles = [
  path.join(__dirname, 'release-gate.test.ts'),
  path.join(__dirname, 'docusign-webhook-hmac.test.ts'),
  path.join(__dirname, 'stripe-webhook-security.test.ts'),
]

let anyFailed = false
for (const file of testFiles) {
  console.log(`\n[run-tests.mjs] Running ${path.basename(file)}\n`)
  try {
    execSync(`npx tsx "${file}"`, { cwd: root, stdio: 'inherit' })
  } catch {
    anyFailed = true
  }
}

if (anyFailed) process.exit(1)
