/**
 * tests/perplexity-response-format-fix.test.ts
 *
 * Pins the Perplexity response_format payload fix:
 *
 *   1. Request body uses
 *        response_format: {
 *          type: 'json_schema',
 *          json_schema: { name, schema }
 *        }
 *      — NOT { type: 'json_object' } (which Sonar's structured-output
 *      mode rejects with "ResponseFormatJSONSchema -> json_schema:
 *      Field required").
 *
 *   2. The strict schema still requires every spec field (project_name,
 *      contract_total, currency, retainage, sov_line_items,
 *      release_conditions, evidence_requirements, warnings, assumptions)
 *      and locks funder_authorization_required to const true so the
 *      product invariant cannot drift.
 *
 *   3. Diagnostic on Perplexity non-2xx logs status, model,
 *      response_format_type, response_format_has_json_schema,
 *      response_format_schema_name, and a truncated upstream body —
 *      WITHOUT the API key, prompt, or contract text.
 *
 *   4. User-facing error on every Perplexity failure is the safer copy
 *      "Could not generate draft release rules right now. Enter release
 *      rules manually or try again." — never blames the PDF.
 *
 *   5. Route still does not authorize release / touch Stripe / inject
 *      banned phrases.
 *
 * Run: npx tsx tests/perplexity-response-format-fix.test.ts
 */

import fs   from 'fs'
import path from 'path'

const ROOT = path.resolve(process.cwd())

const HELPER       = 'src/lib/engine/contract-release-rules.ts'
const ROUTE        = 'src/app/api/deals/[dealId]/release-rules/generate-from-contract/route.ts'
const PACKAGE_JSON = 'package.json'

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), 'utf-8')
}
function pass(msg: string) { console.log(`  ✓ ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL: ${msg}`) }
function check(cond: boolean, msg: string) { cond ? pass(msg) : fail(msg) }

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

async function main() {
  console.log('\nperplexity-response-format-fix.test.ts\n')

  const helper     = read(HELPER)
  const helperCode = stripComments(helper)
  const route      = read(ROUTE)
  const pkg        = read(PACKAGE_JSON)

  // ── 1. response_format shape ───────────────────────────────────────────
  console.log('1. response_format shape')

  // Bad shape (the bug we are fixing) must be gone.
  check(
    !/response_format:\s*\{\s*type:\s*['"]json_object['"]\s*\}/.test(helperCode),
    '  1a. helper no longer sends { type: "json_object" } as response_format',
  )

  // The new shape must declare type === 'json_schema'
  check(
    /type:\s*['"]json_schema['"]/.test(helperCode),
    '  1b. response_format.type === "json_schema"',
  )

  // The new shape must include a json_schema field — NOT a bare schema field
  // directly under response_format.
  check(
    /json_schema:\s*\{[\s\S]*?name:[\s\S]*?schema:\s*RELEASE_RULES_JSON_SCHEMA/.test(helperCode),
    '  1c. response_format.json_schema = { name, schema: RELEASE_RULES_JSON_SCHEMA }',
  )

  // Disallow the broken intermediate shape that was producing the 400:
  // a top-level `schema:` directly under `response_format` without
  // `json_schema:` wrapper.
  check(
    !/response_format:\s*\{[\s\S]*?type:\s*['"]json_schema['"][\s\S]*?\bschema:\s*RELEASE_RULES_JSON_SCHEMA[\s\S]*?\}/.test(
      helperCode.replace(/json_schema:[\s\S]*?\}/g, ''),
    ),
    '  1d. response_format does NOT use the invalid top-level schema-only shape',
  )

  // Must reference the schema constant by name + the named schema constant exists
  check(
    /const\s+RELEASE_RULES_JSON_SCHEMA\s*=/.test(helperCode),
    '  1e. RELEASE_RULES_JSON_SCHEMA constant is defined',
  )
  check(
    /const\s+PERPLEXITY_SCHEMA_NAME\s*=\s*['"]contract_release_rules['"]/.test(helperCode),
    '  1f. PERPLEXITY_SCHEMA_NAME = "contract_release_rules"',
  )
  // The actual fetch body uses the responseFormat object that was assembled above
  check(
    /response_format:\s*responseFormat/.test(helperCode),
    '  1g. fetch body uses response_format: responseFormat',
  )

  // ── 2. Strict schema still requires every spec field ──────────────────
  console.log('\n2. Strict schema preserves spec fields')

  // Match the `required: [...]` array on the top-level schema. Use a
  // non-greedy match anchored on the array literal that follows the
  // top-level RELEASE_RULES_JSON_SCHEMA assignment.
  const topLevelRequired =
    helperCode.match(/RELEASE_RULES_JSON_SCHEMA[\s\S]{0,400}required:\s*\[([\s\S]*?)\]/)?.[1] ?? ''

  for (const field of [
    'project_name',
    'contract_total',
    'currency',
    'retainage',
    'sov_line_items',
    'release_conditions',
    'evidence_requirements',
    'warnings',
    'assumptions',
  ]) {
    check(
      topLevelRequired.includes(`'${field}'`) ||
      topLevelRequired.includes(`"${field}"`),
      `  2a. top-level required[] includes "${field}"`,
    )
  }

  // additionalProperties: false on the top-level shape blocks unknown keys
  check(
    /RELEASE_RULES_JSON_SCHEMA[\s\S]{0,160}additionalProperties:\s*false/.test(helperCode),
    '  2b. top-level schema sets additionalProperties: false',
  )

  // funder_authorization_required is locked to const true — product invariant
  check(
    /FIELD_EXTRACTION_TRUE_SCHEMA[\s\S]{0,400}value:\s*\{\s*const:\s*true\s*\}/.test(helperCode),
    '  2c. funder_authorization_required.value uses { const: true }',
  )

  // Release-condition sub-fields all 5 present
  for (const condField of [
    'sequential_release_required',
    'lien_waiver_required',
    'inspection_required',
    'change_order_approval_required',
    'funder_authorization_required',
  ]) {
    check(helperCode.includes(condField),
      `  2d. release_conditions schema includes "${condField}"`)
  }

  // ── 3. Diagnostic on non-2xx ──────────────────────────────────────────
  console.log('\n3. Safe diagnostic on Perplexity non-2xx')

  // Pull the non-2xx log block. Anchor on the [release-rules] perplexity
  // non-2xx string.
  const nonOkLog = helper.match(
    /\[release-rules\] perplexity non-2xx[\s\S]*?\}\s*\)/,
  )
  check(!!nonOkLog, '  3a. non-2xx log block exists')

  for (const field of [
    'status',
    'model',
    'response_format_type',
    'response_format_has_json_schema',
    'response_format_schema_name',
    'upstream_body_excerpt',
  ]) {
    check(
      nonOkLog !== null && nonOkLog[0].includes(field),
      `  3b. non-2xx log includes "${field}"`,
    )
  }

  // The non-2xx log MUST NOT include the API key, raw contract text, or the
  // assembled prompt.
  check(
    nonOkLog !== null && !nonOkLog[0].includes('apiKey'),
    '  3c. non-2xx log does NOT include apiKey',
  )
  check(
    nonOkLog !== null && !nonOkLog[0].includes('contractText'),
    '  3d. non-2xx log does NOT include contractText',
  )
  check(
    nonOkLog !== null && !nonOkLog[0].includes('userMessage'),
    '  3e. non-2xx log does NOT include the assembled prompt',
  )
  // Body is truncated, never logged in full
  check(
    nonOkLog !== null && /body\.slice\(0,\s*400\)/.test(nonOkLog[0]),
    '  3f. upstream body is truncated to 400 chars',
  )

  // ── 4. User-facing error on every Perplexity failure path ─────────────
  console.log('\n4. Safe user-facing error message')

  const safeMessage =
    'Could not generate draft release rules right now. ' +
    'Enter release rules manually or try again.'
  // The helper must include this exact spec wording on each Perplexity-
  // failure path (network, non-2xx, body parse, JSON parse).
  const occurrences = helper.match(/Could not generate draft release rules right now\./g) || []
  check(
    occurrences.length >= 3,
    `  4a. spec'd "Could not generate draft release rules right now." copy is used on >=3 failure paths (found ${occurrences.length})`,
  )
  check(
    helper.includes('Enter release rules manually or try again.'),
    '  4b. fallback advice "Enter release rules manually or try again."',
  )
  check(
    !helper.includes('AI service returned ${response.status}'),
    '  4c. legacy "AI service returned ${status}" message removed',
  )
  check(
    !helper.includes('AI service returned non-JSON content'),
    '  4d. legacy "AI service returned non-JSON content" message removed',
  )
  check(
    !helper.includes('AI service returned an unparseable body'),
    '  4e. legacy "AI service returned an unparseable body" message removed',
  )

  // The helper must NOT pretend the PDF is corrupted when Perplexity is the
  // failure source — those messages live in src/lib/engine/contract-text.ts
  // and must NOT appear in this helper.
  check(
    !/password-protected or corrupted/i.test(helper) &&
    !/scanned or image-based/i.test(helper),
    '  4f. helper does not blame the PDF for AI failures',
  )
  // The cached spec helper file is allowed to mention "Could not read" as
  // legacy — but the contract-release-rules helper must not. (Sanity guard.)
  check(
    !/Could not read the contract PDF/.test(helper),
    '  4g. helper does not surface PDF-read errors (those live in contract-text.ts)',
  )

  // Reasons enum still distinguishes upstream from invalid_json
  for (const reason of ['unreadable_contract', 'config', 'upstream', 'invalid_json']) {
    check(helper.includes(`'${reason}'`), `  4h. failure reason "${reason}" still emitted`)
  }

  // ── 5. Hard guarantees preserved ──────────────────────────────────────
  console.log('\n5. No release / payment / Stripe code paths added')
  for (const banned of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!helper.includes(banned),
      `  5a. helper does NOT import / call "${banned}"`)
    check(!route.includes(banned),
      `  5b. route does NOT import / call "${banned}"`)
  }

  // ── 6. Banned product claims absent ───────────────────────────────────
  console.log('\n6. Banned product claims absent')
  const all = (helper + '\n' + route).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'vektrum is a lender',
    'ai approves release',
    'ai approves',
    'ai authorizes',
    'funds are released automatically',
    'funds released automatically',
    'guaranteed extraction',
    'guarantees compliance',
    'contractor authorizes release',
  ]) {
    check(!all.includes(banned), `  6. banned: "${banned}" absent`)
  }

  // ── 7. Test wired into npm test ───────────────────────────────────────
  check(
    pkg.includes('perplexity-response-format-fix.test.ts'),
    '7. perplexity-response-format-fix.test.ts wired into npm test',
  )

  console.log('\n✓ All perplexity-response-format-fix tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
