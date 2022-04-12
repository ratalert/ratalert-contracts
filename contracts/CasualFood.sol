// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Food.sol";

contract CasualFood is Food {
  constructor() Food("CasualFood", "CFOOD", 10000000 * 10 ** 18) {}
}
