// ─── Core domain types ───────────────────────────────────────────────────────

export type UserRole = "contractor" | "funder" | "admin";

export type DealStatus =
  | "draft"
  | "active"
  | "in_progress"
  | "completed"
  | "disputed"
  | "cancelled"
  | "frozen";   // deal locked by a contract void that occurred after milestone releases

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
  draft:       "draft",
  active:      "active",
  in_progress: "in_progress",
  completed:   "completed",
  disputed:    "disputed",
  cancelled:   "cancelled",
  frozen:      "frozen",
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
  /** True once the user has a verified TOTP factor. Set by DB trigger on auth.mfa_factors. */
  mfa_enrolled: boolean;
  mfa_enrolled_at: string | null;
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

  // ── Sequential release enforcement (migration 000005) ───────────────────────
  /**
   * When true, milestones must be released in ascending order_index order.
   * A milestone with order_index N is blocked until every milestone with
   * order_index < N is in 'released' status.
   * Required by institutional lenders. Defaults to false.
   */
  sequential_release_required?: boolean;

  // ── Lien waiver (migration 20260424000008) ───────────────────────────────────
  /**
   * When true, an approved conditional_progress lien waiver is required for
   * every milestone release (Condition 10 of validateRelease()).
   * Required by institutional lenders in most US states.
   */
  lien_waiver_required?: boolean;

  // ── Retainage (migration 20260424000006) ─────────────────────────────────────
  /**
   * Percentage of each milestone gross amount withheld until project completion.
   * Range: 0 to <100. Default 0 (no retainage). Locked after first funding event.
   * Industry standard: 5-10% for institutional construction lending.
   */
  retainage_percentage?: number | null;
  /**
   * Cumulative retainage currently held (not yet released to contractor).
   * Incremented on each milestone release; decremented on retainage release.
   */
  retainage_held?: number | null;
  /**
   * Cumulative retainage already released to the contractor (monotone increasing).
   * Use retainage_held for the current outstanding balance.
   */
  retainage_released?: number | null;

  // ── Contract void freeze (migration 20260424000010) ──────────────────────────
  /**
   * True when a DocuSign envelope-voided event fired AFTER milestone releases
   * had already occurred on this deal. The deal status is simultaneously set to
   * 'frozen'. Releases and new funding are blocked until an admin unfreezes.
   */
  deal_freeze_on_void?: boolean;
  /**
   * The deal status captured immediately before the freeze. The admin unfreeze
   * endpoint restores the deal to this status. NULL on non-frozen deals.
   */
  frozen_from_status?: string | null;

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
  /**
   * Dollar amount withheld from this milestone release as retainage.
   * Zero when the deal has no retainage (retainage_percentage = 0).
   * The contractor received (amount - retainage_amount) at release time.
   */
  retainage_amount?: number | null;
  /**
   * Soft reference to the active/approved lien waiver for this milestone.
   * Not a FK (lien_waivers already references milestones — circular FK avoided).
   * Updated when a conditional_progress waiver is approved.
   */
  lien_waiver_id?: string | null;
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

// ─── Lien Waivers ────────────────────────────────────────────────────────────

export type LienWaiverType =
  | 'conditional_progress'
  | 'unconditional_progress'
  | 'conditional_final'
  | 'unconditional_final'

export type LienWaiverStatus = 'requested' | 'uploaded' | 'approved' | 'rejected'

export interface LienWaiver {
  id:               string
  deal_id:          string
  milestone_id:     string | null
  waiver_type:      LienWaiverType
  status:           LienWaiverStatus
  uploaded_by:      string | null
  approved_by:      string | null
  /** Supabase Storage path in the 'lien-waivers' bucket. */
  file_path:        string | null
  /** Dollar amount covered by this waiver (typically = milestone.amount). */
  waiver_amount:    number | null
  /** Through-date for the waiver (ISO date string). */
  through_date:     string | null
  rejection_reason: string | null
  requested_at:     string
  uploaded_at:      string | null
  approved_at:      string | null
  rejected_at:      string | null
  created_at:       string
}

// ─── Milestone Documents ──────────────────────────────────────────────────────

/**
 * Evidence or supporting document uploaded by a contractor for a milestone.
 * Column names match the public.milestone_documents DB table exactly.
 *
 * Actual schema (verified against production):
 *   id, milestone_id, uploaded_by, file_url, file_type, description, created_at
 *
 * NOTE: production schema stores display names in description and type in file_type.
 *       description stores the original display filename set at upload time.
 *       file_type uses values: 'photo' | 'document' | 'change_order'
 */
export interface MilestoneDocument {
  id:           string
  milestone_id: string
  /** UUID of the uploading profile. Do not render raw in UI. */
  uploaded_by:  string
  /** Public URL to the file in Supabase Storage. */
  file_url:     string
  /** 'photo' | 'document' | 'change_order' — matches DB enum-like constraint. */
  file_type:    string | null
  /** Original filename or freeform note set at upload time. */
  description:  string | null
  created_at:   string
}

// ─────────────────────────────────────────────────────────────────────────────

/** Status values match the public.change_order_status DB enum exactly. */
export type ChangeOrderStatus = 'submitted' | 'approved' | 'rejected' | 'paid'

export interface ChangeOrder {
  id:           string
  milestone_id: string
  deal_id:      string
  /** Signed amount delta: positive = increase, negative = decrease. */
  amount:       number
  description:  string
  status:       ChangeOrderStatus
  /** Profile UUID — do not render raw in UI. */
  submitted_by: string
  approved_by:  string | null
  approved_at:  string | null
  created_at:   string
  updated_at:   string
}
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
  /** Milestone amount — the full contract value for this milestone. */
  gross_amount: number;
  /** Rate applied at the time of this release, in basis points. */
  billing_rate_bps: number;
  /** Vektrum platform fee charged to the funder on top of the gross amount. */
  fee_amount: number;
  /**
   * Contractor payout via Stripe: gross_amount - retainage_amount.
   * Equals gross_amount when retainage_percentage = 0.
   */
  net_amount: number;
  /**
   * Retainage withheld from this milestone. Zero on pre-retainage records.
   * net_amount = gross_amount - retainage_amount.
   */
  retainage_amount?: number | null;
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

// ─── Schedule of Values ───────────────────────────────────────────────────────

export type SovLineItemStatus = 'draft' | 'pending_review' | 'approved' | 'superseded'

export interface SovLineItem {
  id:                     string
  deal_id:                string
  item_number:            string | null
  description:            string
  /** Contract-allocated value for this line item. */
  scheduled_value:        number
  /** Cumulative approved change orders applied to this line item. */
  approved_change_orders: number
  /** scheduled_value + approved_change_orders. */
  revised_value:          number
  /** Previously released (prior draw applications). */
  previous_released:      number
  /** Amount requested in the current draw application. */
  current_requested:      number
  /** Retainage withheld on this line item. */
  retainage_amount:       number
  /** revised_value - previous_released - current_requested. */
  balance_to_finish:      number
  /** (previous_released + current_requested) / revised_value × 100, capped at 100. */
  percent_complete:       number
  status:                 SovLineItemStatus
  sort_order:             number
  created_by:             string | null
  approved_by:            string | null
  approved_at:            string | null
  created_at:             string
  updated_at:             string
}

export interface MilestoneSovLink {
  id:               string
  milestone_id:     string
  sov_line_item_id: string
  /** Portion of this milestone's amount drawn against this SOV line item. */
  allocated_amount: number
  created_at:       string
  // Joined
  sov_line_item?: SovLineItem
}

// ─── In-app notification ──────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'in_app'
export type NotificationStatus  = 'pending' | 'sent' | 'failed' | 'skipped'

export interface AppNotification {
  id:                string
  recipient_user_id: string | null
  recipient_email:   string | null
  deal_id:           string | null
  entity_type:       string
  entity_id:         string
  notification_type: string
  channel:           NotificationChannel
  status:            NotificationStatus
  subject:           string | null
  body_summary:      string | null
  error_message:     string | null
  created_at:        string
  sent_at:           string | null
  /** Null = unread. Non-null = timestamp when user marked as read. */
  read_at:           string | null
}
