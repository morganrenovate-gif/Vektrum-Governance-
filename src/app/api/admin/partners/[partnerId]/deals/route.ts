import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireMFA } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { internalError, notFoundError, validationError } from '@/lib/errors'
import { POLICIES, checkRateLimit, rateLimitResponse, logRateLimitViolation } from '@/lib/engine/rate-limit'

export const dynamic = 'force-dynamic'

// ─── Shared auth helper ───────────────────────────────────────────────────────

async function adminAuth(request: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return { error: err as NextResponse, authContext: null }
  }
  try {
    requireRole(authContext.profile, 'admin')
  } catch (err) {
    return { error: err as NextResponse, authContext: null }
  }
  const supabase = await createClient()
  try {
    await requireMFA(supabase, authContext.profile)
  } catch (err) {
    return { error: err as NextResponse, authContext: null }
  }
  return { error: null, authContext }
}

// ─── GET /api/admin/partners/[partnerId]/deals ────────────────────────────────
//
// Returns:
//   assigned  — deals currently assigned to this partner
//   available — external-manual deals with no partner assigned (for the picker)
//
// Used by the deal assignment modal in the admin partner dashboard.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { partnerId } = await params
  const { error, authContext } = await adminAuth(request)
  if (error || !authContext) return error!

  const admin = createSupabaseAdminClient()

  // Verify partner exists
  const { data: partner, error: partnerError } = await admin
    .from('partners')
    .select('id, name')
    .eq('id', partnerId)
    .single()

  if (partnerError || !partner) {
    return notFoundError(`Partner ${partnerId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // Currently assigned deals
  const { data: assigned } = await db
    .from('deals')
    .select('id, title, status, execution_rail, funded_amount, released_amount, created_at')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(100)

  // Available: external-manual deals with no partner assigned
  // Admins can also assign stripe-rail deals if they're switching to external,
  // but we surface external-manual unassigned deals first.
  const { data: available } = await db
    .from('deals')
    .select('id, title, status, execution_rail, funded_amount, created_at')
    .is('partner_id', null)
    .eq('execution_rail', 'external_manual')
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    partner:   { id: partner.id, name: partner.name },
    assigned:  assigned  ?? [],
    available: available ?? [],
  })
}

// ─── POST /api/admin/partners/[partnerId]/deals ───────────────────────────────
//
// Assigns a deal to this partner by setting deals.partner_id = partnerId.
//
// Body: { deal_id: string }
//
// Constraints:
//   - Deal must exist
//   - Deal must not already be assigned to another partner (use DELETE first)
//   - Admin role + AAL2 MFA required

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { partnerId } = await params
  const { error, authContext } = await adminAuth(request)
  if (error || !authContext) return error!

  // ── Rate limit ─────────────────────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${authContext.user.id}:admin_write`, POLICIES.admin_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${authContext.user.id}:admin_write`, rl, {
        actorId: authContext.user.id, policyName: 'admin_write',
        entityType: 'partner', entityId: partnerId,
      })
      return rateLimitResponse(rl, POLICIES.admin_write.description)
    }
  }

  let body: { deal_id?: string }
  try {
    body = await request.json()
  } catch {
    return validationError(['Request body must be valid JSON with a deal_id field.'])
  }

  const dealId = typeof body.deal_id === 'string' ? body.deal_id.trim() : ''
  if (!dealId) return validationError(['deal_id is required.'])

  const admin = createSupabaseAdminClient()

  // Verify partner
  const { data: partner, error: partnerError } = await admin
    .from('partners')
    .select('id, name, is_active')
    .eq('id', partnerId)
    .single()

  if (partnerError || !partner) {
    return notFoundError(`Partner ${partnerId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = partner as any

  if (!p.is_active) {
    return NextResponse.json(
      { error: 'Cannot assign a deal to an inactive partner. Activate the partner first.' },
      { status: 409 },
    )
  }

  // Verify deal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal, error: dealError } = await (admin as any)
    .from('deals')
    .select('id, title, status, execution_rail, partner_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = deal as any

  if (d.partner_id && d.partner_id !== partnerId) {
    return NextResponse.json(
      {
        error:
          `Deal ${dealId} is already assigned to a different partner. ` +
          'Unassign it first via DELETE /api/admin/partners/[id]/deals.',
        current_partner_id: d.partner_id,
      },
      { status: 409 },
    )
  }

  if (d.partner_id === partnerId) {
    return NextResponse.json(
      { error: 'This deal is already assigned to this partner.', already_assigned: true },
      { status: 409 },
    )
  }

  // Apply assignment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedDeal, error: updateError } = await (admin as any)
    .from('deals')
    .update({ partner_id: partnerId })
    .eq('id', dealId)
    .select('id, title, status, execution_rail, partner_id')
    .single()

  if (updateError || !updatedDeal) {
    return internalError('Failed to assign deal to partner.', updateError?.message)
  }

  await logAudit({
    entity_type:   'deal',
    entity_id:     dealId,
    action:        'partner_assigned_to_deal',
    actor_id:      authContext.user.id,
    actor_role:    authContext.profile.role,
    system_source: 'api/admin/partners/[partnerId]/deals',
    old_values:    { partner_id: null },
    new_values:    { partner_id: partnerId },
    metadata: {
      partner_id:   partnerId,
      partner_name: p.name,
      deal_title:   d.title,
      deal_status:  d.status,
      execution_rail: d.execution_rail,
    },
  })

  return NextResponse.json(
    {
      deal:    updatedDeal,
      partner: { id: p.id, name: p.name },
    },
    { status: 200 },
  )
}

// ─── DELETE /api/admin/partners/[partnerId]/deals ────────────────────────────
//
// Unassigns a deal from this partner by setting deals.partner_id = NULL.
//
// Body: { deal_id: string }

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { partnerId } = await params
  const { error, authContext } = await adminAuth(request)
  if (error || !authContext) return error!

  // ── Rate limit ─────────────────────────────────────────────────────────────
  {
    const rl = await checkRateLimit(`user:${authContext.user.id}:admin_write`, POLICIES.admin_write)
    if (!rl.allowed) {
      logRateLimitViolation(`user:${authContext.user.id}:admin_write`, rl, {
        actorId: authContext.user.id, policyName: 'admin_write',
        entityType: 'partner', entityId: partnerId,
      })
      return rateLimitResponse(rl, POLICIES.admin_write.description)
    }
  }

  let body: { deal_id?: string }
  try {
    body = await request.json()
  } catch {
    return validationError(['Request body must be valid JSON with a deal_id field.'])
  }

  const dealId = typeof body.deal_id === 'string' ? body.deal_id.trim() : ''
  if (!dealId) return validationError(['deal_id is required.'])

  const admin = createSupabaseAdminClient()

  // Verify deal belongs to this partner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal, error: dealError } = await (admin as any)
    .from('deals')
    .select('id, title, status, execution_rail, partner_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} was not found.`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = deal as any

  if (d.partner_id !== partnerId) {
    return NextResponse.json(
      {
        error:
          `Deal ${dealId} is not assigned to partner ${partnerId}. ` +
          'No action taken.',
      },
      { status: 409 },
    )
  }

  // Fetch partner name for audit
  const { data: partner } = await admin
    .from('partners')
    .select('id, name')
    .eq('id', partnerId)
    .single()

  // Apply unassignment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedDeal, error: updateError } = await (admin as any)
    .from('deals')
    .update({ partner_id: null })
    .eq('id', dealId)
    .select('id, title, status, execution_rail, partner_id')
    .single()

  if (updateError || !updatedDeal) {
    return internalError('Failed to unassign deal from partner.', updateError?.message)
  }

  await logAudit({
    entity_type:   'deal',
    entity_id:     dealId,
    action:        'partner_unassigned_from_deal',
    actor_id:      authContext.user.id,
    actor_role:    authContext.profile.role,
    system_source: 'api/admin/partners/[partnerId]/deals',
    old_values:    { partner_id: partnerId },
    new_values:    { partner_id: null },
    metadata: {
      partner_id:   partnerId,
      partner_name: partner?.name ?? partnerId,
      deal_title:   d.title,
      deal_status:  d.status,
    },
  })

  return NextResponse.json({ deal: updatedDeal })
}
