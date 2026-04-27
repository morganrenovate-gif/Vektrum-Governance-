"use client";

import { ContractImportFlow } from "@/components/ai/ContractImportFlow";
import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, FileUp, ListOrdered, Lock, Building2 } from "lucide-react";
import type { DealMetadata } from "@/lib/actions/analyze-contract";
import { createClient } from "@/lib/supabase/client";

function formatCurrency(value: string): string {
  const num = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return "";
  return num.toFixed(2);
}

interface Partner {
  id: string;
  name: string;
  is_active: boolean;
}

export default function NewDealPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    total_amount: "",
    sequential_release_required: false,
    retainage_percentage: "",
    partner_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    async function checkAdminAndFetchPartners() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single<{ role: string }>();
      if (profile?.role === "admin") {
        setIsAdmin(true);
        // Fetch partner list for the selector
        try {
          const res = await fetch("/api/admin/partners");
          if (res.ok) {
            const data = await res.json();
            setPartners((data.partners ?? []).filter((p: Partner) => p.is_active));
          }
        } catch {
          // Non-fatal — admin may not have MFA active; silently ignore
        }
      }
    }
    checkAdminAndFetchPartners();
  }, []);

  const update =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Deal title is required.";
    if (form.title.trim().length > 120) {
      errs.title = "Title must be 120 characters or fewer.";
    }
    const amount = parseFloat(form.total_amount);
    if (!form.total_amount || isNaN(amount)) {
      errs.total_amount = "Enter a valid dollar amount.";
    } else if (amount < 100) {
      errs.total_amount = "Minimum deal amount is $100.";
    } else if (amount > 100_000_000) {
      errs.total_amount = "Maximum deal amount is $100,000,000.";
    }
    if (form.retainage_percentage !== "") {
      const pct = parseFloat(form.retainage_percentage);
      if (isNaN(pct) || pct < 0 || pct >= 100) {
        errs.retainage_percentage = "Retainage must be between 0% and 100% (exclusive).";
      }
    }
    return errs;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    setServerError(null);
    setErrors({});

    try {
      const retainagePct =
        form.retainage_percentage !== ""
          ? parseFloat(form.retainage_percentage)
          : 0;

      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          total_amount: parseFloat(form.total_amount),
          sequential_release_required: form.sequential_release_required,
          retainage_percentage: retainagePct > 0 ? retainagePct : undefined,
          ...(form.partner_id ? { partner_id: form.partner_id } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error ?? "Failed to create deal. Please try again.");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/deals/${data.deal.id}`);
    } catch {
      setServerError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const metadata: DealMetadata = {
    dealName: form.title.trim() || "Untitled Deal",
    funderEmail: "",
    contractorEmail: "",
    jurisdiction: "US",
  };

  return (
    <div className="min-h-screen bg-surface-0">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16">
        <ContractImportFlow
          metadata={metadata}
          renderTrigger={(openImport) => (
            <div className="hidden" />
          )}
        >
          <div className="max-w-xl">
            <Link
              href="/dashboard"
              className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to dashboard
            </Link>

            <div className="mb-8">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px w-5 bg-vektrum-blue" />
                <p className="text-[11px] tracking-[0.12em] uppercase text-blue-300 font-semibold">
                  New Deal
                </p>
              </div>
              <h1 className="font-display text-[2rem] font-bold tracking-[-0.04em] text-white leading-[1.05]">
                Create New Deal
              </h1>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Deal Details</CardTitle>
              </CardHeader>
              <CardBody>
                <ContractImportFlow
                  metadata={metadata}
                  renderTrigger={(openImport) => null}
                >
                  <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    <Input
                      label="Deal Title"
                      placeholder="e.g. Riverside Apartments — Foundation Phase"
                      value={form.title}
                      onChange={update("title")}
                      error={errors.title}
                      required
                      maxLength={120}
                      helperText="A clear, project-specific name visible to all parties."
                    />

                    <Textarea
                      label="Description"
                      placeholder="Scope of work, special conditions, references to contract clauses…"
                      value={form.description}
                      onChange={update("description")}
                      rows={4}
                      helperText="Optional. Visible to the funder when reviewing this deal."
                    />

                    <Input
                      type="number"
                      label="Total Contract Amount (USD)"
                      placeholder="250000"
                      value={form.total_amount}
                      onChange={update("total_amount")}
                      error={errors.total_amount}
                      required
                      min={100}
                      step={0.01}
                      helperText="The full value of the contract. Milestones must sum to this amount."
                      onBlur={(e) => {
                        const formatted = formatCurrency(e.target.value);
                        if (formatted) {
                          setForm((prev) => ({ ...prev, total_amount: formatted }));
                        }
                      }}
                    />

                    {/* Sequential release toggle */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        {/* Custom toggle */}
                        <div className="relative flex-shrink-0 mt-0.5">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={form.sequential_release_required}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                sequential_release_required: e.target.checked,
                              }))
                            }
                          />
                          <div className="w-9 h-5 rounded-full border border-white/[0.12] bg-white/[0.06] peer-checked:bg-vektrum-blue peer-checked:border-vektrum-blue transition-all" />
                          <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white/40 peer-checked:bg-white peer-checked:translate-x-4 transition-all" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <ListOrdered size={13} className="text-white/50 flex-shrink-0" aria-hidden="true" />
                            <span className="text-[13px] font-semibold text-white/85">
                              Require milestones to be released in order
                            </span>
                          </div>
                          <p className="text-[12px] text-white/75 leading-relaxed">
                            Milestone N cannot be released until milestone N−1 is confirmed
                            released. Recommended for institutional lenders who require sequential
                            disbursement.
                          </p>
                          {form.sequential_release_required && (
                            <p className="mt-1.5 text-[11px] font-medium text-blue-300">
                              Sequential enforcement enabled — cannot be changed after first funding.
                            </p>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Retainage percentage */}
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 space-y-3">
                      <div className="flex items-center gap-1.5">
                        <Lock size={13} className="text-white/50 flex-shrink-0" aria-hidden="true" />
                        <span className="text-[13px] font-semibold text-white/85">
                          Retainage Withholding
                        </span>
                        <span className="ml-auto text-[11px] text-white/65">
                          Optional — default 0%
                        </span>
                      </div>
                      <p className="text-[12px] text-white/75 leading-relaxed">
                        Withhold a percentage of each milestone payment until project completion.
                        Industry standard is 5–10% for institutional construction lending.
                        Leave blank or 0 for no retainage.
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-[140px]">
                          <input
                            type="number"
                            min={0}
                            max={99}
                            step={0.5}
                            placeholder="0"
                            value={form.retainage_percentage}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                retainage_percentage: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-2 pr-8 text-[13px] text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-vektrum-blue/50 focus:border-vektrum-blue"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-white/75 pointer-events-none">
                            %
                          </span>
                        </div>
                        {errors.retainage_percentage && (
                          <p className="text-[12px] text-red-400">{errors.retainage_percentage}</p>
                        )}
                      </div>
                      {form.retainage_percentage !== "" &&
                        parseFloat(form.retainage_percentage) > 0 && (
                          <p className="text-[11px] font-medium text-amber-400/80">
                            {parseFloat(form.retainage_percentage).toFixed(
                              parseFloat(form.retainage_percentage) % 1 === 0 ? 0 : 2
                            )}% withheld per milestone — cannot be changed after first funding.
                          </p>
                        )}
                    </div>

                    {/* Execution-rail partner selector — admin only */}
                    {isAdmin && (
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 space-y-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-white/50 flex-shrink-0" aria-hidden="true" />
                          <span className="text-[13px] font-semibold text-white/85">
                            Execution-rail partner
                          </span>
                          <span className="ml-auto text-[11px] text-white/65">
                            Admin only — optional
                          </span>
                        </div>
                        <p className="text-[12px] text-white/75 leading-relaxed">
                          Assign an institutional execution-rail partner (escrow company, title company,
                          or construction loan servicer) to this deal. When a release is authorized,
                          Vektrum will fire a signed webhook to the partner&rsquo;s endpoint for execution.
                          Leave as &ldquo;None&rdquo; to use Stripe Connect.
                        </p>
                        <select
                          value={form.partner_id}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, partner_id: e.target.value }))
                          }
                          className="w-full rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-2 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-vektrum-blue/50 focus:border-vektrum-blue"
                        >
                          <option value="">None (use Stripe Connect)</option>
                          {partners.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {form.partner_id && (
                          <p className="text-[11px] font-medium text-blue-300">
                            External rail selected — Vektrum will issue authorization signals to this partner.
                          </p>
                        )}
                      </div>
                    )}

                    {serverError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md bg-red-500/[0.08] border border-red-500/20 px-3 py-2.5 text-sm text-red-400"
                      >
                        <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        {serverError}
                      </div>
                    )}

                    <div className="border-t border-white/10 pt-5">
                      <ContractImportFlow
                        metadata={metadata}
                        renderTrigger={(openImport) => (
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <Button
                                  type="submit"
                                  variant="primary"
                                  size="lg"
                                  loading={loading}
                                >
                                  {loading ? "Creating Deal…" : "Create Deal"}
                                </Button>

                                <Link href="/dashboard">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="lg"
                                    disabled={loading}
                                  >
                                    Cancel
                                  </Button>
                                </Link>
                              </div>

                              <p className="text-xs text-white/70">
                                After creating the deal, you&rsquo;ll be able to add milestones and
                                invite a funder.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={openImport}
                              disabled={loading}
                              className="inline-flex items-center gap-2 rounded-xl border border-vektrum-blue/30 bg-vektrum-blue/[0.08] px-4 py-2 text-[13px] font-semibold text-blue-300 hover:bg-vektrum-blue/[0.14] hover:border-vektrum-blue/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FileUp size={14} />
                              Import from contract
                            </button>
                          </div>
                        )}
                      >
                        <></>
                      </ContractImportFlow>
                    </div>
                  </form>
                </ContractImportFlow>
              </CardBody>
            </Card>
          </div>
        </ContractImportFlow>
      </div>
    </div>
  );
}