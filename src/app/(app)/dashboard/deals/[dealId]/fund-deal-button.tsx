"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { AlertCircle, ArrowRight, Building2, Info } from "lucide-react";

interface FundDealButtonProps {
  dealId: string;
  remaining: number;
  stripeConnected: boolean;
  mfaEnrolled: boolean;
  mfaSetupUrl: string;
  /**
   * Funder's selected disbursement rail. The button branches on this:
   *   'stripe'         → existing Stripe Checkout flow (requires connected acct).
   *   'external_rail'  → advisory note; disbursement runs through the partner.
   *   'not_configured' → "Choose rail" CTA into onboarding/settings.
   *   null             → same as not_configured.
   */
  disbursementRail: 'stripe' | 'external_rail' | 'not_configured' | null;
}

export function FundDealButton({
  dealId,
  remaining,
  stripeConnected,
  mfaEnrolled,
  mfaSetupUrl,
  disbursementRail,
}: FundDealButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gate 1: funder must enroll MFA before any release-related action.
  // MFA enforcement is unchanged from prior behavior.
  if (!mfaEnrolled) {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="notice-warning max-w-sm flex-col items-start gap-2">
          <div className="flex items-start gap-2.5">
            <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Secure your account before funding.</p>
              <p className="text-[12px] text-white/70">Funding requires multi-factor authentication to protect capital authorization.</p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push(mfaSetupUrl)}
          >
            Set up MFA
            <ArrowRight size={12} aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  // Gate 2a: rail not configured — point the user back to rail selection.
  // Vektrum records authorization readiness; the selected rail executes
  // disbursement after required release conditions and authorization are
  // complete. The deterministic release gate continues to enforce all 10
  // conditions server-side.
  if (!disbursementRail || disbursementRail === 'not_configured') {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="notice-warning max-w-sm flex-col items-start gap-2">
          <div className="flex items-start gap-2.5">
            <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>
              Choose your disbursement rail before recording funding commitments.
              You can connect Stripe or select an external rail.
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push('/dashboard/funder/onboarding')}
          >
            Choose rail
            <ArrowRight size={12} aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  // Gate 2b: external rail — Vektrum does not initiate the disbursement.
  // The selected rail executes disbursement after required release
  // conditions and authorization are complete.
  if (disbursementRail === 'external_rail') {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 max-w-sm flex flex-col items-start gap-2">
          <div className="flex items-start gap-2.5">
            <Building2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-400" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-[13px] font-semibold text-emerald-300">
                External rail selected
              </p>
              <p className="text-[12px] text-white/70 leading-relaxed">
                Vektrum records authorization readiness. Disbursement is executed
                through the selected external rail. Record funding commitments
                {remaining > 0 ? ` of ${formatMoney(remaining)}` : ''} via your operational process.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Gate 2c: Stripe rail selected but not yet connected — surface the gap.
  if (disbursementRail === 'stripe' && !stripeConnected) {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="notice-warning max-w-sm flex-col items-start gap-2">
          <div className="flex items-start gap-2.5">
            <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>Connect your Stripe account before funding via Stripe Connect.</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push('/dashboard/funder/onboarding')}
          >
            Complete Setup
            <ArrowRight size={12} aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  const handleFund = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${dealId}/fund`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not initiate funding. Please try again.");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        variant="success"
        size="lg"
        loading={loading}
        onClick={handleFund}
        className="sm:w-auto"
      >
        Record funding commitment — {formatMoney(remaining)}
      </Button>
      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}
