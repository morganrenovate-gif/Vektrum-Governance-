"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Shield, LogOut } from "lucide-react";
import { logMfaVerified, logMfaFailed } from "@/lib/engine/audit";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MfaVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [factorId, setFactorId]   = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [code, setCode]           = useState<string>("");
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [attempts, setAttempts]   = useState(0);

  // ── Resolve the user's verified TOTP factor on mount ──────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();

      // Already at AAL2 — nothing to verify
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === "aal2") {
        if (!cancelled) router.replace(next.startsWith("/") ? next : "/dashboard");
        return;
      }

      // Not enrolled yet — send to enroll
      if (aalData?.nextLevel !== "aal2") {
        if (!cancelled) {
          const enrollUrl = next
            ? `/auth/mfa/enroll?next=${encodeURIComponent(next)}`
            : "/auth/mfa/enroll";
          router.replace(enrollUrl);
        }
        return;
      }

      // Find the verified TOTP factor to challenge
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError || !factors) {
        if (!cancelled) setPageReady(true); // show page with generic error path
        return;
      }

      const totp = factors.totp.find(f => f.status === "verified");
      if (!totp) {
        // No verified factor — this shouldn't happen if AAL check said aal2 is next
        if (!cancelled) {
          router.replace(next ? `/auth/mfa/enroll?next=${encodeURIComponent(next)}` : "/auth/mfa/enroll");
        }
        return;
      }

      if (!cancelled) {
        setFactorId(totp.id);
        setPageReady(true);
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit TOTP code ───────────────────────────────────────────────────────
  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || !factorId) return;

    const trimmedCode = code.replace(/\s/g, "");
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setError("Please enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: trimmedCode,
    });

    if (verifyError) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      // Log failure — fire-and-forget
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          logMfaFailed({
            actorId:      user.id,
            actorEmail:   user.email ?? null,
            actorRole:    null,
            factorId,
            attemptCount: newAttempts,
            reason:       verifyError.message,
            source:       "auth/mfa/verify",
          }).catch(() => {});
        }
      } catch { /* non-fatal */ }

      if (verifyError.message.includes("Invalid") || verifyError.message.includes("expired")) {
        setError(
          "Incorrect code. Make sure your device's clock is set to automatic time and try again." +
          (newAttempts >= 3 ? " Still failing? Try opening a new code in your app (codes rotate every 30 seconds)." : ""),
        );
      } else {
        setError("Verification failed: " + verifyError.message);
      }

      setLoading(false);
      return;
    }

    // Log success — fire-and-forget
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        logMfaVerified({
          actorId:    user.id,
          actorEmail: user.email ?? null,
          actorRole:  null,
          factorId,
          source:     "auth/mfa/verify",
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }

    setLoading(false);
    router.replace(next.startsWith("/") ? next : "/dashboard");
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-[#0D1B2A]">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-vektrum-blue/10 border border-vektrum-blue/20">
            <Shield size={24} className="text-vektrum-blue" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Verify your identity
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Enter the 6-digit code from your authenticator app to continue.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-sm">

          {/* Loading */}
          {!pageReady && (
            <div className="flex flex-col items-center gap-3 py-8 text-white/75">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vektrum-blue" />
              <p className="text-sm">Loading&hellip;</p>
            </div>
          )}

          {/* Verify form */}
          {pageReady && (
            <form onSubmit={handleVerify} className="space-y-4">
              <Input
                type="text"
                inputMode="numeric"
                label="Authenticator code"
                placeholder="123 456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
                autoComplete="one-time-code"
                autoFocus
                maxLength={7}
                required
              />

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 text-sm text-red-400"
                >
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={!factorId}
                className="w-full"
              >
                {loading ? "Verifying…" : "Verify and continue"}
              </Button>
            </form>
          )}
        </div>

        {/* Sign out option */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue rounded transition-colors"
          >
            <LogOut size={13} aria-hidden="true" />
            Sign out and use a different account
          </button>
        </div>

        {/* Trust note */}
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-white/[0.08] bg-surface-2 px-4 py-3">
          <Shield size={14} className="text-vektrum-blue mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs text-white/55">
            MFA verification is required for funder and admin accounts before accessing
            Vektrum. Codes rotate every 30 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
