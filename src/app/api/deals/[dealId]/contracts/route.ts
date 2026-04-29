import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { errorResponse, internalError } from '@/lib/errors'

export const dynamic = 'force-dynamic'

// ─── POST /api/deals/[dealId]/contracts ────────────────────────────────────────
//
// Contractor or admin uploads a contract PDF for a deal.
// Creates a new contract record with status = 'pending_signatures'.
//
// Rules:
//   - Authenticated, deal-participant access required
//   - Contractor or admin only (funders cannot upload)
//   - Contractors may only upload for their own deal
//   - PDF only, max 20 MB
//   - One non-voided contract per deal (partial unique index enforces this;
//     we check first and return 409 to give a clear error message)
//   - Storage bucket: 'contracts' (private)
//   - Storage path: {dealId}/{uuid}-{sanitizedFilename}
//   - Audit log: contract_uploaded (DB trigger fires too; explicit call here
//     ensures actor_id is recorded even when using the admin client)
//
// Returns: { contract: ContractRow }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await params

  // ── 1. Authentication ──────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // ── 2. Role check (contractor or admin only) ───────────────────────────────
  if (profile.role !== 'contractor' && profile.role !== 'admin') {
    return errorResponse(403, 'Only contractors and admins may upload a contract.')
  }

  // ── 3. Deal access check ───────────────────────────────────────────────────
  const supabase = await createClient()
  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  const adminClient = createSupabaseAdminClient()

  // ── 4. Contractor-specific: must be the deal's own contractor ─────────────
  if (profile.role === 'contractor') {
    const { data: deal } = await adminClient
      .from('deals')
      .select('contractor_id')
      .eq('id', dealId)
      .single()

    if (!deal || deal.contractor_id !== user.id) {
      return errorResponse(403, 'You are not the contractor for this deal.')
    }
  }

  // ── 5. Conflict check — one non-voided contract per deal ──────────────────
  const { data: existingContract } = await adminClient
    .from('contracts')
    .select('id, status')
    .eq('deal_id', dealId)
    .neq('status', 'voided')
    .maybeSingle()

  if (existingContract) {
    return errorResponse(
      409,
      `This deal already has an active contract (status: ${existingContract.status}). ` +
        'Void the existing contract before uploading a replacement.',
    )
  }

  // ── 6. Parse file from FormData ───────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse(400, 'Could not parse form data. Send multipart/form-data with a "file" field.')
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return errorResponse(400, 'No file provided. Include a "file" field in the multipart/form-data body.')
  }

  // ── 7. PDF-only validation ────────────────────────────────────────────────
  if (file.type !== 'application/pdf') {
    return errorResponse(
      400,
      `Invalid file type '${file.type}'. Only PDF files are accepted for contracts.`,
    )
  }

  // ── 8. Size limit (20 MB) ─────────────────────────────────────────────────
  if (file.size > 20 * 1024 * 1024) {
    return errorResponse(400, 'File exceeds the 20 MB maximum size limit.')
  }

  // ── 9. Build storage path ─────────────────────────────────────────────────
  const uniqueId     = crypto.randomUUID()
  const originalName = file instanceof File
    ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    : 'contract.pdf'
  const storagePath  = `${dealId}/${uniqueId}-${originalName}`

  // ── 10. Upload to Supabase Storage ────────────────────────────────────────
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: storageError } = await adminClient.storage
    .from('contracts')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (storageError) {
    return internalError(
      'Failed to upload the contract file to storage. Please try again.',
      storageError.message,
    )
  }

  // ── 11. Insert contract record ────────────────────────────────────────────
  const documentName = file instanceof File ? file.name : 'contract.pdf'

  const { data: newContract, error: insertError } = await adminClient
    .from('contracts')
    .insert({
      deal_id:             dealId,
      uploaded_by:         user.id,
      storage_path:        storagePath,
      document_name:       documentName,
      document_size_bytes: file.size,
      status:              'pending_signatures',
    })
    .select()
    .single()

  if (insertError || !newContract) {
    // File is in storage but DB record failed — log for reconciliation
    void logAudit({
      entity_type: 'contract',
      entity_id:   dealId,
      action:      'contract_upload_db_failed',
      actor_id:    user.id,
      actor_role:  profile.role,
      old_values:  null,
      new_values:  null,
      metadata: {
        storage_path: storagePath,
        deal_id:      dealId,
        error:        insertError?.message,
        note:         'File uploaded to storage but contracts record insert failed — requires reconciliation',
      },
    })

    return internalError(
      'File uploaded but the contract record could not be created. ' +
        `Contact support with Deal ID: ${dealId} to reconcile.`,
      insertError?.message,
    )
  }

  // ── 12. Explicit audit log ────────────────────────────────────────────────
  // The DB trigger (trg_audit_contracts_insert) fires automatically but uses
  // auth.uid() which is null for service-role inserts. We log here explicitly
  // so actor_id is always recorded in the application audit trail.
  void logAudit({
    entity_type: 'contract',
    entity_id:   newContract.id,
    action:      'contract_uploaded',
    actor_id:    user.id,
    actor_role:  profile.role,
    old_values:  null,
    new_values: {
      status:        'pending_signatures',
      storage_path:  storagePath,
      document_name: documentName,
    },
    metadata: {
      deal_id:             dealId,
      document_size_bytes: file.size,
      content_type:        'application/pdf',
    },
  })

  return NextResponse.json({ contract: newContract }, { status: 201 })
}
