"use client";

import { useEffect, useState, use } from "react";
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
import { formatAddress, outcomeOf, ChallengeState } from "@/lib/rungs";
import { assertActiveChain } from "@/lib/useChainWrite";

interface ChallengeData {
  ladderId: bigint;
  challenger: string;
  target: string;
  acceptBy: bigint;
  reportBy: bigint;
  stake: bigint;
  state: number;
  reportC: number;
  reportT: number;
}

export default function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const challengeId = BigInt(resolvedParams.id);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });

  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment.address;

  const [chal, setChal] = useState<ChallengeData | null>(null);
  const [ladderName, setLadderName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState<bigint>(BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(BigInt(Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchChallenge = async () => {
    if (!publicClient || contractAddress === "0x0000000000000000000000000000000000000000") {
      setLoading(false);
      return;
    }

    try {
      const data = await publicClient.readContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "challengeOf",
        args: [challengeId],
      });

      setChal({
        ladderId: data.ladderId,
        challenger: data.challenger,
        target: data.target,
        acceptBy: data.acceptBy,
        reportBy: data.reportBy,
        stake: data.stake,
        state: data.state,
        reportC: data.reportC,
        reportT: data.reportT,
      });

      if (data.ladderId > 0n) {
        const lData = await publicClient.readContract({
          address: contractAddress,
          abi: RUNGS_ABI,
          functionName: "ladderOf",
          args: [data.ladderId],
        });
        setLadderName(lData.name);
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load challenge:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenge();
    const interval = setInterval(fetchChallenge, 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId, contractAddress]);

  const normUser = address?.toLowerCase();
  const isChallenger = normUser && chal && normUser === chal.challenger.toLowerCase();
  const isTarget = normUser && chal && normUser === chal.target.toLowerCase();
  const isPlayer = isChallenger || isTarget;

  // Actions
  const handleAccept = async () => {
    if (!walletClient || !publicClient || !chal) return;
    setError(null);
    setFeedback(null);
    setActionPending(true);

    try {
      await assertActiveChain(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "accept",
        args: [challengeId],
        value: chal.stake,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setFeedback("Challenge accepted! Match is now active.");
      await fetchChallenge();
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
    } finally {
      setActionPending(false);
    }
  };

  const handleCancel = async () => {
    if (!walletClient || !publicClient || !chal) return;
    setError(null);
    setFeedback(null);
    setActionPending(true);

    try {
      await assertActiveChain(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "cancel",
        args: [challengeId],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setFeedback("Challenge cancelled and your stake has been refunded.");
      await fetchChallenge();
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
    } finally {
      setActionPending(false);
    }
  };

  const handleWalkover = async () => {
    if (!walletClient || !publicClient || !chal) return;
    setError(null);
    setFeedback(null);
    setActionPending(true);

    try {
      await assertActiveChain(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "walkover",
        args: [challengeId],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setFeedback("Walkover claimed! Rungs swapped and stake refunded.");
      await fetchChallenge();
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
    } finally {
      setActionPending(false);
    }
  };

  const handleReport = async (challengerWon: boolean) => {
    if (!walletClient || !publicClient || !chal) return;
    setError(null);
    setFeedback(null);
    setActionPending(true);

    try {
      await assertActiveChain(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "report",
        args: [challengeId, challengerWon],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setFeedback("Result reported! Awaiting opponent's confirmation.");
      await fetchChallenge();
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
    } finally {
      setActionPending(false);
    }
  };

  const handleVoidTimeout = async () => {
    if (!walletClient || !publicClient || !chal) return;
    setError(null);
    setFeedback(null);
    setActionPending(true);

    try {
      await assertActiveChain(walletClient);
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "voidChallenge",
        args: [challengeId],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setFeedback("Challenge voided due to report deadline passing. Stakes returned to pending balances.");
      await fetchChallenge();
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
    } finally {
      setActionPending(false);
    }
  };

  if (loading && !chal) {
    return (
      <PageShell title="Loading Challenge…">
        <Panel>
          <div className="py-16 text-center font-mono text-sm text-[var(--text-muted)] animate-pulse">
            Loading challenge details from chain…
          </div>
        </Panel>
      </PageShell>
    );
  }

  if (!chal || chal.ladderId === 0n) {
    return (
      <PageShell title="Challenge Not Found">
        <Panel>
          <div className="py-16 text-center text-sm text-[var(--text-muted)]">
            Challenge #{challengeId.toString()} does not exist.
          </div>
        </Panel>
      </PageShell>
    );
  }

  const stakeEth = formatEther(chal.stake);
  const totalPrizeEth = formatEther(chal.stake * 2n);

  // States: Offered, Active, Settled, Void, Walkover, Cancelled
  const isOffered = chal.state === ChallengeState.Offered;
  const isActive = chal.state === ChallengeState.Active;
  const isSettled = chal.state === ChallengeState.Settled;
  const isVoid = chal.state === ChallengeState.Void;
  const isWalkover = chal.state === ChallengeState.Walkover;
  const isCancelled = chal.state === ChallengeState.Cancelled;

  // Accept window & Report window
  const acceptExpired = currentTime > chal.acceptBy;
  const reportExpired = currentTime > chal.reportBy;

  // Reports status (Spec §4: A player's own report is shown after it is sent; the other side's report is shown only as 'reported' until both are in)
  const userReport = isChallenger ? chal.reportC : isTarget ? chal.reportT : 0;
  const userHasReported = userReport > 0;
  const bothReported = chal.reportC > 0 && chal.reportT > 0;

  const stateLabels = ["Offered", "Active", "Settled", "Void", "Walkover", "Cancelled"];

  return (
    <PageShell
      title={`Challenge #${challengeId.toString()}`}
      subtitle={`Ladder: ${ladderName || `#${chal.ladderId.toString()}`} • State: ${stateLabels[chal.state]}`}
    >
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        {/* Back Link */}
        <div>
          <Link
            href={`/ladder/${chal.ladderId.toString()}`}
            className="text-xs font-heading uppercase tracking-wider text-[var(--accent)] hover:underline inline-flex items-center gap-1"
          >
            ← Back to {ladderName || "Ladder"}
          </Link>
        </div>

        {/* Challenge Overview Card */}
        <Panel
          title={
            <div className="flex items-center justify-between w-full">
              <span>Match Details</span>
              <span
                className={`text-[10px] font-heading uppercase px-2.5 py-0.5 rounded font-bold ${
                  isActive
                    ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                    : isSettled
                    ? "bg-[var(--success)] text-[var(--accent-ink)]"
                    : isVoid || isCancelled
                    ? "bg-[var(--danger)] text-white"
                    : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                }`}
              >
                {stateLabels[chal.state]}
              </span>
            </div>
          }
          subtitle={`Stakes: 2 × ${stakeEth} BOT = ${totalPrizeEth} BOT Winner Pool`}
        >
          <div className="grid grid-cols-2 gap-4 py-3 border-y border-[var(--border-subtle)] my-2">
            {/* Challenger side */}
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-heading uppercase text-[var(--text-muted)]">
                Challenger
              </span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                {formatAddress(chal.challenger)}
              </span>
              {isChallenger && (
                <span className="text-[10px] font-heading uppercase text-[var(--accent)] font-bold">
                  (You)
                </span>
              )}
            </div>

            {/* Target side */}
            <div className="flex flex-col gap-1 text-right">
              <span className="text-[11px] font-heading uppercase text-[var(--text-muted)]">
                Target (Defender)
              </span>
              <span className="font-mono text-sm font-bold text-[var(--text-primary)]">
                {formatAddress(chal.target)}
              </span>
              {isTarget && (
                <span className="text-[10px] font-heading uppercase text-[var(--accent)] font-bold">
                  (You)
                </span>
              )}
            </div>
          </div>

          {/* Timers & Conditions */}
          <div className="flex flex-col gap-2 text-xs font-mono text-[var(--text-muted)] pt-2">
            {isOffered && (
              <div className="flex items-center justify-between">
                <span>Accept Deadline:</span>
                <span className={acceptExpired ? "text-[var(--danger)]" : "text-[var(--text-primary)]"}>
                  {acceptExpired
                    ? "Expired (Walkover Available)"
                    : new Date(Number(chal.acceptBy) * 1000).toLocaleString()}
                </span>
              </div>
            )}
            {isActive && (
              <div className="flex items-center justify-between">
                <span>Report Deadline:</span>
                <span className={reportExpired ? "text-[var(--danger)]" : "text-[var(--text-primary)]"}>
                  {reportExpired
                    ? "Expired (Void Available)"
                    : new Date(Number(chal.reportBy) * 1000).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </Panel>

        {/* Mutual Reports Progress Box (Spec §3.1, §4) */}
        {isActive && (
          <Panel
            appearance="recessed"
            title="Mutual Match Reports"
            subtitle="Both players must submit who won. If reports agree, ranks move and payout is credited."
          >
            <div className="grid grid-cols-2 gap-4 py-4 text-center">
              {/* Challenger Report Status */}
              <div className="flex flex-col items-center gap-1.5 p-3 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="text-xs font-heading uppercase text-[var(--text-muted)]">
                  Challenger Report
                </span>
                {chal.reportC > 0 ? (
                  <div className="flex items-center gap-1 text-sm font-bold text-[var(--success)]">
                    <span>✓ Submitted</span>
                    {bothReported && (
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        ({chal.reportC === 1 ? "Self Won" : "Target Won"})
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-mono text-[var(--text-muted)] italic">
                    Pending…
                  </span>
                )}
              </div>

              {/* Target Report Status */}
              <div className="flex flex-col items-center gap-1.5 p-3 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="text-xs font-heading uppercase text-[var(--text-muted)]">
                  Target Report
                </span>
                {chal.reportT > 0 ? (
                  <div className="flex items-center gap-1 text-sm font-bold text-[var(--success)]">
                    <span>✓ Submitted</span>
                    {bothReported && (
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        ({chal.reportT === 1 ? "Challenger Won" : "Self Won"})
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-mono text-[var(--text-muted)] italic">
                    Pending…
                  </span>
                )}
              </div>
            </div>

            {/* If user hasn't reported yet, provide report actions */}
            {isPlayer && !userHasReported && !reportExpired && (
              <div className="flex flex-col gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <p className="text-xs text-[var(--text-primary)] font-semibold text-center">
                  Submit match result:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={actionPending}
                    onClick={() => handleReport(true)}
                  >
                    Challenger Won
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    disabled={actionPending}
                    onClick={() => handleReport(false)}
                  >
                    Target Won
                  </Button>
                </div>
              </div>
            )}

            {isPlayer && userHasReported && !bothReported && (
              <div className="text-center py-2 text-xs font-mono text-[var(--accent)]">
                You reported. Waiting for your opponent to report…
              </div>
            )}
          </Panel>
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

        {/* Action Controls for Offered State */}
        {isOffered && (
          <Panel>
            <div className="flex flex-col gap-3">
              {isTarget && !acceptExpired && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Match stake: Deposit <strong>{stakeEth} BOT</strong> to accept the challenge.
                  </p>
                  <Button
                    size="lg"
                    variant="primary"
                    disabled={actionPending}
                    onClick={handleAccept}
                    className="w-full"
                  >
                    {actionPending ? "Accepting…" : `Accept & Stake ${stakeEth} BOT`}
                  </Button>
                </div>
              )}

              {isChallenger && !acceptExpired && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Target has not yet accepted. You can cancel and withdraw your stake anytime before acceptance.
                  </p>
                  <Button
                    size="md"
                    variant="secondary"
                    disabled={actionPending}
                    onClick={handleCancel}
                  >
                    {actionPending ? "Cancelling…" : "Cancel Challenge & Refund Stake"}
                  </Button>
                </div>
              )}

              {isChallenger && acceptExpired && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    The 3-day acceptance window has expired! Claim your walkover victory to swap ranks and retrieve your stake.
                  </p>
                  <Button
                    size="lg"
                    variant="primary"
                    disabled={actionPending}
                    onClick={handleWalkover}
                    className="w-full"
                  >
                    {actionPending ? "Claiming Walkover…" : "Claim Walkover & Swap Rungs"}
                  </Button>
                </div>
              )}

              {!isPlayer && (
                <div className="text-center py-4 text-xs font-mono text-[var(--text-muted)]">
                  Waiting for target {formatAddress(chal.target)} to accept or for window to expire.
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Void by timeout action if active and report expired */}
        {isActive && reportExpired && (
          <Panel>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[var(--text-muted)]">
                The 7-day reporting window has expired without mutual settlement. Anyone can void the match to return stakes.
              </p>
              <Button
                size="md"
                variant="secondary"
                disabled={actionPending}
                onClick={handleVoidTimeout}
              >
                {actionPending ? "Voiding…" : "Void Match (Refund Stakes)"}
              </Button>
            </div>
          </Panel>
        )}

        {/* Terminal state explanations */}
        {isSettled && (
          <Panel appearance="recessed">
            <div className="py-2 text-center text-xs font-sans text-[var(--text-primary)]">
              This challenge has been settled! The winner has been credited {totalPrizeEth} BOT to their pending balance.
            </div>
          </Panel>
        )}
        {isVoid && (
          <Panel appearance="recessed">
            <div className="py-2 text-center text-xs font-sans text-[var(--text-primary)]">
              This challenge was voided (disagreement or deadline elapsed). Stakes have been returned to pending balances.
            </div>
          </Panel>
        )}
        {isWalkover && (
          <Panel appearance="recessed">
            <div className="py-2 text-center text-xs font-sans text-[var(--text-primary)]">
              This challenge concluded by walkover. Challenger took their stake back and swapped places.
            </div>
          </Panel>
        )}
        {isCancelled && (
          <Panel appearance="recessed">
            <div className="py-2 text-center text-xs font-sans text-[var(--text-muted)]">
              This challenge was cancelled by the challenger before acceptance.
            </div>
          </Panel>
        )}
      </div>
    </PageShell>
  );
}
