// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Food.sol";

contract FastFood is Food {
  constructor() Food("FastFood", "FFOOD", 100000000 * 10 ** 18) {}
}
