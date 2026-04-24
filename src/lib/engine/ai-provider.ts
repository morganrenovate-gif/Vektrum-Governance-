// ─── AI Draw Review Provider Abstraction ──────────────────────────────────────
//
// Implements a three-level provider chain for draw review:
//   Perplexity sonar-pro  →  Claude claude-sonnet-4-20250514  →  GPT-4o
//
// Each provider is tried in order. If a provider is unconfigured, times out,
// or returns an HTTP error it is skipped and the next is tried. All providers
// use the same system/user prompt so results are comparable across providers.
//
// Timeout per provider is controlled by AI_PROVIDER_TIMEOUT_MS (default 10 s).
// If every provider fails, ProviderChain throws ProviderChainError with code
// AI_ALL_PROVIDERS_FAILED.

export interface DrawReviewContext {
  milestoneId: string
  dealId: string
  milestone: {
    title:       string
    description: string | null
    amount:      number
    status:      string
  }
  deal: {
    title:        string
    description:  string | null
    status:       string
    total_amount: number
  }
  documents: Array<{
    file_url:   string
    file_type:  string | null
    created_at: string
  }>
}

export type RiskLevel      = 'low' | 'medium' | 'high' | 'critical'
export type Recommendation = 'approve' | 'hold' | 'reject'
export type ProviderName   = 'perplexity' | 'anthropic' | 'openai'

export interface DrawReviewResult {
  risk_level:    RiskLevel
  score:         number
  findings:      string[]
  recommendation: Recommendation
  reasoning:     string
  /** Which AI provider produced this result. */
  provider_used: ProviderName
  /** True when the primary provider (Perplexity) was unavailable. */
  is_fallback:   boolean
  /** Exact model string used, e.g. 'sonar-pro', 'claude-sonnet-4-20250514'. */
  model:         string
}

export interface AIDrawReviewProvider {
  readonly name:  ProviderName
  readonly model: string
  reviewDraw(ctx: DrawReviewContext): Promise<DrawReviewResult>
}

// ─── Shared prompt builders ───────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return (
    'You are an AI financial risk analyst for Vektrum, a construction payment governance ' +
    'platform. Your role is to evaluate milestone draw requests and assess whether fund ' +
    'release is appropriate. You must be rigorous, objective, and protect all parties from ' +
    'fraud, premature payment, and documentation gaps.'
  )
}

function buildUserPrompt(ctx: DrawReviewContext): string {
  const { milestone, deal, documents } = ctx

  const docLines = documents.length > 0
    ? documents.map(d => `- ${d.file_url} (${d.file_type ?? 'unknown type'}, submitted ${d.created_at})`).join('\n')
    : 'No documents submitted'

  return `Analyze this construction milestone draw request:

DEAL CONTEXT:
- Deal: ${deal.title}
- Description: ${deal.description ?? 'None provided'}
- Total Amount: $${deal.total_amount?.toLocaleString()}
- Deal Status: ${deal.status}

MILESTONE:
- Title: ${milestone.title}
- Description: ${milestone.description ?? 'None provided'}
- Draw Amount: $${milestone.amount?.toLocaleString()}
- Current Status: ${milestone.status}

SUBMITTED DOCUMENTS (${documents.length} files):
${docLines}

ASSESSMENT REQUIRED:
Provide a structured JSON assessment with these exact fields:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "score": <integer 0-100, where 100 = fully safe to release>,
  "findings": [<array of specific observations, each a complete sentence>],
  "recommendation": "approve" | "hold" | "reject",
  "reasoning": "<2-4 sentence executive summary of your assessment>"
}

Risk criteria:
- critical: fraud indicators, zero documentation, amount inconsistency, or policy violation
- high: missing key documents, status mismatch, or significant concerns
- medium: minor gaps, could proceed with caution
- low: well-documented, appropriate amount, clear completion evidence

Respond ONLY with the JSON object. No markdown, no commentary.`
}

// ─── JSON parser (shared) ─────────────────────────────────────────────────────

function parseAssessment(
  raw: string,
): Omit<DrawReviewResult, 'provider_used' | 'is_fallback' | 'model'> {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return {
      risk_level:     'high',
      score:          40,
      findings:       [
        'AI response could not be parsed — manual review required',
        raw.slice(0, 500),
      ],
      recommendation: 'hold',
      reasoning:
        'Automated assessment encountered a parsing error. ' +
        'A human reviewer should evaluate this draw request.',
    }
  }
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

function providerTimeout(): AbortSignal {
  const ms = parseInt(process.env.AI_PROVIDER_TIMEOUT_MS ?? '10000', 10)
  return AbortSignal.timeout(ms)
}

// ─── Perplexity Provider ──────────────────────────────────────────────────────

export class PerplexityProvider implements AIDrawReviewProvider {
  readonly name  = 'perplexity' as const
  readonly model = 'sonar-pro'

  async reviewDraw(ctx: DrawReviewContext): Promise<DrawReviewResult> {
    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) throw new Error('PERPLEXITY_API_KEY not configured')

    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       this.model,
        messages:    [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: buildUserPrompt(ctx) },
        ],
        temperature: 0.1,
        max_tokens:  1024,
      }),
      signal: providerTimeout(),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Perplexity HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw: string = data.choices?.[0]?.message?.content ?? ''
    return { ...parseAssessment(raw), provider_used: this.name, is_fallback: false, model: this.model }
  }
}

// ─── Anthropic Provider ───────────────────────────────────────────────────────

export class AnthropicProvider implements AIDrawReviewProvider {
  readonly name  = 'anthropic' as const
  readonly model = 'claude-sonnet-4-20250514'

  async reviewDraw(ctx: DrawReviewContext): Promise<DrawReviewResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:      this.model,
        max_tokens: 1024,
        system:     buildSystemPrompt(),
        messages:   [
          { role: 'user', content: buildUserPrompt(ctx) },
        ],
      }),
      signal: providerTimeout(),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Anthropic HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw: string = data.content?.[0]?.text ?? ''
    return { ...parseAssessment(raw), provider_used: this.name, is_fallback: true, model: this.model }
  }
}

// ─── OpenAI Provider ──────────────────────────────────────────────────────────

export class OpenAIProvider implements AIDrawReviewProvider {
  readonly name  = 'openai' as const
  readonly model = 'gpt-4o'

  async reviewDraw(ctx: DrawReviewContext): Promise<DrawReviewResult> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:           this.model,
        messages:        [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user',   content: buildUserPrompt(ctx) },
        ],
        temperature:     0.1,
        max_tokens:      1024,
        response_format: { type: 'json_object' },
      }),
      signal: providerTimeout(),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const raw: string = data.choices?.[0]?.message?.content ?? ''
    return { ...parseAssessment(raw), provider_used: this.name, is_fallback: true, model: this.model }
  }
}

// ─── Provider Chain Error ─────────────────────────────────────────────────────

export class ProviderChainError extends Error {
  readonly code = 'AI_ALL_PROVIDERS_FAILED' as const
  /** Per-provider error messages keyed by provider name. */
  readonly providerErrors: Partial<Record<ProviderName, string>>

  constructor(providerErrors: Partial<Record<ProviderName, string>>) {
    super('All AI providers failed — draw review unavailable')
    this.name           = 'ProviderChainError'
    this.providerErrors = providerErrors
  }
}

// ─── Provider Chain ───────────────────────────────────────────────────────────

/**
 * Tries providers in order: Perplexity → Anthropic → OpenAI.
 *
 * Each provider is given AI_PROVIDER_TIMEOUT_MS (default 10 s) before being
 * abandoned. A provider that is unconfigured (missing API key) is skipped
 * immediately without consuming the timeout.
 *
 * The `is_fallback` field on DrawReviewResult reflects whether the primary
 * provider (Perplexity, index 0) was bypassed.
 *
 * Throws ProviderChainError if every provider fails.
 */
export class ProviderChain {
  private readonly providers: AIDrawReviewProvider[]

  constructor(providers?: AIDrawReviewProvider[]) {
    this.providers = providers ?? [
      new PerplexityProvider(),
      new AnthropicProvider(),
      new OpenAIProvider(),
    ]
  }

  async reviewDraw(ctx: DrawReviewContext): Promise<DrawReviewResult> {
    const providerErrors: Partial<Record<ProviderName, string>> = {}

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i]

      try {
        console.info(`[ai-provider] Trying ${provider.name} (${provider.model})`)
        const result = await provider.reviewDraw(ctx)
        // Authoritative is_fallback — set by chain position, not individual provider
        const resultWithFallback: DrawReviewResult = { ...result, is_fallback: i > 0 }
        console.info(`[ai-provider] ${provider.name} succeeded — is_fallback=${resultWithFallback.is_fallback}`)
        return resultWithFallback
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`[ai-provider] ${provider.name} failed: ${message}`)
        providerErrors[provider.name] = message
      }
    }

    console.error('[ai-provider] All providers failed:', providerErrors)
    throw new ProviderChainError(providerErrors)
  }
}
