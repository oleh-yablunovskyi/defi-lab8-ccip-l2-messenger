import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();
const { AbiCoder, ZeroHash, parseEther } = ethers;

// CCIP chain selectors; the mock router reports every message as coming from Sepolia
const SEPOLIA_SELECTOR = 16015286601757825753n;
const ARBITRUM_SEPOLIA_SELECTOR = 3478487238524512106n;
const TEXT = "Hello L2 from L1!";
const FEE = parseEther("0.05");

// The mock router of the Chainlink package plays both sides: like the router of Sepolia it takes
// the fee in the fee token of the message, and like the router of Arbitrum Sepolia it calls
// ccipReceive of the receiver at once. A plain ERC-20 stands in for LINK.
async function deploy() {
  const router = await ethers.deployContract("MockCCIPRouter");
  await router.setFee(FEE);
  const link = await ethers.deployContract("TestToken");
  const messenger = await ethers.deployContract("CrossChainMessenger", [
    await router.getAddress(),
    await link.getAddress(),
  ]);
  const receiver = await ethers.deployContract("MessageReceiver", [await router.getAddress()]);
  return { router, link, messenger, receiver };
}

describe("CrossChainMessenger", function () {
  it("pays the CCIP fee in LINK and the receiver gets the text", async function () {
    const { router, link, messenger, receiver } = await deploy();
    await link.transfer(messenger, parseEther("1"));

    const messageId = await messenger.sendMessage.staticCall(ARBITRUM_SEPOLIA_SELECTOR, receiver, TEXT);
    await expect(messenger.sendMessage(ARBITRUM_SEPOLIA_SELECTOR, receiver, TEXT))
      .to.emit(messenger, "MessageSent")
      .withArgs(messageId, ARBITRUM_SEPOLIA_SELECTOR, await receiver.getAddress(), TEXT, FEE);

    // the router pulled exactly the fee in LINK (the approve of sendMessage)
    expect(await link.balanceOf(messenger)).to.equal(parseEther("1") - FEE);
    expect(await link.balanceOf(router)).to.equal(FEE);
    // the receiver decoded the message: the id, the source chain, the sender and the text
    expect(await receiver.lastMessageId()).to.equal(messageId);
    expect(await receiver.lastSourceChainSelector()).to.equal(SEPOLIA_SELECTOR);
    expect(await receiver.lastSender()).to.equal(await messenger.getAddress());
    expect(await receiver.lastText()).to.equal(TEXT);
  });

  it("reverts when its LINK balance does not cover the fee", async function () {
    const { link, messenger, receiver } = await deploy();
    await link.transfer(messenger, parseEther("0.01"));

    await expect(messenger.sendMessage(ARBITRUM_SEPOLIA_SELECTOR, receiver, TEXT)).to.be.revertedWith(
      "Not enough LINK for fees",
    );
    expect(await receiver.lastText()).to.equal("");
  });

  it("the receiver accepts a message only from its CCIP router", async function () {
    const { receiver } = await deploy();
    const [user] = await ethers.getSigners();
    const coder = AbiCoder.defaultAbiCoder();
    const forged = {
      messageId: ZeroHash,
      sourceChainSelector: SEPOLIA_SELECTOR,
      sender: coder.encode(["address"], [user.address]),
      data: coder.encode(["string"], ["forged"]),
      destTokenAmounts: [],
    };

    await expect(receiver.ccipReceive(forged))
      .to.be.revertedWithCustomError(receiver, "InvalidRouter")
      .withArgs(user.address);
  });
});
