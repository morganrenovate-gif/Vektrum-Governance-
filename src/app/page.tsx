import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Shield, GitBranch, FileText } from "lucide-react";

export default async function HomePage() {
  // If authenticated, redirect to dashboard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Vektrum
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-500 sm:text-xl">
          Protected milestone payments for construction. Funds release only when
          work is verified — not before.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/auth/signup"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-vektrum-blue px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vektrum-blue focus-visible:ring-offset-2"
          >
            Create Account
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-slate-100 bg-slate-50 px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-10">
            How Vektrum Protects Every Party
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Card 1 */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                <Shield
                  size={20}
                  className="text-vektrum-blue"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Milestone-Based Release
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Funds are escrowed at deal start. Each milestone unlocks only
                after the funder explicitly approves the completed work.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <GitBranch
                  size={20}
                  className="text-vektrum-amber"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Dispute Isolation
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                A disputed milestone freezes only its own funds. Other approved
                milestones continue to release without interruption.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <FileText
                  size={20}
                  className="text-vektrum-green"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Complete Audit Trail
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Every status change, approval, and payment is logged with a
                timestamp and actor. Full accountability for every dollar.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
