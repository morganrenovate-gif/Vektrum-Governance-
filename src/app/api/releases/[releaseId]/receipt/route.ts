import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/middleware'
import { getReceiptByReleaseId } from '@/lib/engine/receipts'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── GET /api/releases/[releaseId]/receipt ─────────────────────────────────────
// Returns the transaction receipt for a release.
//
// Access:
//   - Deal participants (contractor or funder for this deal) may fetch.
//   - Admins may fetch any receipt.
//
// The receipt is fetched via the service-role client then access-checked against
// the authenticated user so that RLS doesn't need to be thread-through here.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  const receipt = await getReceiptByReleaseId(releaseId)

  if (!receipt) {
    return notFoundError(`No receipt found for release ${releaseId}.`)
  }

  // ── Access check ────────────────────────────────────────────────────────────
  // Admins can see any receipt.
  // Participants can only see receipts where they are the contractor or funder.
  const isAdmin       = profile.role === 'admin'
  const isParticipant = receipt.contractor_id === user.id || receipt.funder_id === user.id

  if (!isAdmin && !isParticipant) {
    return NextResponse.json(
      { error: 'You do not have access to this receipt.' },
      { status: 403 },
    )
  }

  return NextResponse.json(receipt)
}

