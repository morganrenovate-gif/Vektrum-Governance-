"use client";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import React from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

// ── Dark-first variant classes ────────────────────────────────────────────────
//
// primary   — unchanged, already correct
// secondary — was bg-vektrum-surface (white) + text-vektrum-muted (near-black)
//             now bg-white/[0.06] + text-white/70 — correct on dark navy
// ghost     — was bg-transparent + text-vektrum-muted (near-black)
//             now bg-transparent + text-white/55 — correct on dark navy
// danger    — unchanged
// success   — unchanged
//
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-vektrum-blue text-white shadow-lg shadow-vektrum-blue/30 hover:bg-vektrum-blue-hover hover:shadow-xl hover:shadow-vektrum-blue/40 hover:-translate-y-0.5 focus-visible:ring-vektrum-blue disabled:opacity-50",
  secondary:
    "border border-white/15 bg-white/[0.05] text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-vektrum-blue disabled:opacity-40",
  danger:
    "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 focus-visible:ring-red-500 disabled:opacity-50",
  success:
    "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 focus-visible:ring-emerald-500 disabled:opacity-50",
  ghost:
    "bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white/80 focus-visible:ring-vektrum-blue disabled:opacity-30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[40px] px-4 py-2 text-[13px] gap-1.5 rounded-xl",
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