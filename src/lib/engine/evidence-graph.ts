// src/lib/engine/evidence-graph.ts
//
// Tier D — Construction-finance evidence graph ontology (patent memo candidate #2).
//
// `buildEvidenceGraph()` captures the state of all evidence at the moment
// a release is authorized. The canonical snapshot is hashed and bound into:
//   - authorization_tokens.graph_commitment  (the token commits to what it saw)
//   - audit_log.graph_snapshot_hash          (the chain entry commits to the same)
//
// This gives downstream verifiers a cryptographic link from the authorization
// token back to the exact set of documents, conditions, and review state that
// justified the release decision.
//
// Graph schema version: "evidence-graph.v1"
// Bump the version when the node/edge shape changes — old records stay
// verifiable under the version they were created with.

import { sha256OfCanonicalJson } from '@/lib/engine/audit'
import { RELEASE_POLICY_VERSION } from '@/lib/engine/authorization-token'

// ─── Graph schema ─────────────────────────────────────────────────────────────

export const EVIDENCE_GRAPH_SCHEMA_VERSION = 'evidence-graph.v1'

/** A snapshot of the evidence state used to justify a release authorization. */
export interface EvidenceGraph {
  schema_version: string
  captured_at:    string

  /** Core milestone identity at authorization time. */
  milestone: {
    id:                string
    status:            string
    protection_status: string
    amount:            number
    title:             string
  }

  /** Deal context — identifies the parties and financial structure. */
  deal: {
    id:                      string
    contractor_id:           string
    funder_id:               string | null
    billing_rate_bps:        number
    retainage_percentage:    number
  }

  /**
   * Gate result — which conditions passed/failed at authorization time
   * and which policy version evaluated them.
   */
  gate: {
    policy_version:  string
    passed:          boolean
    failed_reasons:  string[]
  }

  /**
   * AI draw review — the result of checkAiPrecondition() at authorization time.
   * Captures whether the AI pre-screen passed, why it was blocked (if at all),
   * and any non-blocking warning.
   */
  ai_review: {
    passed:  boolean
    reason:  string | null
    warning: string | null
  }

  /**
   * SOV line-item links — the per-line-item amounts drawn against in this
   * release (Tier C). Null when no SOV links are present.
   */
  sov_links: Array<{ sov_line_item_id: string; amount: number }> | null

  /**
   * Execution context — rail chosen for this authorization.
   */
  execution: {
    rail_scope:      'stripe' | 'external_rail'
    gross_amount:    number
    net_amount:      number
    currency:        string
  }
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export interface BuildEvidenceGraphInput {
  milestoneId:         string
  milestoneStatus:     string
  milestoneProtection: string
  milestoneAmount:     number
  milestoneTitle:      string
  dealId:              string
  contractorId:        string
  funderId:            string | null
  billingRateBps:      number
  retainagePercentage: number
  gatePassed:          boolean
  gateErrors:          string[]
  aiPassed:            boolean
  aiReason:            string | null
  aiWarning:           string | null
  sovLinks:            Array<{ sov_line_item_id: string; amount: number }> | null | undefined
  railScope:           'stripe' | 'external_rail'
  grossAmount:         number
  netAmount:           number
  currency:            string
}

/**
 * Build the canonical evidence graph for a release authorization.
 *
 * The returned object is a deterministic snapshot of all evidence that
 * justified the gate decision. It is designed to be canonical-JSON-serializable
 * and stable across repeated calls for the same inputs.
 */
export function buildEvidenceGraph(input: BuildEvidenceGraphInput): EvidenceGraph {
  return {
    schema_version: EVIDENCE_GRAPH_SCHEMA_VERSION,
    captured_at:    new Date().toISOString(),

    milestone: {
      id:                input.milestoneId,
      status:            input.milestoneStatus,
      protection_status: input.milestoneProtection,
      amount:            input.milestoneAmount,
      title:             input.milestoneTitle,
    },

    deal: {
      id:                   input.dealId,
      contractor_id:        input.contractorId,
      funder_id:            input.funderId,
      billing_rate_bps:     input.billingRateBps,
      retainage_percentage: input.retainagePercentage,
    },

    gate: {
      policy_version: RELEASE_POLICY_VERSION,
      passed:         input.gatePassed,
      failed_reasons: input.gateErrors,
    },

    ai_review: {
      passed:  input.aiPassed,
      reason:  input.aiReason ?? null,
      warning: input.aiWarning ?? null,
    },

    sov_links: input.sovLinks && input.sovLinks.length > 0
      ? input.sovLinks
      : null,

    execution: {
      rail_scope:   input.railScope,
      gross_amount: input.grossAmount,
      net_amount:   input.netAmount,
      currency:     input.currency,
    },
  }
}

/**
 * Compute the graph commitment — the sha256 hash of the canonical JSON
 * serialization of the evidence graph. This is the value that gets written
 * into both authorization_tokens.graph_commitment and audit_log.graph_snapshot_hash.
 */
export async function computeGraphCommitment(graph: EvidenceGraph): Promise<string> {
  return sha256OfCanonicalJson(graph)
}
