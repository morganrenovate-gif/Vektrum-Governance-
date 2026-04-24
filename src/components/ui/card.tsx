import { cn } from "@/lib/utils";
import React from "react";

// ─── Card ─────────────────────────────────────────────────────────────────────
//
// DARK-FIRST: The app is predominantly dark navy.
// Card variants:
//   default  — standard panel (bg-surface-2, rounded-xl, shadow-card)
//   feature  — elevated panel for important content (shadow-feature)
//   inset    — nested content panel (bg-surface-3, no shadow)
//   light    — for genuine light-section marketing pages only
//
// Corner radius is rounded-xl (12px) rather than rounded-2xl (16px).
// Institutional software uses slightly tighter radius than consumer apps.
//
interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "feature" | "inset" | "light";
}

export function Card({ children, className, variant = "default" }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden",
        variant === "default" && "border border-white/[0.08] bg-surface-2 shadow-card",
        variant === "feature" && "border border-white/[0.1] bg-surface-2 shadow-feature",
        variant === "inset"   && "border border-white/[0.06] bg-surface-3",
        variant === "light"   && "border border-black/[0.07] bg-white shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── CardHeader ───────────────────────────────────────────────────────────────
interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  border?: boolean;
  variant?: "dark" | "light";
}

export function CardHeader({
  children,
  className,
  border = true,
  variant = "dark",
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "px-5 py-4",
        border && (
          variant === "dark"
            ? "border-b border-white/[0.06]"
            : "border-b border-black/[0.06]"
        ),
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── CardBody ─────────────────────────────────────────────────────────────────
interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn("px-5 py-5", className)}>{children}</div>;
}

// ─── CardFooter ───────────────────────────────────────────────────────────────
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
  variant?: "dark" | "light";
}

export function CardFooter({ children, className, variant = "dark" }: CardFooterProps) {
  return (
    <div
      className={cn(
        "px-5 py-3",
        variant === "dark"
          ? "border-t border-white/[0.05] bg-white/[0.015]"
          : "border-t border-black/[0.06] bg-[#F8F9FB]",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── CardTitle ────────────────────────────────────────────────────────────────
export function CardTitle({
  children,
  className,
  variant = "dark",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "dark" | "light";
}) {
  return (
    <h3
      className={cn(
        "text-[14px] font-semibold tracking-[-0.01em] leading-none",
        variant === "dark" ? "text-white" : "text-white",
        className
      )}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
  variant = "dark",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "dark" | "light";
}) {
  return (
    <p
      className={cn(
        "mt-1 text-[13px] leading-relaxed",
        variant === "dark" ? "text-white/75" : "text-white/75",
        className
      )}
    >
      {children}
    </p>
  );
}
