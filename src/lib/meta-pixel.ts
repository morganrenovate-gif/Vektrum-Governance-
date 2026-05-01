/**
 * Meta Pixel — thin client-side helper.
 *
 * trackMetaEvent() wraps window.fbq so every callsite is safe:
 *   - No-ops on the server (typeof window === 'undefined').
 *   - No-ops if the pixel script never loaded (fbq undefined).
 *   - No-ops if NEXT_PUBLIC_META_PIXEL_ID is not set (fbq never initialised).
 *   - Never throws — pixel failures in ad-blocked environments must not crash the app.
 *
 * Usage:
 *   import { trackMetaEvent } from '@/lib/meta-pixel'
 *   trackMetaEvent('Lead')
 *   trackMetaEvent('ViewContent', { content_name: 'Pricing' })
 *
 * Standard events: PageView, ViewContent, Lead, Schedule, CompleteRegistration
 * Reference: https://developers.facebook.com/docs/meta-pixel/reference
 */

// Extend Window with the fbq global injected by the pixel base code.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq?: (...args: any[]) => void
    _fbq?: unknown
  }
}

/**
 * Fire a Meta Pixel standard event.
 *
 * @param eventName - Standard event name: 'PageView', 'Lead', 'ViewContent',
 *                    'Schedule', 'CompleteRegistration', etc.
 * @param params    - Optional event parameters (content_name, value, currency, …).
 */
export function trackMetaEvent(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  try {
    if (typeof window === 'undefined') return
    if (!window.fbq) return
    if (params) {
      window.fbq('track', eventName, params)
    } else {
      window.fbq('track', eventName)
    }
  } catch {
    // Non-fatal — pixel may be blocked by ad blockers; never propagate to caller
  }
}
