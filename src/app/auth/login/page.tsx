"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

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

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-vektrum-text">Sign in to Vektrum</h1>
          <p className="mt-2 text-sm text-vektrum-muted">
            Construction payment governance
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
          </CardHeader>
          <CardBody>
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

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md bg-vektrum-red-bg border border-vektrum-red-border px-3 py-2.5 text-sm text-vektrum-red"
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
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-sm text-vektrum-muted">
          Don&rsquo;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-vektrum-blue hover:underline"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
