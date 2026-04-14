"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface AddMilestoneFormProps {
  dealId: string;
  maxAmount: number;
}

export function AddMilestoneForm({ dealId, maxAmount }: AddMilestoneFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", description: "", amount: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const update =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Milestone title is required.";
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount)) {
      errs.amount = "Enter a valid dollar amount.";
    } else if (amount <= 0) {
      errs.amount = "Amount must be greater than zero.";
    } else if (amount > maxAmount) {
      errs.amount = `Amount cannot exceed remaining allocation of $${maxAmount.toFixed(2)}.`;
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
      const res = await fetch(`/api/deals/${dealId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          amount: parseFloat(form.amount),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error ?? "Failed to add milestone.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setForm({ title: "", description: "", amount: "" });
      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 1500);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Input
        label="Milestone Title"
        placeholder="e.g. Foundation excavation and pour"
        value={form.title}
        onChange={update("title")}
        error={errors.title}
        required
      />

      <Textarea
        label="Description"
        placeholder="Deliverables, acceptance criteria, references to specs…"
        value={form.description}
        onChange={update("description")}
        rows={3}
        helperText="Optional but recommended for dispute prevention."
      />

      <Input
        type="number"
        label="Amount (USD)"
        placeholder={`Up to ${maxAmount.toFixed(2)}`}
        value={form.amount}
        onChange={update("amount")}
        error={errors.amount}
        min={0.01}
        max={maxAmount}
        step={0.01}
        required
      />

      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-vektrum-red"
        >
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          {serverError}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-vektrum-green"
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          Milestone added successfully.
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={loading}
        disabled={maxAmount <= 0}
      >
        Add Milestone
      </Button>

      {maxAmount <= 0 && (
        <p className="text-xs text-slate-400">
          All funds have been allocated across existing milestones.
        </p>
      )}
    </form>
  );
}
