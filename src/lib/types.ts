// ─── Core domain types ───────────────────────────────────────────────────────

export type UserRole = "contractor" | "funder" | "admin";

export type DealStatus =
  | "draft"
  | "active"
  | "completed"
  | "disputed"
  | "cancelled";

export type MilestoneStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_review"
  | "approved"
  | "released"
  | "disputed";

export type ProtectionStatus =
  | "pending_funding"
  | "funded"
  | "ready_for_release"
  | "released"
  | "refunded";

// ─── Database row types ───────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  role: UserRole;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  title: string;
  description: string | null;
  total_amount: number;
  funded_amount: number;
  released_amount: number;
  status: DealStatus;
  contractor_id: string;
  funder_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contractor?: Profile;
  funder?: Profile;
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  deal_id: string;
  title: string;
  description: string | null;
  amount: number;
  status: MilestoneStatus;
  protection_status: ProtectionStatus;
  order_index: number;
  stripe_transfer_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  // Joined
  actor?: Profile;
}

// ─── API request/response shapes ─────────────────────────────────────────────

export interface CreateDealPayload {
  title: string;
  description?: string;
  total_amount: number;
}

export interface CreateMilestonePayload {
  deal_id: string;
  title: string;
  description?: string;
  amount: number;
}

export interface UpdateMilestoneStatusPayload {
  milestone_id: string;
  status: MilestoneStatus;
}

export interface ApiError {
  error: string;
  details?: string;
}

// ─── Release gate ─────────────────────────────────────────────────────────────

export interface ReleaseGateResult {
  can_release: boolean;
  blockers: string[];
}

export type ChangeOrderStatus = 'pending' | 'approved' | 'rejected'
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated'
export type ReleaseStatus = 'completed' | 'failed'
