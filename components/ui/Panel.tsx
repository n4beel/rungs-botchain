"use client";

import { CSSProperties, HTMLAttributes, ReactNode } from "react";

export interface LadderPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  appearance?: "solid" | "elevated" | "recessed";
}

export default function Panel({
  title,
  subtitle,
  badge,
  actions,
  appearance = "solid",
  children,
  className = "",
  style,
  ...props
}: LadderPanelProps) {
  const bg =
    appearance === "elevated"
      ? "var(--bg-elevated)"
      : appearance === "recessed"
      ? "var(--bg-overlay)"
      : "var(--bg-surface)";

  const panelStyles: CSSProperties = {
    backgroundColor: bg,
    borderColor: "var(--border-default)",
    ...style,
  };

  return (
    <section
      className={`border rounded-lg p-5 sm:p-6 shadow-sm relative ${className}`}
      style={panelStyles}
      {...props}
    >
      {(title || subtitle || badge || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-[var(--border-subtle)]">
          <div>
            {title && (
              <h2 className="font-heading text-lg font-bold tracking-tight text-[var(--text-primary)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {(badge || actions) && (
            <div className="flex items-center gap-2">
              {badge}
              {actions}
            </div>
          )}
        </header>
      )}
      <div className="w-full">{children}</div>
    </section>
  );
}
