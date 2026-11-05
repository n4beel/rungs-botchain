"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type RungButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type RungButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: RungButtonVariant;
  size?: RungButtonSize;
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, children, className = "", style, ...props }, ref) => {
    const vClass =
      variant === "primary"
        ? "bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105"
        : variant === "secondary"
        ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-surface)]"
        : variant === "danger"
        ? "bg-transparent text-[var(--danger)] border border-[var(--danger)] hover:bg-[var(--danger)]/10"
        : "bg-transparent text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]";

    const sClass =
      size === "sm"
        ? "px-3 py-1.5 text-xs"
        : size === "lg"
        ? "px-6 py-3 text-base"
        : "px-4 py-2 text-sm";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-sm font-heading uppercase tracking-wider font-semibold cursor-pointer select-none transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${vClass} ${sClass} ${className}`}
        style={style}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
