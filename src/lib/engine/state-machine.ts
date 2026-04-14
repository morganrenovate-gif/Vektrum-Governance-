import type { MilestoneStatus, UserRole } from '@/lib/types'

// ─── Transition Map ───────────────────────────────────────────────────────────

/**
 * Defines every legal state transition for a milestone.
 *
 * 'system' is a reserved pseudo-role used for transitions that can only be
 * triggered programmatically (e.g. the release endpoint), never directly
 * by a human user calling the transition endpoint.
 */
export const VALID_TRANSITIONS: Record<
  MilestoneStatus,
  { next: MilestoneStatus; requiredRole: UserRole | 'system' }[]
> = {
  not_started: [
    {
      next: 'in_progress',
      requiredRole: 'contractor',
    },
  ],
  in_progress: [
    {
      next: 'ready_for_review',
      requiredRole: 'contractor',
    },
  ],
  ready_for_review: [
    {
      next: 'approved',
      requiredRole: 'funder',
    },
    {
      // Funder sends work back to the contractor with changes requested
      next: 'in_progress',
      requiredRole: 'funder',
    },
  ],
  approved: [
    {
      // System-only: triggered by the release endpoint after validateRelease passes
      next: 'released',
      requiredRole: 'system',
    },
  ],
  released: [
    // Terminal state — no further transitions are possible
  ],
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface TransitionResult {
  valid: boolean
  error?: string
}

/**
 * Validates whether a milestone status transition is permitted for the given
 * user role.
 *
 * Returns { valid: true } if the transition is allowed.
 * Returns { valid: false, error: "..." } with a human-readable explanation
 * if the transition is not permitted, including guidance on what to do next.
 *
 * @param currentStatus - The milestone's current status.
 * @param newStatus     - The requested destination status.
 * @param userRole      - The role of the user attempting the transition.
 *                        Pass 'system' only from trusted server-side release logic.
 */
export function validateTransition(
  currentStatus: MilestoneStatus,
  newStatus: MilestoneStatus,
  userRole: UserRole | 'system',
): TransitionResult {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus]

  // Is the requested destination status ever reachable from the current state?
  const matchingTransition = allowedTransitions.find(
    (t) => t.next === newStatus,
  )

  if (!matchingTransition) {
    // Build a helpful list of what IS possible from here
    const possibleNext = allowedTransitions.map((t) => `'${t.next}'`).join(', ')

    if (currentStatus === 'released') {
      return {
        valid: false,
        error: `This milestone has already been released and is in a terminal state. No further status changes are possible.`,
      }
    }

    if (allowedTransitions.length === 0) {
      return {
        valid: false,
        error: `Milestone status '${currentStatus}' is a terminal state and cannot be changed.`,
      }
    }

    return {
      valid: false,
      error:
        `Cannot transition a milestone from '${currentStatus}' to '${newStatus}'. ` +
        `From '${currentStatus}', the only valid next ${allowedTransitions.length === 1 ? 'status is' : 'statuses are'}: ${possibleNext}.`,
    }
  }

  // The transition path exists — now check if this caller's role is allowed to trigger it
  const { requiredRole } = matchingTransition

  if (requiredRole === 'system') {
    // The 'approved' → 'released' transition is reserved for the internal release endpoint.
    // No user role may directly trigger it via the transition API.
    return {
      valid: false,
      error: `The transition from '${currentStatus}' to '${newStatus}' is reserved for the system release process. ` +
        `To release funds for an approved milestone, use the dedicated release endpoint instead.`,
    }
  }

  if (userRole !== requiredRole && userRole !== 'admin') {
    const roleLabel = requiredRole.charAt(0).toUpperCase() + requiredRole.slice(1)
    return {
      valid: false,
      error:
        `Only a ${roleLabel} can move a milestone from '${currentStatus}' to '${newStatus}'. ` +
        `Your account role is '${userRole}'. If you believe this is incorrect, contact your account administrator.`,
    }
  }

  return { valid: true }
}
