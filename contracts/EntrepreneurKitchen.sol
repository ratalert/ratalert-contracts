// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Kitchen.sol";
import "./KitchenShop.sol";

abstract contract EntrepreneurKitchen is Kitchen {
  KitchenShop kitchenShop;
  uint8 kitchenId;
  uint8 charactersPerKitchen;
  uint8 minEfficiency;

  /**
   * Checks if there is kitchen space for the given amount of characters
   * @param amountToAdd - Number of characters to add to stake
   * @return true
   */
  function _checkSpace(uint256 amountToAdd) internal override view returns (bool) {
    address account = _msgSender();
    uint256 balance = kitchenShop.balanceOf(account, kitchenId);
    return balance * charactersPerKitchen >= stakers[account].length + amountToAdd;
  }

  /**
   * Checks if the character is eligible to work in that kitchen
   * @param tokenId - Amount of characters to stake
   * @return true
   */
  function _checkEligibility(uint256 tokenId) internal override view returns (bool) {
    (uint8 efficiency,) = getProperties(tokenId);
    return efficiency >= minEfficiency;
  }
}
