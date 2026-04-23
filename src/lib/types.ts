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
  | "disputed"
  | "payout_failed";

export type ProtectionStatus =
  | "pending"
  | "ready_for_release"
  | "released"
  | "disputed";

// ─── Status constants ─────────────────────────────────────────────────────────
// Use these instead of inline string arrays to guard status checks.
// If the DB enum changes, update here and TypeScript will surface every callsite.

export const DEAL_STATUSES: Record<DealStatus, DealStatus> = {
  draft:     "draft",
  active:    "active",
  completed: "completed",
  disputed:  "disputed",
  cancelled: "cancelled",
};

export const MILESTONE_STATUSES: Record<MilestoneStatus, MilestoneStatus> = {
  not_started:      "not_started",
  in_progress:      "in_progress",
  ready_for_review: "ready_for_review",
  approved:         "approved",
  released:         "released",
  disputed:         "disputed",
  payout_failed:    "payout_failed",
};

export const PROTECTION_STATUSES: Record<ProtectionStatus, ProtectionStatus> = {
  pending:           "pending",
  ready_for_release: "ready_for_release",
  released:          "released",
  disputed:          "disputed",
};

// ─── Database row types ───────────────────────────────────────────────────────

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  role: UserRole;
  stripe_account_id: string | null;
  stripe_payouts_enabled: boolean;
  onboarding_complete: boolean;
  /** Billing plan tier. Determines billing_rate_bps written to a deal at funding time. */
  subscription_tier: 'standalone' | 'institutional' | 'enterprise';
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
  /** Cumulative platform fees charged to the funder across all released milestones. */
  fees_collected: number;
  /** Vektrum platform fee rate in basis points. 100 = 1.00%, 70 = 0.70%, 65 = 0.65%. */
  billing_rate_bps: number;
  /** In-flight reserved amount — funds committed to a release but not yet settled. */
  reserved_amount?: number;
  status: DealStatus;
  contractor_id: string;
  funder_id: string | null;
  stripe_payment_intent_id: string | null;
  /**
   * Amount committed by an active Stripe PaymentIntent that has not yet been
   * confirmed by the funder's bank. Incremented by POST /fund at PI creation;
   * decremented on payment_intent.succeeded or payment_intent.payment_failed.
   * Never negative. NOT a substitute for funded_amount.
   */
  funds_pending_amount: number;
  /**
   * True once a payment_intent.succeeded webhook has been processed for this
   * deal. funded_amount is only incremented via the webhook — never in the
   * fund API route. Used by the reconcile pass to identify deals that should
   * have confirmed Stripe PaymentIntent records.
   */
  funds_captured: boolean;

  // ── Governance fee model (null on deals created before migration 004) ────────
  /**
   * Total contract value committed to contractor disbursements.
   * Mirrors total_amount. Null on legacy deals.
   */
  construction_budget?: number | null;
  /**
   * Governance fee rate in basis points applied to this deal.
   * Mirrors billing_rate_bps under governance model terminology.
   * Null on legacy deals.
   */
  governance_fee_bps?: number | null;
  /**
   * Total governance fee for the full deal life.
   * ROUND(construction_budget × governance_fee_bps / 10000, 2).
   * Null on legacy deals.
   */
  governance_fee_total?: number | null;
  /**
   * Total funder funding facility: construction_budget + governance_fee_total.
   * Null on legacy deals.
   */
  facility_total?: number | null;

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
  // ── Core identity ──────────────────────────────────────────────────────────
  /** UUID primary key — unique event identifier */
  id: string;
  /** Monotonic integer assigned at insert time by the DB sequence.
   *  Use this for deterministic ordering when two events share the same
   *  created_at millisecond. Never application-assigned. */
  event_sequence: number;

  // ── What happened ──────────────────────────────────────────────────────────
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;

  // ── When ──────────────────────────────────────────────────────────────────
  /** Server-assigned UTC timestamp (PostgreSQL DEFAULT now()).
   *  Always display as exact UTC — never as relative time ("3 days ago"). */
  created_at: string;

  // ── Who (compliance fields added in migration 016) ─────────────────────────
  actor_id: string | null;
  actor_role: string | null;
  /** Denormalized at write time. Self-contained even if the profile is deleted.
   *  'system' for DB trigger events. 'unknown' as fallback. */
  actor_name: string | null;
  /** Denormalized from auth.users at write time. Null for system/trigger events. */
  actor_email: string | null;

  // ── Where (system source) ──────────────────────────────────────────────────
  /** Code module or DB trigger that generated this event.
   *  Format: 'api/milestones/release', 'webhook/stripe', 'db_trigger/audit_deals' */
  system_source: string | null;
  /** Optional request correlation ID — groups all events from one HTTP request. */
  session_id: string | null;
  /** Client IP, if provided by the caller. Null for system events. */
  ip_address: string | null;

  // ── Joined fields (populated by Supabase foreign-key joins, not DB columns) ─
  /** Populated by join: profiles!audit_log_actor_id_fkey */
  actor?: { full_name: string | null; role?: string | null } | null;
  /** Populated by join on entity_id for system-triggered events (e.g. signups) */
  entity_profile?: { full_name: string | null; role?: string | null } | null;

  // ── Cryptographic integrity (migration 20260424000004) ─────────────────────
  /**
   * SHA-256 hex digest of the row's key fields, computed by the
   * trg_audit_log_hash BEFORE INSERT trigger. NULL for pre-migration rows.
   * Proves the row content has not changed since insertion.
   */
  row_hash: string | null;
  /**
   * SHA-256 of (row_hash || previous row's chain_hash), ordered by
   * event_sequence. Detects retroactive insertion or deletion.
   * NULL for pre-migration rows.
   */
  chain_hash: string | null;
}

// ─── Auth types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthContext {
  user: AuthUser;
  profile: Profile;
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
export type DisputeStatus = 'open' | 'resolved' | 'escalated'
export type ReleaseStatus = 'completed' | 'failed'
export type TransferStatus = 'pending' | 'confirmed' | 'failed' | 'reversed'

export interface Release {
  id: string;
  milestone_id: string;
  deal_id: string;
  amount: number;
  stripe_transfer_id: string | null;
  idempotency_key: string;
  transfer_status: TransferStatus;
  failure_code: string | null;
  failure_message: string | null;
  failed_at: string | null;
  released_at: string;
  released_by: string;
  created_at: string;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

// ─── Contracts ────────────────────────────────────────────────────────────────

export type ContractStatus =
  | 'pending_signatures'
  | 'funder_signed'
  | 'contractor_signed'
  | 'signed'
  | 'voided'

export interface Contract {
  id:                   string;
  deal_id:              string;
  uploaded_by:          string;
  /** Original filename shown in UI */
  document_name:        string;
  document_size_bytes:  number | null;
  /** DocuSign envelope ID. Null if DocuSign is not configured. */
  docusign_envelope_id: string | null;
  /** Time-limited signed URL for the original PDF (generated server-side) */
  document_url:         string | null;
  /** Time-limited signed URL for the final signed PDF (set after completion) */
  signed_document_url:  string | null;
  status:               ContractStatus;
  funder_signed_at:     string | null;
  contractor_signed_at: string | null;
  voided_at:            string | null;
  void_reason:          string | null;
  created_at:           string;
  updated_at:           string;
}

export interface BillingRecord {
  id: string;
  deal_id: string;
  milestone_id: string;
  release_id: string;
  funder_id: string;
  /** Milestone amount — the full contract value released to the contractor. */
  gross_amount: number;
  /** Rate applied at the time of this release, in basis points. */
  billing_rate_bps: number;
  /** Vektrum platform fee charged to the funder on top of the gross amount. */
  fee_amount: number;
  /** Contractor payout. Always equals gross_amount — contractors are never charged. */
  net_amount: number;
  /** Stripe transfer ID for the contractor payout. */
  stripe_transfer_id: string;
  /** Mirrors releases.transfer_status. Failed/reversed records are excluded from fee totals. */
  transfer_status: TransferStatus;
  created_at: string;
}

export interface Dispute {
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

// ─── Transaction Receipts ─────────────────────────────────────────────────────

export type ReceiptStatus = 'pending' | 'failed' | 'reversed'

export interface TransactionReceipt {
  id:                string
  receipt_number:    string
  release_id:        string
  milestone_id:      string
  deal_id:           string
  billing_record_id: string | null
  status:            ReceiptStatus

  // Financial snapshot (immutable)
  gross_amount:      number
  fee_amount:        number
  fee_rate_bps:      number
  total_charged:     number

  // Stripe
  stripe_transfer_id: string

  // Parties
  contractor_id:   string
  funder_id:       string
  contractor_name: string
  funder_name:     string

  // Denormalized titles
  deal_title:      string
  milestone_title: string

  // Timestamps
  released_at:   string
  failed_at:     string | null
  email_sent_at: string | null
  created_at:    string
  updated_at:    string
}
