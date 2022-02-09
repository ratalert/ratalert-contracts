// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Food.sol";

contract GourmetFood is Food {
  constructor() ERC20("GourmetFood", "GFOOD") {}
}
