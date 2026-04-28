import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'
import type { MilestoneStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ─── POST /api/milestones/[milestoneId]/documents/upload ──────────────────────
//
// Contractor uploads a supporting evidence file for a milestone.
// Accepts multipart/form-data with a 'file' field.
//
// The file is stored in Supabase Storage in the 'milestone-documents' bucket at:
//   {dealId}/{milestoneId}/{documentId}/{sanitized-filename}
//
// After upload, a milestone_documents record is created with the public file URL.
//
// Access: Contractor assigned to this milestone, or admin.
// Milestone must be in 'in_progress' or 'ready_for_review' status.
//
// Body: multipart/form-data
//   file: File (PDF, PNG, or JPEG; max 20 MB)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const { milestoneId } = await params

  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  try {
    requireRole(profile, 'contractor', 'admin')
  } catch (err) {
    return err as NextResponse
  }

  const adminClient = createSupabaseAdminClient()

  // ── Fetch Milestone ──────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await adminClient
    .from('milestones')
    .select('id, deal_id, status, contractor_id')
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(`Milestone ${milestoneId} was not found.`)
  }

  // ── Deal Access ──────────────────────────────────────────────────────────────
  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient())
  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Status Check ─────────────────────────────────────────────────────────────
  const uploadableStatuses: MilestoneStatus[] = ['in_progress', 'ready_for_review']
  if (!uploadableStatuses.includes(milestone.status as MilestoneStatus)) {
    return errorResponse(
      400,
      `Evidence can only be uploaded when a milestone is 'in_progress' or 'ready_for_review'. ` +
        `This milestone's current status is '${milestone.status}'.`,
    )
  }

  // ── Contractor Ownership Check ───────────────────────────────────────────────
  if (profile.role === 'contractor' && milestone.contractor_id !== user.id) {
    return errorResponse(
      403,
      'You can only upload evidence to milestones assigned to you.',
    )
  }

  // ── Parse File ───────────────────────────────────────────────────────────────
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

  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg']
  if (!allowedTypes.includes(file.type)) {
    return errorResponse(
      400,
      `Invalid file type '${file.type}'. Only PDF, PNG, and JPEG files are accepted.`,
    )
  }

  if (file.size > 20 * 1024 * 1024) {
    return errorResponse(400, 'File exceeds the 20 MB maximum size limit.')
  }

  // ── Build Storage Path ───────────────────────────────────────────────────────
  const ext          = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
  const originalName = file instanceof File ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : `evidence.${ext}`
  // Derive file_type for the DB from the mime type (maps to allowed enum values)
  const dbFileType   = file.type.startsWith('image/') ? 'photo' : 'document'
  // Generate a short unique id prefix to prevent filename collisions
  const uid          = crypto.randomUUID()
  const storagePath  = `${milestone.deal_id}/${milestoneId}/${uid}/${originalName}`

  // ── Upload to Supabase Storage ───────────────────────────────────────────────
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: storageError } = await adminClient.storage
    .from('milestone-documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (storageError) {
    return internalError(
      'Failed to upload the file to storage. Please try again.',
      storageError.message,
    )
  }

  // ── Build public URL ─────────────────────────────────────────────────────────
  const { data: urlData } = adminClient.storage
    .from('milestone-documents')
    .getPublicUrl(storagePath)

  const fileUrl = urlData.publicUrl

  // ── Insert Document Record ───────────────────────────────────────────────────
  // Uses only real DB columns: uploaded_by, file_url, file_type, description.
  // originalName is stored in description so the UI can display a readable filename.
  const { data: document, error: insertError } = await adminClient
    .from('milestone_documents')
    .insert({
      milestone_id: milestoneId,
      uploaded_by:  user.id,
      file_url:     fileUrl,
      file_type:    dbFileType,
        description: originalName, // stores display name in the existing description column
    })
    .select()
    .single()

  if (insertError || !document) {
    // File is in storage but DB record failed — log for manual reconciliation
    await logAudit({
      entity_type: 'milestone_document',
      entity_id:   milestoneId,
      action:      'document_upload_db_failed',
      actor_id:    user.id,
      old_values:  null,
      new_values:  null,
      metadata: {
        deal_id:      milestone.deal_id,
        storage_path: storagePath,
        error:        insertError?.message,
        note:         'File uploaded to storage but DB insert failed — requires reconciliation',
      },
    })

    return internalError(
      'File uploaded but the document record could not be saved. ' +
        `Contact support with milestone ID: ${milestoneId} to reconcile.`,
      insertError?.message,
    )
  }

  await logAudit({
    entity_type: 'milestone_document',
    entity_id:   document.id,
    action:      'document_uploaded',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values:  null,
    new_values: {
      milestone_id: milestoneId,
      file_url:     document.file_url,
      file_type:    document.file_type,
      description:  document.description,
    },
    metadata: {
      deal_id:          milestone.deal_id,
      milestone_status: milestone.status,
      storage_path:     storagePath,
    },
  })

  return NextResponse.json({ document }, { status: 201 })
}
