"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import LadderView from "@/components/ladder/LadderView";
import { RUNGS_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatRungsError } from "@/lib/errors";
import { ladderRows, type LadderRow } from "@/lib/rungs";
import { assertActiveChain } from "@/lib/useChainWrite";

interface LadderDetails {
  id: bigint;
  name: string;
  creator: string;
  count: number;
  stake: bigint;
}

export default function LadderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const ladderId = BigInt(resolvedParams.id);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });

  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment.address;

  const [ladder, setLadder] = useState<LadderDetails | null>(null);
  const [standingsList, setStandingsList] = useState<string[]>([]);
  const [userRank, setUserRank] = useState<number>(0);
  const [busyMap, setBusyMap] = useState<Record<string, bigint>>({});
  const [userOpenChallenge, setUserOpenChallenge] = useState<bigint | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll ladder data every 8 seconds
  const fetchLadderData = async () => {
    if (!publicClient || contractAddress === "0x0000000000000000000000000000000000000000") {
      setLoading(false);
      return;
    }

    try {
      const lData = await publicClient.readContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "ladderOf",
        args: [ladderId],
      });

      const count = lData.count;
      setLadder({
        id: ladderId,
        name: lData.name,
        creator: lData.creator,
        count: count,
        stake: lData.stake,
      });

      if (count > 0) {
        // Read full standings (up to 50 players max)
        const players = await publicClient.readContract({
          address: contractAddress,
          abi: RUNGS_ABI,
          functionName: "standings",
          args: [ladderId, 0, count],
        });
        setStandingsList([...players]);

        // Find active challenges for players by checking latest challenges
        const totalChallenges = await publicClient.readContract({
          address: contractAddress,
          abi: RUNGS_ABI,
          functionName: "challengeCount",
        });

        const numC = Number(totalChallenges);
        const map: Record<string, bigint> = {};
        const limit = Math.min(numC, 50);

        for (let i = numC; i > numC - limit; i--) {
          const cid = BigInt(i);
          const chal = await publicClient.readContract({
            address: contractAddress,
            abi: RUNGS_ABI,
            functionName: "challengeOf",
            args: [cid],
          });
          if (chal.ladderId === ladderId && (chal.state === 0 || chal.state === 1)) {
            map[chal.challenger.toLowerCase()] = cid;
            map[chal.target.toLowerCase()] = cid;
          }
        }
        setBusyMap(map);
      } else {
        setStandingsList([]);
        setBusyMap({});
      }

      if (address) {
        const uRank = await publicClient.readContract({
          address: contractAddress,
          abi: RUNGS_ABI,
          functionName: "rankOf",
          args: [ladderId, address],
        });
        const rankNum = Number(uRank);
        setUserRank(rankNum);

        // Check if user has open challenge
        const userCid = busyMap[address.toLowerCase()] || null;
        setUserOpenChallenge(userCid);
      } else {
        setUserRank(0);
        setUserOpenChallenge(null);
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load ladder details:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLadderData();
    const interval = setInterval(fetchLadderData, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladderId, contractAddress, address]);

  // Handle Join Ladder
  const handleJoin = async () => {
    if (!walletClient || !publicClient || !ladder) return;
    setError(null);
    setFeedback(null);
    setActionPending(true);

    try {
      await assertActiveChain(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "join",
        args: [ladderId],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setFeedback("You successfully joined the ladder!");
      await fetchLadderData();
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
    } finally {
      setActionPending(false);
    }
  };

  // Handle Challenge Target Rung
  const handleChallenge = async (targetRank: number) => {
    if (!walletClient || !publicClient || !ladder) return;
    setError(null);
    setFeedback(null);
    setActionPending(true);

    try {
      await assertActiveChain(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "challenge",
        args: [ladderId, targetRank],
        value: ladder.stake,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setFeedback(`Challenge issued to rung #${targetRank}!`);
      await fetchLadderData();
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
    } finally {
      setActionPending(false);
    }
  };

  if (loading && !ladder) {
    return (
      <PageShell title="Loading Ladder…">
        <Panel>
          <div className="py-16 text-center font-mono text-sm text-[var(--text-muted)] animate-pulse">
            Loading ladder details from chain…
          </div>
        </Panel>
      </PageShell>
    );
  }

  if (!ladder) {
    return (
      <PageShell title="Ladder Not Found">
        <Panel>
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">
            Ladder #{ladderId.toString()} does not exist.
          </div>
        </Panel>
      </PageShell>
    );
  }

  const rows: LadderRow[] = ladderRows(standingsList, address, userRank, busyMap);
  const stakeEth = formatEther(ladder.stake);
  const isMember = userRank > 0;
  const isLadderFull = ladder.count >= 50;

  return (
    <PageShell
      title={ladder.name}
      subtitle={`Ladder #${ladder.id.toString()} • Fixed Stake: ${stakeEth} BOT • Up to 50 players`}
    >
      <div className="flex flex-col gap-6">
        {/* User status & Open challenge banner */}
        {userOpenChallenge && (
          <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--accent)] flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden="true">
                ⚔️
              </span>
              <div>
                <p className="font-heading text-sm font-bold text-[var(--accent)] uppercase tracking-wider">
                  You Have An Open Challenge (#{userOpenChallenge.toString()})
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  Action required or awaiting mutual match report.
                </p>
              </div>
            </div>
            <Link href={`/challenge/${userOpenChallenge.toString()}`}>
              <Button size="sm" variant="primary">
                View Match Panel
              </Button>
            </Link>
          </div>
        )}

        {/* Join action banner if not member */}
        {!isMember && (
          <Panel appearance="elevated">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-heading text-base font-bold text-[var(--text-primary)]">
                  {isLadderFull ? "Ladder Is Full" : "Ready to Compete?"}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {isLadderFull
                    ? "This ladder has reached the maximum of 50 players."
                    : `Join at the bottom rung (#${ladder.count + 1}). No entry fee required to join; stakes are only deposited when challenging.`}
                </p>
              </div>
              {!isLadderFull && (
                <Button
                  size="md"
                  variant="primary"
                  disabled={actionPending || !isConnected}
                  onClick={handleJoin}
                >
                  {actionPending
                    ? "Joining…"
                    : isConnected
                    ? `Join at Rung #${ladder.count + 1}`
                    : "Connect Wallet to Join"}
                </Button>
              )}
            </div>
          </Panel>
        )}

        {/* Member rules alert */}
        {isMember && (
          <div className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] p-3 rounded border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
            <span>
              Your current rank: <strong className="text-[var(--accent)] font-bodoni text-sm">#{userRank}</strong>
            </span>
            <span>
              Stake {stakeEth} BOT to challenge someone up to 3 rungs above you.
            </span>
          </div>
        )}

        {/* Feedback / Error Alerts */}
        {feedback && (
          <div className="p-3 rounded bg-[var(--success)]/15 border border-[var(--success)] text-xs text-[var(--success)]">
            {feedback}
          </div>
        )}
        {error && (
          <div className="p-3 rounded bg-[var(--danger)]/15 border border-[var(--danger)] text-xs text-[var(--danger)]">
            {error}
          </div>
        )}

        {/* The Visual & Accessible Ladder */}
        <LadderView
          rows={rows}
          stakeEth={stakeEth}
          onChallenge={isMember ? handleChallenge : undefined}
          isChallenging={actionPending}
        />
      </div>
    </PageShell>
  );
}
