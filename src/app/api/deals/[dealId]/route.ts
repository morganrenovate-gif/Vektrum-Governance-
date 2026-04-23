import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'



// ─── GET /api/deals/[dealId] ──────────────────────────────────────────────────
// Fetch a deal with its milestones.
// Access restricted to: the deal's contractor, the deal's funder, and admins.

export async function GET(request: NextRequest, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = await createClient()

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  try {
    const { data: deal, error } = await supabase
      .from('deals')
      .select(
        `
        id,
        title,
        description,
        total_amount,
        funded_amount,
        released_amount,
        status,
        contractor_id,
        funder_id,
        created_at,
        updated_at,
        milestones (
          id,
          title,
          description,
          amount,
          status,
          protection_status,
          order_index,
          created_at,
          updated_at
        )
      `,
      )
      .eq('id', dealId)
      .order('order_index', { foreignTable: 'milestones', ascending: true })
      .single()

    if (error || !deal) {
      return notFoundError(
        `Deal ${dealId} was not found. Verify the deal ID and try again.`,
      )
    }

    return NextResponse.json({ deal })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while retrieving the deal. Please try again.',
      message,
    )
  }
}

// ─── PATCH /api/deals/[dealId] ────────────────────────────────────────────────
// Partially update a deal.
//
// Role-based field restrictions:
//   - contractor: can update title, description (only when deal is in 'draft')
//   - funder:     can update funder_id to assign themselves (only when deal is 'draft')
//   - admin:      can update any of the above fields regardless of status
//
// Neither role may directly mutate financial fields (total_amount, funded_amount,
// released_amount) or status through this endpoint — dedicated sub-routes handle those.

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = await createClient()

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Send a valid JSON object with the fields you wish to update.',
    )
  }

  // ── Fetch Current Deal State ────────────────────────────────────────────────
  const { data: currentDeal, error: fetchError } = await supabase
    .from('deals')
    .select('id, title, description, status, contractor_id, funder_id, total_amount')
    .eq('id', dealId)
    .single()

  if (fetchError || !currentDeal) {
    return notFoundError(
      `Deal ${dealId} was not found. Verify the deal ID and try again.`,
    )
  }

  // ── Build Allowed Update Payload ────────────────────────────────────────────
  const updates: Record<string, unknown> = {}

  const isAdmin = profile.role === 'admin'
  const isDraft = currentDeal.status === 'draft'

  if (profile.role === 'contractor' || isAdmin) {
    if (!isDraft && !isAdmin) {
      return errorResponse(
        400,
        `Deal details can only be edited while the deal is in 'draft' status. ` +
          `This deal's current status is '${currentDeal.status}'. Contact your funder if you need changes made.`,
      )
    }

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || (body.title as string).trim() === '') {
        return errorResponse(400, 'Deal title must be a non-empty string.')
      }
      updates.title = (body.title as string).trim()
    }

    if (body.description !== undefined) {
      updates.description =
        typeof body.description === 'string' ? body.description.trim() : null
    }
  }

  if (profile.role === 'funder' || isAdmin) {
    if (body.funder_id !== undefined) {
      if (!isDraft && !isAdmin) {
        return errorResponse(
          400,
          `The funder assignment can only be changed while the deal is in 'draft' status. ` +
            `This deal is currently '${currentDeal.status}'.`,
        )
      }
      updates.funder_id = body.funder_id
    }
  }

  // Guard: reject any attempts to directly mutate protected financial or status fields.
  // billing_rate_bps is set server-side at funding time from the funder's subscription
  // tier — it must never be accepted from user input through this endpoint.
  const protectedFields = ['total_amount', 'funded_amount', 'released_amount', 'status', 'billing_rate_bps']
  const attemptedProtectedFields = protectedFields.filter((f) => f in body)

  if (attemptedProtectedFields.length > 0) {
    return errorResponse(
      400,
      `The following fields cannot be updated directly through this endpoint: ${attemptedProtectedFields.join(', ')}. ` +
        `Use the dedicated funding, milestone, or status management endpoints instead.`,
    )
  }

  if (Object.keys(updates).length === 0) {
    return errorResponse(
      400,
      'No updatable fields were provided. Include at least one of: title, description, funder_id.',
    )
  }

  try {
    const { data: updatedDeal, error: updateError } = await supabase
      .from('deals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', dealId)
      .select()
      .single()

    if (updateError || !updatedDeal) {
      return internalError(
        'Failed to update the deal. Please try again. If this problem continues, contact support.',
        updateError?.message,
      )
    }

    await logAudit({
      entity_type: 'deal',
      entity_id: dealId,
      action: 'deal_updated',
      actor_id: user.id,
      old_values: Object.fromEntries(
        Object.keys(updates).map((k) => [k, currentDeal[k as keyof typeof currentDeal]]),
      ),
      new_values: updates,
    })

    return NextResponse.json({ deal: updatedDeal })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while updating the deal. Please try again.',
      message,
    )
  }
}
