"use client";

import { ContractImportFlow } from "@/components/ai/ContractImportFlow";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import type { DealMetadata } from "@/lib/actions/analyze-contract";

function formatCurrency(value: string): string {
  const num = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return "";
  return num.toFixed(2);
}

export default function NewDealPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    total_amount: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Deal title is required.";
    if (form.title.trim().length > 120)
      errs.title = "Title must be 120 characters or fewer.";
    const amount = parseFloat(form.total_amount);
    if (!form.total_amount || isNaN(amount)) {
      errs.total_amount = "Enter a valid dollar amount.";
    } else if (amount < 100) {
      errs.total_amount = "Minimum deal amount is $100.";
    } else if (amount > 100_000_000) {
      errs.total_amount = "Maximum deal amount is $100,000,000.";
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
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          total_amount: parseFloat(form.total_amount),
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

  // Derived from form state so the AI receives the deal name and can use it
  const metadata: DealMetadata = {
    dealName: form.title.trim() || "Untitled Deal",
    funderEmail: "",
    contractorEmail: "",
    jurisdiction: "US",
  };

  return (
    <div className="page-container py-8">
      <ContractImportFlow metadata={metadata}>
        <div className="max-w-xl">
          {/* Back link */}
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-vektrum-muted hover:text-vektrum-text transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mb-6 font-display text-2xl font-bold text-vektrum-text">
            Create New Deal
          </h1>

          <Card>
            <CardHeader>
              <CardTitle>Deal Details</CardTitle>
            </CardHeader>
            <CardBody>
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
                    if (formatted)
                      setForm((prev) => ({ ...prev, total_amount: formatted }));
                  }}
                />

                {serverError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-md bg-vektrum-red-bg border border-vektrum-red-border px-3 py-2.5 text-sm text-vektrum-red"
                  >
                    <AlertCircle size={15} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    {serverError}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={loading}
                    className="sm:w-auto"
                  >
                    {loading ? "Creating Deal…" : "Create Deal"}
                  </Button>
                  <Link href="/dashboard">
                    <Button type="button" variant="ghost" size="lg" disabled={loading}>
                      Cancel
                    </Button>
                  </Link>
                </div>

                <p className="text-xs text-vektrum-faint">
                  After creating the deal, you&rsquo;ll be able to add milestones and
                  invite a funder.
                </p>
              </form>
            </CardBody>
          </Card>
        </div>
      </ContractImportFlow>
    </div>
  );
}
