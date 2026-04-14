/**
 * Vektrum — Database Type Definitions
 *
 * Hand-authored TypeScript types matching the Supabase schema defined in
 * 001_schema.sql. These types are used to parameterise the Supabase client
 * (createServerClient<Database>, createBrowserClient<Database>, etc.) so that
 * every query is fully type-safe without code generation.
 *
 * Structure:
 *   - SQL enum unions
 *   - Individual Row interfaces (shape of a row as returned by SELECT)
 *   - Insert types (required fields only; defaults omitted/optional)
 *   - Update types (all fields optional; id/created_at never updated)
 *   - Database interface (wires everything into the Supabase client generic)
 */

// =============================================================================
// ENUM TYPES — mirror the SQL CREATE TYPE ... AS ENUM definitions
// =============================================================================

/** Roles a user can hold in the platform. */
export type UserRole = 'contractor' | 'funder' | 'admin'

/** Lifecycle states of a deal. */
export type DealStatus =
  | 'draft'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'disputed'
  | 'cancelled'

/** Workflow states of an individual milestone. */
export type MilestoneStatus =
  | 'not_started'
  | 'in_progress'
  | 'ready_for_review'
  | 'approved'
  | 'released'

/** Payment protection states of a milestone. */
export type ProtectionStatus =
  | 'pending'
  | 'ready_for_release'
  | 'released'
  | 'disputed'

/** Lifecycle states of a change order. */
export type ChangeOrderStatus = 'submitted' | 'approved' | 'rejected' | 'paid'

/** Resolution states of a dispute. */
export type DisputeStatus = 'open' | 'resolved' | 'escalated'

/** Entity types recorded in the audit log. */
export type AuditEntityType =
  | 'deal'
  | 'milestone'
  | 'release'
  | 'change_order'
  | 'dispute'

/** Actions recorded in the audit log. */
export type AuditAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'released'
  | 'approved'
  | 'rejected'
  | 'funded'


// =============================================================================
// ROW TYPES — shape of a full row as returned from the database
// =============================================================================

/**
 * profiles
 * Extends auth.users. Created automatically when a new user signs up.
 */
export interface ProfileRow {
  /** UUID — references auth.users(id). */
  id: string
  role: UserRole
  full_name: string | null
  company_name: string | null
  /** Stripe Connect account ID. Set for contractors once onboarding is done. */
  stripe_account_id: string | null
  /** True when Stripe has enabled payouts for this contractor. */
  stripe_payouts_enabled: boolean
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

/**
 * deals
 * An escrow deal linking a contractor to a funder.
 */
export interface DealRow {
  id: string
  contractor_id: string
  /** Nullable until a funder accepts/funds the deal. */
  funder_id: string | null
  title: string
  description: string | null
  /** Total deal value in dollars (numeric(12,2)). */
  total_amount: number
  /** Amount funded into escrow so far. funded_amount <= total_amount. */
  funded_amount: number
  /** Amount released to the contractor so far. released_amount <= funded_amount. */
  released_amount: number
  status: DealStatus
  created_at: string
  updated_at: string
}

/**
 * milestones
 * An ordered work phase within a deal, each carrying its own escrow amount.
 */
export interface MilestoneRow {
  id: string
  deal_id: string
  title: string
  description: string | null
  amount: number
  /** Zero-based ordering integer. Unique within a deal. */
  position: number
  status: MilestoneStatus
  protection_status: ProtectionStatus
  created_at: string
  updated_at: string
}

/**
 * milestone_documents
 * Evidence files (photos, PDFs, change orders) uploaded to a milestone.
 */
export interface MilestoneDocumentRow {
  id: string
  milestone_id: string
  uploaded_by: string
  file_url: string
  /** Broad category: 'photo' | 'document' | 'change_order'. */
  file_type: string | null
  description: string | null
  created_at: string
}

/**
 * change_orders
 * A formal request to adjust a milestone amount.
 */
export interface ChangeOrderRow {
  id: string
  milestone_id: string
  deal_id: string
  /** Dollar amount of the change (may be positive or negative). */
  amount: number
  description: string
  status: ChangeOrderStatus
  submitted_by: string
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

/**
 * disputes
 * A formal dispute raised against a milestone payment.
 */
export interface DisputeRow {
  id: string
  milestone_id: string
  deal_id: string
  amount_in_dispute: number
  reason: string
  status: DisputeStatus
  opened_by: string
  resolved_by: string | null
  resolution: string | null
  opened_at: string
  resolved_at: string | null
}

/**
 * releases
 * Immutable record of a payment release transferred via Stripe.
 * No UPDATE or DELETE is ever permitted on this table.
 */
export interface ReleaseRow {
  id: string
  /** Unique per milestone — only one release is allowed per milestone. */
  milestone_id: string
  deal_id: string
  amount: number
  stripe_transfer_id: string | null
  /** Client-generated UUID used to prevent duplicate Stripe transfers. */
  idempotency_key: string
  released_at: string
  released_by: string
  created_at: string
}

/**
 * audit_log
 * Append-only event log. No UPDATE or DELETE is ever permitted.
 */
export interface AuditLogRow {
  id: string
  entity_type: AuditEntityType
  entity_id: string
  action: AuditAction
  /** The auth.users UUID of the user who caused the event. May be null for system events. */
  actor_id: string | null
  /** JSON snapshot of the row before the change (null for inserts). */
  old_values: Record<string, unknown> | null
  /** JSON snapshot of the row after the change. */
  new_values: Record<string, unknown> | null
  /** Additional context (e.g. trigger name, Stripe event ID). */
  metadata: Record<string, unknown> | null
  created_at: string
}


// =============================================================================
// INSERT TYPES — fields required/optional when inserting a new row.
// Fields with database-level defaults (id, timestamps, etc.) are optional.
// =============================================================================

export interface ProfileInsert {
  /** Must match the auth.users UUID that was just created. */
  id: string
  role?: UserRole
  full_name?: string | null
  company_name?: string | null
  stripe_account_id?: string | null
  stripe_payouts_enabled?: boolean
  onboarding_complete?: boolean
}

export interface DealInsert {
  contractor_id: string
  funder_id?: string | null
  title: string
  description?: string | null
  total_amount: number
  funded_amount?: number
  released_amount?: number
  status?: DealStatus
}

export interface MilestoneInsert {
  deal_id: string
  title: string
  description?: string | null
  amount: number
  position: number
  status?: MilestoneStatus
  protection_status?: ProtectionStatus
}

export interface MilestoneDocumentInsert {
  milestone_id: string
  uploaded_by: string
  file_url: string
  file_type?: string | null
  description?: string | null
}

export interface ChangeOrderInsert {
  milestone_id: string
  deal_id: string
  amount: number
  description: string
  status?: ChangeOrderStatus
  submitted_by: string
  approved_by?: string | null
  approved_at?: string | null
}

export interface DisputeInsert {
  milestone_id: string
  deal_id: string
  amount_in_dispute: number
  reason: string
  status?: DisputeStatus
  opened_by: string
  resolved_by?: string | null
  resolution?: string | null
  opened_at?: string
  resolved_at?: string | null
}

export interface ReleaseInsert {
  milestone_id: string
  deal_id: string
  amount: number
  stripe_transfer_id?: string | null
  /** Must be globally unique. Generate with crypto.randomUUID(). */
  idempotency_key: string
  released_by: string
  released_at?: string
}

export interface AuditLogInsert {
  entity_type: AuditEntityType
  entity_id: string
  action: AuditAction
  actor_id?: string | null
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}


// =============================================================================
// UPDATE TYPES — all user-editable fields optional; primary key / created_at
// are never updated.
// releases and audit_log intentionally have NO update type (immutable).
// =============================================================================

export interface ProfileUpdate {
  /** Role is excluded — role changes must use a privileged server operation. */
  full_name?: string | null
  company_name?: string | null
  stripe_account_id?: string | null
  stripe_payouts_enabled?: boolean
  onboarding_complete?: boolean
}

export interface DealUpdate {
  funder_id?: string | null
  title?: string
  description?: string | null
  total_amount?: number
  funded_amount?: number
  released_amount?: number
  status?: DealStatus
}

export interface MilestoneUpdate {
  title?: string
  description?: string | null
  amount?: number
  position?: number
  status?: MilestoneStatus
  protection_status?: ProtectionStatus
}

export interface MilestoneDocumentUpdate {
  file_url?: string
  file_type?: string | null
  description?: string | null
}

export interface ChangeOrderUpdate {
  amount?: number
  description?: string
  status?: ChangeOrderStatus
  approved_by?: string | null
  approved_at?: string | null
}

export interface DisputeUpdate {
  status?: DisputeStatus
  resolved_by?: string | null
  resolution?: string | null
  resolved_at?: string | null
}

// ReleaseUpdate — intentionally omitted. Releases are immutable.
// AuditLogUpdate — intentionally omitted. Audit log is immutable.


// =============================================================================
// DATABASE INTERFACE
// Wires all Row/Insert/Update types into the Supabase client generic so that
// createServerClient<Database>, createBrowserClient<Database>, etc. are fully
// type-safe without needing any code generation.
// =============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      deals: {
        Row: DealRow
        Insert: DealInsert
        Update: DealUpdate
      }
      milestones: {
        Row: MilestoneRow
        Insert: MilestoneInsert
        Update: MilestoneUpdate
      }
      milestone_documents: {
        Row: MilestoneDocumentRow
        Insert: MilestoneDocumentInsert
        Update: MilestoneDocumentUpdate
      }
      change_orders: {
        Row: ChangeOrderRow
        Insert: ChangeOrderInsert
        Update: ChangeOrderUpdate
      }
      disputes: {
        Row: DisputeRow
        Insert: DisputeInsert
        Update: DisputeUpdate
      }
      releases: {
        Row: ReleaseRow
        Insert: ReleaseInsert
        // No Update type — releases are immutable
        Update: never
      }
      audit_log: {
        Row: AuditLogRow
        Insert: AuditLogInsert
        // No Update type — audit log is immutable
        Update: never
      }
    }
    Views: {
      // No views defined in this migration
      [key: string]: never
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_deal_participant: {
        Args: { p_deal_id: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: UserRole
      deal_status: DealStatus
      milestone_status: MilestoneStatus
      protection_status: ProtectionStatus
      change_order_status: ChangeOrderStatus
      dispute_status: DisputeStatus
    }
    CompositeTypes: {
      // No composite types defined
      [key: string]: never
    }
  }
}

// =============================================================================
// CONVENIENCE RE-EXPORTS
// Shorthand type aliases for common patterns in server and client components.
// =============================================================================

/** A fully-typed Supabase client parameterised with the Vektrum Database schema. */
export type { Database }
