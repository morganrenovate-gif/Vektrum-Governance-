/**
 * Contract → draft release-governance rules helper.
 *
 * SAFETY BOUNDARY:
 *   - This helper produces DRAFT rules only. Output never authorizes
 *     release, never moves money, never approves SOV, never replaces legal
 *     review. Every generated value is for human review.
 *   - The system prompt explicitly tells the model: "You do not approve
 *     releases, interpret legal obligations with authority, authorize
 *     payment, or move funds." Output is forced through a strict shape
 *     before any caller touches it.
 *   - We refuse partial inputs: if extracted contract text is too short
 *     or empty, we return ok:false with a safe message, never an empty
 *     draft.
 *
 * SECRETS:
 *   - PERPLEXITY_API_KEY is server-only. We deliberately import this from
 *     `process.env` here (a server-only module) and never re-export it.
 *   - Do NOT use NEXT_PUBLIC_*; those names ship to the browser.
 *
 * Schema is fully described in DraftReleaseRules below.
 */

const DEFAULT_PERPLEXITY_MODEL = 'sonar-pro'

const MIN_CONTRACT_TEXT_CHARS = 500

const SYSTEM_PROMPT =
  'You extract draft construction draw release rules from signed contract text. ' +
  'You do not approve releases, interpret legal obligations with authority, ' +
  'authorize payment, or move funds. Return only JSON matching the schema. ' +
  'If unclear, use nulls, warnings, and review_required=true.'

// ─── Perplexity structured-output JSON Schema ────────────────────────────
//
// Sonar's structured-output mode rejects `{ type: 'json_object' }` and
// requires `{ type: 'json_schema', json_schema: { name, schema } }`. The
// 400 returned by the bare `json_object` shape is:
//   "ResponseFormatJSONSchema -> json_schema: Field required"
//
// Schema below mirrors the DraftReleaseRules TypeScript shape but uses
// nullable variants per JSON Schema 2020-12 (the spec Sonar follows).
// We keep `additionalProperties: false` on every object so the model
// cannot smuggle extra keys past the validator.

const PERPLEXITY_SCHEMA_NAME = 'contract_release_rules'

const FIELD_EXTRACTION_BOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    value:       { type: ['boolean', 'null'] },
    source_text: { type: ['string',  'null'] },
    confidence:  { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['value', 'source_text', 'confidence'],
} as const

const FIELD_EXTRACTION_TRUE_SCHEMA = {
  // funder_authorization_required — product invariant. The model is told
  // that value must be `true`; we also overwrite locally in validateDraft.
  type: 'object',
  additionalProperties: false,
  properties: {
    value:       { const: true },
    source_text: { type: ['string', 'null'] },
    confidence:  { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['value', 'source_text', 'confidence'],
} as const

const RELEASE_RULES_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'project_name',
    'contract_total',
    'currency',
    'retainage',
    'sov_line_items',
    'release_conditions',
    'evidence_requirements',
    'warnings',
    'assumptions',
  ],
  properties: {
    project_name:   { type: ['string', 'null'] },
    contract_total: { type: ['number', 'null'], minimum: 0 },
    currency:       { type: 'string', enum: ['USD'] },
    retainage: {
      type: 'object',
      additionalProperties: false,
      properties: {
        percentage:  { type: ['number', 'null'], minimum: 0, maximum: 100 },
        source_text: { type: ['string', 'null'] },
        confidence:  { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['percentage', 'source_text', 'confidence'],
    },
    sov_line_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name:            { type: 'string' },
          description:     { type: ['string', 'null'] },
          amount:          { type: ['number', 'null'], minimum: 0 },
          source_text:     { type: ['string', 'null'] },
          confidence:      { type: 'number', minimum: 0, maximum: 1 },
          review_required: { type: 'boolean' },
        },
        required: [
          'name', 'description', 'amount',
          'source_text', 'confidence', 'review_required',
        ],
      },
    },
    release_conditions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sequential_release_required:    FIELD_EXTRACTION_BOOL_SCHEMA,
        lien_waiver_required:           FIELD_EXTRACTION_BOOL_SCHEMA,
        inspection_required:            FIELD_EXTRACTION_BOOL_SCHEMA,
        change_order_approval_required: FIELD_EXTRACTION_BOOL_SCHEMA,
        funder_authorization_required:  FIELD_EXTRACTION_TRUE_SCHEMA,
      },
      required: [
        'sequential_release_required',
        'lien_waiver_required',
        'inspection_required',
        'change_order_approval_required',
        'funder_authorization_required',
      ],
    },
    evidence_requirements: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          condition:         { type: 'string' },
          required_document: { type: 'string' },
          applies_to:        { type: ['string', 'null'] },
          source_text:       { type: ['string', 'null'] },
          confidence:        { type: 'number', minimum: 0, maximum: 1 },
          review_required:   { type: 'boolean' },
        },
        required: [
          'condition', 'required_document', 'applies_to',
          'source_text', 'confidence', 'review_required',
        ],
      },
    },
    warnings:    { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
  },
} as const

// ─── Output schema ───────────────────────────────────────────────────────

export interface FieldExtraction<T> {
  value:        T | null
  source_text:  string | null
  confidence:   number
}

export interface SovLineItemDraft {
  name:            string
  description:     string | null
  amount:          number | null
  source_text:     string | null
  confidence:      number
  review_required: boolean
}

export interface EvidenceRequirementDraft {
  condition:         string
  required_document: string
  applies_to:        string | null
  source_text:       string | null
  confidence:        number
  review_required:   boolean
}

export interface DraftReleaseRules {
  project_name:    string | null
  contract_total:  number | null
  currency:        'USD'
  retainage: {
    percentage:  number | null
    source_text: string | null
    confidence:  number
  }
  sov_line_items: SovLineItemDraft[]
  release_conditions: {
    sequential_release_required:    FieldExtraction<boolean>
    lien_waiver_required:           FieldExtraction<boolean>
    inspection_required:            FieldExtraction<boolean>
    change_order_approval_required: FieldExtraction<boolean>
    funder_authorization_required:  FieldExtraction<true>
  }
  evidence_requirements: EvidenceRequirementDraft[]
  warnings:    string[]
  assumptions: string[]
}

// ─── Inputs ──────────────────────────────────────────────────────────────

export interface GenerateInput {
  dealTitle?:        string | null
  contractFileName?: string | null
  contractTotal?:    number | null
  contractText:      string
}

export interface GenerateOk {
  ok:       true
  draft:    DraftReleaseRules
  source:   'perplexity'
  /** Total of all sov_line_items[].amount that are non-null. Used by callers
   *  to record an audit-friendly summary without re-walking the payload. */
  lineItemsTotal: number
}

export interface GenerateErr {
  ok:    false
  error: string
  /** Reason category — used by the API route to map to a status code. */
  reason:
    | 'unreadable_contract'   // 422 — extraction returned too little text
    | 'config'                // 503 — PERPLEXITY_API_KEY missing
    | 'upstream'              // 502 — Perplexity returned non-2xx
    | 'invalid_json'          // 502 — model returned non-JSON / wrong shape
    | 'unknown'
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function generateDraftReleaseRules(
  input: GenerateInput,
): Promise<GenerateOk | GenerateErr> {
  const text = (input.contractText ?? '').trim()
  if (text.length < MIN_CONTRACT_TEXT_CHARS) {
    return {
      ok:     false,
      reason: 'unreadable_contract',
      error:
        'Could not read enough text from the signed contract. ' +
        'Enter release rules manually.',
    }
  }

  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    console.error(
      '[release-rules] PERPLEXITY_API_KEY is not set. ' +
      'Set it in Vercel env vars (server-only — never NEXT_PUBLIC_).',
    )
    return {
      ok:     false,
      reason: 'config',
      error:
        'AI extraction is not configured. Enter release rules manually until ' +
        'PERPLEXITY_API_KEY is set in the deployment environment.',
    }
  }

  const model = process.env.PERPLEXITY_MODEL || DEFAULT_PERPLEXITY_MODEL

  // User message — short prompt + the contract text. The schema is enforced
  // structurally below; we ask the model to be conservative with nulls.
  const userMessage =
    `Generate draft SOV and release rules for human review. Do not invent ` +
    `amounts or conditions. Use source_text snippets where possible. If ` +
    `ambiguous, add warnings and set review_required=true.\n\n` +
    `Deal title: ${input.dealTitle ?? '(unknown)'}\n` +
    `Contract filename: ${input.contractFileName ?? '(unknown)'}\n` +
    `Known contract total (USD): ${
      typeof input.contractTotal === 'number' ? input.contractTotal : '(unknown)'
    }\n\n` +
    `Contract text:\n"""\n${truncateForPrompt(text)}\n"""`

  // Sonar's structured-output API requires:
  //   response_format: { type: 'json_schema',
  //                      json_schema: { name, schema } }
  // The previous { type: 'json_object' } shape was rejected with
  //   "ResponseFormatJSONSchema -> json_schema: Field required"
  const responseFormat = {
    type: 'json_schema',
    json_schema: {
      name:   PERPLEXITY_SCHEMA_NAME,
      schema: RELEASE_RULES_JSON_SCHEMA,
    },
  } as const

  let response: Response
  try {
    response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMessage   },
        ],
        response_format: responseFormat,
        temperature: 0,
      }),
    })
  } catch (err) {
    // Network / DNS / abort. Upstream code did not run.
    console.error('[release-rules] perplexity fetch failed:', String(err).slice(0, 200))
    return {
      ok:     false,
      reason: 'upstream',
      error:
        'Could not generate draft release rules right now. ' +
        'Enter release rules manually or try again.',
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    // Safe diagnostics — never log the API key or the raw prompt / contract.
    // Surfaces the response_format shape so a future regression to the
    // wrong shape is immediately visible in Vercel logs.
    console.error('[release-rules] perplexity non-2xx', {
      status:                       response.status,
      model,
      response_format_type:         responseFormat.type,
      response_format_has_json_schema: !!responseFormat.json_schema,
      response_format_schema_name:  responseFormat.json_schema.name,
      // Body truncated to 400 chars. We do NOT include the prompt, contract
      // text, or API key in this log line.
      upstream_body_excerpt:        body.slice(0, 400),
    })
    return {
      ok:     false,
      reason: 'upstream',
      error:
        'Could not generate draft release rules right now. ' +
        'Enter release rules manually or try again.',
    }
  }

  // Pull the assistant's JSON content.
  let raw: string
  try {
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    raw = json.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    console.error('[release-rules] perplexity body parse failed:', String(err).slice(0, 200))
    return {
      ok:     false,
      reason: 'invalid_json',
      error:
        'Could not generate draft release rules right now. ' +
        'Enter release rules manually or try again.',
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[release-rules] model returned non-JSON content (first 200 chars):', raw.slice(0, 200))
    return {
      ok:     false,
      reason: 'invalid_json',
      error:
        'Could not generate draft release rules right now. ' +
        'Enter release rules manually or try again.',
    }
  }

  const validation = validateDraft(parsed, input.contractTotal ?? null)
  if (!validation.ok) {
    return { ok: false, reason: 'invalid_json', error: validation.error }
  }

  return {
    ok:             true,
    source:         'perplexity',
    draft:          validation.draft,
    lineItemsTotal: validation.lineItemsTotal,
  }
}

// ─── Validation ──────────────────────────────────────────────────────────

interface ValidationOk { ok: true; draft: DraftReleaseRules; lineItemsTotal: number }
interface ValidationErr { ok: false; error: string }

/**
 * Coerces the model's output into the strict DraftReleaseRules shape.
 * Missing fields → nulls + warning. Negative amounts → null + warning.
 * Mismatched line-item totals → review_required on every line + warning.
 */
function validateDraft(
  raw: unknown,
  knownContractTotal: number | null,
): ValidationOk | ValidationErr {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'AI output is not a JSON object.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as any
  const warnings: string[]    = Array.isArray(obj.warnings)    ? obj.warnings.filter((w: unknown) => typeof w === 'string') : []
  const assumptions: string[] = Array.isArray(obj.assumptions) ? obj.assumptions.filter((a: unknown) => typeof a === 'string') : []

  // Line items — non-negative amounts only; review_required gates anything weird.
  const lineItemsRaw = Array.isArray(obj.sov_line_items) ? obj.sov_line_items : []
  const sov_line_items: SovLineItemDraft[] = []
  let lineItemsTotal = 0
  let totalIsKnown = true
  for (const item of lineItemsRaw) {
    if (!item || typeof item !== 'object') continue
    const name        = typeof item.name === 'string' ? item.name.slice(0, 200) : null
    if (!name) continue
    const description = typeof item.description === 'string' ? item.description.slice(0, 1000) : null
    const source_text = typeof item.source_text === 'string' ? item.source_text.slice(0, 1000) : null
    const confidence  = clampConfidence(item.confidence)
    let amount: number | null = null
    if (typeof item.amount === 'number' && Number.isFinite(item.amount)) {
      if (item.amount < 0) {
        warnings.push(`Negative amount on line item "${name}" — set to null.`)
      } else {
        amount = item.amount
      }
    }
    if (amount === null) totalIsKnown = false
    else lineItemsTotal += amount
    const review_required = !!item.review_required || amount === null || confidence < 0.6
    sov_line_items.push({ name, description, amount, source_text, confidence, review_required })
  }

  // Compare totals
  const contract_total =
    typeof obj.contract_total === 'number' && obj.contract_total >= 0
      ? obj.contract_total
      : null
  if (totalIsKnown && contract_total !== null && Math.abs(lineItemsTotal - contract_total) > 0.5) {
    warnings.push(
      `Sum of SOV line items (${lineItemsTotal.toFixed(2)}) does not match ` +
      `contract_total (${contract_total.toFixed(2)}). Review required.`,
    )
    for (const item of sov_line_items) item.review_required = true
  }
  if (
    totalIsKnown &&
    knownContractTotal !== null &&
    Math.abs(lineItemsTotal - knownContractTotal) > 0.5
  ) {
    warnings.push(
      `Sum of SOV line items (${lineItemsTotal.toFixed(2)}) does not match ` +
      `the deal's recorded contract total (${knownContractTotal.toFixed(2)}). Review required.`,
    )
    for (const item of sov_line_items) item.review_required = true
  }

  // Retainage
  const retainageRaw = obj.retainage ?? {}
  let retainagePct: number | null = null
  if (typeof retainageRaw.percentage === 'number' && Number.isFinite(retainageRaw.percentage)) {
    if (retainageRaw.percentage < 0 || retainageRaw.percentage > 100) {
      warnings.push(`Retainage percentage out of range (${retainageRaw.percentage}). Set to null.`)
    } else {
      retainagePct = retainageRaw.percentage
    }
  }
  const retainage = {
    percentage:  retainagePct,
    source_text: typeof retainageRaw.source_text === 'string' ? retainageRaw.source_text.slice(0, 1000) : null,
    confidence:  clampConfidence(retainageRaw.confidence),
  }

  // Release conditions
  const rcRaw = obj.release_conditions ?? {}
  const release_conditions = {
    sequential_release_required:    coerceBoolField(rcRaw.sequential_release_required),
    lien_waiver_required:           coerceBoolField(rcRaw.lien_waiver_required),
    inspection_required:            coerceBoolField(rcRaw.inspection_required),
    change_order_approval_required: coerceBoolField(rcRaw.change_order_approval_required),
    // funder_authorization_required is product-invariant true; we never let
    // the model lower it. Source/confidence still come from the model so
    // reviewers see what the contract said about funder authority.
    funder_authorization_required: coerceTrueField(rcRaw.funder_authorization_required),
  }

  // Evidence requirements
  const evidenceRaw = Array.isArray(obj.evidence_requirements) ? obj.evidence_requirements : []
  const evidence_requirements: EvidenceRequirementDraft[] = []
  for (const ev of evidenceRaw) {
    if (!ev || typeof ev !== 'object') continue
    const condition         = typeof ev.condition === 'string' ? ev.condition.slice(0, 200) : null
    const required_document = typeof ev.required_document === 'string' ? ev.required_document.slice(0, 200) : null
    if (!condition || !required_document) continue
    const confidence        = clampConfidence(ev.confidence)
    evidence_requirements.push({
      condition,
      required_document,
      applies_to:      typeof ev.applies_to === 'string' ? ev.applies_to.slice(0, 200) : null,
      source_text:     typeof ev.source_text === 'string' ? ev.source_text.slice(0, 1000) : null,
      confidence,
      review_required: !!ev.review_required || confidence < 0.6,
    })
  }

  const draft: DraftReleaseRules = {
    project_name:   typeof obj.project_name === 'string' ? obj.project_name.slice(0, 200) : null,
    contract_total,
    currency:       'USD',
    retainage,
    sov_line_items,
    release_conditions,
    evidence_requirements,
    warnings,
    assumptions,
  }

  return { ok: true, draft, lineItemsTotal }
}

function clampConfidence(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function coerceBoolField(v: unknown): FieldExtraction<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (v ?? {}) as any
  let value: boolean | null = null
  if (typeof r.value === 'boolean') value = r.value
  return {
    value,
    source_text: typeof r.source_text === 'string' ? r.source_text.slice(0, 1000) : null,
    confidence:  clampConfidence(r.confidence),
  }
}

function coerceTrueField(v: unknown): FieldExtraction<true> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (v ?? {}) as any
  return {
    value:       true,                             // product invariant
    source_text: typeof r.source_text === 'string' ? r.source_text.slice(0, 1000) : null,
    confidence:  clampConfidence(r.confidence),
  }
}

function truncateForPrompt(text: string): string {
  // Sonar-pro context is large but we still cap the prompt to keep
  // latency bounded and the cost predictable. 60k chars ≈ 15k tokens.
  const MAX = 60_000
  if (text.length <= MAX) return text
  return text.slice(0, MAX) + '\n\n[…contract truncated…]'
}
