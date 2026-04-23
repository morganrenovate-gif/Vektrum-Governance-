'use server'

import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'
import { BILLING_RATES } from '@/lib/engine/billing'

// ─── Shared types ─────────────────────────────────────────────────────────────
// These types are the contract between the API route, the upload modal,
// the review screen, and confirmDealFromContract.
// DO NOT move them — they are imported by multiple client and server modules.

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

export type ConfirmDealInput = {
  metadata: DealMetadata
  milestones: ProposedMilestone[]
  totalValue: number
  importedViaAI: boolean
}

// ─── confirmDealFromContract ──────────────────────────────────────────────────
// Server action: creates a draft deal + milestones from a reviewed AI result.
// Called by MilestoneReviewScreen after the contractor approves the structure.
// Uses `position` (0-indexed) — NOT order_index.

export async function confirmDealFromContract(
  input: ConfirmDealInput,
): Promise<{ success: true; dealId: string } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'You must be signed in to create a deal.' }
    }

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert({
        title:            input.metadata.dealName,
        total_amount:     input.totalValue,
        status:           'draft',
        contractor_id:    user.id,
        // billing_rate_bps is always set server-side — never from user input.
        // Default to STANDALONE (100 bps). Overwritten at funding time with the
        // funder's actual subscription tier rate.
        billing_rate_bps: BILLING_RATES.STANDALONE,
      })
      .select('id')
      .single()

    if (dealError || !deal) {
      throw new Error(dealError?.message ?? 'Failed to create deal')
    }

    const milestoneRows = input.milestones.map((m) => ({
      deal_id: deal.id,
      title: m.name,
      description: m.notes || null,
      amount: m.amount,
      position: m.sequence_order - 1, // sequence_order is 1-indexed; position is 0-indexed
      status: 'not_started',
      protection_status: 'pending',
    }))

    const { error: msError } = await supabase.from('milestones').insert(milestoneRows)

    if (msError) {
      // Roll back the deal if milestones fail — keep DB consistent
      await supabase.from('deals').delete().eq('id', deal.id)
      throw new Error(msError.message)
    }

    await logAudit({
      entity_type: 'deal',
      entity_id: deal.id,
      action: 'created',
      actor_id: user.id,
      old_values: null,
      new_values: {
        status: 'draft',
        milestone_count: input.milestones.length,
      },
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
