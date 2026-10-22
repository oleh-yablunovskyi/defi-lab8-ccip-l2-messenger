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

The wallet needs about 0.013 Sepolia ETH: 0.006 ETH become L2 ETH and LINK, and the Hardhat
scripts pay 1 gwei per gas (the messenger deployment alone takes about 5.66 M gas). Instead of
faucets, the wallet gets its Arbitrum Sepolia ETH through the Arbitrum bridge and its LINK on
Uniswap V3.

```sh
node scripts/status.ts                                          # balances before the run
npx hardhat run scripts/bridge.ts --network sepolia             # 0.003 ETH to the L2, arrives in ~10-15 min
npx hardhat run scripts/buy-link.ts --network sepolia           # 0.003 ETH -> ~0.25 LINK
npx hardhat run scripts/deploy.ts --network sepolia             # CrossChainMessenger
npx hardhat run scripts/fund.ts --network sepolia               # all the LINK to the messenger
node scripts/status.ts                                          # wait until the L2 balance is there
npx hardhat run scripts/deploy.ts --network arbitrumSepolia     # MessageReceiver
node scripts/agent.ts                                           # sendMessage, prints the message id
node scripts/status.ts                                          # the receiver's last message, ~15 min later
```

The CCIP fee of one message is about 0.04 LINK. The delivery waits for the finality of the Sepolia
block (about 15 minutes) before CCIP executes the message on Arbitrum Sepolia.

## Results of the run on 21 October 2026

| | Sepolia (L1) | Arbitrum Sepolia (L2) |
| --- | --- | --- |
| Wallet | `0x09662A780cF56bFe7Ec70A455644E74061d9543C` | the same address |
| Contract | CrossChainMessenger `0x2eBDB1145aBf1E9349eaf94A88e80Cd3a05659b4` | MessageReceiver `0x7961936380477d3486ff6d8A7C3BBd7F9f4FAc36` |
| Deployment | `0x28d8751abf559e265f4b21bce5b2e3626e8d3f55bd6d7f8fffb35d51eb49565f` | `0xa71ce1d9e6bab2fdcba2be7932266e3dd0ece82837190ed375110ee241dcd715` |

Transactions on Sepolia: bridge deposit `0xe210fc0ca472df3bd066aac4e4a35f0f708ef1520ad13814b5f1377cc5a8eabe`,
LINK purchase `0x1819599cbd5323a825a49ca0bce83a48974c76ae7cd88865c642bff8ce208684`, LINK
transfer to the messenger `0xe8a71ec6bf6a86f97a9343c0d4bd2d2530fb08a2d4d21eab20e284ce34cf1eda`,
`sendMessage` `0x5d8fcfa2a952715484fc68313d585ab83cc35d93f8c0f6c6f9cff6b8d0a44080` (block 11961410).

CCIP message id `0x0cfd1ea9321bf4bdbefa95ad317e7bda3ec6a1aa7707244ec527b8005162472e`
([CCIP Explorer](https://ccip.chain.link/msg/0x0cfd1ea9321bf4bdbefa95ad317e7bda3ec6a1aa7707244ec527b8005162472e)),
fee 0.041219377954390809 LINK. Status Success after 13 min 42 s: CCIP executed the message on
Arbitrum Sepolia in tx `0xb7b36ef517d96fc2883384b1785cc6d779a124f73a9aa656054f0fdffd93ace6`
(block 321349383). `node scripts/status.ts` then read from the receiver the message id above, the
source chain selector 16015286601757825753 (Sepolia), the messenger as the sender and the text
"Hello L2 from L1!".

The run cost 0.012235778005524675 Sepolia ETH: 0.006 ETH became 0.003 ETH on Arbitrum Sepolia
and 0.246650884965961237 LINK, and 0.006235778005524675 ETH paid for gas, of which 0.005660853 ETH
was the messenger deployment.
