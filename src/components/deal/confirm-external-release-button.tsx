"use client";

// ─── ConfirmExternalReleaseButton ────────────────────────────────────────────
//
// Used when an external_manual release is in execution_status='pending' and
// the funder returns to record that they (or their partner) executed payment
// outside Vektrum. Never shown for stripe_connect releases.
//
// Calls POST /api/releases/[releaseId]/confirm-external — which on success
// flips execution_status → 'confirmed', inserts billing_records, and
// increments deal.released_amount / fees_collected / retainage_held.

import { useState } from "react";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileSignature,
  X,
} from "lucide-react";

interface ConfirmExternalReleaseButtonProps {
  releaseId: string;
  amount: number;
  contractorName: string;
  /** Optional — if supplied, renders a "Mark failed" secondary action. */
  allowMarkFailed?: boolean;
  /** Called on successful confirmation or failure-mark, so parent can refresh. */
  onChange?: () => void;
}

type PaymentMethod = "wire" | "ach" | "check" | "other";
type UIState = "idle" | "confirm_form" | "fail_form" | "loading" | "success" | "error";

export function ConfirmExternalReleaseButton({
  releaseId,
  amount,
  contractorName,
  allowMarkFailed = false,
  onChange,
}: ConfirmExternalReleaseButtonProps) {
  const [uiState, setUiState] = useState<UIState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  // Confirm form
  const [method, setMethod]       = useState<PaymentMethod>("wire");
  const [reference, setReference] = useState("");
  const [notes, setNotes]         = useState("");

  // Fail form
  const [failReason, setFailReason] = useState("");

  const handleConfirm = async () => {
    setServerError(null);
    if (!reference.trim()) {
      setServerError("A bank reference or check number is required.");
      return;
    }
    setUiState("loading");
    try {
      const res = await fetch(`/api/releases/${releaseId}/confirm-external`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payment_method:    method,
          payment_reference: reference.trim(),
          notes:             notes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUiState("error");
        setServerError(
          data.error ?? "Confirmation failed. Please try again or contact support.",
        );
      } else {
        setUiState("success");
        onChange?.();
      }
    } catch {
      setUiState("error");
      setServerError("Network error. Please try again.");
    }
  };

  const handleMarkFailed = async () => {
    setServerError(null);
    if (failReason.trim().length < 10) {
      setServerError("Please provide a reason (at least 10 characters).");
      return;
    }
    setUiState("loading");
    try {
      const res = await fetch(`/api/releases/${releaseId}/mark-external-failed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: failReason.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setUiState("error");
        setServerError(data.error ?? "Mark-failed action failed.");
      } else {
        setUiState("success");
        onChange?.();
      }
    } catch {
      setUiState("error");
      setServerError("Network error. Please try again.");
    }
  };

  if (uiState === "success") {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-4">
        <CheckCircle2 size={20} className="text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            External payment recorded
          </p>
          <p className="mt-0.5 text-sm text-emerald-400/70">
            Confirmation for <span className="tabular-nums font-bold">{formatMoney(amount)}</span>{" "}
            to {contractorName} is logged. Billing and ledger have been updated.
          </p>
        </div>
      </div>
    );
  }

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
          <Button variant="primary" size="sm" onClick={() => setUiState("confirm_form")}>
            Back to confirmation
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setUiState("idle"); setServerError(null); }}
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (uiState === "loading") {
    return (
      <div className="relative rounded-xl border-2 border-vektrum-blue bg-surface-2 shadow-feature overflow-hidden">
        <div className="h-1 w-full bg-vektrum-blue" />
        <div className="px-6 py-5 flex items-center justify-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-vektrum-blue/30 border-t-vektrum-blue" aria-hidden="true" />
          <p className="text-sm font-semibold text-white">Recording confirmation…</p>
        </div>
      </div>
    );
  }

  if (uiState === "confirm_form") {
    return (
      <FormShell
        title="Record external payment confirmation"
        subtitle="Capture how payment was executed outside Vektrum. This flips the release to 'confirmed' and commits billing."
        onClose={() => { setUiState("idle"); setServerError(null); }}
      >
        {serverError && (
          <div className="flex items-start gap-2 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {serverError}
          </div>
        )}

        <div className="space-y-4">
          <Field label="Payment method">
            <div className="grid grid-cols-4 gap-2">
              {(["wire", "ach", "check", "other"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={
                    "rounded-md border px-3 py-2 text-xs font-semibold capitalize transition-colors " +
                    (method === m
                      ? "border-vektrum-blue bg-vektrum-blue/10 text-white"
                      : "border-white/[0.08] bg-surface-3 text-white/65 hover:border-white/20")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Payment reference" required>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. Fedwire IMAD 20260425BNF1234 or check #1021"
              className="w-full rounded-md border border-white/[0.08] bg-surface-3 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-vektrum-blue focus:outline-none"
              maxLength={512}
            />
            <p className="mt-1 text-[11px] text-white/45">
              Bank IMAD / OMAD, ACH trace, check number, or partner transfer id. Required.
            </p>
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Bank name, settlement date, anything future audit should see."
              className="w-full rounded-md border border-white/[0.08] bg-surface-3 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-vektrum-blue focus:outline-none resize-y"
              maxLength={2000}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button variant="release" size="md" className="flex-1" onClick={handleConfirm}>
            <CheckCircle2 size={15} aria-hidden="true" />
            Record {formatMoney(amount)} as paid
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => { setUiState("idle"); setServerError(null); }}
          >
            Cancel
          </Button>
        </div>
      </FormShell>
    );
  }

  if (uiState === "fail_form") {
    return (
      <FormShell
        title="Mark external release as failed"
        subtitle="Use this if external execution did not happen or was reversed. Frees the funded-balance reservation."
        onClose={() => { setUiState("idle"); setServerError(null); }}
      >
        {serverError && (
          <div className="flex items-start gap-2 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {serverError}
          </div>
        )}

        <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-400/85">
          The milestone remains in &apos;released&apos; state (governance-authorised). Admin action
          is required if you need to revert milestone status to re-authorise.
        </div>

        <Field label="Reason" required>
          <textarea
            value={failReason}
            onChange={(e) => setFailReason(e.target.value)}
            rows={4}
            placeholder="Wire was returned / funder cancelled / etc. Minimum 10 characters."
            className="w-full rounded-md border border-white/[0.08] bg-surface-3 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-vektrum-blue focus:outline-none resize-y"
            maxLength={2000}
          />
        </Field>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button variant="release" size="md" className="flex-1" onClick={handleMarkFailed}>
            <AlertCircle size={15} aria-hidden="true" />
            Mark failed
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => { setUiState("idle"); setServerError(null); }}
          >
            Cancel
          </Button>
        </div>
      </FormShell>
    );
  }

  // Idle state — show the pending banner + actions
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/25 px-5 py-4">
        <Clock size={20} className="text-amber-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-400">
            Awaiting external payment confirmation
          </p>
          <p className="mt-0.5 text-sm text-amber-400/80">
            <span className="tabular-nums font-bold">{formatMoney(amount)}</span> authorised for{" "}
            {contractorName}. Record confirmation once payment is executed.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="primary"
          size="md"
          onClick={() => setUiState("confirm_form")}
        >
          <FileSignature size={14} aria-hidden="true" />
          Record external payment
        </Button>

        {allowMarkFailed && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => setUiState("fail_form")}
          >
            Mark as failed
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FormShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="relative rounded-xl border-2 border-vektrum-blue bg-surface-2 shadow-feature overflow-hidden"
    >
      <div className="h-1 w-full bg-vektrum-blue" />
      <div className="px-6 py-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/65 hover:text-white hover:bg-surface-4 transition-colors"
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-white/65">
        {label}
        {required && <span className="ml-1 text-amber-400">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
