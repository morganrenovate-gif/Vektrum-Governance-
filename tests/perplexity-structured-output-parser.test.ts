/**
 * tests/perplexity-structured-output-parser.test.ts
 *
 * Pins the parseStructuredModelJson helper + the diagnostic + user-message
 * changes in src/lib/engine/contract-release-rules.ts. The helper is
 * imported and exercised live (this is a real unit test, not source-parse)
 * so all the surface-level failure modes from the production log
 * ("non-JSON content" on what was actually valid JSON) are pinned.
 *
 * Run: npx tsx tests/perplexity-structured-output-parser.test.ts
 */

import fs   from 'fs'
import path from 'path'
import {
  parseStructuredModelJson,
  type ParseStructuredOk,
  type ParseStructuredErr,
} from '@/lib/engine/contract-release-rules'

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

// Sample payload that mirrors the structured-output schema. Used as the
// "valid" anchor on the parse-success cases.
const VALID_PAYLOAD = {
  project_name:   'Vektrum Demo Project',
  contract_total: 2_500_000,
  currency:       'USD',
  retainage:      { percentage: 10, source_text: null, confidence: 0.9 },
  sov_line_items: [
    { name: 'Foundation', description: null, amount: 500_000, source_text: null, confidence: 0.8, review_required: false },
  ],
  release_conditions: {
    sequential_release_required:    { value: true,  source_text: null, confidence: 0.9 },
    lien_waiver_required:           { value: true,  source_text: null, confidence: 0.9 },
    inspection_required:            { value: true,  source_text: null, confidence: 0.9 },
    change_order_approval_required: { value: true,  source_text: null, confidence: 0.9 },
    funder_authorization_required:  { value: true,  source_text: null, confidence: 1.0 },
  },
  evidence_requirements: [],
  warnings:    [],
  assumptions: [],
}

const VALID_JSON_STRING = JSON.stringify(VALID_PAYLOAD, null, 2)

function expectOk(r: ParseStructuredOk | ParseStructuredErr): asserts r is ParseStructuredOk {
  if (!r.ok) fail(`expected ok, got err with reason="${r.reason}"`)
}
function expectErr(
  r: ParseStructuredOk | ParseStructuredErr,
): asserts r is ParseStructuredErr {
  if (r.ok) fail('expected err, got ok')
}

async function main() {
  console.log('\nperplexity-structured-output-parser.test.ts\n')

  // ── 1. Plain JSON string (production log path) ────────────────────────
  console.log('1. Plain JSON string content')
  {
    const r = parseStructuredModelJson(VALID_JSON_STRING)
    expectOk(r)
    check(
      (r.value as { project_name?: string }).project_name === 'Vektrum Demo Project',
      '  1a. plain stringified JSON parses through the happy path',
    )
  }

  // Exact prefix the production log showed ({\n  "project_name"…) — same
  // shape that was being rejected as "non-JSON content". This is the
  // regression check.
  {
    const productionLogShape =
      '{\n  "project_name": "Vektrum Demo Project",\n  "contract_total": 2500000,' +
      '\n  "currency": "USD",\n  "retainage": { "percentage": 10, "source_text": null, "confidence": 0.9 },' +
      '\n  "sov_line_items": [],\n  "release_conditions": {' +
      '\n    "sequential_release_required":    { "value": true, "source_text": null, "confidence": 0.9 },' +
      '\n    "lien_waiver_required":           { "value": true, "source_text": null, "confidence": 0.9 },' +
      '\n    "inspection_required":            { "value": true, "source_text": null, "confidence": 0.9 },' +
      '\n    "change_order_approval_required": { "value": true, "source_text": null, "confidence": 0.9 },' +
      '\n    "funder_authorization_required":  { "value": true, "source_text": null, "confidence": 1.0 }' +
      '\n  },\n  "evidence_requirements": [],\n  "warnings": [],\n  "assumptions": []\n}'
    const r = parseStructuredModelJson(productionLogShape)
    expectOk(r)
    check(
      (r.value as { project_name?: string }).project_name === 'Vektrum Demo Project',
      '  1b. production-log-shaped string is no longer rejected',
    )
  }

  // ── 2. Already-parsed object (provider returns a parsed shape) ───────
  console.log('\n2. Already-parsed object content')
  {
    const r = parseStructuredModelJson(VALID_PAYLOAD)
    expectOk(r)
    check(r.value === VALID_PAYLOAD || (r.value as { project_name?: string }).project_name === 'Vektrum Demo Project',
      '  2a. plain object passes through (no JSON.parse on object)')
  }

  // ── 3. Markdown-fenced JSON ──────────────────────────────────────────
  console.log('\n3. Markdown-fenced content')
  {
    const fenced = '```json\n' + VALID_JSON_STRING + '\n```'
    const r = parseStructuredModelJson(fenced)
    expectOk(r)
    check(
      (r.value as { project_name?: string }).project_name === 'Vektrum Demo Project',
      '  3a. ```json … ``` fenced content unwraps + parses',
    )
  }
  {
    const fenced = '```\n' + VALID_JSON_STRING + '\n```'
    const r = parseStructuredModelJson(fenced)
    expectOk(r)
    check(
      (r.value as { project_name?: string }).project_name === 'Vektrum Demo Project',
      '  3b. ``` … ``` (no language tag) fenced content unwraps + parses',
    )
  }
  // Inline fences inside the JSON itself must NOT be stripped.
  {
    const withInlineCode = JSON.stringify({
      ...VALID_PAYLOAD,
      assumptions: ['model said: ```const x = 1```'],
    })
    const r = parseStructuredModelJson(withInlineCode)
    expectOk(r)
    check(
      Array.isArray((r.value as { assumptions: string[] }).assumptions) &&
      (r.value as { assumptions: string[] }).assumptions[0].includes('```'),
      '  3c. inline ``` inside JSON values is preserved',
    )
  }

  // ── 4. Leading / trailing prose recovery ─────────────────────────────
  console.log('\n4. Leading / trailing prose recovery')
  {
    const withProse =
      'Here is your draft:\n\n' + VALID_JSON_STRING +
      '\n\nLet me know if you need any changes.'
    const r = parseStructuredModelJson(withProse)
    expectOk(r)
    check(
      (r.value as { project_name?: string }).project_name === 'Vektrum Demo Project',
      '  4a. content with leading + trailing prose recovers via { … } slice',
    )
  }
  {
    // Same but only leading prose
    const withProse = 'Sure! ' + VALID_JSON_STRING
    const r = parseStructuredModelJson(withProse)
    expectOk(r)
    check(
      (r.value as { project_name?: string }).project_name === 'Vektrum Demo Project',
      '  4b. leading-prose-only content recovers',
    )
  }

  // ── 5. Empty / whitespace input rejected ─────────────────────────────
  console.log('\n5. Empty input rejected')
  {
    const r = parseStructuredModelJson('')
    expectErr(r); check(r.reason === 'empty', '  5a. empty string → reason "empty"')
  }
  {
    const r = parseStructuredModelJson('   \n\t  ')
    expectErr(r); check(r.reason === 'empty', '  5b. whitespace-only string → reason "empty"')
  }
  {
    const r = parseStructuredModelJson('```json\n\n```')
    expectErr(r); check(r.reason === 'empty', '  5c. empty fenced block → reason "empty"')
  }

  // ── 6. Top-level arrays + primitives rejected ────────────────────────
  console.log('\n6. Top-level non-object rejected')
  {
    // Array passed as JS value
    const r = parseStructuredModelJson([VALID_PAYLOAD])
    expectErr(r)
    check(r.reason === 'top_level_not_object',
      '  6a. JS array → reason "top_level_not_object"')
  }
  {
    const r = parseStructuredModelJson('[1, 2, 3]')
    expectErr(r)
    check(r.reason === 'top_level_not_object',
      '  6b. stringified top-level array → reason "top_level_not_object"')
  }
  {
    const r = parseStructuredModelJson('"just a string"')
    expectErr(r)
    check(r.reason === 'top_level_not_object',
      '  6c. stringified top-level string literal → reason "top_level_not_object"')
  }
  {
    const r = parseStructuredModelJson('42')
    expectErr(r)
    check(r.reason === 'top_level_not_object',
      '  6d. stringified top-level number → reason "top_level_not_object"')
  }
  {
    const r = parseStructuredModelJson('null')
    expectErr(r)
    check(r.reason === 'top_level_not_object',
      '  6e. stringified top-level null → reason "top_level_not_object"')
  }

  // ── 7. Malformed / truncated JSON rejected ───────────────────────────
  console.log('\n7. Malformed / truncated rejected')
  {
    // Truncated mid-stream — no closing } at all.
    const truncated = VALID_JSON_STRING.slice(0, VALID_JSON_STRING.length - 1)
    const r = parseStructuredModelJson(truncated)
    expectErr(r)
    check(r.reason === 'unparseable',
      '  7a. truncated JSON (missing closing brace) → reason "unparseable"')
  }
  {
    // Garbage mid-string
    const r = parseStructuredModelJson('{ "project_name": "x", "broken": ,,, }')
    expectErr(r)
    check(r.reason === 'unparseable',
      '  7b. malformed JSON → reason "unparseable"')
  }
  {
    const r = parseStructuredModelJson('not even close to JSON')
    expectErr(r)
    check(r.reason === 'unparseable',
      '  7c. plain prose without { … } → reason "unparseable"')
  }

  // ── 8. Unsupported types ─────────────────────────────────────────────
  console.log('\n8. Unsupported types')
  {
    const r = parseStructuredModelJson(undefined)
    expectErr(r); check(r.reason === 'unsupported_type', '  8a. undefined → "unsupported_type"')
  }
  {
    const r = parseStructuredModelJson(null)
    expectErr(r); check(r.reason === 'unsupported_type', '  8b. null → "unsupported_type"')
  }
  {
    const r = parseStructuredModelJson(123)
    expectErr(r); check(r.reason === 'unsupported_type', '  8c. number → "unsupported_type"')
  }
  {
    const r = parseStructuredModelJson(true)
    expectErr(r); check(r.reason === 'unsupported_type', '  8d. boolean → "unsupported_type"')
  }

  // ── 9. Helper never uses eval / Function ─────────────────────────────
  console.log('\n9. No eval / Function in helper')
  const helper = read(HELPER)
  check(!/\beval\s*\(/.test(helper),
    '  9a. helper does NOT use eval()')
  check(!/new\s+Function\s*\(/.test(helper),
    '  9b. helper does NOT use new Function()')

  // ── 10. Helper structure pins ────────────────────────────────────────
  console.log('\n10. Helper structure pins')
  check(helper.includes('export function parseStructuredModelJson'),
    '  10a. helper exports parseStructuredModelJson')
  // Reads message.parsed first, falls back to message.content
  check(
    /messageParsed\s*!==\s*undefined/.test(helper) &&
    /messageParsed\s*!==\s*null/.test(helper) &&
    /messageContent/.test(helper),
    '  10b. helper prefers message.parsed when present, falls back to message.content',
  )

  // ── 11. Diagnostic log shape on parse failure ────────────────────────
  console.log('\n11. Failure diagnostic log shape')
  // Pull the failure log block — anchored on the [release-rules] model
  // output marker.
  const failureLogMatch = helper.match(
    /\[release-rules\] model output could not be parsed[\s\S]*?\}\s*\)/,
  )
  check(!!failureLogMatch, '  11a. failure log block exists')
  for (const field of [
    'content_type',
    'content_length',
    'starts_with',
    'ends_with',
    'first_200_chars',
    'parse_failure_reason',
    'response_format_type',
    'response_format_schema_name',
  ]) {
    check(
      failureLogMatch !== null && failureLogMatch[0].includes(field),
      `  11b. diagnostic log includes "${field}"`,
    )
  }
  // Must NOT log the API key, full prompt, or contract text
  check(
    failureLogMatch !== null &&
    !failureLogMatch[0].includes('apiKey') &&
    !failureLogMatch[0].includes('contractText') &&
    !failureLogMatch[0].includes('userMessage'),
    '  11c. diagnostic log does NOT include API key / prompt / contract text',
  )

  // ── 12. User-facing parse-failure message ────────────────────────────
  console.log('\n12. User-facing parse-failure message')
  check(
    helper.includes('Could not parse the draft release rules returned by the AI service.'),
    '  12a. parse-failure message: "Could not parse the draft release rules returned by the AI service."',
  )
  // Must NOT blame the PDF
  check(
    !/password-protected or corrupted/i.test(helper) &&
    !/Could not read the contract PDF/i.test(helper),
    '  12b. helper does not blame the PDF on parse failure',
  )
  // The earlier safe message ("Could not generate draft release rules …")
  // is still used for non-2xx + network failures — confirm both messages
  // co-exist.
  check(
    helper.includes('Could not generate draft release rules right now.'),
    '  12c. existing "Could not generate draft release rules right now." preserved for upstream failures',
  )

  // ── 13. validateDraft still runs after the parser ────────────────────
  console.log('\n13. Strict validation still gates persistence')
  // The helper code must call validateDraft(...) on the parsed value.
  check(
    /validation\s*=\s*validateDraft\(\s*parseResult\.value/.test(helper),
    '  13a. validateDraft is invoked on parseResult.value',
  )

  // ── 14. No Stripe / payment / release imports ────────────────────────
  console.log('\n14. No Stripe / payment / release imports')
  const route = read(ROUTE)
  for (const banned of [
    'validateRelease',
    'authorizeRelease',
    'createTransfer',
    "'@/lib/stripe'",
    'stripe.transfers',
  ]) {
    check(!helper.includes(banned),
      `  14a. helper does NOT import / call "${banned}"`)
    check(!route.includes(banned),
      `  14b. route does NOT import / call "${banned}"`)
  }

  // ── 15. Banned product claims absent ─────────────────────────────────
  console.log('\n15. Banned product claims absent')
  const lower = (helper + '\n' + route).toLowerCase()
  for (const banned of [
    'vektrum moves money',
    'vektrum holds funds',
    'vektrum acts as escrow',
    'ai approves release',
    'ai approves',
    'ai authorizes',
    'funds are released automatically',
    'funds released automatically',
    'guaranteed extraction',
    'guarantees compliance',
  ]) {
    check(!lower.includes(banned), `  15. banned: "${banned}" absent`)
  }

  // ── 16. Test wired into npm test ─────────────────────────────────────
  const pkg = read(PACKAGE_JSON)
  check(pkg.includes('perplexity-structured-output-parser.test.ts'),
    '16. perplexity-structured-output-parser.test.ts wired into npm test')

  console.log('\n✓ All perplexity-structured-output-parser tests passed.\n')
}

main().catch((err) => {
  console.error('\n' + err.message)
  process.exit(1)
})
