// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

abstract contract GenericPausable is OwnableUpgradeable, PausableUpgradeable {
  function pause() external onlyOwner { _pause(); }
  function unpause() external onlyOwner { _unpause(); }
}
