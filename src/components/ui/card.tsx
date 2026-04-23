import { cn } from "@/lib/utils";
import React from "react";

// ─── Card root ────────────────────────────────────────────────────────────────
//
// DARK-FIRST: The app is predominantly dark navy (bg-[#0D1B2A] / bg-[#031226]).
// Card defaults to the established dark surface (bg-[#111827]).
// Pass variant="light" only in genuine light-section contexts (marketing pages).
//
interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Remove default padding from the body area */
  noPadding?: boolean;
  /** Light variant for use inside bg-white / bg-[#F8F9FB] marketing sections */
  variant?: "dark" | "light";
}

export function Card({ children, className, noPadding, variant = "dark" }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden",
        variant === "dark"
          ? "border-white/[0.08] bg-surface-2 shadow-card"
          : "border-black/[0.07] bg-white shadow-sm",
        !noPadding && "overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Card header ─────────────────────────────────────────────────────────────
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

// ─── Card body ────────────────────────────────────────────────────────────────
interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

// ─── Card footer ─────────────────────────────────────────────────────────────
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
          ? "border-t border-white/[0.06] bg-white/[0.02]"
          : "border-t border-black/[0.06] bg-[#F8F9FB]",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Card title ───────────────────────────────────────────────────────────────
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
        "text-[15px] font-semibold tracking-[-0.01em] leading-none",
        variant === "dark" ? "text-white" : "text-vektrum-text",
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
        variant === "dark" ? "text-white/50" : "text-vektrum-muted",
        className
      )}
    >
      {children}
    </p>
  );
}