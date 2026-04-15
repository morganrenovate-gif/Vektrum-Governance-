import { cn } from "@/lib/utils";
import React from "react";

// ─── Card root ────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Remove default padding from the body area */
  noPadding?: boolean;
}

export function Card({ children, className, noPadding }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-vektrum-border bg-vektrum-surface shadow-sm",
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
  /** Render a subtle separator line between header and body */
  border?: boolean;
}

export function CardHeader({
  children,
  className,
  border = true,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "px-5 py-4",
        border && "border-b border-vektrum-border-subtle",
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
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        "border-t border-vektrum-border-subtle bg-vektrum-surface-alt px-5 py-3",
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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn("text-base font-semibold text-vektrum-text leading-none", className)}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-1 text-sm text-vektrum-muted", className)}>{children}</p>
  );
}
