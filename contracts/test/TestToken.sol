// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Stand-in for the LINK token in the local tests
contract TestToken is ERC20 {
    constructor() ERC20("Test LINK", "tLINK") {
        _mint(msg.sender, 1_000 ether);
    }
}
