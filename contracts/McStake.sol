// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Kitchen.sol";
import "./FastFood.sol";

contract McStake is Kitchen {
  FastFood foodToken; // Reference to the $FFOOD contract

  function initialize(
    address _character,
    address _claim,
    address _foodToken
  ) external initializer {
    __Ownable_init();
    __Pausable_init();

    unaccountedRewards = 0;
    foodTokensPerRat = 0;
    lastClaimTimestamp = 0;

    character = Character(_character);
    claim = IClaim(_claim);
    foodToken = FastFood(_foodToken);
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(
    uint256 _foodTokenMaxSupply,
    uint256[] memory _earningSettings, // dailyChefEarnings, ratTheftPercentage, vestingPeriod, accrualPeriod
    int8[] memory _propertyIncrements, // dailySkillRate, dailyFreakRate, dailyIntelligenceRate, dailyBodyMassRate
    uint8 _chefEfficiencyMultiplier,
    int256 _ratEfficiencyMultiplier,
    int256 _ratEfficiencyOffset,
    uint8 _maxClaimsPerTx
  ) external onlyOwner {
    foodTokenMaxSupply = _foodTokenMaxSupply * 1 ether;
    dailyChefEarnings = _earningSettings[0] * 1 ether;
    ratTheftPercentage = _earningSettings[1];
    vestingPeriod = _earningSettings[2];
    accrualPeriod = _earningSettings[3];
    dailySkillRate = _propertyIncrements[0];
    dailyFreakRate = _propertyIncrements[1];
    dailyIntelligenceRate = _propertyIncrements[2];
    dailyBodyMassRate = _propertyIncrements[3];
    chefEfficiencyMultiplier = _chefEfficiencyMultiplier;
    ratEfficiencyMultiplier = _ratEfficiencyMultiplier;
    ratEfficiencyOffset = _ratEfficiencyOffset;
    maxClaimsPerTx = _maxClaimsPerTx;
  }

  /**
   * Mints the given amount of food tokens in the user's account
   * @param sender - User wallet address
   * @param amount - Amount of food tokens to mint
   */
  function _mintFoodToken(address sender, uint256 amount) internal override {
    foodToken.mint(sender, amount);
  }
}
