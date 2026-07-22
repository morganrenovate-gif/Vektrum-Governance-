/**
 * Stable condition identities for the release gate — Phase 1 foundation.
 *
 * This module gives every gate check a machine-stable code, human label,
 * category, and evaluation order so that a successful (or failed) evaluation
 * can be recorded and later reproduced (see gate_evaluations /
 * gate_condition_results). It introduces NO behaviour: validateRelease() still
 * makes the exact same pass/fail decision. Codes are stable identifiers — do
 * not rename or renumber them once shipped; historical records reference them.
 *
 * Categories (audit §10) are metadata only in Phase 1 (they drive nothing yet):
 *   - platform_safeguard      → never lender-configurable (system/authz/tenant)
 *   - payment_rail_safeguard  → belongs to a specific execution rail
 *   - lender_policy           → future lender-configurable applicability/threshold
 *   - hybrid_legacy           → currently coupled; to be split in a later phase
 */

/** Gate engine version. Bump when the SET of conditions or their evaluation logic changes. */
export const GATE_ENGINE_VERSION = 'gate-engine.v1' as const;

/** Backward-compatible default policy identity for the current fixed gate. */
export const STANDARD_POLICY = {
  code: 'vektrum_standard_release',
  version: 'v1',
  label: 'Vektrum Standard Release Policy v1',
} as const;

export type ConditionCategory =
  | 'platform_safeguard'
  | 'payment_rail_safeguard'
  | 'lender_policy'
  | 'hybrid_legacy';

export type ConditionOutcome = 'passed' | 'failed' | 'not_applicable' | 'error';
export type Applicability = 'applicable' | 'not_applicable';

export type ConditionCode =
  | 'ACTOR_AUTHORIZED'
  | 'DEAL_NOT_FROZEN'
  | 'MILESTONE_APPROVED'
  | 'PROTECTION_READY'
  | 'FUNDED_BALANCE_SUFFICIENT'
  | 'PAYOUT_ACCOUNT_READY'
  | 'CONTRACTOR_ONBOARDING_COMPLETE'
  | 'NO_ACTIVE_RELEASE'
  | 'CHANGE_ORDERS_RESOLVED'
  | 'SIGNED_CONTRACT_PRESENT'
  | 'PREREQUISITES_SATISFIED'
  | 'LIEN_WAIVER_APPROVED'
  | 'SOV_BALANCE_VALID'
  | 'AI_PRECONDITION_SATISFIED';

export interface ConditionDef {
  code: ConditionCode;
  label: string;
  category: ConditionCategory;
  /** Stable evaluation order (reflects validateRelease() sequence). */
  order: number;
  /** Bump only when THIS condition's evaluator logic changes. */
  evaluatorVersion: string;
}

/** Canonical registry. The single source of truth for condition identity. */
export const CONDITIONS: Record<ConditionCode, ConditionDef> = {
  ACTOR_AUTHORIZED:               { code: 'ACTOR_AUTHORIZED',               label: 'Authorized funder actor',              category: 'platform_safeguard',     order: 0,  evaluatorVersion: 'v1' },
  DEAL_NOT_FROZEN:                { code: 'DEAL_NOT_FROZEN',                label: 'Deal not frozen',                      category: 'platform_safeguard',     order: 1,  evaluatorVersion: 'v1' },
  MILESTONE_APPROVED:             { code: 'MILESTONE_APPROVED',             label: 'Milestone status approved',            category: 'lender_policy',          order: 2,  evaluatorVersion: 'v1' },
  PROTECTION_READY:               { code: 'PROTECTION_READY',               label: 'Protection status ready for release',  category: 'lender_policy',          order: 3,  evaluatorVersion: 'v1' },
  FUNDED_BALANCE_SUFFICIENT:      { code: 'FUNDED_BALANCE_SUFFICIENT',      label: 'Sufficient funded balance',            category: 'hybrid_legacy',          order: 4,  evaluatorVersion: 'v1' },
  PAYOUT_ACCOUNT_READY:           { code: 'PAYOUT_ACCOUNT_READY',           label: 'Payout account ready (rail)',          category: 'payment_rail_safeguard', order: 5,  evaluatorVersion: 'v1' },
  CONTRACTOR_ONBOARDING_COMPLETE: { code: 'CONTRACTOR_ONBOARDING_COMPLETE', label: 'Contractor onboarding complete',       category: 'lender_policy',          order: 6,  evaluatorVersion: 'v1' },
  NO_ACTIVE_RELEASE:              { code: 'NO_ACTIVE_RELEASE',              label: 'No existing active release',           category: 'platform_safeguard',     order: 7,  evaluatorVersion: 'v1' },
  CHANGE_ORDERS_RESOLVED:         { code: 'CHANGE_ORDERS_RESOLVED',         label: 'No open change orders',                category: 'lender_policy',          order: 8,  evaluatorVersion: 'v1' },
  SIGNED_CONTRACT_PRESENT:        { code: 'SIGNED_CONTRACT_PRESENT',        label: 'Signed contract on file',              category: 'lender_policy',          order: 9,  evaluatorVersion: 'v1' },
  PREREQUISITES_SATISFIED:        { code: 'PREREQUISITES_SATISFIED',        label: 'Sequential prerequisites satisfied',   category: 'lender_policy',          order: 10, evaluatorVersion: 'v1' },
  LIEN_WAIVER_APPROVED:           { code: 'LIEN_WAIVER_APPROVED',           label: 'Approved conditional lien waiver',     category: 'lender_policy',          order: 11, evaluatorVersion: 'v1' },
  SOV_BALANCE_VALID:              { code: 'SOV_BALANCE_VALID',              label: 'SOV line-item balance valid',          category: 'hybrid_legacy',          order: 12, evaluatorVersion: 'v1' },
  AI_PRECONDITION_SATISFIED:      { code: 'AI_PRECONDITION_SATISFIED',      label: 'AI draw pre-review current',           category: 'platform_safeguard',     order: 13, evaluatorVersion: 'v1' },
};

/**
 * One immutable per-condition result. Mirrors the gate_condition_results table.
 * `inputs` holds ONLY release-relevant decision inputs (no secrets, no PII beyond
 * ids). `resultCode` is the machine identity of the outcome — never a prose string.
 */
export interface ConditionResult {
  code: ConditionCode;
  label: string;
  category: ConditionCategory;
  evaluatorVersion: string;
  order: number;
  applicability: Applicability;
  outcome: ConditionOutcome;
  /** Stable machine result code, e.g. 'PASS', 'FAIL', 'NOT_APPLICABLE', 'ERROR'. */
  resultCode: string;
  /** Human-readable explanation. For failures this equals the user-facing error string. */
  explanation: string | null;
  /** Release-relevant inputs used to decide this condition (no secrets). */
  inputs?: Record<string, unknown>;
  /** Source-record identifiers used as evidence (ids only). */
  evidenceRefs?: string[];
  evaluatedAt: string;
}

/** Helper to build a ConditionResult from the registry def + outcome. */
export function makeResult(
  code: ConditionCode,
  outcome: ConditionOutcome,
  opts: {
    applicability?: Applicability;
    resultCode?: string;
    explanation?: string | null;
    inputs?: Record<string, unknown>;
    evidenceRefs?: string[];
  } = {},
): ConditionResult {
  const def = CONDITIONS[code];
  const applicability: Applicability =
    opts.applicability ?? (outcome === 'not_applicable' ? 'not_applicable' : 'applicable');
  const defaultResultCode =
    outcome === 'passed' ? 'PASS'
    : outcome === 'failed' ? 'FAIL'
    : outcome === 'not_applicable' ? 'NOT_APPLICABLE'
    : 'ERROR';
  return {
    code: def.code,
    label: def.label,
    category: def.category,
    evaluatorVersion: def.evaluatorVersion,
    order: def.order,
    applicability,
    outcome,
    resultCode: opts.resultCode ?? defaultResultCode,
    explanation: opts.explanation ?? null,
    inputs: opts.inputs,
    evidenceRefs: opts.evidenceRefs,
    evaluatedAt: new Date().toISOString(),
  };
}
