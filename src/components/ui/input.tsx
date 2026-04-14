import { cn } from "@/lib/utils";
import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Render the input with full width (default: true) */
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
      <div className={cn("flex flex-col gap-1", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-vektrum-red" aria-hidden="true">
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
            "block rounded-md border px-3 py-2.5 text-sm text-slate-900",
            "placeholder:text-slate-400",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "min-h-[44px]", // Touch target
            fullWidth && "w-full",
            error
              ? "border-vektrum-red bg-red-50 focus:border-vektrum-red focus:ring-red-200"
              : "border-slate-300 bg-white focus:border-vektrum-blue focus:ring-blue-100",
            props.disabled && "cursor-not-allowed bg-slate-50 text-slate-500",
            className
          )}
          {...props}
        />

        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs font-medium text-vektrum-red"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-slate-500">
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
      <div className={cn("flex flex-col gap-1", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-vektrum-red" aria-hidden="true">
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
            "block rounded-md border px-3 py-2.5 text-sm text-slate-900",
            "placeholder:text-slate-400 resize-y",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            fullWidth && "w-full",
            error
              ? "border-vektrum-red bg-red-50 focus:border-vektrum-red focus:ring-red-200"
              : "border-slate-300 bg-white focus:border-vektrum-blue focus:ring-blue-100",
            className
          )}
          {...props}
        />
        {error && (
          <p role="alert" className="text-xs font-medium text-vektrum-red">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);
