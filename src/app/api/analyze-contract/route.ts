// POST /api/analyze-contract
//
// Accepts a multipart/form-data request with:
//   contract  — the PDF file (required, max 20MB)
//   metadata  — JSON string of DealMetadata (optional, used for prompt context)
//
// Pipeline:
//   1. Parse the PDF to plain text using pdf-parse (Node.js runtime)
//   2. Truncate text to fit Perplexity's context window
//   3. Call Perplexity Sonar Pro to extract structured milestone data
//   4. Validate + normalise the response
//   5. Return { success: true, data: ContractAnalysisResult }
//
// This is the ONLY place contract text is parsed or sent to any AI service.
// The text is never persisted — only the resulting milestone structure is saved
// (by confirmDealFromContract in src/lib/actions/analyze-contract.ts).

// POST /api/analyze-contract
//
// SECURITY: Requires an authenticated session — any logged-in user (any role)
// may use this endpoint to analyse a contract PDF before creating a deal.
// Unauthenticated requests are rejected with 401 to prevent anonymous API
// abuse that would burn Perplexity API credits.

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/middleware'
import type { ContractAnalysisResult, ProposedMilestone } from '@/lib/actions/analyze-contract'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation, getRequestIp } from '@/lib/engine/rate-limit'
export const runtime = "nodejs";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 20 * 1024 * 1024            // 20 MB
const MAX_TEXT_CHARS = 60_000                      // ~15k tokens — well within sonar-pro context
const PERPLEXITY_MODEL = 'sonar-pro'
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions'

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 0. Authentication gate ─────────────────────────────────────────────────
  // Any authenticated user may analyse a contract. We do NOT require a specific
  // role because this endpoint is used during deal creation, before a deal (and
  // therefore a role context) exists. The gate solely prevents anonymous abuse.
  let authContext
  try {
    authContext = await getAuthUser(req)
  } catch (err) {
    return err as NextResponse
  }

  // ── Rate limit — AI contract analysis (IP-keyed + user-keyed) ─────────────
  // Keyed by user ID when available; falls back to IP for any edge cases.
  // Each call parses a PDF and sends ~15k tokens to Perplexity — strict cap.
  {
    const limitKey = `user:${authContext.user.id}:ai_analysis`
    const rl = await checkRateLimit(limitKey, POLICIES.ai_analysis)
    if (!rl.allowed) {
      logRateLimitViolation(limitKey, rl, {
        actorId: authContext.user.id, policyName: 'ai_analysis',
        entityType: 'contract', entityId: 'upload',
      })
      return rateLimitResponse(rl, POLICIES.ai_analysis.description)
    }
  }

  // ── 1. Parse multipart form ────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request — expected multipart/form-data.' },
      { status: 400 },
    )
  }

  const contractFile = formData.get('contract')
  if (!contractFile || !(contractFile instanceof Blob)) {
    return NextResponse.json(
      { success: false, error: 'No contract file provided.' },
      { status: 400 },
    )
  }

  if (contractFile.type !== 'application/pdf') {
    return NextResponse.json(
      { success: false, error: 'Only PDF files are supported.' },
      { status: 400 },
    )
  }

  if (contractFile.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: 'File must be under 20MB.' },
      { status: 400 },
    )
  }

  // Optional: deal metadata for richer prompt context
  let metadata: { dealName?: string; jurisdiction?: string } = {}
  const metadataRaw = formData.get('metadata')
  if (typeof metadataRaw === 'string') {
    try {
      metadata = JSON.parse(metadataRaw)
    } catch {
      // Non-fatal — we can analyze without metadata
    }
  }

  // ── 2. Extract text from PDF ───────────────────────────────────────────────
  // pdf-parse v2.x replaced the old callable default export with a class-based
  // API: `new PDFParse({ data: buffer }).getText()`. The constructor
  // auto-converts Node Buffer to Uint8Array. Always call parser.destroy() to
  // release the underlying pdfjs-dist document.
  let contractText: string
  let parser: InstanceType<typeof import('pdf-parse').PDFParse> | null = null
  try {
    const buffer = Buffer.from(await contractFile.arrayBuffer())

    // pdf-parse is shipped as a dual CJS/ESM package. Use require() to stay
    // on the CJS path and avoid ESM interop issues in the Next.js Node runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse') as typeof import('pdf-parse')
    parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    contractText = parsed.text ?? ''
  } catch (err) {
    console.error('[analyze-contract] PDF parse error:', err)
    return NextResponse.json(
      {
        success: false,
        error:
          'Could not read the PDF. Please ensure the file is not password-protected or corrupted.',
      },
      { status: 422 },
    )
  } finally {
    // Always release pdfjs resources even if downstream steps throw.
    try {
      await parser?.destroy()
    } catch {
      // destroy() failures are non-fatal for the request
    }
  }

  if (!contractText.trim()) {
    return NextResponse.json(
      {
        success: false,
        error:
          'No readable text found in this PDF. It may be a scanned image without OCR text.',
      },
      { status: 422 },
    )
  }

  // Truncate to avoid blowing through token limits — take the first N chars
  const truncated = contractText.length > MAX_TEXT_CHARS
    ? contractText.slice(0, MAX_TEXT_CHARS) + '\n\n[... document truncated for analysis ...]'
    : contractText

  // ── 3. Check Perplexity key ────────────────────────────────────────────────
  const apiKey = process.env.PERPLEXITY_API_KEY

  // Diagnostic: log key presence (never the value) and file context
  console.info('[analyze-contract] diagnostics:', {
    route: 'POST /api/analyze-contract',
    perplexityKeyPresent: !!apiKey,
    fileSize: contractFile.size,
    textLength: contractText?.length ?? 0,
  })

  // Error type 1: missing env var
  if (!apiKey) {
    console.error('[analyze-contract] PERPLEXITY_API_KEY not set — add it to .env.local and Vercel env vars')
    return NextResponse.json(
      { success: false, error: 'AI analysis service is not configured.', code: 'AI_NOT_CONFIGURED' },
      { status: 503 },
    )
  }

  // ── 4. Build prompts ───────────────────────────────────────────────────────
  const projectContext = [
    metadata.dealName && `Project: ${metadata.dealName}`,
    metadata.jurisdiction && `Jurisdiction: ${metadata.jurisdiction}`,
  ]
    .filter(Boolean)
    .join('\n')

  const systemPrompt = `You are a construction contract analyst for Vektrum, a construction payment governance platform. Your job is to read raw construction contract text and extract a structured milestone payment schedule.

You must return ONLY a valid JSON object. No markdown fences, no commentary, no explanation — just the JSON.

The JSON must exactly match this schema:
{
  "milestones": [
    {
      "name": string,
      "amount": number,
      "conditions": string[],
      "sequence_order": number,
      "retainage_pct": number,
      "notes": string,
      "flags": string[]
    }
  ],
  "total_value": number,
  "retainage_summary": string,
  "missing_clauses": string[],
  "recommended_settings": {
    "dispute_isolation": boolean,
    "co_gating": boolean,
    "retainage_holdback_pct": number
  }
}

Rules:
- sequence_order starts at 1 and increments
- amount must be a positive number (dollars, no currency symbols)
- total_value is the sum of all milestone amounts
- conditions lists the completion requirements for each milestone
- retainage_pct is the percentage withheld per milestone (0 if not specified)
- notes captures any unusual terms or qualifications for that milestone
- flags lists risk indicators: e.g. "no lien waiver clause", "vague completion criteria", "no dispute resolution"
- missing_clauses lists important clauses absent from the contract
- retainage_summary is a 1-2 sentence plain-English summary of retainage terms
- dispute_isolation: true if the contract allows per-milestone dispute handling
- co_gating: true if change orders require funder approval before work proceeds
- retainage_holdback_pct: the overall retainage percentage (0 if none)`

  const userPrompt = `${projectContext ? projectContext + '\n\n' : ''}CONTRACT TEXT:\n\n${truncated}`

  // ── 5. Call Perplexity Sonar Pro ───────────────────────────────────────────
  let rawContent: string
  try {
    const response = await fetch(PERPLEXITY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,  // Low temperature — we want deterministic extraction, not creativity
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[analyze-contract] Perplexity error:', response.status, errorBody)

      // Error type 2: invalid key / unauthorized
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { success: false, error: 'AI service authentication failed. Check the API key configuration.', code: 'AI_AUTH_FAILED' },
          { status: 502 },
        )
      }

      // 429 rate limit
      if (response.status === 429) {
        return NextResponse.json(
          { success: false, error: 'AI service rate limit reached. Please try again in a moment.', code: 'AI_RATE_LIMITED' },
          { status: 429 },
        )
      }

      // Error type 6: other provider error
      return NextResponse.json(
        { success: false, error: 'AI service returned an error. Please try again.', code: 'AI_PROVIDER_ERROR' },
        { status: 502 },
      )
    }

    const json = await response.json()
    rawContent = json.choices?.[0]?.message?.content ?? ''
  } catch (err) {
    // Error type 6: network / provider unreachable
    console.error('[analyze-contract] Perplexity fetch failed (network error):', err)
    return NextResponse.json(
      { success: false, error: 'Could not reach the AI service. Please try again.', code: 'AI_NETWORK_ERROR' },
      { status: 502 },
    )
  }

  if (!rawContent.trim()) {
    return NextResponse.json(
      { success: false, error: 'AI returned an empty response. Please try again.' },
      { status: 502 },
    )
  }

  // ── 6. Parse + validate the JSON response ─────────────────────────────────
  let parsed: ContractAnalysisResult
  try {
    // Strip any markdown fences the model may have added despite instructions
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[analyze-contract] JSON parse failed. Raw content:', rawContent.slice(0, 500))
    return NextResponse.json(
      {
        success: false,
        error:
          'AI returned an unreadable response. This can happen with unusual contract formats. Please try again or enter milestones manually.',
      },
      { status: 502 },
    )
  }

  // ── 7. Normalise + sanitise the parsed result ──────────────────────────────
  // Ensure every field is present and correctly typed before returning to
  // the client. Missing or malformed fields get safe defaults.
  const milestones: ProposedMilestone[] = (parsed.milestones ?? []).map((m, i) => ({
    name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : `Milestone ${i + 1}`,
    amount: typeof m.amount === 'number' && m.amount > 0 ? m.amount : 0,
    conditions: Array.isArray(m.conditions) ? m.conditions.filter((c) => typeof c === 'string') : [],
    sequence_order: typeof m.sequence_order === 'number' ? m.sequence_order : i + 1,
    retainage_pct: typeof m.retainage_pct === 'number' ? m.retainage_pct : 0,
    notes: typeof m.notes === 'string' ? m.notes : '',
    flags: Array.isArray(m.flags) ? m.flags.filter((f) => typeof f === 'string') : [],
  }))

  if (milestones.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          'No milestones could be extracted from this document. Please ensure this is a construction contract with a payment schedule, or enter milestones manually.',
      },
      { status: 422 },
    )
  }

  // Recompute total_value from milestones rather than trusting the AI's sum
  const totalValue =
    typeof parsed.total_value === 'number' && parsed.total_value > 0
      ? parsed.total_value
      : milestones.reduce((sum, m) => sum + m.amount, 0)

  const result: ContractAnalysisResult = {
    milestones,
    total_value: totalValue,
    retainage_summary:
      typeof parsed.retainage_summary === 'string'
        ? parsed.retainage_summary
        : 'Retainage terms not identified.',
    missing_clauses: Array.isArray(parsed.missing_clauses)
      ? parsed.missing_clauses.filter((c) => typeof c === 'string')
      : [],
    recommended_settings: {
      dispute_isolation:
        typeof parsed.recommended_settings?.dispute_isolation === 'boolean'
          ? parsed.recommended_settings.dispute_isolation
          : true,
      co_gating:
        typeof parsed.recommended_settings?.co_gating === 'boolean'
          ? parsed.recommended_settings.co_gating
          : false,
      retainage_holdback_pct:
        typeof parsed.recommended_settings?.retainage_holdback_pct === 'number'
          ? parsed.recommended_settings.retainage_holdback_pct
          : 0,
    },
  }

  return NextResponse.json({ success: true, data: result })
}
