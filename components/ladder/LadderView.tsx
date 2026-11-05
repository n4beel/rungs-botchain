"use client";

import { useState } from "react";
import Link from "next/link";
import { formatAddress, type LadderRow } from "@/lib/rungs";
import Button from "@/components/ui/Button";

interface LadderViewProps {
  rows: LadderRow[];
  stakeEth: string;
  onChallenge?: (targetRank: number) => void;
  isChallenging?: boolean;
}

export default function LadderView({
  rows,
  stakeEth,
  onChallenge,
  isChallenging = false,
}: LadderViewProps) {
  const [viewTable, setViewTable] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Header controls & Mode Toggle */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)] font-mono">
          {rows.length} player{rows.length === 1 ? "" : "s"} ranked • Top rung #1
        </span>
        <button
          type="button"
          onClick={() => setViewTable(!viewTable)}
          className="font-heading uppercase tracking-wider text-[var(--accent)] font-bold hover:underline cursor-pointer"
          aria-pressed={viewTable}
        >
          {viewTable ? "View Visual Ladder" : "View Accessible Table"}
        </button>
      </div>

      {viewTable ? (
        /* Accessible Table Equivalent (Spec §8.3) */
        <div className="overflow-x-auto rounded border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <table className="w-full text-left text-xs font-sans">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] font-heading uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Rung</th>
                <th className="py-2.5 px-3">Player Wallet</th>
                <th className="py-2.5 px-3">Challenge Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
              {rows.map((row) => (
                <tr
                  key={row.rank}
                  className={`hover:bg-[var(--bg-elevated)]/40 ${
                    row.isCurrentUser ? "bg-[var(--bg-elevated)]/70" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 font-bodoni text-base font-bold text-[var(--accent)]">
                    #{row.rank}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatAddress(row.player)}
                    </span>
                    {row.isCurrentUser && (
                      <span className="ml-2 text-[10px] text-[var(--accent-ink)] font-heading uppercase px-1.5 py-0.5 rounded bg-[var(--accent)] font-bold">
                        You
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-muted)] font-sans">
                    {row.isBusy ? (
                      <span className="text-[var(--warning)] font-semibold">
                        Match In Progress {row.activeChallengeId && `(#${row.activeChallengeId.toString()})`}
                      </span>
                    ) : (
                      <span className="text-[var(--success)]">Free</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {row.canChallenge && onChallenge ? (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={isChallenging}
                        onClick={() => onChallenge(row.rank)}
                      >
                        Challenge #{row.rank}
                      </Button>
                    ) : row.isBusy && row.activeChallengeId ? (
                      <Link
                        href={`/challenge/${row.activeChallengeId.toString()}`}
                        className="text-[11px] font-heading uppercase text-[var(--accent)] hover:underline"
                      >
                        View Match
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Visual Vertical Ladder with Rails and Rungs (Spec §3.1) */
        <div className="relative rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-6 overflow-hidden">
          {/* Ladder Container with Left & Right Rails */}
          <div className="relative mx-auto max-w-lg py-4">
            {/* Left Rail */}
            <div
              className="absolute left-6 top-0 bottom-0 w-3 rounded-full shadow-md z-0"
              style={{ backgroundColor: "var(--border-strong)" }}
              aria-hidden="true"
            />
            {/* Right Rail */}
            <div
              className="absolute right-6 top-0 bottom-0 w-3 rounded-full shadow-md z-0"
              style={{ backgroundColor: "var(--border-strong)" }}
              aria-hidden="true"
            />

            {/* Stacked Rungs (Rank 1 at top) */}
            <div className="relative z-10 flex flex-col gap-3.5">
              {rows.map((row) => {
                const canChal = row.canChallenge && onChallenge;

                return (
                  <div
                    key={row.rank}
                    className={`relative mx-2 sm:mx-3 px-4 py-3 rounded-lg border shadow-sm transition-all flex items-center justify-between gap-3 ${
                      row.isCurrentUser
                        ? "bg-[var(--bg-elevated)] border-[var(--accent)] ring-1 ring-[var(--accent)]"
                        : "bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className="flex items-center gap-3">
                      <span className="font-bodoni text-xl sm:text-2xl font-bold text-[var(--accent)] min-w-[36px]">
                        #{row.rank}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                          {formatAddress(row.player)}
                        </span>
                        {row.isCurrentUser && (
                          <span className="text-[10px] font-heading uppercase tracking-wider text-[var(--accent)] font-bold">
                            Your Rung
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2">
                      {row.isBusy ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-heading uppercase px-2 py-0.5 rounded bg-[var(--bg-overlay)] text-[var(--warning)] font-bold">
                            Busy
                          </span>
                          {row.activeChallengeId && (
                            <Link
                              href={`/challenge/${row.activeChallengeId.toString()}`}
                              className="text-xs font-mono text-[var(--accent)] hover:underline"
                            >
                              #{row.activeChallengeId.toString()}
                            </Link>
                          )}
                        </div>
                      ) : canChal ? (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={isChallenging}
                          onClick={() => onChallenge(row.rank)}
                          title={`Stake ${stakeEth} BOT to challenge rung #${row.rank}`}
                        >
                          ▲ Challenge
                        </Button>
                      ) : (
                        <span className="text-xs font-mono text-[var(--text-muted)] opacity-60">
                          {row.isCurrentUser ? "Active" : "Free"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
