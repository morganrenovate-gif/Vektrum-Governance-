import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { forbiddenError, unauthorizedError } from '@/lib/errors'
import type { AuthContext, Profile, UserRole } from '@/lib/types'
import { logAdminAudit, type AdminAuditParams } from '@/lib/engine/audit'

// ─── Auth Extraction ──────────────────────────────────────────────────────────

/**
 * Extracts the Supabase session from the incoming request's cookies.
 * Returns the authenticated user plus their profile row (which includes the role).
 *
 * Throws a 401 NextResponse if no valid session exists.
 * Throws a 401 NextResponse if the profile record cannot be found.
 *
 * AUDIT LOG NOTE:
 * This function does NOT log authentication events. It is called on every
 * authenticated API request — logging here would produce one 'user_login'
 * audit entry per request, creating massive noise (hundreds of entries per
 * session) and adding a DB write to every API call.
 *
 * Authentication events are captured at the correct points:
 *   - Sign-in via email link:  src/app/auth/callback/route.ts (action: 'user_login')
 *   - Sign-in / password events: src/app/api/auth/webhook/route.ts
 *     (configure a Supabase Database Webhook on auth.users → POST to /api/auth/webhook)
 */
export async function getAuthUser(request: NextRequest): Promise<AuthContext> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Read-only in middleware context — session mutation is handled by the SSR middleware
        },
      },
    },
  )

  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser()

  if (sessionError || !user) {
    throw unauthorizedError(
      'Your session has expired or is invalid. Please sign in again to continue.',
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw unauthorizedError(
      'Your user profile could not be found. If this problem persists, contact support.',
    )
  }

  return {
    user: { id: user.id, email: user.email ?? '' },
    profile: profile as Profile,
  }
}

// ─── Role Guard ───────────────────────────────────────────────────────────────

/**
 * Asserts that the caller's profile.role is one of the allowed roles.
 *
 * Throws a 403 NextResponse with a human-readable explanation if unauthorized.
 *
 * @param profile       - The caller's profile object returned by getAuthUser.
 * @param allowedRoles  - One or more roles that may perform this action.
 */
export function requireRole(profile: Profile, ...allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(profile.role)) {
    const roleList = allowedRoles
      .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
      .join(' or ')

    throw forbiddenError(
      `This action requires the ${roleList} role. Your account is registered as a ${profile.role}. ` +
        `If you believe this is incorrect, contact your account administrator.`,
    )
  }
}

// ─── MFA Assurance Guard ──────────────────────────────────────────────────────

/**
 * Asserts that the session has reached Authentication Assurance Level 2 (AAL2)
 * for roles that require MFA.
 *
 * REQUIRED ROLES: 'funder' and 'admin'. Contractors are exempt (they receive
 * disbursements but do not authorize them).
 *
 * THROWS:
 *   403 NextResponse — if the role requires MFA and the session is only AAL1.
 *   The response body includes a machine-readable `mfa_required: true` field
 *   so the frontend can redirect to /auth/mfa/verify automatically.
 *
 * AAL SEMANTICS (from Supabase docs):
 *   aal1 + nextLevel aal2 → user has enrolled MFA but not verified this session
 *   aal2               → user has verified MFA this session ✓
 *   aal1 + nextLevel aal1 → user has no MFA enrolled
 *
 * For funders/admins with no MFA enrolled: this function throws 403 with
 * `mfa_required: true` and `mfa_enrolled: false` so the caller can redirect
 * to the enrollment page rather than the verify page.
 *
 * @param supabase  - Supabase server client from the request context
 * @param profile   - The caller's profile (contains role)
 */
export async function requireMFA(
  supabase: ReturnType<typeof createServerClient>,
  profile: Profile,
): Promise<void> {
  const MFA_REQUIRED_ROLES: UserRole[] = ['funder', 'admin']

  // Contractors are exempt — they receive payments but do not authorize them
  if (!MFA_REQUIRED_ROLES.includes(profile.role)) return

  const { data: aalData, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

  if (error || !aalData) {
    // If we can't determine AAL, fail closed: deny access
    throw NextResponse.json(
      {
        error:        'Could not verify multi-factor authentication status. Please sign in again.',
        mfa_required: true,
        mfa_error:    true,
      },
      { status: 403 },
    )
  }

  const { currentLevel, nextLevel } = aalData

  // AAL2 — fully verified: allow through
  if (currentLevel === 'aal2') return

  // AAL1 with next=AAL2 — enrolled but not yet verified this session
  if (currentLevel === 'aal1' && nextLevel === 'aal2') {
    throw NextResponse.json(
      {
        error:        'Multi-factor authentication is required for this action. Please verify your authenticator code.',
        mfa_required: true,
        mfa_enrolled: true,
        redirect:     '/auth/mfa/verify',
      },
      { status: 403 },
    )
  }

  // AAL1 with next=AAL1 — no MFA enrolled at all
  throw NextResponse.json(
    {
      error:        'Your account requires multi-factor authentication. Please enroll an authenticator app before accessing this feature.',
      mfa_required: true,
      mfa_enrolled: false,
      redirect:     '/auth/mfa/enroll',
    },
    { status: 403 },
  )
}

// ─── Deal Access Guard ────────────────────────────────────────────────────────

/**
 * Verifies that the authenticated user is a participant on the specified deal —
 * either as the contractor, the funder, or a platform admin.
 *
 * Throws a 403 NextResponse if the user has no association with the deal.
 * Throws a 404-style 403 if the deal does not exist, to avoid leaking deal IDs.
 *
 * @param supabase  - Supabase client initialized from the request cookies.
 * @param dealId    - The deal UUID to check access for.
 * @param userId    - The authenticated user's ID (from auth.users).
 * @param role      - The user's platform role.
 */
export async function requireDealAccess(
  supabase: ReturnType<typeof createServerClient>,
  dealId: string,
  userId: string,
  role: UserRole,
): Promise<void> {
  // Admins have global access to all deals
  if (role === 'admin') return

  const { data: deal, error } = await supabase
    .from('deals')
    .select('id, contractor_id, funder_id')
    .eq('id', dealId)
    .single()

  if (error || !deal) {
    throw forbiddenError(
      `Deal ${dealId} was not found or you do not have permission to access it. ` +
        `Only the contractor, funder, and platform administrators can view or modify a deal.`,
    )
  }

  const isContractor = deal.contractor_id === userId
  const isFunder = deal.funder_id === userId

  if (!isContractor && !isFunder) {
    throw forbiddenError(
      `You are not a participant on deal ${dealId}. ` +
        `Access is restricted to the deal's contractor, funder, and platform administrators.`,
    )
  }
}

// ─── Admin Justification Validation ──────────────────────────────────────────

const ADMIN_JUSTIFICATION_MIN_CHARS = 20

/**
 * Extracts and validates the admin justification from a request.
 *
 * Checks the X-Admin-Justification header first, then falls back to the
 * `admin_justification` field on an already-parsed body object.
 *
 * Returns the trimmed justification string, or throws a 400 NextResponse
 * if it is missing or under ADMIN_JUSTIFICATION_MIN_CHARS characters.
 *
 * @param request     - The incoming Next.js request (header source).
 * @param parsedBody  - Optional already-parsed request body (body source).
 */
export function extractAdminJustification(
  request: NextRequest,
  parsedBody?: Record<string, unknown> | null,
): string {
  const fromHeader = request.headers.get('x-admin-justification')?.trim()
  const fromBody   = typeof parsedBody?.admin_justification === 'string'
    ? parsedBody.admin_justification.trim()
    : undefined

  const justification = fromHeader ?? fromBody ?? ''

  if (!justification) {
    throw NextResponse.json(
      {
        error:
          'Admin actions require a justification. ' +
          `Pass admin_justification (≥ ${ADMIN_JUSTIFICATION_MIN_CHARS} characters) ` +
          'in the request body or the X-Admin-Justification header.',
      },
      { status: 400 },
    )
  }

  if (justification.length < ADMIN_JUSTIFICATION_MIN_CHARS) {
    throw NextResponse.json(
      {
        error:
          `Admin justification must be at least ${ADMIN_JUSTIFICATION_MIN_CHARS} characters ` +
          `(received ${justification.length}).`,
      },
      { status: 400 },
    )
  }

  return justification
}

// ─── Admin Audit Guard ────────────────────────────────────────────────────────

/**
 * Parameters for requireAdminAudit, beyond justification.
 * Maps to AdminAuditParams minus admin_justification (handled separately).
 */
export interface AdminAuditContext {
  action:                  string
  entityType:              string
  entityId:                string
  systemSource:            string
  authorizationReference?: string | null
  ipAddress?:              string | null
  sessionId?:              string | null
  oldValues?:              Record<string, unknown> | null
  newValues?:              Record<string, unknown> | null
  metadata?:               Record<string, unknown> | null
}

/**
 * Validates the admin justification and writes to both audit_log and
 * admin_audit_log as a fire-and-forget dual-write.
 *
 * Call this AFTER parsing the request body and AFTER role / MFA checks pass.
 * The justification must already be extracted (via extractAdminJustification
 * or manually from the body) and passed in as `justification`.
 *
 * THROWS a 400 NextResponse if justification is absent or too short.
 * Never throws for audit write failures — those are logged to console.error.
 *
 * @param profile        - Authenticated admin's profile.
 * @param user           - Authenticated user (id + email).
 * @param justification  - Pre-extracted justification string.
 * @param ctx            - Audit metadata for the action being performed.
 */
export async function requireAdminAudit(
  profile:       Profile,
  user:          { id: string; email: string },
  justification: string,
  ctx:           AdminAuditContext,
): Promise<void> {
  // Validate length (redundant if caller used extractAdminJustification,
  // but acts as a safe-guard if justification was extracted manually)
  if (!justification || justification.trim().length < ADMIN_JUSTIFICATION_MIN_CHARS) {
    throw NextResponse.json(
      {
        error:
          `Admin justification must be at least ${ADMIN_JUSTIFICATION_MIN_CHARS} characters.`,
      },
      { status: 400 },
    )
  }

  // Dual-write to audit_log + admin_audit_log — fire-and-forget, never throws
  const auditParams: AdminAuditParams = {
    entity_type:             ctx.entityType,
    entity_id:               ctx.entityId,
    action:                  ctx.action,
    actor_id:                user.id,
    actor_role:              profile.role,
    actor_email:             user.email,
    system_source:           ctx.systemSource,
    ip_address:              ctx.ipAddress  ?? null,
    session_id:              ctx.sessionId  ?? null,
    old_values:              ctx.oldValues  ?? null,
    new_values:              ctx.newValues  ?? null,
    metadata:                ctx.metadata   ?? null,
    admin_justification:     justification.trim(),
    authorization_reference: ctx.authorizationReference ?? null,
  }

  // Fire-and-forget — audit failures must never block the calling operation
  logAdminAudit(auditParams).catch(err => {
    console.error('[requireAdminAudit] logAdminAudit failed:', err)
  })
}
