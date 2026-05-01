'use client'

/**
 * MetaViewContent — client component.
 *
 * Fires fbq('track', 'ViewContent', { content_name }) once on page mount.
 * Drop into any server-component marketing page to signal high-intent views.
 *
 * Fires once per mount — safe to render in server-component pages since
 * the 'use client' boundary wraps only this leaf.
 *
 * Usage:
 *   <MetaViewContent contentName="Funders" />
 *   <MetaViewContent contentName="Pricing" />
 *   <MetaViewContent contentName="Demo" />
 *   <MetaViewContent contentName="Contractors" />
 */

import { useEffect, useRef } from 'react'
import { trackMetaEvent } from '@/lib/meta-pixel'

interface MetaViewContentProps {
  contentName: string
}

export function MetaViewContent({ contentName }: MetaViewContentProps) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    trackMetaEvent('ViewContent', { content_name: contentName })
  }, [contentName])

  return null
}
