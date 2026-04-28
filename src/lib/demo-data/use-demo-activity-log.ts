'use client'

/**
 * useDemoActivityLog
 *
 * Client-side-only hook for the demo-live activity log.
 * No Supabase, no API calls, no production audit log interaction.
 *
 * Entries are prepended (newest-first) so the log reads like a real-time feed.
 * The resetLog() function is designed to be called inside useDemoAutoReset so
 * the log clears on bfcache restore or manual demo reset.
 */

import { useCallback, useState } from 'react'

export interface DemoActivityEntry {
  /** Unique entry ID — crypto.randomUUID() */
  id:        string
  /** Formatted local time string, e.g. "02:34:17 PM" */
  timestamp: string
  /** Human-readable actor name, e.g. "Funder Demo User" */
  actor:     string
  /** Role label used for the color badge */
  role:      'funder' | 'contractor' | 'admin' | 'system'
  /** Short action verb phrase, e.g. "AI Draw Review Completed" */
  action:    string
  /** One-line detail string, e.g. "Score: 34/100 · Risk: High" */
  detail:    string
}

export function useDemoActivityLog() {
  const [entries, setEntries] = useState<DemoActivityEntry[]>([])

  const addEntry = useCallback(
    (entry: Omit<DemoActivityEntry, 'id' | 'timestamp'>) => {
      setEntries((prev) => [
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour:    '2-digit',
            minute:  '2-digit',
            second:  '2-digit',
            hour12:  true,
          }),
          ...entry,
        },
        ...prev,
      ])
    },
    [],
  )

  /** Call inside useDemoAutoReset callback to clear the log on demo reset. */
  const resetLog = useCallback(() => setEntries([]), [])

  return { entries, addEntry, resetLog }
}
