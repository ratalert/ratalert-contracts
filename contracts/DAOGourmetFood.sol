// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DAOGourmetFood is ERC20, ERC20Capped, ERC20Permit, ERC20Votes, Ownable, AccessControl {
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

  constructor(address _dao) ERC20("GourmetFood", "GFOOD") ERC20Capped(1000000 * 10 ** 18) ERC20Permit("GourmetFood") {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _setupRole(DEFAULT_ADMIN_ROLE, _dao);
  }

  /**
   * Override required for ERC20Votes
   */
  function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
    super._afterTokenTransfer(from, to, amount);
  }

  /**
   * Override required for ERC20Capped
   */
  function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes, ERC20Capped) {
    super._mint(to, amount);
  }

  /**
   * Override required for ERC20Votes
   */
  function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
    super._burn(account, amount);
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
