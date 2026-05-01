'use client'

/**
 * MetaPixelPageView — client component.
 *
 * Fires fbq('track', 'PageView') on every SPA route change after the initial
 * page load. The initial PageView is already fired by the base script in
 * <MetaPixelScript />, so this component skips the first render.
 *
 * Dedup strategy:
 *   - isFirst ref skips the first pathname effect (base script covers it).
 *   - prevPath ref prevents double-fires if useEffect runs twice in StrictMode.
 *
 * Renders null — no visible output.
 */

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackMetaEvent } from '@/lib/meta-pixel'

export function MetaPixelPageView() {
  const pathname = usePathname()
  const isFirst  = useRef(true)
  const prevPath = useRef<string | null>(null)

  useEffect(() => {
    // Skip the very first render — the base script already fired PageView.
    if (isFirst.current) {
      isFirst.current = false
      prevPath.current = pathname
      return
    }

    // Guard against double-fire (React StrictMode double-invoke in dev).
    if (prevPath.current === pathname) return
    prevPath.current = pathname

    trackMetaEvent('PageView')
  }, [pathname])

  return null
}
