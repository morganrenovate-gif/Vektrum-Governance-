import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError, notFoundError } from '@/lib/errors'
import type { MilestoneStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'



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
  const supabase = await createClient()

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
        'id, milestone_id, uploaded_by, file_url, file_type, description, created_at',
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
// Register a document URL for a milestone after the file has been uploaded to storage.
//
// Restricted to contractors (and admins) only.
// Milestone must be in 'in_progress' or 'ready_for_review' status.
//
// Body: { file_url, file_type?, description? }
//   file_url    — required. Public URL of the file already uploaded to storage.
//   file_type   — optional. One of: 'photo' | 'document' | 'change_order'. Defaults to 'document'.
//   description — optional. Human-readable filename or note (max 255 chars).

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

  const supabase = await createClient()

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
  const ALLOWED_FILE_TYPES = ['photo', 'document', 'change_order'] as const

  let body: {
    file_url?: string
    file_type?: string
    description?: string
  }

  try {
    body = await request.json()
  } catch {
    return errorResponse(
      400,
      'The request body could not be parsed as JSON. Send: { file_url, file_type?, description? }',
    )
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  const validationErrors: string[] = []

  if (!body.file_url || typeof body.file_url !== 'string' || body.file_url.trim() === '') {
    validationErrors.push(
      'file_url is required and must be the URL of the file after it has been uploaded to storage.',
    )
  }

  if (body.file_type !== undefined && !ALLOWED_FILE_TYPES.includes(body.file_type as typeof ALLOWED_FILE_TYPES[number])) {
    validationErrors.push(`file_type must be one of: ${ALLOWED_FILE_TYPES.join(', ')}.`)
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
        uploaded_by:  user.id,
        file_url:     body.file_url!.trim(),
        file_type:    body.file_type?.trim() ?? 'document',
        description:  body.description?.trim() ?? null,
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
        file_url:     document.file_url,
        file_type:    document.file_type,
        description:  document.description,
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
