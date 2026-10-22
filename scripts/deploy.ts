// Control task, steps 2 and 3. On Sepolia (or its local fork) deploys CrossChainMessenger with the
// CCIP router and the LINK token of Sepolia; on Arbitrum Sepolia deploys the receiver
// MessageReceiver with the CCIP router of Arbitrum Sepolia. The address and the transaction go to
// deployments/<network>.json.
//   npx hardhat run scripts/deploy.ts --network arbitrumSepolia
//   npx hardhat run scripts/deploy.ts --network sepolia
import { network } from "hardhat";
import { ARBITRUM_SEPOLIA, ROUTER_ABI, SEPOLIA, saveDeployment } from "./config.js";

const { ethers, networkName } = await network.create();
const { formatEther } = ethers;
const [deployer] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();

const onL2 = chainId === ARBITRUM_SEPOLIA.chainId;
const contractName = onL2 ? "MessageReceiver" : "CrossChainMessenger";
const routerAddress = onL2 ? ARBITRUM_SEPOLIA.ccipRouter : SEPOLIA.ccipRouter;
const args = onL2 ? [routerAddress] : [routerAddress, SEPOLIA.link];

console.log(`[Network] ${networkName}, chain id ${chainId}, block ${await ethers.provider.getBlockNumber()}`);
// The CCIP router of this chain must be there (on the fork its code comes from Sepolia)
if ((await ethers.provider.getCode(routerAddress)) === "0x") throw new Error(`No CCIP router at ${routerAddress}`);
const router = await ethers.getContractAt(ROUTER_ABI, routerAddress);
console.log(`[Router]  ${routerAddress}: ${await router.typeAndVersion()}`);
console.log(`[Wallet]  ${deployer.address}: ${formatEther(await ethers.provider.getBalance(deployer))} ETH, nonce ${await ethers.provider.getTransactionCount(deployer)}`);

const contract = await ethers.deployContract(contractName, args, deployer);
const tx = contract.deploymentTransaction()!;
console.log(`[Deploy]  ${contractName}(${args.join(", ")})`);
console.log(`          tx ${tx.hash}`);
await contract.waitForDeployment();
const receipt = (await tx.wait())!;
const address = await contract.getAddress();
console.log(`          address ${address}`);
console.log(`          block ${receipt.blockNumber}, gas used ${receipt.gasUsed}, fee ${formatEther(receipt.fee)} ETH`);

await saveDeployment(networkName, {
  contract: contractName,
  address,
  chainId: chainId.toString(),
  deployer: deployer.address,
  txHash: tx.hash,
  block: receipt.blockNumber,
  constructorArgs: args,
});
console.log(`[Saved]   deployments/${networkName}.json`);
