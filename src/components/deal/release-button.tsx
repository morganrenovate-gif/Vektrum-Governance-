"use client";

import { useState } from "react";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ReleaseGateResult } from "@/lib/types";
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Shield,
  X,
  Clock,
  Banknote,
  FileSignature,
} from "lucide-react";

interface ReleaseButtonProps {
  milestoneId: string;
  /** Deal ID — reserved for future use / logging */
  dealId?: string;
  amount: number;
  contractorName: string;
  milestoneTitle?: string;
  gate: ReleaseGateResult;
  /** Called when release succeeds so parent can refresh data */
  onSuccess?: () => void;
}

type ExecutionRail = "stripe_connect" | "external_manual";
type UIState =
  | "idle"
  | "picking_rail"
  | "confirming_stripe"
  | "confirming_external"
  | "loading"
  | "success_stripe"
  | "success_external_pending"
  | "error";

export function ReleaseButton({
  milestoneId,
  amount,
  contractorName,
  milestoneTitle,
  gate,
  onSuccess,
}: ReleaseButtonProps) {
  const [uiState, setUiState] = useState<UIState>("idle");
  const [selectedRail, setSelectedRail] = useState<ExecutionRail>("stripe_connect");
  const [serverError, setServerError] = useState<string | null>(null);
  const [blockersOpen, setBlockersOpen] = useState(false);

  const canRelease = gate.can_release;

  const handleStripeRelease = async () => {
    setUiState("loading");
    setServerError(null);

    try {
      const res = await fetch(`/api/milestones/${milestoneId}/release`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setUiState("error");
        setServerError(data.error ?? "Release failed. Please contact support.");
      } else {
        setUiState("success_stripe");
        onSuccess?.();
      }
    } catch {
      setUiState("error");
      setServerError("Network error. Please try again.");
    }
  };

  const handleExternalAuthorize = async () => {
    setUiState("loading");
    setServerError(null);

    try {
      const res = await fetch(
        `/api/milestones/${milestoneId}/authorize-external`,
        { method: "POST", headers: { "content-type": "application/json" } },
      );
      const data = await res.json();

      if (!res.ok) {
        setUiState("error");
        setServerError(
          data.error ?? "External authorization failed. Please contact support.",
        );
      } else {
        setUiState("success_external_pending");
        onSuccess?.();
      }
    } catch {
      setUiState("error");
      setServerError("Network error. Please try again.");
    }
  };

  // ── Success: Stripe rail (funds actually moved) ────────────────────────────
  if (uiState === "success_stripe") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-4">
        <CheckCircle2 size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            Payment released successfully
          </p>
          <p className="mt-0.5 text-sm text-emerald-400/70">
            <span className="tabular-nums font-bold">{formatMoney(amount)}</span> sent to {contractorName} via Stripe Connect
          </p>
        </div>
      </div>
    );
  }

  // ── Success: External rail (authorized; awaiting off-platform execution) ──
  // Critically: we do NOT say "Payment released" here — no money has moved.
  if (uiState === "success_external_pending") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/25 px-5 py-4">
        <Clock size={20} className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-amber-400">
            Approved for external execution — awaiting payment confirmation
          </p>
          <p className="mt-0.5 text-sm text-amber-400/80">
            Vektrum has authorized release of{" "}
            <span className="tabular-nums font-bold">{formatMoney(amount)}</span>{" "}
            to {contractorName}. Execute the payment via your chosen rail (wire / ACH / check) and
            return to record confirmation.
          </p>
          <p className="mt-2 text-xs text-amber-400/70">
            No funds have moved through Vektrum. Vektrum is governance; you control execution.
          </p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (uiState === "error") {
    return (
      <div className="space-y-3">
        {serverError && (
          <div className="flex items-start gap-2 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {serverError}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setUiState("picking_rail")}>
            Try Again
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setUiState("idle"); setServerError(null); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (uiState === "loading") {
    return (
      <div className="relative rounded-xl border-2 border-vektrum-blue bg-surface-2 shadow-feature overflow-hidden">
        <div className="h-1 w-full bg-vektrum-blue" />
        <div className="px-6 py-5 flex items-center justify-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-vektrum-blue/30 border-t-vektrum-blue" aria-hidden="true" />
          <p className="text-sm font-semibold text-white">
            {selectedRail === "stripe_connect" ? "Processing Stripe release…" : "Authorizing external release…"}
          </p>
        </div>
      </div>
    );
  }

  // ── Rail selection ─────────────────────────────────────────────────────────
  if (uiState === "picking_rail") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pick-rail-title"
        className="relative rounded-xl border-2 border-vektrum-blue bg-surface-2 shadow-feature overflow-hidden"
      >
        <div className="h-1 w-full bg-vektrum-blue" />
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vektrum-blue/10">
                <Shield size={18} className="text-vektrum-blue" aria-hidden="true" />
              </div>
              <div>
                <h3 id="pick-rail-title" className="font-display text-base font-bold text-white">
                  How will {contractorName} be paid?
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Vektrum governs the release either way — choose the execution rail.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUiState("idle")}
              className="rounded-md p-1 text-white/65 hover:text-white hover:bg-surface-4 transition-colors"
              aria-label="Cancel rail selection"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <fieldset className="space-y-2.5">
            <legend className="sr-only">Execution rail</legend>

            <RailOption
              id="rail-stripe"
              selected={selectedRail === "stripe_connect"}
              onSelect={() => setSelectedRail("stripe_connect")}
              icon={<Banknote size={16} />}
              title="Stripe Connect"
              blurb="Automated. Vektrum triggers a Stripe transfer immediately once conditions pass. Requires contractor Stripe Connect account to be active."
            />

            <RailOption
              id="rail-external"
              selected={selectedRail === "external_manual"}
              onSelect={() => setSelectedRail("external_manual")}
              icon={<FileSignature size={16} />}
              title="External / manual execution"
              blurb="Vektrum authorizes the release. Your team (or escrow / title / treasury partner) executes payment outside Vektrum via wire, ACH, or check. Return to record confirmation and attach proof."
            />
          </fieldset>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() =>
                setUiState(
                  selectedRail === "stripe_connect" ? "confirming_stripe" : "confirming_external",
                )
              }
            >
              Continue
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setUiState("idle")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Confirmation: Stripe rail ──────────────────────────────────────────────
  if (uiState === "confirming_stripe") {
    return (
      <ConfirmShell
        titleId="confirm-release-title-stripe"
        title="Confirm Stripe release"
        subtitle="This action is irreversible once confirmed"
        onClose={() => setUiState("picking_rail")}
      >
        <AmountHero amount={amount} contractorName={contractorName} milestoneTitle={milestoneTitle} />

        <ul className="space-y-2" aria-label="Release consequences">
          {[
            "Stripe transfer initiates immediately",
            "Milestone marked released — cannot be reversed",
            "Platform fee recorded in billing_records",
            "Action recorded in immutable audit log",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs text-white/55">{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            variant="release"
            size="md"
            className="flex-1"
            onClick={handleStripeRelease}
          >
            <Shield size={15} aria-hidden="true" />
            Release {formatMoney(amount)} via Stripe
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setUiState("picking_rail")}
          >
            Back
          </Button>
        </div>
      </ConfirmShell>
    );
  }

  // ── Confirmation: External rail ────────────────────────────────────────────
  if (uiState === "confirming_external") {
    return (
      <ConfirmShell
        titleId="confirm-release-title-external"
        title="Authorize external execution"
        subtitle="Vektrum approves the release. Your team executes payment outside Vektrum."
        onClose={() => setUiState("picking_rail")}
      >
        <AmountHero amount={amount} contractorName={contractorName} milestoneTitle={milestoneTitle} />

        <ul className="space-y-2" aria-label="External authorization consequences">
          {[
            "Milestone marked released — governance authorization is recorded",
            "No Stripe transfer is initiated; no funds move through Vektrum",
            "Platform fee is NOT billed until you record external confirmation",
            "You return later to record payment method, reference, and proof",
            "All steps written to the immutable audit log",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs text-white/55">{item}</span>
            </li>
          ))}
        </ul>

        <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-400/85">
          Vektrum is governance / authorization infrastructure — not a payment processor. Funds never
          pass through Vektrum on this rail. Confirmation must be recorded after execution.
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            variant="release"
            size="md"
            className="flex-1"
            onClick={handleExternalAuthorize}
          >
            <FileSignature size={15} aria-hidden="true" />
            Authorize {formatMoney(amount)}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setUiState("picking_rail")}
          >
            Back
          </Button>
        </div>
      </ConfirmShell>
    );
  }

  // ── Can release — show high-gravity CTA ───────────────────────────────────
  if (canRelease) {
    return (
      <div className="space-y-2">
        <Button
          variant="release"
          size="lg"
          onClick={() => setUiState("picking_rail")}
          className="w-full sm:w-auto"
        >
          <Shield size={16} aria-hidden="true" />
          <span>Release to {contractorName}</span>
          <span className="ml-2 rounded-md bg-white/20 px-2.5 py-1 text-sm font-bold tabular-nums">
            {formatMoney(amount)}
          </span>
        </Button>
      </div>
    );
  }

  // ── Cannot release — show blockers ────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Disabled button */}
      <button
        disabled
        aria-disabled="true"
        aria-describedby="release-blockers"
        className={cn(
          "inline-flex items-center justify-between gap-3 w-full sm:w-auto",
          "min-h-[52px] rounded-xl px-6 py-3",
          "bg-surface-3/50 text-white/55 cursor-not-allowed",
          "border border-white/[0.08] shadow-sm",
        )}
      >
        <div className="flex items-center gap-2.5">
          <Lock size={15} aria-hidden="true" />
          <span className="text-sm font-semibold">Release to {contractorName}</span>
        </div>
        <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-sm font-bold tabular-nums text-white/65">
          {formatMoney(amount)}
        </span>
      </button>

      {/* Blockers */}
      <div id="release-blockers" className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] overflow-hidden">
        <button
          type="button"
          onClick={() => setBlockersOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors"
          aria-expanded={blockersOpen}
          aria-controls="blockers-list"
        >
          <span className="flex items-center gap-1.5">
            <Lock size={12} aria-hidden="true" />
            {gate.blockers.length} condition{gate.blockers.length !== 1 ? "s" : ""} not met
          </span>
          {blockersOpen ? (
            <ChevronUp size={12} aria-hidden="true" />
          ) : (
            <ChevronDown size={12} aria-hidden="true" />
          )}
        </button>

        <ul
          id="blockers-list"
          className={cn(
            "divide-y divide-amber-500/20 border-t border-amber-500/20",
            blockersOpen ? "block" : "hidden sm:block",
          )}
          aria-label="Release blockers"
        >
          {gate.blockers.map((blocker, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 px-4 py-2.5 text-xs text-amber-400"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400"
                aria-hidden="true"
              />
              {blocker}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function RailOption({
  id,
  selected,
  onSelect,
  icon,
  title,
  blurb,
}: {
  id: string;
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors",
        selected
          ? "border-vektrum-blue bg-vektrum-blue/[0.08]"
          : "border-white/[0.08] bg-surface-3 hover:border-white/[0.15]",
      )}
    >
      <input
        id={id}
        type="radio"
        name="execution-rail"
        checked={selected}
        onChange={onSelect}
        className="sr-only"
      />
      <div
        className={cn(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
          selected ? "bg-vektrum-blue text-white" : "bg-surface-4 text-white/65",
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className={cn("text-[13px] font-semibold", selected ? "text-white" : "text-white/85")}>
          {title}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">{blurb}</p>
      </div>
      <span
        className={cn(
          "h-4 w-4 flex-shrink-0 rounded-full border",
          selected ? "border-vektrum-blue bg-vektrum-blue" : "border-white/25",
        )}
        aria-hidden="true"
      >
        {selected && (
          <span className="block h-2 w-2 m-1 rounded-full bg-white" />
        )}
      </span>
    </label>
  );
}

function ConfirmShell({
  titleId,
  title,
  subtitle,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="relative rounded-xl border-2 border-vektrum-blue bg-surface-2 shadow-feature overflow-hidden"
    >
      <div className="h-1 w-full bg-vektrum-blue" />
      <div className="px-6 py-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vektrum-blue/10">
              <Shield size={18} className="text-vektrum-blue" aria-hidden="true" />
            </div>
            <div>
              <h3 id={titleId} className="font-display text-base font-bold text-white">
                {title}
              </h3>
              <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/65 hover:text-white hover:bg-surface-4 transition-colors"
            aria-label="Back"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AmountHero({
  amount,
  contractorName,
  milestoneTitle,
}: {
  amount: number;
  contractorName: string;
  milestoneTitle?: string;
}) {
  return (
    <div className="rounded-lg bg-surface-3 border border-white/[0.08] px-5 py-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/55">
        Amount to be released
      </p>
      <p className="mt-1.5 font-display text-5xl font-bold tabular-nums tracking-tight text-white">
        {formatMoney(amount)}
      </p>
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <ArrowRight size={12} className="text-vektrum-blue" aria-hidden="true" />
        <p className="text-sm text-white/55">
          to <span className="font-semibold text-white">{contractorName}</span>
        </p>
      </div>
      {milestoneTitle && (
        <p className="mt-1 text-xs text-white/70">Milestone: {milestoneTitle}</p>
      )}
    </div>
  );
}
