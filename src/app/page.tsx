import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Shield,
  GitBranch,
  FileText,
  ArrowRight,
  Lock,
  Banknote,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col">
      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-vektrum-bg">
        {/* Blueprint grid pattern — matches logo structural aesthetic */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(26,58,150,1) 1px, transparent 1px), linear-gradient(90deg, rgba(26,58,150,1) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        {/* Brand blue radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-vektrum-blue-subtle/60 to-transparent rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-24 pb-20 sm:pt-32 sm:pb-28">
          {/* Badge */}
          <div className="animate-fade-in flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-vektrum-border bg-vektrum-surface px-4 py-1.5 shadow-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-vektrum-green animate-pulse-slow" />
              <span className="text-[12px] font-medium text-vektrum-muted tracking-wide">
                Construction payment infrastructure
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in text-center text-4xl font-bold tracking-[-0.035em] text-vektrum-text sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1] text-balance">
            Funds release when
            <br className="hidden sm:block" />
            {" "}work is verified.
            <br className="hidden sm:block" />
            <span className="text-vektrum-faint">Not before.</span>
          </h1>

          {/* Subheadline */}
          <p className="animate-fade-in-delay mx-auto mt-6 max-w-lg text-center text-[17px] leading-relaxed text-vektrum-muted">
            Vektrum governs milestone-based disbursements for construction.
            Every dollar tracked, every release audited, every party protected.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-delay-2 mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Start a deal
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-vektrum-border bg-vektrum-surface px-7 py-3 text-[14px] font-semibold text-vektrum-muted shadow-sm hover:bg-vektrum-surface-alt hover:border-vektrum-blue/40 transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Stats bar ─────────────────────────────────────────────────────── */}
      <section className="border-y border-vektrum-border bg-vektrum-surface">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-10">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-0 sm:divide-x sm:divide-vektrum-border-subtle">
            {[
              { value: "$299B", label: "Lost annually to slow payments", sub: "Rabbet 2025 Report" },
              { value: "65 hrs", label: "Monthly GC payment admin", sub: "Industry average" },
              { value: "14%", label: "Hidden cost on every project", sub: "Payment delays" },
              { value: "88%", label: "GCs declined bids over slow-pay", sub: "Reputation damage" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center text-center sm:px-6">
                <span className="text-2xl font-bold tracking-[-0.02em] text-vektrum-text font-numeric sm:text-3xl">
                  {stat.value}
                </span>
                <span className="mt-1.5 text-[13px] leading-snug text-vektrum-muted">
                  {stat.label}
                </span>
                <span className="mt-1 text-[11px] text-vektrum-faint">
                  {stat.sub}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ──────────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint">
              How it works
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl">
              Protected at every step
            </h2>
            <p className="mt-3 mx-auto max-w-md text-[15px] text-vektrum-muted">
              From deal creation to final payout, Vektrum enforces the rules so no one has to trust the process — they can verify it.
            </p>
          </div>

          {/* Steps */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Create deal",
                desc: "Contractor creates a deal with defined milestones and amounts. The full contract value is set upfront.",
                icon: FileText,
              },
              {
                step: "02",
                title: "Fund escrow",
                desc: "Funder deposits funds via Stripe. Money is held — Vektrum governs release but never holds funds directly.",
                icon: Banknote,
              },
              {
                step: "03",
                title: "Complete & approve",
                desc: "Contractor marks work done. Funder reviews, inspects, and approves each milestone independently.",
                icon: CheckCircle2,
              },
              {
                step: "04",
                title: "Release payment",
                desc: "All 7 release conditions verified server-side. Funds transfer to contractor via Stripe. Fully audited.",
                icon: TrendingUp,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group relative rounded-2xl border border-vektrum-border bg-vektrum-surface p-6 hover:border-vektrum-blue/40 hover:shadow-lg hover:shadow-vektrum-blue/5 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-[12px] font-semibold text-vektrum-faint">
                    {item.step}
                  </span>
                  <div className="h-px flex-1 bg-vektrum-border-subtle" />
                  <item.icon size={18} className="text-vektrum-faint group-hover:text-vektrum-blue transition-colors" />
                </div>
                <h3 className="text-[15px] font-semibold text-vektrum-text tracking-[-0.01em]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-vektrum-muted">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Core protection ───────────────────────────────────────────────── */}
      {/* Dark canvas section — logo near-black #141414 */}
      <section className="bg-vektrum-canvas py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Core protections
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-white sm:text-3xl">
              Every dollar governed
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Card 1 — Milestone isolation */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:border-vektrum-blue/40 hover:bg-white/8 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-blue/15 mb-5">
                <Shield size={20} className="text-vektrum-blue-subtle" />
              </div>
              <h3 className="text-[15px] font-semibold text-white tracking-[-0.01em]">
                Milestone isolation
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                Each milestone is an independent financial unit. A dispute on one
                never freezes another. A $9M job is never held up by a $15K disagreement.
              </p>
            </div>

            {/* Card 2 — Release gate */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:border-vektrum-blue/40 hover:bg-white/8 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-amber/15 mb-5">
                <Lock size={20} className="text-yellow-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-white tracking-[-0.01em]">
                7-condition release gate
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                Every release passes 7 server-side checks simultaneously. Milestone approved, funds available, no disputes, no
                pending changes, contractor verified, Stripe active, no duplicates.
              </p>
            </div>

            {/* Card 3 — Audit trail */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 hover:border-vektrum-blue/40 hover:bg-white/8 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vektrum-green/15 mb-5">
                <GitBranch size={20} className="text-green-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-white tracking-[-0.01em]">
                Immutable audit trail
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                No update. No delete. Every status change, approval, and payment logged
                with timestamp and actor. Full accountability for every dollar, forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Who it's for ──────────────────────────────────────────────────── */}
      <section className="bg-vektrum-bg py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-16">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-vektrum-faint">
              Built for
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl">
              Both sides of the check
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
            {/* Contractors */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-blue">
                Contractors
              </span>
              <h3 className="mt-3 text-lg font-semibold text-vektrum-text tracking-[-0.01em]">
                Get paid when you deliver
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {[
                  "Milestone-based payouts — no 90-day net terms",
                  "Immutable proof that work was approved",
                  "Disputes isolate one milestone, not the whole project",
                  "Direct deposit to your bank via Stripe Connect",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-vektrum-green" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Funders */}
            <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-8">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-vektrum-amber">
                Funders &amp; Lenders
              </span>
              <h3 className="mt-3 text-lg font-semibold text-vektrum-text tracking-[-0.01em]">
                Release only what&rsquo;s earned
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {[
                  "Approve each milestone before funds move",
                  "Full audit trail for every disbursement",
                  "Change orders tracked and gated",
                  "7-condition server-side release enforcement",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-vektrum-green" />
                    <span className="text-[13px] leading-relaxed text-vektrum-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-vektrum-border bg-vektrum-surface py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em] text-vektrum-text sm:text-3xl text-balance">
            Stop losing money to broken payment processes
          </h2>
          <p className="mt-4 mx-auto max-w-md text-[15px] text-vektrum-muted">
            Set up your first deal in minutes. No credit card required to start.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link
              href="/auth/signup"
              className="group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-vektrum-blue px-7 py-3 text-[14px] font-semibold text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover transition-all"
            >
              Create your account
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
