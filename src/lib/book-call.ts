// Single source of truth for the public "Book a call" / "Schedule a call" /
// "Talk to us" CTA destination.
//
// Default: the live Cal.com booking page. Override via NEXT_PUBLIC_BOOK_CALL_URL
// for staging/preview environments that should not point at production booking.
//
// BOOK_CALL_EXTERNAL is true when the URL begins with http(s) — call sites use
// it to conditionally apply target="_blank" + rel="noopener noreferrer".
export const BOOK_CALL_URL =
  process.env.NEXT_PUBLIC_BOOK_CALL_URL ?? 'https://cal.com/vektrum'

export const BOOK_CALL_EXTERNAL = BOOK_CALL_URL.startsWith('http')
