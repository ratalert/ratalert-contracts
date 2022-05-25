// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Food.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract GourmetFood is Food, ERC20Permit, ERC20Votes {
  constructor(address _dao) Food("GourmetFood", "GFOOD", 1000000 * 10 ** 18, _dao) ERC20Permit("GourmetFood") {}

  function _afterTokenTransfer(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
    super._afterTokenTransfer(from, to, amount);
  }

  function _mint(address to, uint256 amount) internal override(Food, ERC20, ERC20Votes) {
    super._mint(to, amount);
  }

  function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
    super._burn(account, amount);
  }
}
