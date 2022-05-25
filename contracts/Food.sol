// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract Food is ERC20, ERC20Capped, Ownable, AccessControl {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

  constructor(string memory _name, string memory _symbol, uint256 _cap, address _dao) ERC20(_name, _symbol) ERC20Capped(_cap) {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender); // Initialization
    _setupRole(DEFAULT_ADMIN_ROLE, _dao);
  }

  /**
   * Override required for ERC20Capped
   * @param to - The recipient of the food token
   * @param amount - The amount of food tokens to mint
   */
  function _mint(address to, uint256 amount) internal virtual override(ERC20, ERC20Capped) {
    super._mint(to, amount);
  }

  /**
   * Mints the implementation food token to the recipient
   * @param to - The recipient of the food token
   * @param amount - The amount of food tokens to mint
   */
  function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
    _mint(to, amount);
  }

  /**
   * Burns food tokens from a holder
   * @param from - The holder of the food token
   * @param amount - The amount of food tokens to burn
   */
  function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
    _burn(from, amount);
  }
}
