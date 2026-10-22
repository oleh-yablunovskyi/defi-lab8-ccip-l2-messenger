// Backend agent (control task, step 5): the C# (Nethereum) program of figures 8.4 and 8.5 written
// in TypeScript with ethers.js. It connects to Sepolia (L1) through a JSON-RPC URL, calls
// sendMessage() of CrossChainMessenger for the receiver contract on Arbitrum Sepolia (L2) and
// prints the CCIP message id that the delivery is tracked by in the CCIP Explorer. Talking to an L2
// instead would only take another RPC URL.
//   node scripts/agent.ts
import { existsSync, readFileSync } from "node:fs";
import { Contract, JsonRpcProvider, Wallet, formatEther } from "ethers";

// The key and the RPC URL come from .env (or the file named by ENV_FILE), never from the code
const envFile = process.env.ENV_FILE || ".env";
if (existsSync(envFile)) process.loadEnvFile(envFile);
const deployed = (variable: string, network: string): string =>
  process.env[variable] || JSON.parse(readFileSync(`deployments/${network}.json`, "utf8")).address;

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
if (!privateKey) throw new Error("DEPLOYER_PRIVATE_KEY is not set");
const rpcUrlL1 = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

const provider = new JsonRpcProvider(rpcUrlL1);
const account = new Wallet(privateKey, provider);

const messengerAddress = deployed("MESSENGER_ADDRESS", "sepolia");
const abi = [
  "function sendMessage(uint64 _destinationChainSelector, address _receiver, string _text) returns (bytes32 messageId)",
  "event MessageSent(bytes32 indexed messageId, uint64 indexed destinationChainSelector, address receiver, string text, uint256 feePaid)",
];
const messengerContract = new Contract(messengerAddress, abi, account);

const arbitrumSepoliaSelector = 3478487238524512106n;
const targetContractL2 = deployed("RECEIVER_ADDRESS", "arbitrumSepolia");
const messageData = "Hello L2 from L1!";

const { chainId } = await provider.getNetwork();
console.log(`[Agent] L1 endpoint ${new URL(rpcUrlL1).host}, chain id ${chainId}, account ${account.address}`);
console.log(`[Agent] messenger ${messengerAddress}`);
console.log(`[Agent] receiver on L2 ${targetContractL2}, chain selector ${arbitrumSepoliaSelector}`);
console.log("[Agent] Starting the cross-chain transaction...");

try {
  const tx = await messengerContract.sendMessage(arbitrumSepoliaSelector, targetContractL2, messageData);
  console.log(`[Agent] sent: ${tx.hash}, waiting for the receipt`);
  const receipt = await tx.wait();
  const sent = receipt.logs
    .map((log: { topics: string[]; data: string }) => messengerContract.interface.parseLog(log))
    .find((event: { name: string } | null) => event?.name === "MessageSent");

  console.log(`[SUCCESS] Transaction included in L1 block: ${receipt.blockNumber}`);
  console.log(`Transaction hash (TxHash): ${receipt.hash}`);
  console.log(`CCIP message id (MessageId): ${sent.args.messageId}`);
  console.log(`CCIP fee paid by the contract: ${formatEther(sent.args.feePaid)} LINK; gas used ${receipt.gasUsed}, gas fee ${formatEther(receipt.fee)} ETH`);
  console.log("\nTrack the delivery of the message to Arbitrum in the CCIP Explorer:");
  console.log(`https://ccip.chain.link/tx/${receipt.hash}`);
  console.log(`https://ccip.chain.link/msg/${sent.args.messageId}`);
} catch (error) {
  console.log(`Cross-chain request failed: ${(error as Error).message}`);
  process.exitCode = 1;
}
