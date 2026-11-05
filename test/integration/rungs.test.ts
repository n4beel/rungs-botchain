import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import { createPublicClient, createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RUNGS_ABI } from "../../lib/botchain/abi";
import { swapped, reach, outcomeOf } from "../../lib/rungs";

const ANVIL_PORT = 8665;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

const localChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

describe("Rungs Integration Test (Spec §5)", () => {
  let anvil: ChildProcess;

  const creator = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  const playerA = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const playerB = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
  });

  const clientCreator = createWalletClient({ account: creator, chain: localChain, transport: http(RPC_URL) });
  const clientA = createWalletClient({ account: playerA, chain: localChain, transport: http(RPC_URL) });
  const clientB = createWalletClient({ account: playerB, chain: localChain, transport: http(RPC_URL) });

  let rungsAddress: `0x${string}`;

  beforeAll(async () => {
    anvil = spawn("anvil", ["-p", String(ANVIL_PORT)], { stdio: "ignore" });

    for (let i = 0; i < 30; i++) {
      try {
        await publicClient.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const deployer = spawn(
      "forge",
      [
        "create",
        "contracts/src/Rungs.sol:Rungs",
        "--rpc-url",
        RPC_URL,
        "--private-key",
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "--broadcast",
      ],
      { cwd: process.cwd() }
    );

    let output = "";
    deployer.stdout.on("data", (d) => (output += d.toString()));
    deployer.stderr.on("data", (d) => (output += d.toString()));

    await new Promise<void>((resolve, reject) => {
      deployer.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Deploy failed: ${output}`));
      });
    });

    const match = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
    if (!match) throw new Error(`Could not find deployed address: ${output}`);
    rungsAddress = match[1] as `0x${string}`;
  }, 30000);

  afterAll(() => {
    if (anvil) anvil.kill();
  });

  it("completes long path: join -> challenge -> accept -> both report -> swap -> withdraw", async () => {
    const stake = parseEther("0.1");

    // 1. Create ladder
    const hashCreate = await clientCreator.writeContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "create",
      args: ["Championship Ladder", stake],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashCreate });
    const ladderId = 1n;

    // 2. Player A joins (Rank 1), Player B joins (Rank 2)
    const hashJoinA = await clientA.writeContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "join",
      args: [ladderId],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashJoinA });

    const hashJoinB = await clientB.writeContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "join",
      args: [ladderId],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashJoinB });

    const rankAInitial = await publicClient.readContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "rankOf",
      args: [ladderId, playerA.address],
    });
    const rankBInitial = await publicClient.readContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "rankOf",
      args: [ladderId, playerB.address],
    });
    expect(rankAInitial).toBe(1);
    expect(rankBInitial).toBe(2);

    // Verify reach
    expect(reach(rankBInitial)).toEqual([1]);

    // 3. Player B challenges Player A (Rank 1)
    const hashChal = await clientB.writeContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "challenge",
      args: [ladderId, 1],
      value: stake,
    });
    await publicClient.waitForTransactionReceipt({ hash: hashChal });
    const cid = 1n;

    // 4. Player A accepts
    const hashAccept = await clientA.writeContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "accept",
      args: [cid],
      value: stake,
    });
    await publicClient.waitForTransactionReceipt({ hash: hashAccept });

    // 5. Both report challenger (B) won
    const hashRepB = await clientB.writeContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "report",
      args: [cid, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashRepB });

    const hashRepA = await clientA.writeContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "report",
      args: [cid, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: hashRepA });

    // Verify ranks swapped
    const rankAFinal = await publicClient.readContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "rankOf",
      args: [ladderId, playerA.address],
    });
    const rankBFinal = await publicClient.readContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "rankOf",
      args: [ladderId, playerB.address],
    });
    expect(rankBFinal).toBe(1);
    expect(rankAFinal).toBe(2);

    // 6. Winner (B) has 2 * stake in pending and withdraws
    const pendingB = await publicClient.readContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "pending",
      args: [playerB.address],
    });
    expect(pendingB).toBe(stake * 2n);

    const balBefore = await publicClient.getBalance({ address: playerB.address });
    const hashWith = await clientB.writeContract({
      address: rungsAddress,
      abi: RUNGS_ABI,
      functionName: "withdraw",
    });
    const receiptWith = await publicClient.waitForTransactionReceipt({ hash: hashWith });
    const balAfter = await publicClient.getBalance({ address: playerB.address });
    const gas = receiptWith.gasUsed * receiptWith.effectiveGasPrice;

    expect(balAfter + gas - balBefore).toBe(pendingB);
  });
});
