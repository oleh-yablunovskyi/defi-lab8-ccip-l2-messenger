// Control task, step 1: test ETH for the L2. Instead of a faucet, ETH of the wallet goes from
// Sepolia to Arbitrum Sepolia through the canonical bridge of Arbitrum: depositEth() of the Inbox
// contract on Sepolia. The Arbitrum sequencer credits the same address on the L2 some minutes
// later (node scripts/status.ts shows the L2 balance).
//   npx hardhat run scripts/bridge.ts --network sepolia        (BRIDGE_ETH, default 0.003)
import { network } from "hardhat";
import { ARBITRUM_SEPOLIA, ARBITRUM_SEPOLIA_INBOX } from "./config.js";

const { ethers, networkName } = await network.create();
const { formatEther, parseEther } = ethers;
const amount = parseEther(process.env.BRIDGE_ETH || "0.003");
const [wallet] = await ethers.getSigners();

// The Inbox must lead to the rollup of chain 421614: Inbox -> Bridge -> Rollup -> chainId()
const inbox = await ethers.getContractAt(
  ["function bridge() view returns (address)", "function depositEth() payable returns (uint256)"],
  ARBITRUM_SEPOLIA_INBOX,
  wallet,
);
const bridge = await inbox.bridge();
const rollup = await (await ethers.getContractAt(["function rollup() view returns (address)"], bridge)).rollup();
const l2ChainId = await (await ethers.getContractAt(["function chainId() view returns (uint256)"], rollup)).chainId();
const { chainId } = await ethers.provider.getNetwork();
console.log(`[Network] ${networkName}, chain id ${chainId}, block ${await ethers.provider.getBlockNumber()}`);
console.log(`[Inbox]   ${ARBITRUM_SEPOLIA_INBOX} -> bridge ${bridge}`);
console.log(`          -> rollup ${rollup} of chain ${l2ChainId}`);
if (l2ChainId !== ARBITRUM_SEPOLIA.chainId) throw new Error("This Inbox does not belong to Arbitrum Sepolia");

const before = await ethers.provider.getBalance(wallet);
console.log(`[Wallet]  ${wallet.address}: ${formatEther(before)} ETH, nonce ${await ethers.provider.getTransactionCount(wallet)}`);
if (before < amount * 2n) throw new Error("The wallet has too little ETH for this deposit");

const tx = await inbox.depositEth({ value: amount });
console.log(`[Deposit] depositEth() with ${formatEther(amount)} ETH, tx ${tx.hash}`);
const receipt = await tx.wait();
if (!receipt || receipt.status !== 1) throw new Error("The deposit failed");
console.log(`          block ${receipt.blockNumber}, gas used ${receipt.gasUsed}, fee ${formatEther(receipt.fee)} ETH`);
console.log(`[Wallet]  ${formatEther(await ethers.provider.getBalance(wallet))} ETH left on ${networkName}`);
