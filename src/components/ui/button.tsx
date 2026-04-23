"use client";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "success"
  | "ghost"
  | "release";   // High-consequence financial action — blue with amber accent
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

// ── Variant classes ───────────────────────────────────────────────────────────
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-vektrum-blue text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5 focus-visible:ring-vektrum-blue",
  secondary:
    "border border-white/[0.12] bg-white/[0.05] text-white/70 hover:bg-white/[0.09] hover:text-white hover:border-white/[0.18] focus-visible:ring-vektrum-blue",
  danger:
    "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 focus-visible:ring-red-500",
  success:
    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30 focus-visible:ring-emerald-500",
  ghost:
    "bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white/80 focus-visible:ring-vektrum-blue",
  // release — for fund release, high-value approvals, and irreversible financial actions.
  // Distinct from primary: heavier shadow, subtle amber glow communicates consequence.
  release:
    "bg-vektrum-blue text-white shadow-lg shadow-vektrum-blue/30 ring-1 ring-inset ring-amber-400/20 hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5 focus-visible:ring-vektrum-blue",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[36px] px-3.5 py-1.5 text-[13px] gap-1.5 rounded-xl",
  md: "min-h-[44px] px-5 py-2.5 text-[14px] gap-2 rounded-xl",
  lg: "min-h-[52px] px-8 py-3.5 text-[15px] gap-2 rounded-xl",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-semibold",
          "transition-all duration-150 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1B2A]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && (
          <Loader2
            className="animate-spin"
            size={size === "lg" ? 18 : 16}
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);