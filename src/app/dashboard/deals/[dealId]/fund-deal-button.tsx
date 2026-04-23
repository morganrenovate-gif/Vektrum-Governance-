"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { AlertCircle, ArrowRight, Info } from "lucide-react";

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
        <div className="notice-warning max-w-sm flex-col items-start gap-2">
          <div className="flex items-start gap-2.5">
            <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>Connect your Stripe account before funding deals.</span>
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
        Fund This Deal — {formatMoney(remaining)}
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
