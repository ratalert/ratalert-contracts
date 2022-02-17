// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./EntrepreneurKitchen.sol";
import "./CasualFood.sol";
import "./KitchenShop.sol";

contract TheStakehouse is EntrepreneurKitchen {
  CasualFood foodToken; // Reference to the $CFOOD contract

  function initialize(
    address _character,
    address _foodToken,
    address _kitchenShop,
    uint256 _foodTokenMaxSupply,
    uint256[] memory _earningSettings, // dailyChefEarnings, ratTheftPercentage, vestingPeriod, accrualPeriod
    int8[] memory _propertyIncrements, // dailySkillRate, dailyInsanityRate, dailyIntelligenceRate, dailyFatnessRate
    uint8 _minEfficiency,
    uint8 _charactersPerKitchen,
    uint8 _chefEfficiencyMultiplier,
    int256 _ratEfficiencyMultiplier,
    int256 _ratEfficiencyOffset
  ) external initializer {
    __Ownable_init();
    __Pausable_init();

    unaccountedRewards = 0;
    foodTokensPerRat = 0;
    lastClaimTimestamp = 0;
    kitchenId = 1;

    character = Character(_character);
    foodToken = CasualFood(_foodToken);
    kitchenShop = KitchenShop(_kitchenShop);
    foodTokenMaxSupply = _foodTokenMaxSupply * 1 ether;
    dailyChefEarnings = _earningSettings[0] * 1 ether;
    ratTheftPercentage = _earningSettings[1];
    vestingPeriod = _earningSettings[2];
    accrualPeriod = _earningSettings[3];
    dailySkillRate = _propertyIncrements[0];
    dailyInsanityRate = _propertyIncrements[1];
    dailyIntelligenceRate = _propertyIncrements[2];
    dailyFatnessRate = _propertyIncrements[3];
    minEfficiency = _minEfficiency;
    charactersPerKitchen = _charactersPerKitchen;
    chefEfficiencyMultiplier = _chefEfficiencyMultiplier;
    ratEfficiencyMultiplier = _ratEfficiencyMultiplier;
    ratEfficiencyOffset = _ratEfficiencyOffset;
  }

  /**
   * Mints the given amount of food tokens in the user's account
   * @param amount - Amount of food tokens to mint
   */
  function _mintFoodToken(uint256 amount) internal override {
    foodToken.mint(_msgSender(), amount);
  }
}
