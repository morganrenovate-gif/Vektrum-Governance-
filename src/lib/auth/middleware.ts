import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { forbiddenError, unauthorizedError } from '@/lib/errors'
import type { AuthContext, Profile, UserRole } from '@/lib/types'

// ─── Auth Extraction ──────────────────────────────────────────────────────────

/**
 * Extracts the Supabase session from the incoming request's cookies.
 * Returns the authenticated user plus their profile row (which includes the role).
 *
 * Throws a 401 NextResponse if no valid session exists.
 * Throws a 401 NextResponse if the profile record cannot be found.
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
