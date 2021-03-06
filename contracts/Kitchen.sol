// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Venue.sol";

abstract contract Kitchen is Venue {
  uint256 foodTokenMaxSupply; // There will only ever be x tokens earned through staking
  uint256 dailyChefEarnings; // Gross food token amount that chefs earn per day
  uint256 ratTheftPercentage; // Percentage that Rats steal from all food tokens claimed
  uint256 public unaccountedRewards; // any rewards distributed when no Rats are staked
  uint256 public totalFoodTokensEarned; // Amount of food tokens earned so far
  uint256 public lastClaimTimestamp; // The last time food token was claimed
  uint8 chefEfficiencyMultiplier;
  int256 ratEfficiencyMultiplier;
  int256 ratEfficiencyOffset;

  function initialize() external virtual initializer {
    __Ownable_init();
    __Pausable_init();
  }

  /**
   * Returns the amount of food tokens produced by the Chef during the staking period
   * @param stake - Character's current staking position
   * @return owed - Accrued amount
   */
  function _getOwedByChef(Stake memory stake) internal override returns(uint256 owed) {
    (uint8 efficiency,) = getProperties(stake.tokenId);
    uint256 stakingPeriod = block.timestamp - stake.value;
    if (stakingPeriod > accrualPeriod) {
      stakingPeriod = accrualPeriod; // cut-off
    }
    uint256 nominal = dailyChefEarnings * stakingPeriod / accrualPeriod;
    uint256 multiplier = 100000 + (uint256(efficiency) * chefEfficiencyMultiplier * 10);
    owed = nominal * multiplier / 100000;
    if (totalFoodTokensEarned + owed > foodTokenMaxSupply) {
      owed = foodTokenMaxSupply - totalFoodTokensEarned;
    }

    if (owed > 0) {
      lastClaimTimestamp = block.timestamp;
      _carelesslyLeaveToRats(owed * ratTheftPercentage / 100); // percentage tax to staked Rats
      owed = owed * (100 - ratTheftPercentage) / 100; // Remainder goes to Chef owner
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
    if (totalFoodTokensEarned + owed > foodTokenMaxSupply) {
      owed = foodTokenMaxSupply - totalFoodTokensEarned;
    }

    if (owed > 0) {
      lastClaimTimestamp = block.timestamp;
      totalFoodTokensEarned += owed;
    }
  }

  /**
   * Events are enabled in kitchens
   * @return true
   */
  function _triggerEvents() internal pure override returns(bool) {
    return true;
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
    foodTokensPerRat += (amount + unaccountedRewards) / totalRatsStaked; // make sure to include any unaccounted food tokens
    unaccountedRewards = 0;
  }
}
