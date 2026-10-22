// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

// Placeholder receiver on the destination chain (Arbitrum Sepolia). The CCIP router of that chain
// calls ccipReceive when the message arrives (CCIPReceiver accepts the call only from the router);
// the contract keeps the last message, so the delivery can be read back on the L2.
contract MessageReceiver is CCIPReceiver {
    bytes32 public lastMessageId;
    uint64 public lastSourceChainSelector;
    address public lastSender;
    string public lastText;

    event MessageReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address sender,
        string text
    );

    constructor(address _router) CCIPReceiver(_router) {}

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        lastMessageId = message.messageId;
        lastSourceChainSelector = message.sourceChainSelector;
        lastSender = abi.decode(message.sender, (address));
        lastText = abi.decode(message.data, (string));
        emit MessageReceived(lastMessageId, lastSourceChainSelector, lastSender, lastText);
    }
}
