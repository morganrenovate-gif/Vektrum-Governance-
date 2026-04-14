import { cn } from "@/lib/utils";

interface MoneyProps {
  /** Amount in dollars (e.g. 150000.00) */
  amount: number;
  /** Label displayed above the amount in small caps */
  label: string;
  className?: string;
  /** Use a larger font for emphasis */
  size?: "sm" | "md" | "lg" | "xl";
  /** Muted styling for secondary amounts */
  muted?: boolean;
}

const sizeClasses = {
  sm: "text-base font-semibold",
  md: "text-xl font-semibold",
  lg: "text-2xl font-bold",
  xl: "text-3xl font-bold",
};

export function Money({
  amount,
  label,
  className,
  size = "md",
  muted = false,
}: MoneyProps) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-widest",
          muted ? "text-slate-400" : "text-slate-500"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-numeric tabular-nums",
          sizeClasses[size],
          muted ? "text-slate-400" : "text-slate-900"
        )}
      >
        {formatted}
      </span>
    </div>
  );
}
