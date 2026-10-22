// Read-only view of both chains: the wallet (ETH on Sepolia and on Arbitrum Sepolia, LINK on
// Sepolia), the LINK balance of CrossChainMessenger and the last message that MessageReceiver got.
// It sends no transactions.
//   node scripts/status.ts
import { existsSync, readFileSync } from "node:fs";
import { Contract, JsonRpcProvider, Wallet, formatEther } from "ethers";

const envFile = process.env.ENV_FILE || ".env";
if (existsSync(envFile)) process.loadEnvFile(envFile);
const deployed = (variable: string, network: string): string | undefined =>
  process.env[variable] ||
  (existsSync(`deployments/${network}.json`)
    ? JSON.parse(readFileSync(`deployments/${network}.json`, "utf8")).address
    : undefined);

const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789"; // LINK on Sepolia
const l1 = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com");
const l2 = new JsonRpcProvider(process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc");
const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY!).address;
const link = new Contract(LINK, ["function balanceOf(address) view returns (uint256)"], l1);

const [n1, n2] = await Promise.all([l1.getNetwork(), l2.getNetwork()]);
console.log(`[L1] chain id ${n1.chainId}, block ${await l1.getBlockNumber()}`);
console.log(`     wallet ${wallet}: ${formatEther(await l1.getBalance(wallet))} ETH, ${formatEther(await link.balanceOf(wallet))} LINK, nonce ${await l1.getTransactionCount(wallet)} (pending ${await l1.getTransactionCount(wallet, "pending")})`);
console.log(`[L2] chain id ${n2.chainId}, block ${await l2.getBlockNumber()}`);
console.log(`     wallet ${wallet}: ${formatEther(await l2.getBalance(wallet))} ETH, nonce ${await l2.getTransactionCount(wallet)}`);

const messenger = deployed("MESSENGER_ADDRESS", "sepolia");
if (messenger) console.log(`[CrossChainMessenger] ${messenger} on L1: ${formatEther(await link.balanceOf(messenger))} LINK`);
const receiverAddress = deployed("RECEIVER_ADDRESS", "arbitrumSepolia");
if (receiverAddress && (await l2.getCode(receiverAddress)) === "0x") {
  console.log(`[MessageReceiver] ${receiverAddress}: no contract at this address on L2`);
} else if (receiverAddress) {
  const receiver = new Contract(
    receiverAddress,
    [
      "function lastMessageId() view returns (bytes32)",
      "function lastSourceChainSelector() view returns (uint64)",
      "function lastSender() view returns (address)",
      "function lastText() view returns (string)",
    ],
    l2,
  );
  console.log(`[MessageReceiver] ${receiverAddress} on L2, last message:`);
  console.log(`     messageId ${await receiver.lastMessageId()}`);
  console.log(`     source chain selector ${await receiver.lastSourceChainSelector()}`);
  console.log(`     sender ${await receiver.lastSender()}`);
  console.log(`     text "${await receiver.lastText()}"`);
}
