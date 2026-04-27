'use client'

import { useEffect } from 'react'
import { DEMO_RESET_EVENT } from './index'

/**
 * useDemoAutoReset
 *
 * Drop-in replacement for the bare useEffect(DEMO_RESET_EVENT listener) pattern
 * used across demo-live pages. Calls onReset on three distinct events:
 *
 *   1. Component mount — fresh visitors always start canonical.
 *   2. DEMO_RESET_EVENT — the manual Reset Demo button.
 *   3. pageshow with event.persisted === true — bfcache restore.
 *
 * Why the bfcache branch matters: when a user clicks Browser-back from a
 * deeper page and then Browser-forward back into the demo, Chrome / Safari
 * typically restore the page wholesale from the back/forward cache. The
 * React tree is paused and resumed, NEVER unmounted, so useEffect does not
 * re-run. Without the pageshow handler, any in-session demo state (released
 * milestones, appended activity rows, open modals) would visibly persist
 * across navigations. The `event.persisted === true` guard fires only on
 * bfcache restores — never on the initial load — so it never double-resets.
 *
 * Guarantees:
 *  - onReset() runs exactly once on mount (auto-reset)
 *  - onReset() runs each time DEMO_RESET_EVENT fires (manual reset)
 *  - onReset() runs on bfcache restore (pageshow.persisted)
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

    // Bfcache restore handler — fires only when the browser restores the
    // page from its back/forward cache (event.persisted === true). The
    // initial page load also dispatches pageshow but with persisted=false,
    // so this branch never double-resets a fresh visit.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onReset()
    }

    window.addEventListener(DEMO_RESET_EVENT, onReset)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener(DEMO_RESET_EVENT, onReset)
      window.removeEventListener('pageshow', onPageShow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
