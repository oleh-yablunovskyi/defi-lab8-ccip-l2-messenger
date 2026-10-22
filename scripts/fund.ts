// Control task, step 4: moves LINK from the wallet to CrossChainMessenger, which pays the CCIP fee
// from its own balance. FUND_LINK sets the amount; by default all the LINK of the wallet.
//   npx hardhat run scripts/fund.ts --network sepolia
import { network } from "hardhat";
import { ERC20_ABI, SEPOLIA, loadDeployment } from "./config.js";

const { ethers, networkName } = await network.create();
const { formatEther, parseEther } = ethers;
const [wallet] = await ethers.getSigners();
const messenger = (await loadDeployment(networkName)).address;
const link = await ethers.getContractAt(ERC20_ABI, SEPOLIA.link, wallet);

const walletLink = await link.balanceOf(wallet);
const amount = process.env.FUND_LINK ? parseEther(process.env.FUND_LINK) : walletLink;
console.log(`[Network]   ${networkName}, block ${await ethers.provider.getBlockNumber()}`);
console.log(`[Wallet]    ${wallet.address}: ${formatEther(walletLink)} LINK, ${formatEther(await ethers.provider.getBalance(wallet))} ETH, nonce ${await ethers.provider.getTransactionCount(wallet)}`);
console.log(`[Messenger] ${messenger}: ${formatEther(await link.balanceOf(messenger))} LINK`);
if (amount === 0n || amount > walletLink) throw new Error("Nothing to send or not enough LINK");

const tx = await link.transfer(messenger, amount);
console.log(`[Transfer]  ${formatEther(amount)} LINK to the messenger, tx ${tx.hash}`);
const receipt = await tx.wait();
if (!receipt || receipt.status !== 1) throw new Error("The transfer failed");
console.log(`            block ${receipt.blockNumber}, gas used ${receipt.gasUsed}, fee ${formatEther(receipt.fee)} ETH`);
console.log(`[Messenger] now ${formatEther(await link.balanceOf(messenger))} LINK`);
