import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DealCard } from "@/components/deal/deal-card";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import type { Deal, Profile } from "@/lib/types";
import { Plus, FileText, AlertCircle } from "lucide-react";

async function getProfileAndDeals(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) return { profile: null, deals: [] };

  let query = supabase
    .from("deals")
    .select(
      `
      *,
      contractor:profiles!deals_contractor_id_fkey(*),
      funder:profiles!deals_funder_id_fkey(*),
      milestones(*)
    `
    )
    .order("created_at", { ascending: false })
    .order("order_index", { referencedTable: "milestones", ascending: true });

  // Scope to role
  if (profile.role === "contractor") {
    query = query.eq("contractor_id", userId);
  } else if (profile.role === "funder") {
    query = query.eq("funder_id", userId);
  }
  // admin sees all

  const { data: deals } = await query;
  return { profile: profile as Profile, deals: (deals ?? []) as Deal[] };
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

// ─── Money stat tile ──────────────────────────────────────────────────────────

function MoneyStatTile({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <Money label={label} amount={amount} size="lg" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyDeals({ role }: { role: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-8 py-16 text-center">
      <AlertCircle
        size={32}
        className="mx-auto text-slate-300"
        aria-hidden="true"
      />
      <p className="mt-3 text-sm font-medium text-slate-500">
        {role === "contractor"
          ? "You haven't created any deals yet."
          : "No deals have been assigned to you yet."}
      </p>
      {role === "contractor" && (
        <div className="mt-4">
          <Link href="/dashboard/deals/new">
            <Button variant="primary" size="sm">
              <Plus size={14} aria-hidden="true" />
              Create your first deal
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { profile, deals } = await getProfileAndDeals(user.id);

  if (!profile) {
    return (
      <div className="page-container py-12">
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">
              Your profile could not be loaded. Please sign out and try again.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const totalFunded = deals.reduce((s, d) => s + d.funded_amount, 0);
  const totalReleased = deals.reduce((s, d) => s + d.released_amount, 0);
  const pendingMilestones = deals.flatMap((d) => d.milestones ?? []).filter(
    (m) => m.status === "ready_for_review"
  ).length;

  // ── Contractor view ──────────────────────────────────────────────────────
  if (profile.role === "contractor") {
    return (
      <div className="page-container section space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Welcome back, {profile.full_name.split(" ")[0]}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Contractor dashboard
            </p>
          </div>
          <Link href="/dashboard/deals/new">
            <Button variant="primary" size="md">
              <Plus size={15} aria-hidden="true" />
              Create New Deal
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total Deals" value={deals.length} />
          <MoneyStatTile label="Total Funded" amount={totalFunded} />
          <MoneyStatTile label="Total Released" amount={totalReleased} />
          <StatTile label="Pending Milestones" value={pendingMilestones} />
        </div>

        {/* Deals */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Your Deals
          </h2>
          {deals.length === 0 ? (
            <EmptyDeals role="contractor" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── Funder view ──────────────────────────────────────────────────────────
  if (profile.role === "funder") {
    const actionRequired = deals.filter((d) =>
      (d.milestones ?? []).some((m) => m.status === "ready_for_review")
    );
    const funded = deals.filter((d) => d.funded_amount > 0);

    return (
      <div className="page-container section space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Welcome back, {profile.full_name.split(" ")[0]}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">Funder dashboard</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MoneyStatTile label="Total Funded" amount={totalFunded} />
          <MoneyStatTile label="Total Released" amount={totalReleased} />
          <StatTile label="Pending Approvals" value={pendingMilestones} />
        </div>

        {/* Deals requiring action */}
        {actionRequired.length > 0 && (
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-vektrum-amber">
              Deals Requiring Action ({actionRequired.length})
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {actionRequired.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </section>
        )}

        {/* All funded deals */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Funded Deals
          </h2>
          {funded.length === 0 ? (
            <EmptyDeals role="funder" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {funded.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── Admin view ───────────────────────────────────────────────────────────
  const totalAmount = deals.reduce((s, d) => s + d.total_amount, 0);

  return (
    <div className="page-container section space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            All deals across the platform
          </p>
        </div>
        <Link href="/dashboard/audit">
          <Button variant="secondary" size="md">
            <FileText size={15} aria-hidden="true" />
            Audit Log
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Deals" value={deals.length} />
        <MoneyStatTile label="Deal Volume" amount={totalAmount} />
        <MoneyStatTile label="Total Released" amount={totalReleased} />
        <StatTile label="Pending Milestones" value={pendingMilestones} />
      </div>

      {/* All deals */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          All Deals
        </h2>
        {deals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-8 py-12 text-center">
            <p className="text-sm text-slate-400">No deals in the system yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
