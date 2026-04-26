export const BOOK_CALL_URL =
  process.env.NEXT_PUBLIC_BOOK_CALL_URL ?? '/contact'

export const BOOK_CALL_EXTERNAL = BOOK_CALL_URL.startsWith('http')
