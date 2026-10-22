// Control task, step 4 (preparation): LINK for the CCIP fee. Instead of the Chainlink faucet, the
// wallet buys LINK for Sepolia ETH on Uniswap V3, in the LINK/WETH pool with the 0.3% fee:
// exactInputSingle() of SwapRouter02 wraps the ETH sent with the call into WETH. The minimum
// output is 97% of the quote of QuoterV2.
//   npx hardhat run scripts/buy-link.ts --network sepolia      (SWAP_ETH, default 0.003)
import { network } from "hardhat";
import { ERC20_ABI, SEPOLIA, UNISWAP_V3 } from "./config.js";

const { ethers, networkName } = await network.create();
const { formatEther, parseEther } = ethers;
const amountIn = parseEther(process.env.SWAP_ETH || "0.003");
const [wallet] = await ethers.getSigners();

const quoter = await ethers.getContractAt(
  [
    "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
  ],
  UNISWAP_V3.quoterV2,
);
const router = await ethers.getContractAt(
  [
    "function WETH9() view returns (address)",
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  ],
  UNISWAP_V3.swapRouter02,
  wallet,
);
const link = await ethers.getContractAt(ERC20_ABI, SEPOLIA.link);

const { chainId } = await ethers.provider.getNetwork();
console.log(`[Network] ${networkName}, chain id ${chainId}, block ${await ethers.provider.getBlockNumber()}`);
if ((await router.WETH9()) !== UNISWAP_V3.weth) throw new Error("Unexpected WETH of the Uniswap router");
const ethBefore = await ethers.provider.getBalance(wallet);
const linkBefore = await link.balanceOf(wallet);
console.log(`[Wallet]  ${wallet.address}: ${formatEther(ethBefore)} ETH, ${formatEther(linkBefore)} LINK, nonce ${await ethers.provider.getTransactionCount(wallet)}`);
if (ethBefore < amountIn * 2n) throw new Error("The wallet has too little ETH for this swap");

const [quoted] = await quoter.quoteExactInputSingle.staticCall({
  tokenIn: UNISWAP_V3.weth,
  tokenOut: SEPOLIA.link,
  amountIn,
  fee: UNISWAP_V3.linkWethFee,
  sqrtPriceLimitX96: 0,
});
const minimum = (quoted * 97n) / 100n;
console.log(`[Quote]   ${formatEther(amountIn)} ETH -> ${formatEther(quoted)} LINK (minimum ${formatEther(minimum)})`);

const tx = await router.exactInputSingle(
  {
    tokenIn: UNISWAP_V3.weth,
    tokenOut: SEPOLIA.link,
    fee: UNISWAP_V3.linkWethFee,
    recipient: wallet.address,
    amountIn,
    amountOutMinimum: minimum,
    sqrtPriceLimitX96: 0,
  },
  { value: amountIn },
);
console.log(`[Swap]    exactInputSingle(), tx ${tx.hash}`);
const receipt = await tx.wait();
if (!receipt || receipt.status !== 1) throw new Error("The swap failed");
const linkAfter = await link.balanceOf(wallet);
console.log(`          block ${receipt.blockNumber}, gas used ${receipt.gasUsed}, fee ${formatEther(receipt.fee)} ETH`);
console.log(`[Wallet]  +${formatEther(linkAfter - linkBefore)} LINK, now ${formatEther(linkAfter)} LINK and ${formatEther(await ethers.provider.getBalance(wallet))} ETH`);
