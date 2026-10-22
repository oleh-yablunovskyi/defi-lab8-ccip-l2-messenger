# DeFi lab 8: a cross-chain message from Sepolia to Arbitrum Sepolia with Chainlink CCIP

A contract on Ethereum Sepolia (L1) sends a text message through Chainlink CCIP (Cross-Chain
Interoperability Protocol) to a receiver contract on Arbitrum Sepolia (L2, an Optimistic Rollup).
A backend agent written in TypeScript with ethers.js starts the cross-chain transaction and prints
the CCIP message id, which the delivery is tracked by in the
[CCIP Explorer](https://ccip.chain.link).

## Contents

| Path | What it is |
| --- | --- |
| `contracts/CrossChainMessenger.sol` | Sender on Sepolia, as in figures 8.1–8.3 of the lab text: builds an `EVM2AnyMessage`, asks the router for the fee with `getFee`, pays it in LINK (`approve`) and calls `ccipSend`; emits `MessageSent` with the message id |
| `contracts/MessageReceiver.sol` | Placeholder receiver on Arbitrum Sepolia: a `CCIPReceiver` that keeps the last message (id, source chain, sender, text) |
| `contracts/test/TestToken.sol` | ERC-20 that stands in for LINK in the tests |
| `test/CrossChainMessenger.ts` | Tests with `MockCCIPRouter` of `@chainlink/contracts-ccip` |
| `scripts/config.ts` | Addresses: CCIP routers, chain selectors, LINK, the Arbitrum Inbox, Uniswap V3 |
| `scripts/bridge.ts` | Sends Sepolia ETH to Arbitrum Sepolia through the Inbox of the Arbitrum bridge |
| `scripts/buy-link.ts` | Buys LINK for Sepolia ETH on Uniswap V3 |
| `scripts/deploy.ts` | Deploys `CrossChainMessenger` on Sepolia or `MessageReceiver` on Arbitrum Sepolia |
| `scripts/fund.ts` | Sends LINK to the messenger, which pays the CCIP fee from its balance |
| `scripts/agent.ts` | The backend agent: calls `sendMessage` and prints the message id and Explorer links |
| `scripts/status.ts` | Read-only view of both chains: balances, the messenger's LINK, the receiver's last message |

Two details differ from the figures of the lab text. In figure 8.2 `feeToken` is `address(0)`
(the native coin), while figure 8.3 pays the fee in LINK: it checks the LINK balance, calls
`approve` and sends no ETH with `ccipSend`, so the router would reject the message. Here the fee
token is `address(linkToken)`, as the comment of figure 8.2 suggests. Because
`_buildCCIPMessage` now reads an immutable variable, the compiler requires `view` instead of
`pure`. `@chainlink/contracts-ccip` is pinned to 1.5.0, the last release that has the
`src/v0.8/ccip/...` import paths of the figures.

## Setup

Node.js 22 or later.

```sh
npm install
npx hardhat build
npx hardhat test
npx tsc --noEmit
```

The scripts read `.env` (see `.env.example`): optional RPC URLs of both chains (public endpoints
are used by default) and `DEPLOYER_PRIVATE_KEY`, the wallet that signs on both chains.

## Networks

`hardhat.config.ts` defines `sepolia` (chain id 11155111) and `arbitrumSepolia` (chain id 421614).
For a script the L2 differs from the L1 only in the RPC URL and the chain id. `sepoliaFork` is a
local fork of Sepolia for a trial run.

| | Sepolia (L1) | Arbitrum Sepolia (L2) |
| --- | --- | --- |
| CCIP chain selector | 16015286601757825753 | 3478487238524512106 |
| CCIP router | `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59` | `0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165` |
| LINK | `0x779877A7B0D9E8603169DdbD7836e478b4624789` | |

## Trial run on a fork of Sepolia

The real CCIP router, LINK and Uniswap of Sepolia, without real transactions. A fork has no L2,
so the message is accepted by the router on L1 but never delivered.

```sh
npx hardhat node --network sepoliaFork                     # terminal 1
npx hardhat run scripts/bridge.ts --network localhost      # terminal 2
npx hardhat run scripts/buy-link.ts --network localhost
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/fund.ts --network localhost
ENV_FILE=.env.fork node scripts/agent.ts                   # .env.fork: fork RPC URL, key of
                                                           # test account #0, both addresses
```

## Run on the testnets

The wallet needs about 0.01 Sepolia ETH. Instead of faucets, it gets its Arbitrum Sepolia ETH
through the Arbitrum bridge and its LINK on Uniswap V3.

```sh
node scripts/status.ts                                          # balances before the run
npx hardhat run scripts/bridge.ts --network sepolia             # 0.003 ETH to the L2, arrives in ~10-15 min
npx hardhat run scripts/buy-link.ts --network sepolia           # 0.003 ETH -> ~0.25 LINK
npx hardhat run scripts/deploy.ts --network sepolia             # CrossChainMessenger
npx hardhat run scripts/fund.ts --network sepolia               # all the LINK to the messenger
node scripts/status.ts                                          # wait until the L2 balance is there
npx hardhat run scripts/deploy.ts --network arbitrumSepolia     # MessageReceiver
node scripts/agent.ts                                           # sendMessage, prints the message id
node scripts/status.ts                                          # the receiver's last message, ~20-25 min later
```

The CCIP fee of one message is about 0.04 LINK. The delivery waits for the finality of the Sepolia
block (about 15 minutes) before CCIP executes the message on Arbitrum Sepolia.
