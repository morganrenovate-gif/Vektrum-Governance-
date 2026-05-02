/**
 * Server-only contract text extraction.
 *
 * Resolves the most-readable PDF available for a contract row and runs
 * it through a two-stage extractor (pdf-parse → unpdf fallback). Used by
 * /api/deals/{dealId}/release-rules/generate-from-contract.
 *
 * Source preference (in order — falls through on download OR parse failure):
 *   1. contract.signed_storage_path  — combined signed PDF, written by the
 *      DocuSign envelope-completed webhook.
 *   2. contract.storage_path         — original upload, kept on file when
 *      contract is fully signed but the signed copy hasn't been
 *      downloaded/stored yet (e.g. lost webhook delivery).
 *
 * Two-stage extraction is necessary because DocuSign's combined PDF embeds
 * digital signatures and form fields that occasionally trip pdf-parse v2's
 * pdfjs version. unpdf is a serverless-friendly fallback that handles a
 * wider range of producers.
 *
 * The helper returns a discriminated result with structured failure reasons
 * so the caller can:
 *   - distinguish scanned/empty PDFs from genuinely corrupt files
 *   - log safe diagnostics (path type chosen, sizes, parser used) without
 *     leaking PDF bytes, signed URLs, or secrets
 *   - render a specific user-facing message per failure mode
 */

import { createSupabaseAdminClient } from '@/lib/supabase/server'

const CONTRACTS_BUCKET = 'contracts'

// Below this many extracted, trimmed characters we treat the PDF as
// effectively empty / scanned. The release-rules helper rejects below 500
// for AI extraction; here we draw a more permissive line so we surface a
// clearer "scanned" message before bouncing the user to manual entry.
const SCANNED_PDF_THRESHOLD_CHARS = 100

// ─── Types ──────────────────────────────────────────────────────────────

interface ContractRow {
  id:                   string
  storage_path?:        string | null
  signed_storage_path?: string | null
}

export type ExtractFailureReason =
  | 'no_storage_path'
  | 'download_failed'
  | 'empty_pdf_text'
  | 'scanned_pdf_no_ocr'
  | 'parse_error'
  | 'password_protected_or_corrupt'

export type ExtractedSourceType = 'signed' | 'original' | 'none'

/** Safe (no file contents) diagnostics surfaced for ops logging + tests. */
export interface ExtractDiagnostics {
  contract_id:                    string
  has_storage_path:               boolean
  has_signed_storage_path:        boolean
  selected_source:                ExtractedSourceType
  bucket:                         string
  attempted_paths:                ExtractedSourceType[]
  file_size_bytes:                number | null
  extracted_text_length:          number
  extraction_method:              'pdf-parse' | 'unpdf' | null
  /** True when signed_storage_path was set but its file could not be read,
   *  so we transparently fell back to the original upload. */
  fell_back_from_signed_to_original: boolean
}

export interface ExtractTextOk {
  ok:           true
  text:         string
  sourcePath:   string
  diagnostics:  ExtractDiagnostics
}

export interface ExtractTextErr {
  ok:           false
  error:        string
  reason:       ExtractFailureReason
  diagnostics:  ExtractDiagnostics
}

// ─── Public API ──────────────────────────────────────────────────────────

export async function extractSignedContractText(
  contract: ContractRow,
): Promise<ExtractTextOk | ExtractTextErr> {
  const baseDiag: ExtractDiagnostics = {
    contract_id:                       contract.id,
    has_storage_path:                  !!contract.storage_path,
    has_signed_storage_path:           !!contract.signed_storage_path,
    selected_source:                   'none',
    bucket:                            CONTRACTS_BUCKET,
    attempted_paths:                   [],
    file_size_bytes:                   null,
    extracted_text_length:             0,
    extraction_method:                 null,
    fell_back_from_signed_to_original: false,
  }

  if (!contract.signed_storage_path && !contract.storage_path) {
    return {
      ok:          false,
      reason:      'no_storage_path',
      error:
        'Could not find a contract document to read. Upload the contract or ' +
        'enter release rules manually.',
      diagnostics: baseDiag,
    }
  }

  // Build the candidate list in preference order. Keep the source label so
  // downstream diagnostics + UI hints can mention which document was used.
  const candidates: Array<{ source: ExtractedSourceType; path: string }> = []
  if (contract.signed_storage_path) {
    candidates.push({ source: 'signed',   path: contract.signed_storage_path })
  }
  if (contract.storage_path) {
    candidates.push({ source: 'original', path: contract.storage_path })
  }

  // Track whether we tried signed first and had to fall back, for an honest
  // diagnostic + a tonal-shift in the UI ("from contract document" instead
  // of "from signed contract" once the original is what we actually parsed).
  let triedSignedFirst = candidates[0]?.source === 'signed'

  let lastFailure: ExtractTextErr | null = null

  for (const candidate of candidates) {
    baseDiag.attempted_paths.push(candidate.source)

    // ── Download ────────────────────────────────────────────────────────
    const admin = createSupabaseAdminClient()
    const { data: blob, error: dlErr } = await admin.storage
      .from(CONTRACTS_BUCKET)
      .download(candidate.path)

    if (dlErr || !blob) {
      console.warn('[contract-text] download failed', {
        contract_id:  contract.id,
        source:       candidate.source,
        bucket:       CONTRACTS_BUCKET,
        error:        dlErr?.message?.slice(0, 200) ?? 'no blob',
      })
      lastFailure = {
        ok:          false,
        reason:      'download_failed',
        error:
          'Could not download the contract file from storage. Enter release ' +
          'rules manually.',
        diagnostics: { ...baseDiag, selected_source: 'none' },
      }
      // Try the next candidate if any.
      if (candidate.source === 'signed') {
        baseDiag.fell_back_from_signed_to_original = true
      }
      continue
    }

    const buffer = Buffer.from(await blob.arrayBuffer())
    baseDiag.file_size_bytes = buffer.byteLength

    // ── Parse — pdf-parse first, unpdf fallback ─────────────────────────
    const parsed = await parseTextFromBuffer(buffer, contract.id)
    if (parsed.ok) {
      const text = parsed.text.trim()
      const diagnostics: ExtractDiagnostics = {
        ...baseDiag,
        selected_source:       candidate.source,
        extracted_text_length: text.length,
        extraction_method:     parsed.method,
      }

      if (!text) {
        lastFailure = {
          ok:          false,
          reason:      'empty_pdf_text',
          error:
            'No readable text was extracted from this PDF. Enter release ' +
            'rules manually.',
          diagnostics,
        }
        // Don't try the next candidate — empty text usually means the PDF
        // really has no text (scanned image). The original upload is
        // unlikely to be more readable than the DocuSign-combined version.
        break
      }

      if (text.length < SCANNED_PDF_THRESHOLD_CHARS) {
        lastFailure = {
          ok:          false,
          reason:      'scanned_pdf_no_ocr',
          error:
            'Could not extract text from this PDF. It may be scanned or ' +
            'image-based. Enter release rules manually for now.',
          diagnostics,
        }
        break
      }

      // Success.
      if (candidate.source === 'original' && triedSignedFirst) {
        baseDiag.fell_back_from_signed_to_original = true
      }
      return {
        ok:          true,
        text,
        sourcePath:  candidate.path,
        diagnostics: { ...diagnostics, fell_back_from_signed_to_original: baseDiag.fell_back_from_signed_to_original },
      }
    }

    // Both parsers failed on this candidate. Record the failure and try the
    // next candidate; if there are none left, return the last failure.
    lastFailure = {
      ok:     false,
      reason: parsed.passwordProtected
                ? 'password_protected_or_corrupt'
                : 'parse_error',
      error:  parsed.passwordProtected
                ? 'This PDF appears to be password-protected or corrupted. ' +
                  'Upload an unprotected copy, or enter release rules manually.'
                : 'Could not read the contract PDF. Enter release rules manually.',
      diagnostics: { ...baseDiag, selected_source: candidate.source },
    }
    if (candidate.source === 'signed') {
      baseDiag.fell_back_from_signed_to_original = true
    }
    triedSignedFirst = false   // already noted; don't re-flag
  }

  return lastFailure ?? {
    ok:     false,
    reason: 'parse_error',
    error:  'Could not read the contract PDF. Enter release rules manually.',
    diagnostics: baseDiag,
  }
}

// ─── Internals ──────────────────────────────────────────────────────────

interface ParseOk  { ok: true;  text: string; method: 'pdf-parse' | 'unpdf' }
interface ParseErr { ok: false; passwordProtected: boolean }

/**
 * Try pdf-parse first; if it throws, fall back to unpdf. Both are server-
 * only Node libraries; we don't introduce OCR (no native deps).
 */
async function parseTextFromBuffer(
  buffer: Buffer,
  contractId: string,
): Promise<ParseOk | ParseErr> {
  // ── 1. pdf-parse ──────────────────────────────────────────────────────
  let parser: InstanceType<typeof import('pdf-parse').PDFParse> | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse') as typeof import('pdf-parse')
    parser = new PDFParse({ data: buffer })
    const parsed = await parser.getText()
    const text = parsed.text ?? ''
    return { ok: true, text, method: 'pdf-parse' }
  } catch (err) {
    const msg = String(err).slice(0, 200)
    console.warn('[contract-text] pdf-parse threw — trying unpdf fallback', {
      contract_id: contractId,
      error:       msg,
    })
    // Fall through to unpdf.
  } finally {
    try { await parser?.destroy() } catch { /* non-fatal */ }
  }

  // ── 2. unpdf fallback ────────────────────────────────────────────────
  try {
    const { extractText } = await import('unpdf')
    // unpdf accepts a Uint8Array; Buffer is a Uint8Array subclass but the
    // type is narrower, so we copy into a fresh Uint8Array view to avoid
    // any version mismatch between Buffer and Uint8Array prototypes.
    const u8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const result = await extractText(u8)
    const text = Array.isArray(result.text) ? result.text.join('\n') : (result.text ?? '')
    return { ok: true, text, method: 'unpdf' }
  } catch (err) {
    const msg = String(err)
    const passwordProtected =
      /password/i.test(msg) || /encrypt/i.test(msg)
    console.error('[contract-text] both parsers failed', {
      contract_id:        contractId,
      password_protected: passwordProtected,
      error:              msg.slice(0, 200),
    })
    return { ok: false, passwordProtected }
  }
}
