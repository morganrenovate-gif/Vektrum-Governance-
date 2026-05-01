'use client'

/**
 * DemoBookedClient — fires fbq('track', 'Schedule') once on mount.
 *
 * This is a leaf client component so the parent page.tsx stays a server
 * component (ISR-compatible). Renders null — no visible output.
 */

import { useEffect, useRef } from 'react'
import { trackMetaEvent } from '@/lib/meta-pixel'

export function DemoBookedClient() {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackMetaEvent('Schedule')
  }, [])

  return null
}
