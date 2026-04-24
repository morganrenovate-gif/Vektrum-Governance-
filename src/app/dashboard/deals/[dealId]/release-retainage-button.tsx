"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Banknote, X } from "lucide-react";
import { formatMoney } from "@/lib/utils";

interface ReleaseRetainageButtonProps {
  dealId: string;
  retainageHeld: number;
}

export function ReleaseRetainageButton({
  dealId,
  retainageHeld,
}: ReleaseRetainageButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(retainageHeld.toFixed(2));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseFloat(amount);
  const isValidAmount =
    !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= retainageHeld;

  const handleRelease = async () => {
    if (!isValidAmount) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/deals/${dealId}/retainage/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to release retainage. Please try again.");
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 hover:border-amber-400/50"
      >
        <Banknote size={14} className="mr-1.5" aria-hidden="true" />
        Release Retainage
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="retainage-modal-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-white/[0.10] bg-surface-1 p-6 shadow-2xl">
            {/* Close */}
            <button
              onClick={() => { setOpen(false); setError(null); }}
              disabled={loading}
              className="absolute right-4 top-4 text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="mb-5">
              <h2
                id="retainage-modal-title"
                className="text-[17px] font-semibold text-white mb-1"
              >
                Release Retainage
              </h2>
              <p className="text-[13px] text-white/50 leading-relaxed">
                Transfer withheld retainage to the contractor&rsquo;s Stripe account.
                Currently held:{" "}
                <span className="font-semibold text-amber-400">
                  {formatMoney(retainageHeld)}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <Input
                type="number"
                label="Release Amount (USD)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0.01}
                max={retainageHeld}
                step={0.01}
                helperText={`Maximum: ${formatMoney(retainageHeld)}`}
                disabled={loading}
              />

              <div>
                <label className="block text-[12px] font-medium text-white/60 mb-1.5">
                  Notes <span className="text-white/30 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-white/[0.10] bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-vektrum-blue/60 resize-none disabled:opacity-50"
                  placeholder="e.g. Substantial completion — punch list closed"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 text-[12px] text-red-400"
                >
                  <AlertCircle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setOpen(false); setError(null); }}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleRelease}
                  loading={loading}
                  disabled={!isValidAmount || loading}
                  className="flex-1"
                >
                  {loading
                    ? "Releasing…"
                    : `Release ${isValidAmount ? formatMoney(parsedAmount) : ""}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
