import { existsSync } from "node:fs";
import { resolve } from "node:path";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

// The RPC endpoints and the private key are read from .env (git ignores it, see .env.example);
// ENV_FILE selects another file, for example the one of the trial run on a fork.
const envFile = resolve(import.meta.dirname, process.env.ENV_FILE || ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Public endpoints that need no account or API key; non-empty variables replace them
const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const arbitrumSepoliaRpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
// The same wallet signs on both chains; without a key the two networks can only be read
const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [configVariable("DEPLOYER_PRIVATE_KEY")] : [];

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    // The mock CCIP router of the Chainlink package gets an artifact of its own for the local
    // tests: it takes the fee like the real router and delivers the message at once.
    npmFilesToBuild: ["@chainlink/contracts-ccip/src/v0.8/ccip/test/mocks/MockRouter.sol"],
    profiles: {
      default: {
        version: "0.8.34",
      },
      production: {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    // Ethereum Sepolia (L1): the source chain, where CrossChainMessenger runs
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: sepoliaRpcUrl,
      accounts,
    },
    // Arbitrum Sepolia (L2, an Optimistic Rollup that settles on Sepolia): the destination chain
    // of the message, where MessageReceiver runs. For the scripts it differs from Sepolia only in
    // the RPC URL and the chain id.
    arbitrumSepolia: {
      type: "http",
      chainType: "generic",
      chainId: 421614,
      url: arbitrumSepoliaRpcUrl,
      accounts,
    },
    // Local fork of Sepolia for a trial run: `npx hardhat node --network sepoliaFork` starts a node
    // on http://127.0.0.1:8545 that reads the Sepolia state (the CCIP router, LINK, Uniswap) as of a
    // recent block; the scripts reach it as "localhost". Its transactions never reach Sepolia.
    // "amsterdam" is the Glamsterdam upgrade that Sepolia runs, so the gas costs are close.
    sepoliaFork: {
      type: "edr-simulated",
      chainType: "l1",
      hardfork: "amsterdam",
      forking: {
        url: sepoliaRpcUrl,
      },
      // Test accounts made for this lab, funded only on the fork. The phrase is public, so never
      // send real funds to these addresses.
      accounts: {
        mnemonic: "public loyal can brother roast evidence inform mystery employ fluid apple breeze",
      },
    },
  },
});
