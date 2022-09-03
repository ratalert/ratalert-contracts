// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./VenueV2.sol";

contract GymV2 is VenueV2 {
  function initialize(
    address _character,
    address _claim
  ) external initializer {
    __Ownable_init();
    __Pausable_init();

    character = CharacterV2(_character);
    claim = IClaim(_claim);
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(
    uint256 _vestingPeriod,
    uint256 _accrualPeriod,
    int8 _dailyFreakRate,
    int8 _dailyBodyMassRate,
    uint8 _maxClaimsPerTx,
    uint256 _claimFee
  ) external onlyOwner {
    vestingPeriod = _vestingPeriod;
    accrualPeriod = _accrualPeriod;
    dailyFreakRate = _dailyFreakRate;
    dailyBodyMassRate = _dailyBodyMassRate;
    maxClaimsPerTx = _maxClaimsPerTx;
    claimFee = _claimFee;
  }
}