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

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-vektrum-blue text-white hover:bg-blue-700 focus-visible:ring-blue-500 disabled:bg-blue-300",
  secondary:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400 disabled:text-slate-400",
  danger:
    "bg-vektrum-red text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300",
  success:
    "bg-vektrum-green text-white hover:bg-green-700 focus-visible:ring-green-500 disabled:bg-green-300",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400 disabled:text-slate-300",
};

const sizeClasses: Record<ButtonSize, string> = {
  // All sizes have a minimum height of 44px for mobile touch targets
  sm: "min-h-[44px] px-3 py-2 text-sm gap-1.5",
  md: "min-h-[44px] px-4 py-2.5 text-sm gap-2",
  lg: "min-h-[44px] px-6 py-3 text-base gap-2",
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
          // Base styles
          "inline-flex items-center justify-center rounded-md font-medium",
          "transition-colors duration-150 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
          // Variant + size
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
