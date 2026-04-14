"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { UserRole } from "@/lib/types";

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

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle2
            size={48}
            className="mx-auto text-vektrum-green"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold text-slate-900">Check your inbox</h2>
          <p className="text-sm text-slate-500">
            We sent a confirmation link to{" "}
            <strong className="text-slate-700">{formData.email}</strong>. Click it
            to activate your account and sign in.
          </p>
          <Link
            href="/auth/login"
            className="inline-block text-sm font-medium text-vektrum-blue hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Join Vektrum — construction payment governance
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

              {/* Role selector */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="role"
                  className="text-sm font-medium text-slate-700"
                >
                  I am a…{" "}
                  <span className="ml-0.5 text-vektrum-red" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={update("role")}
                  required
                  className="block min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-vektrum-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="contractor">Contractor — I complete the work</option>
                  <option value="funder">Funder — I finance the project</option>
                </select>
                <p className="text-xs text-slate-500">
                  Admin accounts are provisioned separately.
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-vektrum-red"
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
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-vektrum-blue hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
