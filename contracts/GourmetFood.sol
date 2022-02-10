// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Food.sol";

contract GourmetFood is Food {
  constructor() Food("GourmetFood", "GFOOD", 1000000 * 10 ** 18) {}
}
