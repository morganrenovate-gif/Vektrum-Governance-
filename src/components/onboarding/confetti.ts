import confetti from 'canvas-confetti'

/**
 * Fire a short celebratory confetti burst.
 * Called when the user completes onboarding.
 * Safe to call in a browser-only context (useEffect / click handler).
 */
export function fireConfetti(): void {
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
