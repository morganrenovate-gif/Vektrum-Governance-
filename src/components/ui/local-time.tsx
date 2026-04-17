'use client'

import { useEffect, useState } from 'react'

interface LocalTimeProps {
  iso: string
  className?: string
}

/**
 * Renders a timestamp in the user's local timezone.
 * Falls back to the ISO string during SSR to avoid hydration mismatch.
 */
export function LocalTime({ iso, className }: LocalTimeProps) {
  const [formatted, setFormatted] = useState<string>('')

  useEffect(() => {
    setFormatted(
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        // No timeZone specified → uses the browser's local timezone
      }).format(new Date(iso))
    )
  }, [iso])

  // During SSR / before hydration, render nothing to avoid mismatch
  if (!formatted) {
    return <span className={className}>{iso}</span>
  }

  return <span className={className}>{formatted}</span>
}
