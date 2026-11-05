import { spawn } from "node:child_process";
import { createPublicClient, createWalletClient, defineChain, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RUNGS_ABI } from "../lib/botchain/abi.js";

const PORT = 8765;
const RPC_URL = `http://127.0.0.1:${PORT}`;

const localChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

async function main() {
  console.log(`Starting local Anvil on port ${PORT}...`);
  const anvil = spawn("anvil", ["-p", String(PORT)], { stdio: "ignore" });

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
  });

  // Wait for anvil
  for (let i = 0; i < 30; i++) {
    try {
      await publicClient.getBlockNumber();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log("Deploying Rungs contract...");
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

  await new Promise((resolve, reject) => {
    deployer.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Deploy failed: ${output}`));
    });
  });

  const match = output.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
  if (!match) throw new Error("Could not find address");
  const contractAddress = match[1];
  console.log(`Rungs deployed to: ${contractAddress}`);

  // Seeding roles
  const creator = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  const pA = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const pB = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
  const pC = privateKeyToAccount("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
  const pD = privateKeyToAccount("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a");
  const pE = privateKeyToAccount("0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba");
  const pF = privateKeyToAccount("0x92db14e403b83dde342f1b4cff28ad4a5dacd884be92791f2615a9885d8679cf");
  const pG = privateKeyToAccount("0x4bbbf8560082ea93e76d11802d9db4313f4de79a9fb60d47180403384028644d");
  const pH = privateKeyToAccount("0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97");

  const cCreator = createWalletClient({ account: creator, chain: localChain, transport: http(RPC_URL) });
  const cA = createWalletClient({ account: pA, chain: localChain, transport: http(RPC_URL) });
  const cB = createWalletClient({ account: pB, chain: localChain, transport: http(RPC_URL) });
  const cC = createWalletClient({ account: pC, chain: localChain, transport: http(RPC_URL) });
  const cD = createWalletClient({ account: pD, chain: localChain, transport: http(RPC_URL) });
  const cE = createWalletClient({ account: pE, chain: localChain, transport: http(RPC_URL) });
  const cF = createWalletClient({ account: pF, chain: localChain, transport: http(RPC_URL) });
  const cG = createWalletClient({ account: pG, chain: localChain, transport: http(RPC_URL) });
  const cH = createWalletClient({ account: pH, chain: localChain, transport: http(RPC_URL) });

  console.log("Seeding ladders and challenges per spec §5...");

  // Ladder 1 with 8 players (stake 0.05 BOT)
  const stake = parseEther("0.05");
  const tx1 = await cCreator.writeContract({
    address: contractAddress,
    abi: RUNGS_ABI,
    functionName: "create",
    args: ["Table Tennis Club Ladder", stake],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx1 });

  // 8 players join
  const players = [cA, cB, cC, cD, cE, cF, cG, cH];
  for (const p of players) {
    const tx = await p.writeContract({
      address: contractAddress,
      abi: RUNGS_ABI,
      functionName: "join",
      args: [1n],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  // Challenge 1: Offered (Player D at rank 4 challenges Player B at rank 2)
  const txC1 = await cD.writeContract({
    address: contractAddress,
    abi: RUNGS_ABI,
    functionName: "challenge",
    args: [1n, 2],
    value: stake,
  });
  await publicClient.waitForTransactionReceipt({ hash: txC1 });

  // Ladder 2: Empty ladder
  await cCreator.writeContract({
    address: contractAddress,
    abi: RUNGS_ABI,
    functionName: "create",
    args: ["Chess Championship Ladder", parseEther("0.1")],
  });

  console.log("Local stack ready! Running on http://127.0.0.1:" + PORT);
  console.log("Contract Address:", contractAddress);

  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
