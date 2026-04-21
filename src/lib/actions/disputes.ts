'use server'

import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DisputeReason =
  | 'incomplete_documentation'
  | 'work_not_verified'
  | 'invoice_amount_mismatch'
  | 'lien_waiver_missing'
  | 'change_order_not_approved'
  | 'other'

// ── Flag + generate ───────────────────────────────────────────────────────────

export async function flagMilestoneDisputed(input: {
  milestoneId: string
  reason: DisputeReason
  context?: string
}): Promise<{ success: true; briefId?: string } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['funder', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Only funders can flag disputes' }
    }

    const { data: milestone, error: msError } = await supabase
      .from('milestones')
      .select('id, deal_id, amount, status')
      .eq('id', input.milestoneId)
      .single()

    if (msError || !milestone) return { success: false, error: 'Milestone not found' }

    if (['released', 'disputed'].includes(milestone.status)) {
      return { success: false, error: `Cannot dispute a milestone with status: ${milestone.status}` }
    }

    // Insert dispute record
    const { error: disputeError } = await supabase.from('disputes').insert({
      milestone_id: input.milestoneId,
      deal_id: milestone.deal_id,
      amount_in_dispute: milestone.amount,
      reason: input.reason.replace(/_/g, ' '),
      opened_by: user.id,
    })
    if (disputeError) throw new Error(disputeError.message)

    // Lock milestone
    const { error: updateError } = await supabase
      .from('milestones')
      .update({ status: 'disputed', protection_status: 'disputed' })
      .eq('id', input.milestoneId)
    if (updateError) throw new Error(updateError.message)

    await logAudit({
      entity_type: 'milestone',
      entity_id: input.milestoneId,
      action: 'dispute_flagged',
      actor_id: user.id,
      actor_role: profile.role,
      old_values: { status: milestone.status },
      new_values: { status: 'disputed', protection_status: 'disputed' },
      metadata: { reason: input.reason, context: input.context ?? null, deal_id: milestone.deal_id },
    })

    // Generate brief — non-blocking; dispute lock is already applied
    supabase.functions
      .invoke('generate-dispute-brief', {
        body: {
          milestone_id: input.milestoneId,
          dispute_reason: input.reason,
          dispute_context: input.context ?? undefined,
        },
      })
      .then(({ data, error }) => {
        if (error || !data?.success) {
          console.error('[flagMilestoneDisputed] brief generation error:', error ?? data?.error)
        }
      })
      .catch((err) => console.error('[flagMilestoneDisputed] brief invoke failed:', err))

    return { success: true }
  } catch (err) {
    console.error('[flagMilestoneDisputed] failed:', err)
    return { success: false, error: 'Failed to flag dispute. Please try again.' }
  }
}

// ── Resolve ───────────────────────────────────────────────────────────────────

export async function resolveDispute(
  milestoneId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['funder', 'admin'].includes(profile.role)) {
      return { success: false, error: 'Only funders can resolve disputes' }
    }

    const { data: milestone, error: msError } = await supabase
      .from('milestones')
      .select('id, deal_id, status')
      .eq('id', milestoneId)
      .single()

    if (msError || !milestone) return { success: false, error: 'Milestone not found' }
    if (milestone.status !== 'disputed') {
      return { success: false, error: 'Milestone is not currently disputed' }
    }

    // Mark open briefs resolved
    await supabase
      .from('dispute_briefs')
      .update({ status: 'RESOLVED', resolved_at: new Date().toISOString() })
      .eq('milestone_id', milestoneId)
      .eq('status', 'OPEN')

    // Mark open disputes resolved
    await supabase
      .from('disputes')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq('milestone_id', milestoneId)
      .eq('status', 'open')

    // Restore milestone to approved — funder can then re-trigger release
    await supabase
      .from('milestones')
      .update({ status: 'approved', protection_status: 'ready_for_release' })
      .eq('id', milestoneId)

    await logAudit({
      entity_type: 'milestone',
      entity_id: milestoneId,
      action: 'dispute_resolved',
      actor_id: user.id,
      actor_role: profile.role,
      old_values: { status: 'disputed' },
      new_values: { status: 'approved', protection_status: 'ready_for_release' },
      metadata: { deal_id: milestone.deal_id, resolution_method: 'funder_manual_clear' },
    })

    return { success: true }
  } catch (err) {
    console.error('[resolveDispute] failed:', err)
    return { success: false, error: 'Failed to resolve dispute. Please try again.' }
  }
}
