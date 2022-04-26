// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./DOWable.sol";

abstract contract GenericPausable is PausableUpgradeable, DOWable {
  function pause() external {
    isDao();
    _pause();
  }
  function unpause() external {
    isDao();
    _unpause();
  }
}
