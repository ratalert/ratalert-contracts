// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "./IChefRat.sol";

contract ChefRat is IChefRat, Initializable, OwnableUpgradeable, PausableUpgradeable, ERC1155Upgradeable {
  uint256 public minted;
  uint256 public constant CHEF = 0;
  uint256 public constant RAT = 1;

  function initialize() external initializer {
    __Ownable_init();
    __Pausable_init();
    __ERC1155_init("Rat Alert chefs & rats");

    minted = 0;
  }

  /**
   * Mints a new ERC1155 token: 90% chefs, 10% rats
   * The first 20% are free to claim, the remaining cost $FFOOD
   * @param amount Number of tokens to mint
   */
  function mint(uint8 amount) external whenNotPaused {
    require(amount > 0 && amount <= 10, "Invalid mint amount");
    _mint(_msgSender(), CHEF, amount, "");
    minted += amount;
  }
}
