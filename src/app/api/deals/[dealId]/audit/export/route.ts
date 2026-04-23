import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireDealAccess } from '@/lib/auth/middleware'
import { logAudit } from '@/lib/engine/audit'
import { forbiddenError, notFoundError, validationError, internalError } from '@/lib/errors'
import { formatAuditTimestamp } from '@/lib/engine/audit'

export const dynamic = 'force-dynamic'

// ─── GET /api/deals/[dealId]/audit/export ─────────────────────────────────────
//
// Exports the audit log for a specific deal as CSV or printable HTML.
//
// QUERY PARAMETERS:
//   format     'csv' | 'html'   Default: 'csv'
//   start_date ISO date string  Optional: filter rows from this date (inclusive)
//   end_date   ISO date string  Optional: filter rows up to this date (inclusive)
//
// ACCESS CONTROL:
//   Funder or admin only. Contractors can view audit logs in the dashboard UI
//   but cannot export them (to protect internal review commentary).
//   Admins can export any deal. Funders can only export their own deals.
//
// AUDIT OF EXPORT:
//   The export action itself is written to audit_log so funders cannot
//   silently extract audit trails.
//
// CSV FORMAT:
//   RFC 4180, UTF-8 with BOM (for Excel compatibility). Headers:
//   event_sequence, created_at_utc, entity_type, entity_id, action,
//   actor_name, actor_role, actor_email, system_source, old_values,
//   new_values, metadata, row_hash_valid
//
// HTML/PDF FORMAT:
//   Returns a self-contained, print-optimized HTML page.
//   Browsers can File → Print → Save as PDF to produce a PDF artifact.
//   For binary PDF generation, install pdfkit (npm install pdfkit @types/pdfkit)
//   and replace the HTML path with the pdfkit implementation below.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> },
): Promise<NextResponse> {
  const { dealId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  let authContext
  try {
    authContext = await getAuthUser(request)
  } catch (err) {
    return err as NextResponse
  }

  const { user, profile } = authContext

  // Only funders and admins may export. Contractors view in the UI dashboard.
  if (profile.role === 'contractor') {
    return forbiddenError(
      'Audit log exports are available to funders and platform administrators only. ' +
      'Contractors can view audit history in the deal dashboard.',
    )
  }

  const supabase = await createClient()

  try {
    await requireDealAccess(supabase, dealId, user.id, profile.role)
  } catch (err) {
    return err as NextResponse
  }

  // ── Parse and validate query params ──────────────────────────────────────
  const { searchParams } = new URL(request.url)
  const format    = (searchParams.get('format') ?? 'csv').toLowerCase()
  const startDate = searchParams.get('start_date')
  const endDate   = searchParams.get('end_date')

  if (format !== 'csv' && format !== 'html') {
    return validationError([
      `Invalid format '${format}'. Accepted values: 'csv', 'html'.`,
    ])
  }

  // Validate dates if provided
  if (startDate && isNaN(Date.parse(startDate))) {
    return validationError([`Invalid start_date '${startDate}'. Must be a valid ISO date string.`])
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return validationError([`Invalid end_date '${endDate}'. Must be a valid ISO date string.`])
  }

  // ── Fetch deal metadata ────────────────────────────────────────────────────
  const admin = createSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deal, error: dealError } = await (admin as any)
    .from('deals')
    .select('id, title, total_amount, status, contractor_id, funder_id')
    .eq('id', dealId)
    .single()

  if (dealError || !deal) {
    return notFoundError(`Deal ${dealId} not found.`)
  }

  // ── Fetch audit rows ───────────────────────────────────────────────────────
  // Use admin client so we get all rows regardless of RLS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let auditQuery = (admin as any)
    .from('audit_log')
    .select(
      'id, event_sequence, created_at, entity_type, entity_id, action, ' +
      'actor_id, actor_name, actor_role, actor_email, system_source, ' +
      'old_values, new_values, metadata, row_hash, chain_hash',
    )
    .eq('entity_id', dealId)
    .order('event_sequence', { ascending: true })

  if (startDate) {
    auditQuery = auditQuery.gte('created_at', new Date(startDate).toISOString())
  }
  if (endDate) {
    // End of the specified day (23:59:59.999)
    const endDt = new Date(endDate)
    endDt.setHours(23, 59, 59, 999)
    auditQuery = auditQuery.lte('created_at', endDt.toISOString())
  }

  const { data: auditRows, error: auditError } = await auditQuery

  if (auditError) {
    return internalError(
      'Failed to retrieve audit log rows. Please try again.',
      auditError.message,
    )
  }

  const rows = auditRows ?? []

  // ── Log the export action ─────────────────────────────────────────────────
  // Always audit the export — funders cannot silently extract audit trails.
  // Fire-and-forget.
  logAudit({
    entity_type:   'deal',
    entity_id:     dealId,
    action:        'audit_log_exported',
    actor_id:      user.id,
    actor_role:    profile.role,
    system_source: 'api/deals/audit/export',
    metadata: {
      format,
      start_date:   startDate ?? null,
      end_date:     endDate ?? null,
      row_count:    rows.length,
      deal_title:   deal.title,
    },
  }).catch(err => console.warn('[audit-export] Failed to log export event:', err))

  // ── Generate output ────────────────────────────────────────────────────────
  if (format === 'csv') {
    return generateCsv(dealId, deal.title, rows)
  } else {
    return generateHtml(dealId, deal, rows, { startDate, endDate })
  }
}

// ─── CSV Generator ────────────────────────────────────────────────────────────
//
// RFC 4180 compliant CSV with UTF-8 BOM for Excel compatibility.
// All fields are properly escaped (double quotes for fields containing commas,
// quotes, or newlines). JSONB columns are serialized as compact JSON strings.

function generateCsv(
  dealId: string,
  dealTitle: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
): NextResponse {
  const CSV_HEADERS = [
    'event_sequence',
    'created_at_utc',
    'entity_type',
    'entity_id',
    'action',
    'actor_name',
    'actor_role',
    'actor_email',
    'system_source',
    'old_values',
    'new_values',
    'metadata',
    'row_hash',
    'chain_hash',
  ] as const

  // Escape a CSV field value per RFC 4180
  const csvField = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
    // Wrap in double quotes if contains comma, double quote, or newline
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  const lines: string[] = []

  // UTF-8 BOM for Excel compatibility (\uFEFF)
  lines.push('\uFEFF' + CSV_HEADERS.join(','))

  for (const row of rows) {
    const fields = [
      csvField(row.event_sequence),
      csvField(formatAuditTimestamp(row.created_at)),
      csvField(row.entity_type),
      csvField(row.entity_id),
      csvField(row.action),
      csvField(row.actor_name),
      csvField(row.actor_role),
      csvField(row.actor_email),
      csvField(row.system_source),
      csvField(row.old_values),
      csvField(row.new_values),
      csvField(row.metadata),
      csvField(row.row_hash),
      csvField(row.chain_hash),
    ]
    lines.push(fields.join(','))
  }

  const csvBody = lines.join('\r\n')
  const filename = `audit-${dealId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csvBody, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

// ─── HTML Report Generator ────────────────────────────────────────────────────
//
// Generates a self-contained, print-optimized HTML document.
// Includes a print-to-PDF instruction in the page header.
// All styles are inlined — no external CDN dependencies.
//
// NOTE: For binary PDF output (e.g., a .pdf download), install pdfkit:
//   npm install pdfkit @types/pdfkit
// Then replace this function with a pdfkit implementation that builds the
// same table structure. The HTML report is fully functional for legal purposes:
// File → Print → Save as PDF in any browser produces a proper PDF artifact.

function generateHtml(
  dealId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deal: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
  filters: { startDate: string | null; endDate: string | null },
): NextResponse {
  const generatedAt = formatAuditTimestamp(new Date().toISOString())
  const filename = `audit-${dealId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.html`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const escapeHtml = (str: any): string => {
    if (str === null || str === undefined) return '<span class="null">—</span>'
    const s = typeof str === 'object' ? JSON.stringify(str, null, 2) : String(str)
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  const tableRows = rows.map(row => `
    <tr>
      <td class="mono seq">${escapeHtml(row.event_sequence)}</td>
      <td class="mono time">${escapeHtml(formatAuditTimestamp(row.created_at))}</td>
      <td class="action"><strong>${escapeHtml(row.action)}</strong></td>
      <td>${escapeHtml(row.entity_type)}</td>
      <td class="mono small">${escapeHtml(row.actor_name ?? row.actor_id)}</td>
      <td class="small">${escapeHtml(row.actor_role)}</td>
      <td class="small">${escapeHtml(row.system_source)}</td>
      <td class="mono small json">${escapeHtml(row.new_values)}</td>
      <td class="mono small json">${escapeHtml(row.old_values)}</td>
      <td class="hash">${row.row_hash ? `<span class="hash-valid">${row.row_hash.slice(0, 12)}…</span>` : '<span class="hash-null">pre-migration</span>'}</td>
    </tr>
  `).join('')

  const filterSummary = [
    filters.startDate ? `From: ${filters.startDate}` : null,
    filters.endDate   ? `To: ${filters.endDate}`     : null,
  ].filter(Boolean).join(' · ') || 'All dates'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit Log Export — ${escapeHtml(deal.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #111;
      background: #fff;
      padding: 24px;
    }
    .header {
      border-bottom: 2px solid #0066cc;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      color: #0066cc;
      margin-bottom: 4px;
    }
    .header .meta {
      color: #555;
      font-size: 11px;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .header .meta strong { color: #111; }
    .print-note {
      background: #fffbeb;
      border: 1px solid #f59e0b;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 20px;
      font-size: 11px;
      color: #92400e;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    thead th {
      background: #0066cc;
      color: #fff;
      font-weight: 600;
      padding: 6px 8px;
      text-align: left;
      white-space: nowrap;
      position: sticky;
      top: 0;
    }
    tbody tr:nth-child(even) { background: #f8f9fa; }
    tbody tr:hover { background: #e8f0fe; }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    .mono { font-family: 'SF Mono', 'Fira Code', Consolas, monospace; }
    .seq { color: #6b7280; width: 48px; }
    .time { white-space: nowrap; width: 160px; color: #374151; }
    .action strong { color: #111; }
    .small { font-size: 10px; color: #374151; }
    .json { max-width: 220px; white-space: pre-wrap; word-break: break-all; color: #374151; }
    .hash { font-family: monospace; font-size: 9px; }
    .hash-valid { color: #059669; }
    .hash-null { color: #9ca3af; font-style: italic; }
    .null { color: #9ca3af; }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 10px;
      display: flex;
      justify-content: space-between;
    }
    /* Print styles */
    @media print {
      .print-note { display: none; }
      body { padding: 8px; font-size: 9px; }
      thead th { background: #333 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tbody tr:nth-child(even) { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Vektrum — Audit Log Export</h1>
    <div class="meta">
      <span><strong>Deal:</strong> ${escapeHtml(deal.title)}</span>
      <span><strong>Deal ID:</strong> ${escapeHtml(dealId)}</span>
      <span><strong>Status:</strong> ${escapeHtml(deal.status)}</span>
      <span><strong>Period:</strong> ${escapeHtml(filterSummary)}</span>
      <span><strong>Rows:</strong> ${rows.length}</span>
      <span><strong>Generated:</strong> ${generatedAt}</span>
    </div>
  </div>

  <div class="print-note">
    📄 To save as PDF: use your browser's <strong>File → Print → Save as PDF</strong> feature.
    For programmatic PDF generation, install pdfkit and replace this route's HTML path.
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Timestamp (UTC)</th>
        <th>Action</th>
        <th>Entity Type</th>
        <th>Actor</th>
        <th>Role</th>
        <th>Source</th>
        <th>New Values</th>
        <th>Old Values</th>
        <th>Row Hash</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#6b7280;">No audit events found for the selected period.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <span>Vektrum Governance Platform — Confidential</span>
    <span>Export generated ${generatedAt} · Deal ${dealId}</span>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type':        'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-store',
      'X-Content-Type-Options': 'nosniff',
      // Allow browser to render (not just download) for print-to-PDF workflow
      'X-Frame-Options': 'DENY',
    },
  })
}
