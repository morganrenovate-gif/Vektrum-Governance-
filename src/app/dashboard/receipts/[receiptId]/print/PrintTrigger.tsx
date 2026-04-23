'use client'

import { useEffect } from 'react'

// Calls window.print() after mount so the browser's save-as-PDF dialog opens
// automatically when the print page loads in a new tab.
export function PrintTrigger() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print()
    }, 400) // Allow styles to fully render before opening print dialog
    return () => clearTimeout(timer)
  }, [])

  return null
}
