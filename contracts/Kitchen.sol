// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Venue.sol";
import "./Character.sol";

abstract contract Kitchen is Venue {
  uint256 public constant FFOOD_CLAIM_TAX_PERCENTAGE = 20; // Rats steal x% of all food tokens claimed
  uint256 public constant MINIMUM_TO_EXIT = 8 hours; // Cannot unstake before EOB
  uint256 public constant FFOOD_MAX_SUPPLY = 1000000000 ether; // There will only ever be x tokens earned through staking
  uint256 public constant DAILY_FFOOD_RATE = 1000 ether; // Chefs earn x tokens per day

  uint256 public unaccountedRewards; // any rewards distributed when no Rats are staked
  uint256 public totalFoodTokensEarned; // Amount of food tokens earned so far
  uint256 public lastClaimTimestamp; // The last time food token was claimed
  uint8 public chefEfficiencyMultiplier;
  int256 public ratEfficiencyMultiplier;
  int256 public ratEfficiencyOffset;

  function initialize() external virtual initializer {
    __Ownable_init();
    __Pausable_init();
  }

  /**
   * Returns the food tokens per Rat value when the Rat was staked
   * @return current foodTokensPerRat value
   */
  function _getRatStakeValue() internal view override returns (uint80) {
    return uint80(foodTokensPerRat);
  }

  /**
   * Returns the amount of food tokens produced by the Chef during the staking period
   * @param stake - Character's current staking position
   * @return owed - Accrued amount
   */
  function _getOwedByChef(Stake memory stake) internal override returns(uint256 owed) {
    (uint8 efficiency,) = getProperties(stake.tokenId);
    uint256 nominal = (block.timestamp - stake.value) * DAILY_FFOOD_RATE / accrualPeriod;
    uint256 multiplier = 100000 + (uint256(efficiency) * chefEfficiencyMultiplier * 10);
    owed = nominal * multiplier / 100000;
    if (totalFoodTokensEarned + owed > FFOOD_MAX_SUPPLY) {
      owed = FFOOD_MAX_SUPPLY - totalFoodTokensEarned;
    }

    if (owed > 0) {
      lastClaimTimestamp = block.timestamp;
      _carelesslyLeaveToRats(owed * FFOOD_CLAIM_TAX_PERCENTAGE / 100); // percentage tax to staked Rats
      owed = owed * (100 - FFOOD_CLAIM_TAX_PERCENTAGE) / 100; // Remainder goes to Chef owner
      totalFoodTokensEarned += owed;
    }
  }

  /**
   * Returns the amount of food tokens stolen by the Rat during the staking period
   * @param stake - Character's current staking position
   * @return owed - Accrued amount
   */
  function _getOwedByRat(Stake memory stake) internal override returns(uint256 owed) {
    (, uint8 tolerance) = getProperties(stake.tokenId);
    uint256 nominal = foodTokensPerRat - stake.value;
    int256 multiplier = (int256(int8(tolerance <= 50 ? tolerance : 100 - tolerance)) * ratEfficiencyMultiplier * 1000 / 100) + (ratEfficiencyOffset * 1000);
    owed = nominal * uint256(multiplier) / 100000; // Calculate individual share
    if (totalFoodTokensEarned + owed > FFOOD_MAX_SUPPLY) {
      owed = FFOOD_MAX_SUPPLY - totalFoodTokensEarned;
    }

    if (owed > 0) {
      lastClaimTimestamp = block.timestamp;
      totalFoodTokensEarned += owed;
    }
  }

  /**
   * Add food tokens to claimable pot for the Rats
   * @param amount - Food tokens to add to the pot
   */
  function _carelesslyLeaveToRats(uint256 amount) internal {
    if (totalRatsStaked == 0) { // if there are no staked Rats
      unaccountedRewards += amount; // keep track of food tokens owed to Rats
      return;
    }
    // makes sure to include any unaccounted food tokens
    foodTokensPerRat += (amount + unaccountedRewards) / totalRatsStaked;
    unaccountedRewards = 0;
  }
}
