// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Sends a text message from this chain to a receiver contract on another chain through the
// Chainlink CCIP router and pays the CCIP fee in LINK from its own balance.
contract CrossChainMessenger {
    // The router and the fee token are stored in the bytecode (immutable)
    IRouterClient public immutable ccipRouter;
    IERC20 public immutable linkToken;

    // The delivery is asynchronous: off-chain services follow the message by its messageId
    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address receiver,
        string text,
        uint256 feePaid
    );

    constructor(address _router, address _link) {
        ccipRouter = IRouterClient(_router);
        linkToken = IERC20(_link);
    }

    function sendMessage(
        uint64 _destinationChainSelector,
        address _receiver,
        string calldata _text
    ) external returns (bytes32 messageId) {

        Client.EVM2AnyMessage memory evm2AnyMessage = _buildCCIPMessage(_receiver, _text);

        // The router prices the delivery for the current gas price of the destination chain
        uint256 fees = ccipRouter.getFee(_destinationChainSelector, evm2AnyMessage);

        require(linkToken.balanceOf(address(this)) >= fees, "Not enough LINK for fees");
        linkToken.approve(address(ccipRouter), fees);

        messageId = ccipRouter.ccipSend(_destinationChainSelector, evm2AnyMessage);

        emit MessageSent(messageId, _destinationChainSelector, _receiver, _text, fees);

        return messageId;
    }

    // Packs the receiver and the text into a CCIP message: both are ABI-encoded into bytes, no
    // tokens are sent, and extraArgs sets the gas limit of the execution on the destination chain.
    function _buildCCIPMessage(address _receiver, string calldata _text)
        internal view returns (Client.EVM2AnyMessage memory)
    {
        return Client.EVM2AnyMessage({
            receiver: abi.encode(_receiver),
            data: abi.encode(_text),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: 200_000})
            ),
            feeToken: address(linkToken) // address(0) would mean paying in the native coin; the fee is paid in LINK
        });
    }
}
