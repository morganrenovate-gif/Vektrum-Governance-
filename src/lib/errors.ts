import { NextResponse } from 'next/server'

/**
 * Returns a structured JSON error response.
 * Every error message must be explicit and actionable — no generic "Invalid request" messages.
 */
export function errorResponse(
  status: number,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...(details !== undefined && { details }),
    },
    { status },
  )
}

/**
 * 400 — One or more validation rules failed.
 * Returns the full list of human-readable errors so the client can surface them all at once.
 */
export function validationError(errors: string[]): NextResponse {
  return NextResponse.json(
    {
      error:
        'Your request could not be processed because one or more validation checks failed. Review the errors below and correct them before resubmitting.',
      errors,
    },
    { status: 400 },
  )
}

/**
 * 401 — No valid session found. The caller must authenticate before retrying.
 */
export function unauthorizedError(
  message = 'You must be signed in to perform this action. Please log in and try again.',
): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

/**
 * 403 — The caller is authenticated but lacks the required role or permission.
 * The message must explain what role or condition is required.
 */
export function forbiddenError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}

/**
 * 404 — The requested resource does not exist or the caller does not have access to it.
 */
export function notFoundError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}

/**
 * 409 — A conflict prevented the request from completing (e.g. duplicate release).
 */
export function conflictError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 })
}

/**
 * 500 — An unexpected server-side error occurred.
 * The optional detail is logged server-side only — never returned to the client.
 */
export function internalError(
  message: string,
  detail?: string,
): NextResponse {
  if (detail) {
    console.error('[internalError]', message, detail)
  }
  return NextResponse.json(
    {
      error: message,
    },
    { status: 500 },
  )
}
