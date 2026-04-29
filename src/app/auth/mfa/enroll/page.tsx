"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Shield, Smartphone, Key } from "lucide-react";
import { logMfaEnrolled } from "@/lib/engine/audit";

// ─── Types ────────────────────────────────────────────────────────────────────

type EnrollStep = "loading" | "already_enrolled" | "scan" | "verify" | "success" | "error";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MfaEnrollPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next   = searchParams.get("next") ?? "/dashboard";
  const reason = searchParams.get("reason");

  const [step, setStep]         = useState<EnrollStep>("loading");
  const [factorId, setFactorId] = useState<string>("");
  const [qrCode, setQrCode]     = useState<string>("");
  const [secret, setSecret]     = useState<string>("");
  const [code, setCode]         = useState<string>("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [attempts, setAttempts] = useState(0);

  // ── Check existing enrollment + start enrollment on mount ──────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const supabase = createClient();

      // Check if already at AAL2 — nothing to do
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === "aal2") {
        if (!cancelled) router.replace(next.startsWith("/") ? next : "/dashboard");
        return;
      }

      // Check if user already has a verified TOTP factor
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        if (!cancelled) setStep("error");
        return;
      }

      if (factors.totp.some(f => f.status === "verified")) {
        // Already enrolled — redirect to verify page
        if (!cancelled) {
          const verifyUrl = next
            ? `/auth/mfa/verify?next=${encodeURIComponent(next)}`
            : "/auth/mfa/verify";
          router.replace(verifyUrl);
        }
        return;
      }

      // Start fresh enrollment
      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Vektrum",
      });

      if (enrollError || !enrollData) {
        if (!cancelled) setStep("error");
        return;
      }

      if (!cancelled) {
        setFactorId(enrollData.id);
        setQrCode(enrollData.totp.qr_code);
        setSecret(enrollData.totp.secret);
        setStep("scan");
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Verify TOTP code ───────────────────────────────────────────────────────
  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

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

      if (verifyError.message.includes("Invalid") || verifyError.message.includes("expired")) {
        setError(
          "Incorrect code. Make sure your device's clock is accurate and try again." +
          (newAttempts >= 3 ? " If the issue persists, try generating a new code." : ""),
        );
      } else {
        setError("Verification failed: " + verifyError.message);
      }
      setLoading(false);
      return;
    }

    // Log the enrollment event — fire-and-forget, never block the redirect
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        logMfaEnrolled({
          actorId:    user.id,
          actorEmail: user.email ?? null,
          actorRole:  null, // profile role not needed here; DB trigger also logs this
          factorId,
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }

    setStep("success");
    setLoading(false);

    // Redirect after a brief confirmation moment
    setTimeout(() => {
      router.replace(next.startsWith("/") ? next : "/dashboard");
    }, 1800);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-[#0D1B2A]">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-vektrum-blue/10 border border-vektrum-blue/20">
            <Shield size={24} className="text-blue-400" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Set up two-factor authentication
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Your account requires MFA. Scan the QR code with an authenticator app
            such as Google Authenticator, Authy, or 1Password.
          </p>
        </div>

        {/* Funding-context callout — shown when redirected from a deal funding flow */}
        {reason === "funding" && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-3">
            <Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-white/75">
              <span className="font-semibold text-blue-300">MFA required to fund deals.</span>{" "}
              All capital authorization actions require a verified authenticator app.
              Once set up, you&apos;ll be returned to your deal.
            </p>
          </div>
        )}

        {/* Card */}
        <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-sm">

          {/* ── Loading ──────────────────────────────────────────────────── */}
          {step === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-white/75">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-vektrum-blue" />
              <p className="text-sm">Preparing authenticator setup&hellip;</p>
            </div>
          )}

          {/* ── Error (fatal — enrollment call itself failed) ─────────────── */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <AlertCircle size={32} className="text-red-400" />
              <div>
                <p className="font-medium text-white">Setup could not be started</p>
                <p className="mt-1 text-sm text-white/55">
                  There was a problem initialising your authenticator. Please refresh
                  the page or sign out and sign back in. If the issue persists,
                  contact support.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
                className="mt-2"
              >
                Try again
              </Button>
            </div>
          )}

          {/* ── Scan QR ───────────────────────────────────────────────────── */}
          {(step === "scan" || step === "verify") && (
            <div className="space-y-6">
              {/* Step indicator */}
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-vektrum-blue text-xs font-bold text-white">
                  1
                </div>
                <span className="text-sm font-medium text-white">Scan with your authenticator app</span>
              </div>

              {/* QR code */}
              {qrCode && (
                <div className="flex justify-center">
                  <div className="rounded-xl bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCode}
                      alt="TOTP QR code — scan with your authenticator app"
                      width={180}
                      height={180}
                      className="block"
                    />
                  </div>
                </div>
              )}

              {/* Manual key toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowSecret(s => !s)}
                  className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vektrum-blue rounded transition-colors"
                >
                  <Key size={12} aria-hidden="true" />
                  {showSecret ? "Hide" : "Can't scan? Show"} setup key
                </button>
                {showSecret && (
                  <div className="mt-2 rounded-lg border border-white/[0.08] bg-[#0D1B2A] px-3 py-2">
                    <p className="text-xs text-white/75 mb-1">Manual entry key</p>
                    <code className="text-sm font-mono tracking-wider text-white break-all select-all">
                      {secret}
                    </code>
                  </div>
                )}
              </div>

              <hr className="border-white/[0.08]" />

              {/* Step 2 — enter code */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-vektrum-blue text-xs font-bold text-white">
                    2
                  </div>
                  <span className="text-sm font-medium text-white">Enter the 6-digit code</span>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                  <Input
                    type="text"
                    inputMode="numeric"
                    label="Authenticator code"
                    placeholder="123 456"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/[^\d\s]/g, ""))}
                    autoComplete="one-time-code"
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
                    className="w-full"
                  >
                    <Smartphone size={15} aria-hidden="true" />
                    {loading ? "Verifying…" : "Enable two-factor authentication"}
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* ── Success ───────────────────────────────────────────────────── */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20">
                <CheckCircle2 size={28} className="text-green-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">Two-factor authentication enabled</p>
                <p className="mt-1 text-sm text-white/55">
                  Your account is now protected. Redirecting&hellip;
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Trust note */}
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-white/[0.08] bg-surface-2 px-4 py-3">
          <Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs text-white/55">
            MFA is required for all funder and admin accounts. It protects disbursement
            authorizations and platform administration from unauthorized access.
          </p>
        </div>
      </div>
    </div>
  );
}
