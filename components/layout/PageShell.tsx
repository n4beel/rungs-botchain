"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { footerLinks } from "@/lib/botchain/chain";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function PageShell({ children, title, subtitle }: PageShellProps) {
  const links = footerLinks();
  const pathname = usePathname();

  const navigation = [
    { href: "/", label: "Ladders" },
    { href: "/new", label: "Create Ladder" },
    { href: "/me", label: "My Matches" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Top Banner Navigation */}
      <nav
        className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border-default)] px-4 sm:px-6 py-3"
        aria-label="Global Ladder Navigation"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 no-underline group">
              <span className="text-2xl select-none group-hover:-translate-y-0.5 transition-transform" aria-hidden="true">
                🪜
              </span>
              <span className="font-heading text-xl font-bold tracking-tight text-[var(--accent)]">
                {app.name}
              </span>
            </Link>

            <div className="hidden sm:flex items-center gap-2">
              {navigation.map((n) => {
                const isActive = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`px-3 py-1.5 rounded text-xs font-heading uppercase tracking-wider font-semibold transition-colors ${
                      isActive
                        ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NetworkBadge />
            <div className="w-[140px] sm:w-[170px]">
              <ConnectButton />
            </div>
          </div>
        </div>

        {/* Mobile Nav Links */}
        <div className="flex sm:hidden items-center justify-around pt-2 mt-2 border-t border-[var(--border-subtle)]">
          {navigation.map((n) => {
            const isActive = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-2 py-1 text-xs font-heading uppercase tracking-wider font-semibold ${
                  isActive ? "text-[var(--accent)] underline" : "text-[var(--text-muted)]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 md:py-8">
        {(title || subtitle) && (
          <header className="mb-6 space-y-1">
            {title && (
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-sm text-[var(--text-muted)] max-w-3xl">
                {subtitle}
              </p>
            )}
          </header>
        )}
        {children}
      </main>

      {/* Footer (Spec §3.5) */}
      <footer className="mt-auto bg-[var(--bg-surface)] border-t border-[var(--border-default)] py-6 text-xs text-[var(--text-muted)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-5 flex-wrap justify-center sm:justify-start">
            {links.contract && (
              <a
                href={links.contract}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-[var(--text-primary)]"
              >
                Contract
              </a>
            )}
            <a
              href={links.site}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-[var(--text-primary)]"
            >
              botchain.ai
            </a>
            <a
              href={links.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-[var(--text-primary)]"
            >
              Explorer
            </a>
          </div>
          <BuiltOnBotChain />
        </div>
      </footer>
    </div>
  );
}
