"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { RUNGS_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatRungsError } from "@/lib/errors";
import { formatAddress } from "@/lib/rungs";
import { assertActiveChain } from "@/lib/useChainWrite";

interface MyLadder {
  id: bigint;
  name: string;
  rank: number;
  totalPlayers: number;
  stake: bigint;
}

interface MyChallenge {
  id: bigint;
  ladderId: bigint;
  ladderName: string;
  opponent: string;
  role: "Challenger" | "Target";
  state: number;
  stake: bigint;
}

export default function MyMatchesPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });

  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment.address;

  const [pendingBalance, setPendingBalance] = useState<bigint>(0n);
  const [ladders, setLadders] = useState<MyLadder[]>([]);
  const [challenges, setChallenges] = useState<MyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = async () => {
    if (!publicClient || !address || contractAddress === "0x0000000000000000000000000000000000000000") {
      setLoading(false);
      return;
    }

    try {
      // 1. Pending balance
      const bal = await publicClient.readContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "pending",
        args: [address],
      });
      setPendingBalance(bal);

      // 2. Ladder count
      const countL = await publicClient.readContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "ladderCount",
      });

      const totalL = Number(countL);
      const myLaddersList: MyLadder[] = [];

      for (let i = 1; i <= totalL; i++) {
        const lId = BigInt(i);
        const rank = await publicClient.readContract({
          address: contractAddress,
          abi: RUNGS_ABI,
          functionName: "rankOf",
          args: [lId, address],
        });
        if (Number(rank) > 0) {
          const lData = await publicClient.readContract({
            address: contractAddress,
            abi: RUNGS_ABI,
            functionName: "ladderOf",
            args: [lId],
          });
          myLaddersList.push({
            id: lId,
            name: lData.name,
            rank: Number(rank),
            totalPlayers: lData.count,
            stake: lData.stake,
          });
        }
      }
      setLadders(myLaddersList);

      // 3. User's open / recent challenges
      const totalC = await publicClient.readContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "challengeCount",
      });

      const numC = Number(totalC);
      const myChalList: MyChallenge[] = [];

      const normAddr = address.toLowerCase();
      const limit = Math.min(numC, 50);

      for (let i = numC; i > numC - limit; i--) {
        const cId = BigInt(i);
        const chal = await publicClient.readContract({
          address: contractAddress,
          abi: RUNGS_ABI,
          functionName: "challengeOf",
          args: [cId],
        });

        const isChallenger = chal.challenger.toLowerCase() === normAddr;
        const isTarget = chal.target.toLowerCase() === normAddr;

        if (isChallenger || isTarget) {
          let lName = `Ladder #${chal.ladderId.toString()}`;
          try {
            const lInfo = await publicClient.readContract({
              address: contractAddress,
              abi: RUNGS_ABI,
              functionName: "ladderOf",
              args: [chal.ladderId],
            });
            lName = lInfo.name;
          } catch {
            // ignore
          }

          myChalList.push({
            id: cId,
            ladderId: chal.ladderId,
            ladderName: lName,
            opponent: isChallenger ? chal.target : chal.challenger,
            role: isChallenger ? "Challenger" : "Target",
            state: chal.state,
            stake: chal.stake,
          });
        }
      }

      setChallenges(myChalList);
      setLoading(false);
    } catch (err) {
      console.error("Failed to load user data:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
    const interval = setInterval(fetchUserData, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, contractAddress]);

  const handleWithdraw = async () => {
    if (!walletClient || !publicClient) return;
    setError(null);
    setFeedback(null);
    setWithdrawing(true);

    try {
      await assertActiveChain(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "withdraw",
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setFeedback("Balance withdrawn successfully to your wallet!");
      await fetchUserData();
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
    } finally {
      setWithdrawing(false);
    }
  };

  const stateLabels = ["Offered", "Active", "Settled", "Void", "Walkover", "Cancelled"];

  return (
    <PageShell
      title="My Matches & Balance"
      subtitle="View your active ladder rankings, matches in progress, and withdraw settled payouts."
    >
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        {/* Withdrawable Balance Panel */}
        <Panel
          title="Withdrawable Balance"
          subtitle="Match prizes won or stakes refunded from voided/cancelled matches"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
            <div>
              <span className="font-bodoni text-3xl sm:text-4xl font-bold text-[var(--accent)]">
                {formatEther(pendingBalance)} BOT
              </span>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
                {pendingBalance > 0n
                  ? "Available for immediate withdrawal via pull payment."
                  : "No funds currently pending."}
              </p>
            </div>
            {pendingBalance > 0n && (
              <Button
                size="md"
                variant="primary"
                disabled={withdrawing || !isConnected}
                onClick={handleWithdraw}
              >
                {withdrawing ? "Withdrawing…" : "Withdraw to Wallet"}
              </Button>
            )}
          </div>
        </Panel>

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

        {/* My Ladders */}
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Ladders You Compete In
          </h2>
          {loading ? (
            <Panel>
              <div className="py-6 text-center font-mono text-xs text-[var(--text-muted)] animate-pulse">
                Checking your ladder memberships…
              </div>
            </Panel>
          ) : ladders.length === 0 ? (
            <Panel>
              <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                You haven&apos;t joined any ladders yet. Browse active ladders or create one to join.
              </div>
            </Panel>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ladders.map((lad) => (
                <Link
                  key={lad.id.toString()}
                  href={`/ladder/${lad.id.toString()}`}
                  className="group no-underline block"
                >
                  <Panel className="hover:border-[var(--accent)] transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-heading font-bold text-sm text-[var(--text-primary)] truncate">
                        {lad.name}
                      </span>
                      <span className="font-bodoni font-bold text-base text-[var(--accent)]">
                        Rung #{lad.rank}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[var(--text-muted)]">
                      Ladder #{lad.id.toString()} • {lad.totalPlayers}/50 Players • Stake: {formatEther(lad.stake)} BOT
                    </p>
                  </Panel>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Challenges */}
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Your Match History
          </h2>
          {loading ? (
            <Panel>
              <div className="py-6 text-center font-mono text-xs text-[var(--text-muted)] animate-pulse">
                Fetching match history…
              </div>
            </Panel>
          ) : challenges.length === 0 ? (
            <Panel>
              <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                No challenges found for your wallet.
              </div>
            </Panel>
          ) : (
            <div className="flex flex-col gap-2.5">
              {challenges.map((c) => (
                <Link
                  key={c.id.toString()}
                  href={`/challenge/${c.id.toString()}`}
                  className="group no-underline block"
                >
                  <div className="p-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--accent)] transition-all flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-bodoni font-bold text-sm text-[var(--accent)]">
                        #{c.id.toString()}
                      </span>
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">
                          {c.ladderName}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          Opponent: {formatAddress(c.opponent)} ({c.role})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[var(--text-muted)]">
                        {formatEther(c.stake)} BOT
                      </span>
                      <span
                        className={`text-[10px] font-heading uppercase px-2 py-0.5 rounded font-bold ${
                          c.state === 1
                            ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                            : c.state === 2
                            ? "bg-[var(--success)] text-[var(--accent-ink)]"
                            : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                        }`}
                      >
                        {stateLabels[c.state]}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
