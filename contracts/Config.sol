// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Config is Initializable, OwnableUpgradeable {
  string json;

  function initialize(
  ) external initializer {
    __Ownable_init();
  }

  function get() external view returns (string memory) {
    return json;
  }

  function set(string calldata _json) external onlyOwner {
    json = _json;
  }
}
