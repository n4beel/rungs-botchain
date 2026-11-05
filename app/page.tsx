"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { RUNGS_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatAddress } from "@/lib/rungs";

interface LadderSummary {
  id: bigint;
  name: string;
  creator: string;
  count: number;
  stake: bigint;
  topPlayers: string[];
  userIsMember: boolean;
}

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment.address;
  const isDeployed = contractAddress !== "0x0000000000000000000000000000000000000000";

  const publicClient = usePublicClient({ chainId: activeBotChain.id });

  const [ladders, setLadders] = useState<LadderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !isDeployed) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadLadders() {
      try {
        const count = await publicClient!.readContract({
          address: contractAddress,
          abi: RUNGS_ABI,
          functionName: "ladderCount",
        });

        const total = Number(count);
        if (total === 0) {
          if (isMounted) {
            setLadders([]);
            setLoading(false);
          }
          return;
        }

        const list: LadderSummary[] = [];

        // Fetch all ladders (up to 30)
        const limit = Math.min(total, 30);
        for (let i = total; i > total - limit; i--) {
          const lId = BigInt(i);
          const [lData, topStandings, userRank] = await Promise.all([
            publicClient!.readContract({
              address: contractAddress,
              abi: RUNGS_ABI,
              functionName: "ladderOf",
              args: [lId],
            }),
            publicClient!.readContract({
              address: contractAddress,
              abi: RUNGS_ABI,
              functionName: "standings",
              args: [lId, 0, 3],
            }),
            address
              ? publicClient!.readContract({
                  address: contractAddress,
                  abi: RUNGS_ABI,
                  functionName: "rankOf",
                  args: [lId, address],
                })
              : Promise.resolve(0),
          ]);

          list.push({
            id: lId,
            name: lData.name,
            creator: lData.creator,
            count: lData.count,
            stake: lData.stake,
            topPlayers: [...topStandings],
            userIsMember: Number(userRank) > 0,
          });
        }

        if (isMounted) {
          // Sort: ladders the user is on first, then others
          list.sort((a, b) => {
            if (a.userIsMember === b.userIsMember) return Number(b.id - a.id);
            return a.userIsMember ? -1 : 1;
          });
          setLadders(list);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load ladders:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadLadders();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, address]);

  return (
    <PageShell
      title="Challenge Ladders"
      subtitle="Challenge someone up to three rungs above you. Win and swap places on the ladder."
    >
      <div className="flex flex-col gap-6">
        {/* Limits & Capabilities Panel (Spec §1, §3.4) */}
        <Panel
          appearance="recessed"
          title="What counts as a result"
          subtitle="Fair play rules, mutual reporting, and edge case boundaries"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans text-[var(--text-muted)]">
            <div className="flex flex-col gap-1.5 p-3 rounded bg-[var(--bg-elevated)]/40 border border-[var(--border-subtle)]">
              <span className="font-heading uppercase tracking-wider font-bold text-[var(--accent)]">
                Mutual Reports Only
              </span>
              <p>
                The contract can&apos;t see the match. A result counts only if both players report the same winner. Disagreements void the match.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded bg-[var(--bg-elevated)]/40 border border-[var(--border-subtle)]">
              <span className="font-heading uppercase tracking-wider font-bold text-[var(--accent)]">
                One Wallet = One Player
              </span>
              <p>
                One wallet is one player. It can&apos;t tell people apart. Anyone can join at the bottom rung (up to 50 players max).
              </p>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded bg-[var(--bg-elevated)]/40 border border-[var(--border-subtle)]">
              <span className="font-heading uppercase tracking-wider font-bold text-[var(--accent)]">
                Walkover Clock
              </span>
              <p>
                If a top player never accepts, they lose their place by walkover after three days. Ranks swap and challenger stake returns.
              </p>
            </div>
          </div>
        </Panel>

        {/* Ladders List Section */}
        {loading ? (
          <Panel>
            <div className="py-12 text-center text-sm font-mono text-[var(--text-muted)] animate-pulse">
              Loading challenge ladders from chain…
            </div>
          </Panel>
        ) : !isDeployed ? (
          <Panel>
            <div className="py-12 text-center text-sm text-[var(--warning)] font-sans">
              Rungs contract is not yet deployed on this network.
            </div>
          </Panel>
        ) : ladders.length === 0 ? (
          <Panel>
            <div className="py-12 text-center flex flex-col items-center gap-3">
              <p className="text-sm text-[var(--text-muted)] font-sans">
                No challenge ladders have been created yet.
              </p>
              <Link href="/new">
                <Button size="md">Create the First Ladder</Button>
              </Link>
            </div>
          </Panel>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Active Ladders
              </h2>
              <Link href="/new">
                <Button size="sm">＋ New Ladder</Button>
              </Link>
            </div>

            {/* List of small ladders (Spec §3.1: stub icons with top three names) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ladders.map((ladder) => (
                <Link
                  key={ladder.id.toString()}
                  href={`/ladder/${ladder.id}`}
                  className="group no-underline block"
                >
                  <Panel
                    className="h-full hover:border-[var(--accent)] transition-all cursor-pointer"
                    title={
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate pr-2">{ladder.name}</span>
                        {ladder.userIsMember && (
                          <span className="text-[10px] font-heading uppercase px-2 py-0.5 rounded bg-[var(--accent)] text-[var(--accent-ink)] font-bold shrink-0">
                            Member
                          </span>
                        )}
                      </div>
                    }
                    subtitle={`Ladder #${ladder.id.toString()} • Stake: ${formatEther(ladder.stake)} BOT • ${ladder.count}/50 Players`}
                  >
                    <div className="flex items-center gap-4 mt-2">
                      {/* Ladder Stub Icon */}
                      <div
                        className="w-10 h-16 rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)] flex flex-col justify-around px-1.5 py-1 shrink-0"
                        aria-hidden="true"
                      >
                        <div className="h-1 bg-[var(--accent)] rounded-full w-full opacity-90" />
                        <div className="h-1 bg-[var(--accent)] rounded-full w-full opacity-70" />
                        <div className="h-1 bg-[var(--accent)] rounded-full w-full opacity-50" />
                      </div>

                      {/* Top 3 Standings Preview */}
                      <div className="flex-1 flex flex-col gap-1 text-xs font-mono">
                        {ladder.topPlayers.length === 0 ? (
                          <span className="text-[var(--text-muted)] italic">
                            No players yet. Join at rung #1!
                          </span>
                        ) : (
                          ladder.topPlayers.map((player, idx) => (
                            <div
                              key={player}
                              className="flex items-center justify-between text-[11px]"
                            >
                              <span className="font-bodoni font-bold text-[var(--accent)]">
                                #{idx + 1}
                              </span>
                              <span className="text-[var(--text-primary)]">
                                {formatAddress(player)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </Panel>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
