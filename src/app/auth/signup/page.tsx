"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Shield, Building2, User, Lock, FileCheck } from "lucide-react";
import { VektrumWordmark } from "@/components/ui/vektrum-logo";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const AUTH_TRUST = [
  { icon: Lock, title: "8-condition release gate", desc: "Payments move only with your explicit approval." },
  { icon: Shield, title: "Funds held by Stripe", desc: "Vektrum governs — never holds your capital." },
  { icon: FileCheck, title: "Immutable audit trail", desc: "Every action logged. No edits. No deletes." },
  { icon: CheckCircle2, title: "Contractors join free", desc: "Funders pay. Contractors are always free." },
];

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    full_name: "",
    company_name: "",
    role: "contractor" as UserRole,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = (): string | null => {
    if (!formData.full_name.trim()) return "Full name is required.";
    if (!formData.email.trim()) return "Email is required.";
    if (formData.password.length < 8) return "Password must be at least 8 characters.";
    if (formData.password !== formData.passwordConfirm) return "Passwords do not match.";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
      options: {
        data: {
          full_name: formData.full_name.trim(),
          company_name: formData.company_name.trim() || null,
          role: formData.role,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 bg-[#0D1B2A]">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/[0.08]">
            <CheckCircle2 size={28} className="text-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Check your inbox</h2>
            <p className="mt-2 text-sm text-white/55">
              We sent a confirmation link to{" "}
              <strong className="text-white">{formData.email}</strong>. Click it
              to activate your account and sign in.
            </p>
          </div>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-vektrum-blue hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* ── Left: Trust panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] flex-col justify-between bg-vektrum-canvas px-12 py-16 flex-shrink-0">
        <VektrumWordmark showTagline dark />

        <div className="space-y-10">
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white">
              Govern your construction payments.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/60">
              Milestone-based disbursement with server-enforced release gates.
              Built for the $500K&ndash;$25M projects that need this most.
            </p>
          </div>

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

        <p className="text-xs text-white/70">
          Payments powered by Stripe Connect · Vektrum never holds funds
        </p>
      </div>

      {/* ── Right: Signup form ────────────────────────────────────────────── */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-12 sm:px-8 bg-[#0D1B2A]">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-white">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-white/55">
              Join Vektrum — construction payment governance
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-surface-2 p-6 shadow-sm">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">

              {/* Visual role selection cards */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-white">
                  I am a…{" "}
                  <span className="text-red-400 text-xs" aria-hidden="true">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(["contractor", "funder"] as UserRole[]).map((role) => {
                    const isSelected = formData.role === role;
                    const Icon = role === "contractor" ? Building2 : User;
                    const label = role === "contractor" ? "Contractor" : "Funder";
                    const sub = role === "contractor" ? "I complete the work" : "I finance the project";
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, role }))}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border-2 px-3 py-3.5 text-center transition-all",
                          isSelected
                            ? "border-vektrum-blue bg-vektrum-blue/10"
                            : "border-white/[0.08] bg-surface-3 hover:border-vektrum-blue/40 hover:bg-surface-2"
                        )}
                        aria-pressed={isSelected}
                      >
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          isSelected ? "bg-vektrum-blue" : "bg-surface-3"
                        )}>
                          <Icon size={16} className={isSelected ? "text-white" : "text-white/55"} aria-hidden="true" />
                        </div>
                        <div>
                          <p className={cn(
                            "text-[13px] font-semibold",
                            isSelected ? "text-vektrum-blue" : "text-white"
                          )}>
                            {label}
                          </p>
                          <p className="text-[11px] text-white/70">{sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {formData.role === "contractor" && (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    Contractors always join free — no subscription, no fees.
                  </p>
                )}
              </div>

              <Input
                type="text"
                label="Full Name"
                placeholder="Jane Smith"
                value={formData.full_name}
                onChange={update("full_name")}
                autoComplete="name"
                required
              />

              <Input
                type="text"
                label="Company Name"
                placeholder="Acme Construction Ltd."
                value={formData.company_name}
                onChange={update("company_name")}
                autoComplete="organization"
                helperText="Optional"
              />

              <Input
                type="email"
                label="Email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={update("email")}
                autoComplete="email"
                required
              />

              <Input
                type="password"
                label="Password"
                placeholder="Min. 8 characters"
                value={formData.password}
                onChange={update("password")}
                autoComplete="new-password"
                required
              />

              <Input
                type="password"
                label="Confirm Password"
                placeholder="Re-enter password"
                value={formData.passwordConfirm}
                onChange={update("passwordConfirm")}
                autoComplete="new-password"
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
                {loading ? "Creating account…" : "Create Account"}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-white/55">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-vektrum-blue hover:underline"
            >
              Sign in
            </Link>
          </p>

          <div className="mt-6 lg:hidden flex items-start gap-2 rounded-lg border border-white/[0.08] bg-surface-2 px-4 py-3">
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
