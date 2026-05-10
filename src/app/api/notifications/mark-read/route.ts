import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/middleware'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { errorResponse, internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/notifications/mark-read ───────────────────────────────────────
//
// Marks one or all of the authenticated user's notifications as read.
//
// Body (one of):
//   { id: string }       — mark a single notification
//   { all: true }        — mark all unread for this user
//
// The admin client performs the UPDATE so that no RLS UPDATE policy is needed on
// the notifications table. Before updating, we verify the notification belongs to
// the calling user so that a user cannot mark someone else's notifications as read.
//
// Response: { updated: number }

export async function POST(request: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user } = authContext

  let body: { id?: string; all?: boolean }
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'Request body must be valid JSON.')
  }

  const now = new Date().toISOString()
  const admin = createSupabaseAdminClient()

  if (body.all === true) {
    // Mark all unread for this user
    const { count, error } = await admin
      .from('notifications')
      .update({ read_at: now }, { count: 'exact' })
      .eq('recipient_user_id', user.id)
      .is('read_at', null)

    if (error) {
      return internalError(`Failed to mark all notifications as read: ${error.message}`)
    }

    return NextResponse.json({ updated: count ?? 0 })
  }

  if (body.id && typeof body.id === 'string') {
    // Verify the notification belongs to the calling user before updating
    const supabase = await createClient()
    const { data: notif, error: fetchErr } = await supabase
      .from('notifications')
      .select('id, recipient_user_id')
      .eq('id', body.id)
      .single()

    if (fetchErr || !notif) {
      return errorResponse(404, `Notification ${body.id} not found.`)
    }

    // RLS already enforces this, but belt-and-suspenders check
    if (notif.recipient_user_id !== user.id) {
      return errorResponse(403, 'You can only mark your own notifications as read.')
    }

    const { error: updateErr } = await admin
      .from('notifications')
      .update({ read_at: now })
      .eq('id', body.id)

    if (updateErr) {
      return internalError(`Failed to mark notification as read: ${updateErr.message}`)
    }

    return NextResponse.json({ updated: 1 })
  }

  return errorResponse(400, 'Provide either { id: "<uuid>" } or { all: true }.')
}
