import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/admin/invite ──────────────────────────────────────────────────
// Invites a new user by email and assigns them the admin role.
// The handle_new_user trigger reads user_metadata.role to set profiles.role.
// Body: { email: string }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  let body: { email?: string }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Ensure you are sending a valid JSON object with the required field: email.',
    )
  }

  if (!body.email || typeof body.email !== 'string' || body.email.trim() === '') {
    return errorResponse(400, 'An email address is required.')
  }

  const email = body.email.trim().toLowerCase()

  if (!EMAIL_REGEX.test(email)) {
    return errorResponse(400, 'The email address provided is not valid. Please provide a valid email.')
  }

  try {
    const adminClient = createSupabaseAdminClient()

    // Invite user with role metadata. The handle_new_user trigger reads
    // user_metadata.role to set profiles.role on account creation.
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role: 'admin' },
    })

    if (error) {
      return internalError(
        'Failed to send the invite. The email may already be registered, or there was a service error.',
        error.message,
      )
    }

    const invitedUserId = data.user?.id ?? 'pending'

    await logAudit({
      entity_type: 'profile',
      entity_id: invitedUserId,
      action: 'admin_invite_sent',
      actor_id: user.id,
      metadata: { invited_email: email, invited_by: user.id },
    })

    return NextResponse.json({ success: true, message: 'Invite sent' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while sending the invite. Please try again.',
      message,
    )
  }
}
