/**
 * Vektrum domain types.
 * These mirror the Supabase database schema and are used throughout the API layer.
 */

// ─── Role & Status Enums ──────────────────────────────────────────────────────

export type UserRole = 'contractor' | 'funder' | 'admin'

export type DealStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'cancelled'

export type MilestoneStatus =
  | 'not_started'
  | 'in_progress'
  | 'ready_for_review'
  | 'approved'
  | 'released'

export type MilestoneProtectionStatus =
  | 'pending'
  | 'funded'
  | 'ready_for_release'
  | 'released'

export type ChangeOrderStatus = 'submitted' | 'approved' | 'rejected'

// ─── Database Row Shapes ──────────────────────────────────────────────────────

export interface Profile {
  id: string
  user_id: string
  role: UserRole
  full_name: string | null
  email: string
  stripe_account_id: string | null
  stripe_payouts_enabled: boolean
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  contractor_id: string
  funder_id: string | null
  title: string
  description: string | null
  total_amount: number
  funded_amount: number
  released_amount: number
  status: DealStatus
  created_at: string
  updated_at: string
}

export interface Milestone {
  id: string
  deal_id: string
  title: string
  description: string | null
  amount: number
  status: MilestoneStatus
  protection_status: MilestoneProtectionStatus
  order_index: number
  contractor_id: string
  created_at: string
  updated_at: string
}

export interface MilestoneDocument {
  id: string
  milestone_id: string
  uploader_id: string
  file_name: string
  file_url: string
  file_size: number
  mime_type: string
  created_at: string
}

export interface ChangeOrder {
  id: string
  milestone_id: string
  deal_id: string
  requestor_id: string
  amount: number
  description: string
  status: ChangeOrderStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface Release {
  id: string
  milestone_id: string
  deal_id: string
  contractor_id: string
  amount: number
  stripe_transfer_id: string
  idempotency_key: string
  released_by: string
  created_at: string
}

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: string
  actor_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Convenience Types ────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
}

export interface AuthContext {
  user: AuthUser
  profile: Profile
}
