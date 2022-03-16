// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./Venue.sol";

contract Gym is Venue {
  function initialize(
    address _character,
    address _claim
  ) external initializer {
    __Ownable_init();
    __Pausable_init();

    character = Character(_character);
    claim = IClaim(_claim);
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(
    uint256 _vestingPeriod,
    uint256 _accrualPeriod,
    int8 _dailyInsanityRate,
    int8 _dailyFatnessRate,
    uint8 _maxClaimsPerTx
  ) external onlyOwner {
    vestingPeriod = _vestingPeriod;
    accrualPeriod = _accrualPeriod;
    dailyInsanityRate = _dailyInsanityRate;
    dailyFatnessRate = _dailyFatnessRate;
    maxClaimsPerTx = _maxClaimsPerTx;
  }
}
