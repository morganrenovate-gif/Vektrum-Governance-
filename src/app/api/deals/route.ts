import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { BILLING_RATES, calculateGovernanceFacility } from '@/lib/engine/billing'
import {
  errorResponse,
  forbiddenError,
  internalError,
  validationError,
} from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/deals ───────────────────────────────────────────────────────────
// List deals for the authenticated user, filtered by their role:
//   - contractor → deals where contractor_id = user_id
//   - funder     → deals where funder_id = user_id
//   - admin      → all deals

export async function GET(request: NextRequest) {
  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    const supabase = await createClient()

    let query = supabase
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
        updated_at
      `,
      )
      .order('created_at', { ascending: false })

    if (profile.role === 'contractor') {
      query = query.eq('contractor_id', user.id)
    } else if (profile.role === 'funder') {
      query = query.eq('funder_id', user.id)
    }
    // admin: no filter — returns all deals

    const { data: deals, error } = await query

    if (error) {
      return internalError(
        'Could not retrieve your deals. Please try again. If this problem continues, contact support.',
        error.message,
      )
    }

    return NextResponse.json({ deals })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while retrieving deals. Please try again.',
      message,
    )
  }
}

// ─── POST /api/deals ──────────────────────────────────────────────────────────
// Create a new deal. Restricted to contractors.
// Body: { title, description?, total_amount, funder_id? }

export async function POST(request: NextRequest) {
  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'contractor')
  } catch (err) {
    return err as NextResponse
  }

  let body: {
    title?: string
    description?: string
    total_amount?: number
    funder_id?: string
    /** When true, milestones must be released in ascending order_index order. Default false. */
    sequential_release_required?: boolean
    /**
     * Percentage of each milestone gross amount to withhold as retainage.
     * Range: 0 to <100. Default 0 (no retainage).
     * Industry standard: 5-10% for institutional construction lending.
     */
    retainage_percentage?: number
  }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Ensure you are sending a valid JSON object with the required fields: title, total_amount.',
    )
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const validationErrors: string[] = []

  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    validationErrors.push(
      'A deal title is required. Provide a descriptive name for this project deal.',
    )
  }

  if (
    body.total_amount === undefined ||
    body.total_amount === null ||
    typeof body.total_amount !== 'number'
  ) {
    validationErrors.push(
      'A total_amount is required and must be a number. This is the full contract value of the deal.',
    )
  } else if (body.total_amount <= 0) {
    validationErrors.push(
      `The total_amount must be greater than $0.00. The value you provided (${body.total_amount}) is invalid.`,
    )
  }

  if (validationErrors.length > 0) {
    return validationError(validationErrors)
  }

  try {
    const supabase = await createClient()

    // Compute the governance facility at creation using the conservative
    // STANDALONE default rate. Updated to the funder's actual tier at funding.
    const governance = calculateGovernanceFacility(body.total_amount!, BILLING_RATES.STANDALONE)

    const insertPayload = {
      contractor_id:    user.id,
      title:            body.title!.trim(),
      description:      body.description?.trim() ?? null,
      total_amount:     body.total_amount!,
      funded_amount:    0,
      released_amount:  0,
      // billing_rate_bps is always set server-side — never from user input.
      // Default to STANDALONE (100 bps). Overwritten at funding time with the
      // funder's actual subscription tier rate.
      billing_rate_bps:  BILLING_RATES.STANDALONE,
      status:            'draft',
      // Governance fee model fields — provide the funder with a clear picture of
      // their total facility commitment (construction budget + governance layer).
      construction_budget:  governance.constructionBudget,
      governance_fee_bps:   governance.governanceFeeBps,
      governance_fee_total: governance.governanceFeeTotal,
      facility_total:       governance.facilityTotal,
      // Sequential release mode — false by default, opt-in per deal.
      // Only accept explicit boolean true/false; ignore if not a boolean.
      sequential_release_required:
        typeof body.sequential_release_required === 'boolean'
          ? body.sequential_release_required
          : false,
      // Retainage percentage — 0 by default (no retainage).
      // Validated: must be a finite number in [0, 100). Clamped to 2 decimal places.
      retainage_percentage: (() => {
        const pct = body.retainage_percentage
        if (typeof pct !== 'number' || !isFinite(pct)) return 0
        if (pct < 0 || pct >= 100) return 0
        return Math.round(pct * 100) / 100
      })(),
      ...(body.funder_id && { funder_id: body.funder_id }),
    }

    const { data: deal, error } = await supabase
      .from('deals')
      .insert(insertPayload)
      .select()
      .single()

    if (error || !deal) {
      return internalError(
        'Failed to create the deal. Please try again. If this problem continues, contact support.',
        error?.message,
      )
    }

    await logAudit({
      entity_type: 'deal',
      entity_id: deal.id,
      action: 'deal_created',
      actor_id: user.id,
      actor_role: profile.role,
      old_values: null,
      new_values: {
        title:                        deal.title,
        total_amount:                 deal.total_amount,
        status:                       deal.status,
        contractor_id:                deal.contractor_id,
        sequential_release_required:  deal.sequential_release_required,
        retainage_percentage:         deal.retainage_percentage,
        construction_budget:          governance.constructionBudget,
        governance_fee_bps:           governance.governanceFeeBps,
        governance_fee_total:         governance.governanceFeeTotal,
        facility_total:               governance.facilityTotal,
      },
    })

    return NextResponse.json({ deal }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while creating the deal. Please try again.',
      message,
    )
  }
}
