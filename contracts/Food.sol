// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract Food is ERC20, ERC20Capped, Ownable {
  mapping(address => bool) controllers; // a mapping from an address to whether or not it can mint / burn

  constructor(string memory _name, string memory _symbol, uint256 _cap) ERC20(_name, _symbol) ERC20Capped(_cap) {}

  /**
   * Override required for ERC20Capped
   * @param to - The recipient of the food token
   * @param amount - The amount of food tokens to mint
   */
  function _mint(address to, uint256 amount) internal override(ERC20, ERC20Capped) {
    super._mint(to, amount);
  }

  /**
   * Mints the implementation food token to the recipient
   * @param to - The recipient of the food token
   * @param amount - The amount of food tokens to mint
   */
  function mint(address to, uint256 amount) external {
     require(controllers[msg.sender], "Only controllers can mint");
    _mint(to, amount);
  }

  /**
   * Burns food tokens from a holder
   * @param from - The holder of the food token
   * @param amount - The amount of food tokens to burn
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
