// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Kitchen.sol";
import "./IKitchenUsage.sol";

abstract contract EntrepreneurKitchen is Kitchen {
  IKitchenUsage kitchenUsage;
  uint8 kitchenId;
  uint8 public minEfficiency;

  /**
   * Checks if the character is eligible to work in that kitchen
   * @param tokenId - Amount of characters to stake
   * @return true
   */
  function _checkEligibility(uint256 tokenId) internal override view returns (bool) {
    (uint8 efficiency,) = getProperties(tokenId);
    return efficiency >= minEfficiency;
  }

  /**
   * Checks if there is kitchen space for the given amount of chefs (rats have no limit)
   * @param account - User wallet address
   * @param spaceUsed - Amount of space in use by chefs
   * @return Amount of kitchen space in staking, 0 if (all is in use but) available in wallet, -1 if out of kitchen space
   */
  function _checkSpace(address account, uint256 spaceUsed) internal override view returns (int256) {
    return int256(kitchenUsage.checkSpace(account, kitchenId, spaceUsed));
  }

  /**
   * Stakes a single kitchen, used when staked kitchen space has run out
   * @param account - User wallet address
   */
  function _stakeKitchen(address account) internal override {
    kitchenUsage.stake(account, kitchenId, 1);
  }

  /**
   * Unstakes a kitchen, used when kitchen space is not used anymore
   * @param account - User wallet address
   */
  function _claimKitchen(address account) internal override {
    kitchenUsage.claim(account, kitchenId, 1);
  }
}
