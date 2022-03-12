// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract ControllableUpgradeable is OwnableUpgradeable {
  mapping(address => bool) controllers; // Mapping from an address to whether or not it can mint / burn

  /**
   * @dev Throws if called by any account other than a controller.
     */
  modifier onlyController() {
    require(controllers[msg.sender], "Only controllers can execute");
    _;
  }

  /**
   * Gets controller status by address
   * @param _controller - The address to check
   */
  function controller(address _controller) external view onlyOwner returns (bool) {
    return controllers[_controller];
  }

  /**
   * Enables an address to mint / burn
   * @param _controller - The address to enable
   */
  function addController(address _controller) external onlyOwner {
    controllers[_controller] = true;
  }

  /**
   * Disables an address from minting / burning
   * @param _controller - The address to disable
   */
  function removeController(address _controller) external onlyOwner {
    controllers[_controller] = false;
  }
}
