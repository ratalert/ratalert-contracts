// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Venue.sol";

contract Gym is Venue {
  function initialize(address _chefRat, uint256 _accrualPeriod, int8 _dailyInsanityRate, int8 _dailyFatnessRate) external initializer {
    __Ownable_init();
    __Pausable_init();

    chefRat = ChefRat(_chefRat);
    accrualPeriod = _accrualPeriod;
    dailyInsanityRate = _dailyInsanityRate;
    dailyFatnessRate = _dailyFatnessRate;
  }
}
