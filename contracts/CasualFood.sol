// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Food.sol";

contract CasualFood is Food {
  constructor() ERC20("CasualFood", "CFOOD") {}
}
