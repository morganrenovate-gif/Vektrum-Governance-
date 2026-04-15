/**
 * Fire a short celebratory confetti burst.
 * Called when the user completes onboarding.
 *
 * Safe to call in browser-only contexts (useEffect / click handler).
 * canvas-confetti is imported dynamically to prevent SSR crashes — the
 * top-level import of the ESM bundle causes a build-time failure in Next.js
 * when the module is evaluated during server-side rendering.
 */
export async function fireConfetti(): Promise<void> {
  if (typeof window === 'undefined') return

  const confetti = (await import('canvas-confetti')).default

  // Left burst
  confetti({
    particleCount: 60,
    spread: 55,
    origin: { x: 0.3, y: 0.6 },
    colors: ['#1A3A96', '#E8EDF8', '#FFFFFF', '#1A7A4A'],
  })
  // Right burst
  confetti({
    particleCount: 60,
    spread: 55,
    origin: { x: 0.7, y: 0.6 },
    colors: ['#1A3A96', '#E8EDF8', '#FFFFFF', '#9A5A0A'],
  })
}
