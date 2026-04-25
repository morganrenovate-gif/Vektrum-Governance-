/**
 * Application-level rate limiting for Vektrum API endpoints.
 *
 * Uses Supabase (via the check_rate_limit() Postgres function) as the backing
 * store so counters aggregate correctly across Vercel serverless instances.
 *
 * Algorithm: fixed-window counter. Each (key, window_start) pair has an integer
 * counter incremented atomically by the DB. No sliding-window smoothing — the
 * fixed window is intentional: simple, predictable, and sufficient for the
 * threat model (burst protection and AI cost caps).
 *
 * FAIL-OPEN POLICY
 * ----------------
 * If the DB call fails, the request is ALLOWED. Rate limiting is best-effort
 * infrastructure hardening. Authentication, authorisation, and business-logic
 * validation remain the primary security controls and always run regardless of
 * rate-limit state. A DB outage that disables rate limiting does not disable
 * those controls.
 *
 * VIOLATION LOGGING
 * -----------------
 * All blocks write to console.warn for ops visibility.
 * When the counter reaches 3× the limit (persistent violator pattern), an
 * audit_log entry with action='rate_limit_violation' is written fire-and-forget.
 */

import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/engine/audit'

// ─── Policy definitions ───────────────────────────────────────────────────────

export interface RateLimitPolicy {
  /** Window size in seconds. */
  windowSeconds: number
  /** Maximum number of requests allowed per window. */
  maxRequests: number
  /** Human-readable description used in 429 error messages. */
  description: string
}

/**
 * Named policies for each class of endpoint.
 *
 * All limits can be overridden in production without a deployment via
 * environment variables (see PRODUCTION CONFIGURATION in README / docs).
 *
 * Environment variables (all optional — defaults shown):
 *   RATE_LIMIT_FINANCIAL_WRITE_MAX   default 5   window 60s
 *   RATE_LIMIT_ADMIN_WRITE_MAX       default 20  window 60s
 *   RATE_LIMIT_PARTNER_API_MAX       default 60  window 60s
 *   RATE_LIMIT_AI_ANALYSIS_MAX       default 10  window 3600s
 *   RATE_LIMIT_AI_DRAW_REVIEW_MAX    default 15  window 300s
 *   RATE_LIMIT_DEAL_FUND_MAX         default 5   window 300s
 *   RATE_LIMIT_CRON_MAX              default 3   window 60s
 */
export const POLICIES = {
  /**
   * Strict: Stripe milestone releases, external authorisations, external
   * confirmations, and external-failed marks.
   * Default: 5 per 60 s per user. Prevents rapid-fire release attempts that
   * would amplify DB load across all 5+ gate queries per attempt.
   */
  financial_write: {
    windowSeconds: 60,
    maxRequests:   parseInt(process.env.RATE_LIMIT_FINANCIAL_WRITE_MAX ?? '5', 10),
    description:   'financial write operations',
  },

  /**
   * Strict: Admin API write operations (invite, promote, unfreeze, AI override,
   * subscription tier change, partner management, reconciliation).
   * Default: 20 per 60 s per admin user.
   */
  admin_write: {
    windowSeconds: 60,
    maxRequests:   parseInt(process.env.RATE_LIMIT_ADMIN_WRITE_MAX ?? '20', 10),
    description:   'admin operations',
  },

  /**
   * Moderate: Partner API calls authenticated by API key.
   * Default: 60 per 60 s per partner ID. Partners may execute releases in
   * batch but should not be able to saturate the deal reservation system.
   */
  partner_api: {
    windowSeconds: 60,
    maxRequests:   parseInt(process.env.RATE_LIMIT_PARTNER_API_MAX ?? '60', 10),
    description:   'partner API calls',
  },

  /**
   * Strict cost-protection: POST /api/analyze-contract.
   * Each call parses a PDF and sends ~15k tokens to an AI provider.
   * Default: 10 per hour per user.
   */
  ai_analysis: {
    windowSeconds: 3600,
    maxRequests:   parseInt(process.env.RATE_LIMIT_AI_ANALYSIS_MAX ?? '10', 10),
    description:   'AI contract analysis',
  },

  /**
   * Strict cost-protection: POST /api/ai/draw-review.
   * Each call invokes a multi-provider AI chain.
   * Default: 15 per 5 minutes per user.
   */
  ai_draw_review: {
    windowSeconds: 300,
    maxRequests:   parseInt(process.env.RATE_LIMIT_AI_DRAW_REVIEW_MAX ?? '15', 10),
    description:   'AI draw review',
  },

  /**
   * Strict: POST /api/deals/[dealId]/fund — initiates a Stripe PaymentIntent.
   * Default: 5 per 5 minutes per user. Prevents payment-intent flooding.
   */
  deal_fund: {
    windowSeconds: 300,
    maxRequests:   parseInt(process.env.RATE_LIMIT_DEAL_FUND_MAX ?? '5', 10),
    description:   'deal funding',
  },

  /**
   * Safety cap: POST /api/cron/reconcile.
   * Token-protected by Vercel CRON_SECRET; rate limit is a secondary defence.
   * Default: 3 per 60 s (Vercel invokes once per hour; allows 3 manual runs).
   */
  cron: {
    windowSeconds: 60,
    maxRequests:   parseInt(process.env.RATE_LIMIT_CRON_MAX ?? '3', 10),
    description:   'cron endpoint invocation',
  },
} as const satisfies Record<string, RateLimitPolicy>

export type PolicyName = keyof typeof POLICIES

// ─── Result ───────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed:      boolean
  currentCount: number
  limit:        number
  /** ISO timestamp when the current window resets. */
  resetAt:      string
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Atomically checks and increments a rate limit bucket.
 *
 * Key conventions:
 *   `user:{userId}:{policyName}`        — authenticated user
 *   `partner:{partnerId}:{policyName}`  — partner API key holder
 *   `ip:{ip}:{policyName}`              — IP-keyed (cron, unauthenticated)
 *
 * Fail-open: on any DB error, returns `allowed: true` and logs to console.
 * The request proceeds; auth and validation guards are unaffected.
 */
export async function checkRateLimit(
  key:    string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  try {
    const admin = createSupabaseAdminClient()

    const { data, error } = await admin.rpc('check_rate_limit', {
      p_key:            key,
      p_window_seconds: policy.windowSeconds,
      p_limit:          policy.maxRequests,
    })

    if (error) {
      console.error('[rate-limit] check_rate_limit RPC error — fail-open:', error.message, { key })
      return _failOpen(policy)
    }

    // RPC returns a single-row TABLE result; Supabase JS wraps it as an array.
    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      console.error('[rate-limit] check_rate_limit returned no row — fail-open', { key })
      return _failOpen(policy)
    }

    return {
      allowed:      row.allowed       as boolean,
      currentCount: row.current_count as number,
      limit:        row.limit_val     as number,
      resetAt:      row.reset_at      as string,
    }
  } catch (err) {
    console.error('[rate-limit] unexpected error — fail-open:', err, { key })
    return _failOpen(policy)
  }
}

function _failOpen(policy: RateLimitPolicy): RateLimitResult {
  return {
    allowed:      true,
    currentCount: 0,
    limit:        policy.maxRequests,
    resetAt:      new Date(Date.now() + policy.windowSeconds * 1000).toISOString(),
  }
}

// ─── Violation logging ────────────────────────────────────────────────────────

/**
 * Must be called when checkRateLimit returns allowed=false.
 *
 * Always logs to console.warn (ops visibility, searchable in Vercel logs).
 * At 3× the limit (persistent violator), also writes an audit_log entry
 * fire-and-forget to avoid adding latency to the 429 response.
 */
export function logRateLimitViolation(
  key:    string,
  result: RateLimitResult,
  ctx: {
    actorId:    string | null   // user.id or partnerId or null for IP-keyed
    policyName: string
    /** entity_type for the audit log — typically 'milestone', 'deal', etc. */
    entityType: string
    /** entity_id for the audit log — the resource being acted on */
    entityId:   string
  },
): void {
  const excess = result.currentCount - result.limit

  console.warn(
    `[rate-limit] BLOCKED key=${key} count=${result.currentCount}/${result.limit} ` +
    `excess=${excess} reset=${result.resetAt} actor=${ctx.actorId ?? 'ip'} policy=${ctx.policyName}`,
  )

  // Write an audit entry only at 3× to avoid log spam from accidental double-clicks.
  // 3× = "this actor is clearly looping, not clicking twice by mistake."
  if (result.currentCount >= result.limit * 3 && ctx.actorId) {
    logAudit({
      entity_type: ctx.entityType as Parameters<typeof logAudit>[0]['entity_type'],
      entity_id:   ctx.entityId,
      action:      'rate_limit_violation',
      actor_id:    ctx.actorId,
      old_values:  null,
      new_values:  null,
      metadata: {
        rate_limit_key:  key,
        policy:          ctx.policyName,
        request_count:   result.currentCount,
        limit:           result.limit,
        reset_at:        result.resetAt,
        excess_requests: excess,
      },
    }).catch(err => console.error('[rate-limit] violation audit write failed:', err))
  }
}

// ─── 429 response ─────────────────────────────────────────────────────────────

/**
 * Builds a standard 429 Too Many Requests response with RFC-7231 headers.
 *
 *   Retry-After          — seconds until window reset (integer)
 *   X-RateLimit-Limit    — requests allowed per window
 *   X-RateLimit-Remaining — always 0 (already exceeded)
 *   X-RateLimit-Reset    — ISO timestamp of window reset
 */
export function rateLimitResponse(
  result:      RateLimitResult,
  description: string,
): NextResponse {
  const retryAfter = Math.max(
    1,
    Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000),
  )

  return NextResponse.json(
    {
      error:       `Too many requests. You have exceeded the rate limit for ${description}. Please wait and try again.`,
      code:        'RATE_LIMITED',
      retry_after: retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After':           String(retryAfter),
        'X-RateLimit-Limit':     String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset':     result.resetAt,
      },
    },
  )
}

// ─── IP extraction ────────────────────────────────────────────────────────────

/**
 * Extracts the real client IP from standard proxy headers.
 * Prefer the first entry of X-Forwarded-For (set by Vercel/load balancers).
 * Returns 'unknown' if no IP header is present.
 *
 * WARNING: X-Forwarded-For can be spoofed by clients if your load balancer
 * does not strip or override it. On Vercel, this is set by Vercel's edge
 * network and cannot be forged by end-users. On other platforms, verify that
 * the header is trustworthy before using it as a rate-limit key.
 */
export function getRequestIp(request: Request): string {
  const h = request.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip')                              ??
    h.get('cf-connecting-ip')                       ??   // Cloudflare
    'unknown'
  )
}
