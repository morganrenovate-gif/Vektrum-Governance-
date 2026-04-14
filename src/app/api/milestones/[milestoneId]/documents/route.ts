import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'
import type { MilestoneStatus } from '@/lib/types'



// ─── GET /api/milestones/[milestoneId]/documents ──────────────────────────────
// List all documents attached to a milestone.
// Participants and admins only.

export async function GET(request: NextRequest, { params }: { params: Promise<{ milestoneId: string }> }) {
  const { milestoneId } = await params

  let authContext

  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext
  const supabase = buildSupabaseFromRequest(request)

  // ── Fetch Milestone for Deal ID ─────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id')
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `Milestone ${milestoneId} was not found. Verify the milestone ID and try again.`,
    )
  }

  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  try {
    const { data: documents, error } = await supabase
      .from('milestone_documents')
      .select(
        'id, milestone_id, uploader_id, file_name, file_url, file_size, mime_type, created_at',
      )
      .eq('milestone_id', milestoneId)
      .order('created_at', { ascending: false })

    if (error) {
      return internalError(
        'Could not retrieve documents for this milestone. Please try again.',
        error.message,
      )
    }

    return NextResponse.json({ documents })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while retrieving milestone documents. Please try again.',
      message,
    )
  }
}

// ─── POST /api/milestones/[milestoneId]/documents ─────────────────────────────
// Upload (register) a document for a milestone.
//
// Restricted to contractors only.
// Milestone must be in 'in_progress' or 'ready_for_review' status.
//
// Note: This endpoint registers the document metadata. The actual file upload
// should be done directly to Supabase Storage by the client using a signed URL
// obtained from the storage API. This route records the metadata after upload.
//
// Body: { file_name, file_url, file_size, mime_type }

export async function POST(request: NextRequest, { params }: { params: Promise<{ milestoneId: string }> }) {
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

  const supabase = buildSupabaseFromRequest(request)

  // ── Fetch Milestone ─────────────────────────────────────────────────────────
  const { data: milestone, error: milestoneError } = await supabase
    .from('milestones')
    .select('id, deal_id, status, contractor_id')
    .eq('id', milestoneId)
    .single()

  if (milestoneError || !milestone) {
    return notFoundError(
      `Milestone ${milestoneId} was not found. Verify the milestone ID and try again.`,
    )
  }

  try {
    await requireDealAccess(supabase, milestone.deal_id, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Validate Milestone Status ───────────────────────────────────────────────
  const uploadableStatuses: MilestoneStatus[] = ['in_progress', 'ready_for_review']

  if (!uploadableStatuses.includes(milestone.status as MilestoneStatus)) {
    return errorResponse(
      400,
      `Documents can only be uploaded when a milestone is in 'in_progress' or 'ready_for_review' status. ` +
        `This milestone's current status is '${milestone.status}'. ` +
        `Start work on the milestone first (transition to 'in_progress') before uploading supporting documents.`,
    )
  }

  // ── Validate Contractor Ownership ───────────────────────────────────────────
  if (profile.role === 'contractor' && milestone.contractor_id !== user.id) {
    return errorResponse(
      403,
      'You can only upload documents to milestones assigned to you. ' +
        `Milestone ${milestoneId} is assigned to a different contractor.`,
    )
  }

  // ── Parse Body ──────────────────────────────────────────────────────────────
  let body: {
    file_name?: string
    file_url?: string
    file_size?: number
    mime_type?: string
  }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Send: { file_name, file_url, file_size, mime_type }',
    )
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const validationErrors: string[] = []

  if (!body.file_name || typeof body.file_name !== 'string' || body.file_name.trim() === '') {
    validationErrors.push('file_name is required and must be a non-empty string.')
  }

  if (!body.file_url || typeof body.file_url !== 'string' || body.file_url.trim() === '') {
    validationErrors.push(
      'file_url is required and must be the URL of the file after it has been uploaded to storage.',
    )
  }

  if (body.file_size === undefined || typeof body.file_size !== 'number' || body.file_size <= 0) {
    validationErrors.push('file_size is required and must be a positive number (bytes).')
  }

  if (!body.mime_type || typeof body.mime_type !== 'string' || body.mime_type.trim() === '') {
    validationErrors.push(
      'mime_type is required (e.g. application/pdf, image/jpeg). ' +
        'This helps the platform correctly preview and validate uploaded files.',
    )
  }

  if (validationErrors.length > 0) {
    return NextResponse.json(
      {
        error: 'Document registration failed due to missing or invalid fields.',
        errors: validationErrors,
      },
      { status: 400 },
    )
  }

  // ── Insert Document Record ──────────────────────────────────────────────────
  try {
    const { data: document, error: insertError } = await supabase
      .from('milestone_documents')
      .insert({
        milestone_id: milestoneId,
        uploader_id: user.id,
        file_name: body.file_name!.trim(),
        file_url: body.file_url!.trim(),
        file_size: body.file_size!,
        mime_type: body.mime_type!.trim(),
      })
      .select()
      .single()

    if (insertError || !document) {
      return internalError(
        'Failed to register the document. Please try again. If this problem continues, contact support.',
        insertError?.message,
      )
    }

    await logAudit({
      entity_type: 'milestone_document',
      entity_id: document.id,
      action: 'document_uploaded',
      actor_id: user.id,
      old_values: null,
      new_values: {
        milestone_id: milestoneId,
        file_name: document.file_name,
        file_size: document.file_size,
        mime_type: document.mime_type,
      },
      metadata: {
        deal_id: milestone.deal_id,
        milestone_status: milestone.status,
      },
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return internalError(
      'An unexpected error occurred while registering the document. Please try again.',
      message,
    )
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSupabaseFromRequest(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    },
  )
}
