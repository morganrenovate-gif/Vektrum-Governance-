"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Shield, Lock, CheckCircle2, FileCheck } from "lucide-react";
import { VektrumWordmark } from "@/components/ui/vektrum-logo";

const AUTH_ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Incorrect email or password. Please try again.",
  "Email not confirmed":
    "Please check your inbox and confirm your email before signing in.",
  "Too many requests":
    "Too many sign-in attempts. Please wait a moment and try again.",
};

function humanizeError(message: string): string {
  for (const [key, human] of Object.entries(AUTH_ERROR_MAP)) {
    if (message.includes(key)) return human;
  }
  return message;
}

// Trust signals displayed on the auth page right panel
const AUTH_TRUST = [
  {
    icon: Lock,
    title: "10-condition release gate",
    desc: "Every payment passes 10 server-side checks before a single dollar moves.",
  },
  {
    icon: Shield,
    title: "Funds held by Stripe",
    desc: "Vektrum governs disbursement — your capital is held by Stripe, not us.",
  },
  {
    icon: FileCheck,
    title: "Immutable audit trail",
    desc: "Every action is logged with timestamp and actor. No edits. No deletes.",
  },
  {
    icon: CheckCircle2,
    title: "Milestone isolation",
    desc: "A dispute on one milestone never freezes the others. Your project keeps moving.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(humanizeError(authError.message));
      setLoading(false);
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    const destination = next && next.startsWith("/") ? next : "/dashboard";

    // ── MFA step-up check ──────────────────────────────────────────────────
    // If the user is enrolled in MFA but hasn't verified this session yet
    // (currentLevel=aal1, nextLevel=aal2), redirect to the verify page.
    // The verify page will redirect back to `destination` after a successful challenge.
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel === "aal1" && aalData?.nextLevel === "aal2") {
      window.location.href = `/auth/mfa/verify?next=${encodeURIComponent(destination)}`;
      return;
    }

    window.location.href = destination;
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* ── Left: Trust panel (hidden on mobile) ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-vektrum-canvas px-12 py-16 flex-shrink-0">
        {/* Brand */}
        <VektrumWordmark showTagline dark />

        {/* Main trust copy */}
        <div className="space-y-10">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
              Every dollar governed.<br />
              Every release verified.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/60">
              Construction payment governance built for the $500K&ndash;$25M
              project range where disputes cost the most and protection is the most absent.
            </p>
          </div>

          {/* Trust items */}
          <ul className="space-y-5">
            {AUTH_TRUST.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 mt-0.5">
                  <Icon size={15} className="text-white/70" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/50">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom note */}
        <p className="text-xs text-white/70">
          Payments powered by Stripe Connect · Vektrum never holds funds
        </p>
      </div>

      {/* ── Right: Auth form ──────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8 bg-[#0D1B2A]">
        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-white">
              Sign in to Vektrum
            </h1>
            <p className="mt-1.5 text-sm text-white/55">
              Construction payment governance
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-sm">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                type="email"
                label="Email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <Input
                type="password"
                label="Password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm text-vektrum-blue hover:underline">
                  Forgot password?
                </Link>
              </div>

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
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-white/55">
            Don&rsquo;t have an account?{" "}
            <Link
              href="/auth/signup"
              className="font-medium text-vektrum-blue hover:underline"
            >
              Create account
            </Link>
          </p>

          {/* Mobile trust note (only on small screens) */}
          <div className="mt-8 lg:hidden flex items-start gap-2 rounded-lg border border-white/[0.08] bg-surface-2 px-4 py-3">
            <Shield size={14} className="text-vektrum-blue mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-white/55">
              Payments powered by Stripe Connect. Vektrum governs release — never holds your funds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
