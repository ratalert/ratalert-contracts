// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./EntrepreneurKitchen.sol";
import "./CasualFood.sol";
import "./KitchenShop.sol";

contract TheStakehouse is EntrepreneurKitchen {
  CasualFood foodToken; // Reference to the $CFOOD contract

  function initialize(
    address _character,
    address _claim,
    address _foodToken,
    address _kitchenShop
  ) external initializer {
    __Ownable_init();
    __Pausable_init();

    unaccountedRewards = 0;
    foodTokensPerRat = 0;
    lastClaimTimestamp = 0;
    kitchenId = 1;

    character = Character(_character);
    claim = IClaim(_claim);
    foodToken = CasualFood(_foodToken);
    kitchenShop = KitchenShop(_kitchenShop);
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(
    uint256 _foodTokenMaxSupply,
    uint256[] memory _earningSettings, // dailyChefEarnings, ratTheftPercentage, vestingPeriod, accrualPeriod
    int8[] memory _propertyIncrements, // dailySkillRate, dailyInsanityRate, dailyIntelligenceRate, dailyFatnessRate
    uint8 _minEfficiency,
    uint8 _chefsPerKitchen,
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
    dailyInsanityRate = _propertyIncrements[1];
    dailyIntelligenceRate = _propertyIncrements[2];
    dailyFatnessRate = _propertyIncrements[3];
    minEfficiency = _minEfficiency;
    chefsPerKitchen = _chefsPerKitchen;
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
