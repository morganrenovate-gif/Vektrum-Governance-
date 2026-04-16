import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/admin/promote ─────────────────────────────────────────────────
// Promotes an existing user to admin role. Restricted to admins.
// Body: { userId: string }

export async function POST(request: NextRequest) {
  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'admin')
  } catch (err) {
    return err as NextResponse
  }

  let body: { userId?: string }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Ensure you are sending a valid JSON object with the required field: userId.',
    )
  }

  if (!body.userId || typeof body.userId !== 'string' || body.userId.trim() === '') {
    return errorResponse(400, 'A userId is required. Provide the UUID of the user to promote.')
  }

  // Self-promotion guard
  if (body.userId === user.id) {
    return errorResponse(400, 'You cannot promote yourself. Ask another admin to perform this action.')
  }

  try {
    const adminClient = createSupabaseAdminClient()

    const { data, error } = await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', body.userId)
      .select('id')
      .single()

    if (error || !data) {
      return notFoundError(
        `No user found with ID ${body.userId}. Verify the user exists before attempting to promote them.`,
      )
    }

    await logAudit({
      entity_type: 'profile',
      entity_id: body.userId,
      action: 'admin_role_granted',
      actor_id: user.id,
      old_values: null,
      new_values: { role: 'admin' },
      metadata: { promoted_by: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while promoting the user. Please try again.',
      message,
    )
  }
}
