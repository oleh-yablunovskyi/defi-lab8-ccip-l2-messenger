// Addresses the Hardhat scripts use. CCIP: the CCIP Directory of Chainlink for testnets (the router
// of each chain answers typeAndVersion() with "Router 1.2.0"). Arbitrum: the Inbox of Arbitrum
// Sepolia on Sepolia from the Arbitrum docs. Uniswap: the Uniswap V3 deployment on Sepolia.
import { mkdir, readFile, writeFile } from "node:fs/promises";

export const SEPOLIA = {
  chainId: 11155111n,
  chainSelector: 16015286601757825753n,
  ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  link: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
};

export const ARBITRUM_SEPOLIA = {
  chainId: 421614n,
  chainSelector: 3478487238524512106n,
  ccipRouter: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165",
};

// Canonical bridge of Arbitrum Sepolia: depositEth() of this Inbox on Sepolia credits the ETH to
// the same address on the L2
export const ARBITRUM_SEPOLIA_INBOX = "0xaAe29B0366299461418F5324a79Afc425BE5ae21";

// Uniswap V3 on Sepolia: SwapRouter02, QuoterV2, the WETH of the pools and the LINK/WETH pool fee
export const UNISWAP_V3 = {
  swapRouter02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
  quoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
  weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
  linkWethFee: 3000,
};

export const ROUTER_ABI = ["function typeAndVersion() view returns (string)"];
export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export interface Deployment {
  contract: string;
  address: string;
  chainId: string;
  deployer: string;
  txHash: string;
  block: number;
  constructorArgs: string[];
}

// deployments/<network>.json, written by scripts/deploy.ts
export async function saveDeployment(networkName: string, deployment: Deployment) {
  await mkdir("deployments", { recursive: true });
  await writeFile(`deployments/${networkName}.json`, JSON.stringify(deployment, null, 2) + "\n");
}

export async function loadDeployment(networkName: string): Promise<Deployment> {
  return JSON.parse(await readFile(`deployments/${networkName}.json`, "utf8"));
}
