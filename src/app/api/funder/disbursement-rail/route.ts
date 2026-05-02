import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/engine/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_RAILS = ['stripe', 'external_rail', 'not_configured'] as const
type Rail = typeof ALLOWED_RAILS[number]

/**
 * POST /api/funder/disbursement-rail
 *
 * Records the funder's disbursement-rail intent on profiles.disbursement_rail.
 *
 * Hard guarantees:
 *   - Auth-gated. Funder role only — contractors and admins are rejected.
 *   - Body must be { rail: 'stripe' | 'external_rail' | 'not_configured' }.
 *     Anything else returns 400.
 *   - Captures intent only. The deterministic release gate continues to
 *     enforce all 10 conditions server-side. This route does not change
 *     stripe_account_id, does not move money, and does not loosen release
 *     execution checks.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('id, role, disbursement_rail')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    }

    if (profile.role !== 'funder') {
      return NextResponse.json(
        { error: 'Only funders can set a disbursement rail.' },
        { status: 403 },
      )
    }

    let body: { rail?: string } = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const rail = body.rail as Rail | undefined
    if (!rail || !ALLOWED_RAILS.includes(rail)) {
      return NextResponse.json(
        {
          error:
            'Invalid rail. Must be one of: stripe, external_rail, not_configured.',
        },
        { status: 400 },
      )
    }

    // Use the admin client for the update so it isn't subject to the
    // platform-fields trigger surface. disbursement_rail itself is not in
    // the trigger's protected list, so a session-client write would also
    // succeed today — the admin client is used for consistency with the
    // other onboarding writes (/api/onboarding, /api/stripe/connect).
    const adminClient = createSupabaseAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (adminClient as any)
      .from('profiles')
      .update({
        disbursement_rail: rail,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('[api/funder/disbursement-rail] update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save disbursement rail. Please try again.' },
        { status: 500 },
      )
    }

    // Audit — captures the rail-intent transition. No bank/Stripe/PII metadata.
    await logAudit({
      entity_type:   'profile',
      entity_id:     user.id,
      action:        'disbursement_rail_selected',
      actor_id:      user.id,
      system_source: 'api/funder/disbursement-rail',
      old_values:    { disbursement_rail: profile.disbursement_rail ?? null },
      new_values:    { disbursement_rail: rail },
      metadata:      { route: '/api/funder/disbursement-rail' },
    }).catch((err) => {
      console.error('[api/funder/disbursement-rail] audit failed:', err)
    })

    return NextResponse.json({ success: true, disbursement_rail: rail })
  } catch (err) {
    console.error('[api/funder/disbursement-rail] unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
