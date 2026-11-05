"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseEther } from "viem";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { RUNGS_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatRungsError } from "@/lib/errors";
import { assertActiveChain } from "@/lib/useChainWrite";

export default function NewLadderPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });

  const deployment = getDeployment(activeBotChain.id);
  const contractAddress = deployment.address;

  const [name, setName] = useState("");
  const [stakeEth, setStakeEth] = useState("0.05");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletClient || !publicClient) return;

    setError(null);
    setLoading(true);

    try {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Please enter a ladder name.");
      }
      if (new TextEncoder().encode(trimmed).length > 48) {
        throw new Error("Name must be 48 bytes or fewer.");
      }

      const parsedStake = parseEther(stakeEth);
      if (parsedStake < parseEther("0.01") || parsedStake > parseEther("1000")) {
        throw new Error("Stake must be between 0.01 and 1000 BOT.");
      }

      await assertActiveChain(walletClient);

      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "create",
        args: [trimmed, parsedStake],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      // Find Created event
      // event Created(uint256 indexed id, address indexed creator, string name, uint128 stake);
      // Ladder count is also next id
      const nextId = await publicClient.readContract({
        address: contractAddress,
        abi: RUNGS_ABI,
        functionName: "ladderCount",
      });

      router.push(`/ladder/${nextId.toString()}`);
    } catch (err: unknown) {
      console.error(err);
      setError(formatRungsError(err));
      setLoading(false);
    }
  };

  return (
    <PageShell
      title="Create a Ladder"
      subtitle="Establish a new challenge ladder for your club, league, or tournament."
    >
      <div className="max-w-xl mx-auto">
        <Panel
          title="Ladder Parameters"
          subtitle="Fixed stake per challenge, 50 rungs max, 3-day acceptance window"
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
            {/* Ladder Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="ladder-name"
                className="text-xs font-heading uppercase tracking-wider font-bold text-[var(--text-primary)]"
              >
                Ladder Name (Max 48 bytes)
              </label>
              <input
                id="ladder-name"
                type="text"
                required
                maxLength={48}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Table Football Premier Ladder"
                className="w-full px-3 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-sm font-sans text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {new TextEncoder().encode(name).length} / 48 bytes
              </span>
            </div>

            {/* Stake Amount */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="ladder-stake"
                className="text-xs font-heading uppercase tracking-wider font-bold text-[var(--text-primary)]"
              >
                Match Stake (BOT)
              </label>
              <input
                id="ladder-stake"
                type="number"
                step="any"
                min="0.01"
                max="1000"
                required
                value={stakeEth}
                onChange={(e) => setStakeEth(e.target.value)}
                placeholder="0.05"
                className="w-full px-3 py-2 rounded bg-[var(--bg-elevated)] border border-[var(--border-default)] text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[11px] font-sans text-[var(--text-muted)]">
                Range: 0.01 to 1000 BOT. Both challenger and target deposit this exact amount. Winner takes both stakes (2×).
              </span>
            </div>

            {/* Info notice */}
            <div className="p-3 rounded bg-[var(--bg-elevated)]/40 border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] leading-relaxed">
              <p>
                <strong>Note:</strong> Creating a ladder does not automatically enter you into it. Once created, you can join at the bottom rung.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded bg-[var(--danger)]/15 border border-[var(--danger)] text-xs text-[var(--danger)]">
                {error}
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={loading || !isConnected}
                className="w-full"
              >
                {loading
                  ? "Deploying Ladder…"
                  : isConnected
                  ? "Create Ladder"
                  : "Connect Wallet to Create"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
