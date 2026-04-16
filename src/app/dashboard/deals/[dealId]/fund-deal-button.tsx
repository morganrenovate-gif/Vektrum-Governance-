"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { AlertCircle, ArrowRight } from "lucide-react";

interface FundDealButtonProps {
  dealId: string;
  remaining: number;
  stripeConnected: boolean;
}

export function FundDealButton({ dealId, remaining, stripeConnected }: FundDealButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gate: funder must connect Stripe before funding deals
  if (!stripeConnected) {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="rounded-lg border border-vektrum-amber-border bg-vektrum-amber-bg px-4 py-3 max-w-sm">
          <p className="text-[13px] font-medium text-vektrum-amber">
            Connect your Stripe account to fund deals.
          </p>
          <button
            onClick={() => router.push('/dashboard/funder/onboarding')}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-vektrum-blue px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-vektrum-blue-hover transition-all"
          >
            Complete Setup
            <ArrowRight size={12} />
          </button>
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
        Fund This Deal — {formatMoney(remaining)}
      </Button>
      {error && (
        <div className="flex items-start gap-1.5 text-xs text-vektrum-red">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}
    </div>
  );
}
