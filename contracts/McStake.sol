// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Kitchen.sol";
import "./FastFood.sol";

contract McStake is Kitchen {
  FastFood foodToken; // Reference to the $FFOOD contract

  function initialize(address _character, address _foodToken, uint256 _accrualPeriod, int8 _dailySkillRate, int8 _dailyInsanityRate, int8 _dailyIntelligenceRate, int8 _dailyFatnessRate, uint8 _chefEfficiencyMultiplier, int256 _ratEfficiencyMultiplier, int256 _ratEfficiencyOffset) external initializer {
    __Ownable_init();
    __Pausable_init();

    unaccountedRewards = 0;
    foodTokensPerRat = 0;
    lastClaimTimestamp = 0;

    character = Character(_character);
    foodToken = FastFood(_foodToken);
    accrualPeriod = _accrualPeriod;
    dailySkillRate = _dailySkillRate;
    dailyInsanityRate = _dailyInsanityRate;
    dailyIntelligenceRate = _dailyIntelligenceRate;
    dailyFatnessRate = _dailyFatnessRate;
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
