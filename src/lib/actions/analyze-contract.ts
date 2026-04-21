'use server'

import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProposedMilestone = {
  name: string
  amount: number
  conditions: string[]
  sequence_order: number
  retainage_pct: number
  notes: string
  flags: string[]
}

export type ContractAnalysisResult = {
  milestones: ProposedMilestone[]
  total_value: number
  retainage_summary: string
  missing_clauses: string[]
  recommended_settings: {
    dispute_isolation: boolean
    co_gating: boolean
    retainage_holdback_pct: number
  }
}

export type DealMetadata = {
  dealName: string
  funderEmail: string
  contractorEmail: string
  jurisdiction: string
}

type AnalyzeContractResult =
  | { success: true; data: ContractAnalysisResult }
  | { success: false; error: string }

// ── PDF text extraction ───────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse is CJS-only; require avoids the ESM .default mismatch
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const parsed = await pdfParse(buffer)
  return parsed.text
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(contractText: string, metadata: DealMetadata): string {
  const truncated =
    contractText.length > 80_000
      ? contractText.slice(0, 80_000) + '\n\n[CONTRACT TRUNCATED — analyze available text only]'
      : contractText

  return `You are a construction contract analyst. Extract the full project milestone structure from this contract for use in a payment governance platform.

## CONTRACT METADATA
- Project jurisdiction: ${metadata.jurisdiction}
- Deal name: ${metadata.dealName}

## CONTRACT TEXT
${truncated}

## YOUR TASK
Analyze the contract and extract:
1. All project phases or milestones with their payment amounts
2. Completion conditions for each phase (what must be done/documented before payment)
3. Retainage terms (percentage, when released)
4. Lien waiver requirements per phase
5. Change order provisions
6. Any ambiguous, missing, or risky clauses

CRITICAL: Return ONLY a valid JSON object. No prose. No markdown. No code fences.

The JSON must exactly match this schema:
{
  "milestones": [
    {
      "name": "<phase name from contract>",
      "amount": <number — dollar amount, no symbols>,
      "conditions": ["<condition 1>", "<condition 2>"],
      "sequence_order": <integer starting at 1>,
      "retainage_pct": <number 0-100, e.g. 10 for 10%>,
      "notes": "<any relevant context from contract for this phase>",
      "flags": ["<any ambiguity or risk for this milestone>"]
    }
  ],
  "total_value": <total contract value as number>,
  "retainage_summary": "<plain language summary of retainage terms>",
  "missing_clauses": ["<clause that should exist but is absent or unclear>"],
  "recommended_settings": {
    "dispute_isolation": <true if contract structure supports per-milestone isolation>,
    "co_gating": <true if change orders should block release>,
    "retainage_holdback_pct": <overall retainage percentage as number>
  }
}

Rules:
- Extract real milestone names from the contract — do not invent generic names
- Amounts must sum to total_value (excluding retainage holdback)
- conditions array must include: document requirements (lien waivers, invoices),
  inspection requirements, and any contractual approvals required
- flags array should note anything a project manager should review before approving payment
- If a phase amount is unclear, use 0 and add a flag
- missing_clauses should include: dispute resolution, retainage release triggers,
  lien waiver type (conditional/unconditional) if not specified`
}

// ── analyzeContract server action ─────────────────────────────────────────────

export async function analyzeContract(formData: FormData): Promise<AnalyzeContractResult> {
  const file = formData.get('contract') as File | null
  const metadataRaw = formData.get('metadata') as string | null

  if (!file || !metadataRaw) {
    return { success: false, error: 'Missing file or metadata' }
  }

  if (file.type !== 'application/pdf') {
    return { success: false, error: 'Only PDF files are supported' }
  }

  if (file.size > 20 * 1024 * 1024) {
    return { success: false, error: 'File exceeds 20MB limit' }
  }

  let metadata: DealMetadata
  try {
    metadata = JSON.parse(metadataRaw)
  } catch {
    return { success: false, error: 'Invalid metadata' }
  }

  let contractText: string
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    contractText = await extractPdfText(buffer)
  } catch (err) {
    console.error('[analyzeContract] PDF extraction failed:', err)
    return { success: false, error: 'Could not read PDF. Please check the file and try again.' }
  }

  if (!contractText || contractText.trim().length < 100) {
    return {
      success: false,
      error: 'PDF appears to be empty or image-only. Please use a text-based PDF.',
    }
  }

  // ── Perplexity API call ───────────────────────────────────────────────────
  let rawContent: string
  let modelUsed: string

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content:
              'You are a construction contract analyst. You return only valid JSON. Never add prose, markdown, or code fences.',
          },
          { role: 'user', content: buildPrompt(contractText, metadata) },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!response.ok) {
      throw new Error(`Perplexity API ${response.status}: ${response.statusText}`)
    }

    const json = await response.json()
    rawContent = json.choices?.[0]?.message?.content ?? ''
    modelUsed = json.model ?? 'sonar-pro'
  } catch (err) {
    console.error('[analyzeContract] Perplexity call failed:', err)
    return {
      success: false,
      error: 'AI analysis failed. Please try again or enter milestones manually.',
    }
  }

  // ── Parse response ────────────────────────────────────────────────────────
  let parsed: ContractAnalysisResult
  try {
    const cleaned = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('[analyzeContract] JSON parse failed:', rawContent.slice(0, 300))
    return {
      success: false,
      error: 'AI returned an unreadable response. Please try again or enter milestones manually.',
    }
  }

  if (!Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
    return {
      success: false,
      error: 'No milestones could be extracted from the contract. Please enter them manually.',
    }
  }

  parsed.milestones = parsed.milestones.map((m, i) => ({
    ...m,
    amount: Number(m.amount) || 0,
    retainage_pct: Number(m.retainage_pct) || 0,
    sequence_order: m.sequence_order ?? i + 1,
    conditions: Array.isArray(m.conditions) ? m.conditions : [],
    flags: Array.isArray(m.flags) ? m.flags : [],
    notes: m.notes ?? '',
  }))

  // Contract text is never returned — only the parsed structure
  return { success: true, data: parsed }
}

// ── confirmDealFromContract server action ─────────────────────────────────────

export type ConfirmDealInput = {
  metadata: DealMetadata
  milestones: ProposedMilestone[]
  totalValue: number
  importedViaAI: boolean
}

export async function confirmDealFromContract(
  input: ConfirmDealInput,
): Promise<{ success: true; dealId: string } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // Create deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        title: input.metadata.dealName,
        total_amount: input.totalValue,
        status: 'draft',
        contractor_id: user.id,
      })
      .select('id')
      .single()

    if (dealError || !deal) {
      throw new Error(dealError?.message ?? 'Failed to create deal')
    }

    // Insert milestones — order_index is 0-based
    const milestoneRows = input.milestones.map((m) => ({
      deal_id: deal.id,
      title: m.name,
      description: m.notes || null,
      amount: m.amount,
      order_index: m.sequence_order - 1,
    }))

    const { error: msError } = await supabase.from('milestones').insert(milestoneRows)
    if (msError) {
      // Best-effort cleanup — delete the orphaned deal
      await supabase.from('deals').delete().eq('id', deal.id)
      throw new Error(msError.message)
    }

    await logAudit({
      entity_type: 'deal',
      entity_id: deal.id,
      action: 'deal_created_via_ai_contract_import',
      actor_id: user.id,
      new_values: { status: 'draft', milestone_count: input.milestones.length },
      metadata: {
        total_value: input.totalValue,
        model: 'perplexity/sonar-pro',
        imported_via_ai: input.importedViaAI,
      },
    })

    return { success: true, dealId: deal.id }
  } catch (err) {
    console.error('[confirmDealFromContract] failed:', err)
    return { success: false, error: 'Failed to create deal. Please try again.' }
  }
}
