// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract Controllable is Ownable {
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
  function controller(address _controller) external view returns (bool) {
    return controllers[_controller];
  }

  /**
   * Enables multiple addresses to execute
   * @param _controllers - The addresses to enable
   */
  function addController(address[] memory _controllers) external onlyOwner {
    for (uint i = 0; i < _controllers.length; i++) {
      controllers[_controllers[i]] = true;
    }
  }

  /**
   * Prevents multiple addresses from executing
   * @param _controllers - The addresses to disable
   */
  function removeController(address[] memory _controllers) external onlyOwner {
    for (uint i = 0; i < _controllers.length; i++) {
      controllers[_controllers[i]] = false;
    }
  }
}
