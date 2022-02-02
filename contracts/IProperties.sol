// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IProperties {
  function getEventUpdates(bool isChef, uint8 currentEfficiency, uint8 currentTolerance, int8 efficiencyIncrement, int8 toleranceIncrement) external returns(uint8 efficiencyValue, uint8 toleranceValue, string memory eventName);
}
