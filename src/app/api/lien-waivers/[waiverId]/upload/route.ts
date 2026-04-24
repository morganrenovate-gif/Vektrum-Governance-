import { NextRequest, NextResponse } from 'next/server'
import { createClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'

export const dynamic = 'force-dynamic'


// ─── POST /api/lien-waivers/[waiverId]/upload ─────────────────────────────────
//
// Contractor uploads a signed lien waiver PDF for a requested waiver.
// Updates status = 'uploaded', file_path, uploaded_at.
//
// Accepts multipart/form-data with a 'file' field (PDF or image).
// The file is stored in Supabase Storage at:
//   lien-waivers/{dealId}/{milestoneId}/{waiverId}/{original-filename}
//
// Access: Contractor of the associated deal. Admins may also upload on behalf.
// Re-upload is allowed when status = 'rejected' (contractor corrects and resubmits).
//
// Body: multipart/form-data
//   file: File  (PDF, PNG, or JPEG; max 20 MB)

export async function POST(
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
  const adminClient = createSupabaseAdminClient()

  // ── Fetch Waiver ──────────────────────────────────────────────────────────
  const { data: waiver, error: waiverError } = await adminClient
    .from('lien_waivers')
    .select('id, deal_id, milestone_id, status, waiver_type')
    .eq('id', waiverId)
    .single()

  if (waiverError || !waiver) {
    return notFoundError(`Lien waiver ${waiverId} was not found.`)
  }

  // ── Role Check ─────────────────────────────────────────────────────────────
  // Contractor of this deal, or admin
  if (profile.role !== 'admin') {
    const { data: deal } = await adminClient
      .from('deals')
      .select('contractor_id')
      .eq('id', waiver.deal_id)
      .single()

    if (!deal || deal.contractor_id !== user.id) {
      return errorResponse(
        403,
        'Only the contractor of this deal may upload a lien waiver.',
      )
    }
  }

  // ── Status Check ──────────────────────────────────────────────────────────
  if (waiver.status !== 'requested' && waiver.status !== 'rejected') {
    return errorResponse(
      422,
      `This lien waiver cannot be uploaded — its current status is '${waiver.status}'. ` +
        `Upload is only permitted for 'requested' or 'rejected' waivers.`,
    )
  }

  // ── Parse File from FormData ───────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse(400, 'Could not parse form data. Send a multipart/form-data request with a "file" field.')
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return errorResponse(400, 'No file provided. Include a "file" field in the multipart/form-data body.')
  }

  // Type guard
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg']
  if (!allowedTypes.includes(file.type)) {
    return errorResponse(
      400,
      `Invalid file type '${file.type}'. Only PDF, PNG, and JPEG files are accepted.`,
    )
  }

  // Size check (20 MB)
  if (file.size > 20 * 1024 * 1024) {
    return errorResponse(400, 'File exceeds the 20 MB maximum size limit.')
  }

  // ── Build Storage Path ────────────────────────────────────────────────────
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
  const originalName = file instanceof File ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : `waiver.${ext}`
  const storagePath = `${waiver.deal_id}/${waiver.milestone_id ?? 'deal'}/${waiverId}/${originalName}`

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: storageError } = await adminClient.storage
    .from('lien-waivers')
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: true,   // allow re-upload on rejection
    })

  if (storageError) {
    return internalError(
      'Failed to upload the lien waiver file to storage. Please try again.',
      storageError.message,
    )
  }

  // ── Update Waiver Record ──────────────────────────────────────────────────
  const uploadedAt = new Date().toISOString()

  const { data: updatedWaiver, error: updateError } = await adminClient
    .from('lien_waivers')
    .update({
      status:      'uploaded',
      file_path:   storagePath,
      uploaded_by: user.id,
      uploaded_at: uploadedAt,
      // Clear rejection state on re-upload
      rejected_at:      null,
      rejection_reason: null,
    })
    .eq('id', waiverId)
    .select()
    .single()

  if (updateError || !updatedWaiver) {
    // File is in storage but DB record not updated — log for reconciliation
    await logAudit({
      entity_type: 'lien_waiver',
      entity_id:   waiverId,
      action:      'lien_waiver_upload_db_failed',
      actor_id:    user.id,
      old_values:  { status: waiver.status },
      new_values:  null,
      metadata: {
        storage_path: storagePath,
        error:        updateError?.message,
        note:         'File uploaded to storage but DB record update failed — requires reconciliation',
      },
    })

    return internalError(
      'File uploaded but the waiver record could not be updated. ' +
        `Contact support with Waiver ID: ${waiverId} to reconcile.`,
      updateError?.message,
    )
  }

  await logAudit({
    entity_type: 'lien_waiver',
    entity_id:   waiverId,
    action:      'lien_waiver_uploaded',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values:  { status: waiver.status },
    new_values: {
      status:      'uploaded',
      file_path:   storagePath,
      uploaded_at: uploadedAt,
    },
    metadata: {
      deal_id:      waiver.deal_id,
      milestone_id: waiver.milestone_id,
      waiver_type:  waiver.waiver_type,
      file_size:    file.size,
      content_type: file.type,
    },
  })

  return NextResponse.json({ lien_waiver: updatedWaiver }, { status: 200 })
}
