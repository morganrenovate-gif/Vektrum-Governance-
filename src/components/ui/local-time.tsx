'use client'

import { useEffect, useState } from 'react'

// ─── LocalTime ────────────────────────────────────────────────────────────────
//
// Renders a timestamp in the user's LOCAL browser timezone.
//
// ⚠  NOT FOR AUDIT LOGS OR FINANCIAL RECORDS.
//    Audit displays must use <AuditTimestamp> or formatAuditTimestamp() from
//    @/lib/engine/audit, which always outputs exact UTC with no ambiguity.
//
//    LocalTime is appropriate for:
//      - Deal dates, dashboard activity summaries, notification feeds
//      - Any display where user convenience (local time) outweighs legal precision
//
// Falls back to the raw ISO string during SSR to avoid hydration mismatch.

interface LocalTimeProps {
  iso: string
  className?: string
}

export function LocalTime({ iso, className }: LocalTimeProps) {
  const [formatted, setFormatted] = useState<string>('')

  useEffect(() => {
    setFormatted(
      new Intl.DateTimeFormat('en-US', {
        month:  'short',
        day:    'numeric',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
        // No timeZone → uses the browser's local timezone (intentional for UX)
      }).format(new Date(iso))
    )
  }, [iso])

  if (!formatted) {
    return <span className={className}>{iso}</span>
  }

  return <span className={className}>{formatted}</span>
}

// ─── AuditTimestamp ───────────────────────────────────────────────────────────
//
// Renders a timestamp as an exact UTC string suitable for audit logs,
// financial records, and any legally-defensible display.
//
// Output format: "YYYY-MM-DD HH:MM:SS UTC"
// Example:        "2026-04-23 14:35:02 UTC"
//
// This is a SERVER-SAFE pure renderer — no browser dependency, no hydration
// mismatch. It always shows the full date+time+timezone, never relative text.
//
// Optional `split` prop renders date and time on separate lines for table cells.

interface AuditTimestampProps {
  iso: string
  /** When true, renders date and time on two lines (useful in narrow table cells) */
  split?: boolean
  className?: string
}

export function AuditTimestamp({ iso, split = false, className }: AuditTimestampProps) {
  const d = new Date(iso)

  if (isNaN(d.getTime())) {
    return <span className={className}>{iso}</span>
  }

  const pad  = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`

  if (split) {
    return (
      <span className={className}>
        <span className="block tabular-nums">{date}</span>
        <span className="block tabular-nums text-white/40">{time}</span>
      </span>
    )
  }

  return (
    <span className={`tabular-nums ${className ?? ''}`}>
      {date} {time}
    </span>
  )
}
