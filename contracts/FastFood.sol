// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FastFood is ERC20, Ownable {
  mapping(address => bool) controllers; // a mapping from an address to whether or not it can mint / burn

  constructor() ERC20("FastFood", "FFOOD") {}

  /**
   * Mints $FFOOD to a recipient
   * @param to the recipient of the $FFOOD
   * @param amount the amount of $FFOOD to mint
   */
  function mint(address to, uint256 amount) external {
     require(controllers[msg.sender], "Only controllers can mint");
    _mint(to, amount);
  }

  /**
   * Burns $FFOOD from a holder
   * @param from the holder of the $FFOOD
   * @param amount the amount of $FFOOD to burn
   */
  function burn(address from, uint256 amount) external {
     require(controllers[msg.sender], "Only controllers can burn");
    _burn(from, amount);
  }

  /**
   * Gets controller status by address
   * @param controller the address to check
   */
  function getController(address controller) external view onlyOwner returns (bool) {
    return controllers[controller];
  }

  /**
   * Enables an address to mint / burn
   * @param controller the address to enable
   */
  function addController(address controller) external onlyOwner {
    controllers[controller] = true;
  }

  /**
   * Disables an address from minting / burning
   * @param controller the address to disable
   */
  function removeController(address controller) external onlyOwner {
    controllers[controller] = false;
  }
}
