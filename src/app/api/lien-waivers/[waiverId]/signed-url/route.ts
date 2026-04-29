import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 300  // 5-minute expiry


// ─── GET /api/lien-waivers/[waiverId]/signed-url ──────────────────────────────
//
// Returns a short-lived (5 min) signed URL for the uploaded lien waiver PDF.
//
// Access: Funder or admin of the associated deal only.
// The raw storage path is never returned — only the signed URL.
//
// Errors:
//   401 — unauthenticated
//   403 — contractor or non-participant
//   404 — waiver not found
//   422 — waiver has no file yet (status !== 'uploaded')
//   500 — storage signing failed

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ waiverId: string }> },
) {
  const { waiverId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  if (profile.role !== 'funder' && profile.role !== 'admin') {
    return errorResponse(403, 'Only the deal funder or a platform admin may view lien waiver documents.')
  }

  const adminClient = createSupabaseAdminClient()

  // ── Fetch waiver (file_path only — never returned to client) ─────────────
  const { data: waiver, error: waiverError } = await adminClient
    .from('lien_waivers')
    .select('id, deal_id, milestone_id, status, file_path')
    .eq('id', waiverId)
    .single()

  if (waiverError || !waiver) {
    return notFoundError(`Lien waiver ${waiverId} was not found.`)
  }

  // ── Deal access check ─────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try {
    await requireDealAccess(adminClient as any, waiver.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Require uploaded status ───────────────────────────────────────────────
  if (!waiver.file_path || waiver.status !== 'uploaded') {
    return errorResponse(
      422,
      waiver.status === 'requested'
        ? 'The contractor has not yet uploaded the lien waiver.'
        : waiver.status === 'approved'
          ? 'This waiver is approved. Contact support to retrieve a copy.'
          : waiver.status === 'rejected'
            ? 'This waiver was rejected. The contractor must re-upload before a document is available.'
            : 'No document is available for this lien waiver yet.',
    )
  }

  // ── Generate signed URL ───────────────────────────────────────────────────
  const { data: signedData, error: signedError } = await adminClient.storage
    .from('lien-waivers')
    .createSignedUrl(waiver.file_path, SIGNED_URL_TTL_SECONDS)

  if (signedError || !signedData?.signedUrl) {
    return internalError(
      'Could not generate a secure download link. Please try again.',
      signedError?.message,
    )
  }

  // ── Optional audit event ──────────────────────────────────────────────────
  void logAudit({
    entity_type: 'lien_waiver',
    entity_id:   waiverId,
    action:      'lien_waiver_pdf_viewed',
    actor_id:    user.id,
    actor_role:  profile.role,
    metadata: {
      deal_id:      waiver.deal_id,
      milestone_id: waiver.milestone_id,
      expires_in:   SIGNED_URL_TTL_SECONDS,
    },
  })

  return NextResponse.json(
    {
      signed_url: signedData.signedUrl,
      expires_in: SIGNED_URL_TTL_SECONDS,
    },
    { status: 200 },
  )
}
