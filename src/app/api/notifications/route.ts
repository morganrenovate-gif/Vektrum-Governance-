import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/middleware'
import { createClient } from '@/lib/supabase/server'
import { internalError } from '@/lib/errors'
import type { AppNotification } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ─── GET /api/notifications ───────────────────────────────────────────────────
//
// Returns the authenticated user's most recent notifications (latest 30) plus
// an unread count.  RLS on the notifications table restricts results to rows
// where recipient_user_id = auth.uid() — users only see their own notifications.
//
// Response: { notifications: AppNotification[], unread_count: number }

export async function GET(request: NextRequest) {
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user } = authContext
  const supabase = await createClient()

  // Fetch latest 30 notifications — RLS enforces recipient_user_id = auth.uid()
  const { data: rows, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    return internalError(`Failed to fetch notifications: ${error.message}`)
  }

  const notifications = (rows ?? []) as AppNotification[]

  // Unread = read_at is null
  const unread_count = notifications.filter(n => n.read_at === null).length

  return NextResponse.json({ notifications, unread_count })
}
