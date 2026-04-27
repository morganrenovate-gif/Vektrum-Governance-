'use client'

import { useEffect } from 'react'
import { DEMO_RESET_EVENT } from './index'

/**
 * useDemoAutoReset
 *
 * Drop-in replacement for the bare useEffect(DEMO_RESET_EVENT listener) pattern
 * used across demo-live pages. In addition to wiring the manual-reset event, it
 * also calls onReset once immediately on mount so a fresh demo visitor always
 * starts from a clean state — even if the previous visitor left stale overrides
 * in a same-tab session that kept the page component mounted.
 *
 * Guarantees:
 *  - onReset() is called exactly once on mount (auto-reset)
 *  - onReset() is called each time DEMO_RESET_EVENT fires (manual reset)
 *  - useEffect dep array is [] — runs once, never loops
 *  - No localStorage / sessionStorage — all state is React useState
 *  - No DB or API calls
 *
 * Usage:
 *   useDemoAutoReset(() => {
 *     setOverrides({})
 *     setReleaseModal(false)
 *     // ... any other state that needs resetting
 *   })
 *
 * The empty dep array is intentional. onReset only invokes stable React
 * setState setters (React guarantees setter identity never changes), so there
 * is no stale-closure risk and no need to list onReset as a dep.
 */
export function useDemoAutoReset(onReset: () => void): void {
  useEffect(() => {
    onReset() // auto-reset on mount — clears stale state from same-tab sessions
    window.addEventListener(DEMO_RESET_EVENT, onReset)
    return () => window.removeEventListener(DEMO_RESET_EVENT, onReset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
