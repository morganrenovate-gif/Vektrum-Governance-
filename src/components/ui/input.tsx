import { cn } from "@/lib/utils";
import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      label,
      error,
      helperText,
      fullWidth = true,
      id,
      className,
      required,
      ...props
    },
    ref
  ) {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            // VISUAL: was text-white (#141414) — black on dark bg
            // now text-white/70 — correct on navy
            className="text-[13px] font-medium text-white/70"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-red-400" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
              ? `${inputId}-helper`
              : undefined
          }
          aria-invalid={error ? "true" : undefined}
          className={cn(
            "block rounded-xl border px-3.5 py-2.5 text-[14px] text-white",
            "placeholder:text-white/20",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "min-h-[44px]",
            fullWidth && "w-full",
            error
              ? "border-red-500/40 bg-red-500/[0.07] focus:border-red-500/60 focus:ring-red-500/20"
              : "border-white/[0.10] bg-surface-3 focus:border-vektrum-blue/60 focus:ring-vektrum-blue/20",
            props.disabled && "cursor-not-allowed opacity-50",
            className
          )}
          {...props}
        />

        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-[12px] font-medium text-red-400"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-[12px] text-white/35">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

// ─── Textarea variant ─────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, error, helperText, fullWidth = true, id, className, required, ...props },
    ref
  ) {
    const textareaId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={cn("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-[13px] font-medium text-white/70"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-red-400" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          aria-invalid={error ? "true" : undefined}
          rows={3}
          className={cn(
            "block rounded-xl border px-3.5 py-2.5 text-[14px] text-white",
            "placeholder:text-white/25 resize-y",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            fullWidth && "w-full",
            error
              ? "border-red-500/40 bg-red-500/[0.07] focus:border-red-500/60 focus:ring-red-500/20"
              : "border-white/[0.10] bg-surface-3 focus:border-vektrum-blue/60 focus:ring-vektrum-blue/20",
            className
          )}
          {...props}
        />
        {error && (
          <p role="alert" className="text-[12px] font-medium text-red-400">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="text-[12px] text-white/40">{helperText}</p>
        )}
      </div>
    );
  }
);