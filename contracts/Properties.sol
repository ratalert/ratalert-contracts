// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract Properties is Initializable, OwnableUpgradeable {
  int8 public disasterEfficiencyMinimumChef; // Minimum skill percentage for chefs during a burnout event
  int8 public disasterEfficiencyMinimumRat; // Minimum intelligence percentage for rats during a burnout event
  uint8 public disasterEfficiencyLossChef; // Skill percentage loss for chefs during a burnout event
  uint8 public disasterEfficiencyLossRat; // Intelligence percentage loss for rats during a cat event
  uint8 public disasterToleranceLossChef; // Insanity percentage loss for chefs during a burnout event
  uint8 public disasterToleranceLossRat; // Fatness percentage loss for rats during a cat event

  int8 public mishapEfficiencyMinimumChef; // Minimum skill percentage for chefs during a foot inspector event
  int8 public mishapEfficiencyMinimumRat; // Minimum intelligence percentage for rats during a rat trap event
  uint8 public mishapEfficiencyLossChef; // Skill percentage loss for chefs during a food inspector event
  uint8 public mishapEfficiencyLossRat; // Intelligence percentage loss for rats during a rat trap event
  uint8 public mishapToleranceLossChef; // Insanity percentage loss for chefs during a food inspector event
  uint8 public mishapToleranceLossRat; // Fatness percentage loss for rats during a rat trap event

  function initialize(uint8[] memory _disasterParams, uint8[] memory _mishapParams) external initializer {
    __Ownable_init();

    disasterEfficiencyMinimumChef = int8(_disasterParams[0]);
    disasterEfficiencyMinimumRat = int8(_disasterParams[1]);
    disasterEfficiencyLossChef = _disasterParams[2];
    disasterEfficiencyLossRat = _disasterParams[3];
    disasterToleranceLossChef = _disasterParams[4];
    disasterToleranceLossRat = _disasterParams[5];

    mishapEfficiencyMinimumChef = int8(_mishapParams[0]);
    mishapEfficiencyMinimumRat = int8(_mishapParams[1]);
    mishapEfficiencyLossChef = _mishapParams[2];
    mishapEfficiencyLossRat = _mishapParams[3];
    mishapToleranceLossChef = _mishapParams[4];
    mishapToleranceLossRat = _mishapParams[5];
  }

  /**
   * Does a burnout / cat event occur?
   * @param isChef - Whether it's a Chef or not
   * @param efficiency - The character's current value
   * @param randomVal - A ChainLink VRF random number
   * @return true if event occurred
   */
  function _doesDisasterOccur(bool isChef, int8 efficiency, uint256 randomVal) internal view returns(bool) {
    if (efficiency <= (isChef ? disasterEfficiencyMinimumChef : disasterEfficiencyMinimumRat)) {
      return false;
    }
    uint8 likelihood = uint8(((efficiency - 100) / -4 * 10) + 20);
    return randomVal % 1000 < likelihood;
  }

  /**
   * Does a food inspector / rat trap event occur?
   * @param isChef - Whether it's a Chef or not
   * @param efficiency - The character's current value
   * @param randomVal - A ChainLink VRF random number
   * @return true if event occurred
   */
  function _doesMishapOccur(bool isChef, int8 efficiency, uint256 randomVal) internal view returns(bool) {
    if (efficiency <= (isChef ? mishapEfficiencyMinimumChef : mishapEfficiencyMinimumRat)) {
      return false;
    }
    uint8 likelihood = uint8(((efficiency - 100) * -1) + 20);
    return randomVal % 1000 < likelihood;
  }

  function _resolveDisaster() internal pure returns(uint8, uint8) {
    return (0, 0);
  }

  function _resolveMishap(bool isChef, uint8 efficiencyValue, uint8 toleranceValue) internal view returns(uint8, uint8) {
    uint8 efficiencyLoss = isChef ? mishapEfficiencyLossChef : mishapEfficiencyLossRat;
    uint8 toleranceLoss = isChef ? mishapToleranceLossChef : mishapToleranceLossRat;
    efficiencyValue = (efficiencyLoss > efficiencyValue) ? 0 : efficiencyValue - efficiencyLoss;
    toleranceValue = (toleranceLoss > toleranceValue) ? 0 : toleranceValue - toleranceLoss;
    return (efficiencyValue, toleranceValue);
  }

  function _getUpdatedValue(uint8 old, int8 increment) internal pure returns(uint8) {
    if (increment >= 0) {
      return (uint8(increment) + old > 100) ? 100 : old + uint8(increment);
    } else {
      return (uint8(-increment) > old) ? 0 : old - uint8(-increment);
    }
  }

  function getEventUpdates(bool isChef, uint8 currentEfficiency, uint8 currentTolerance, int8 efficiencyIncrement, int8 toleranceIncrement, uint256 randomVal) public view returns(uint8 efficiencyValue, uint8 toleranceValue, string memory eventName) {
    eventName = "";
    if (_doesDisasterOccur(isChef, int8(currentEfficiency), randomVal)) {
      (efficiencyValue, toleranceValue) = _resolveDisaster();
      eventName = isChef ? "burnout" : "cat";
    } else if (_doesMishapOccur(isChef, int8(currentEfficiency), randomVal)) {
      (efficiencyValue, toleranceValue) = _resolveMishap(isChef, currentEfficiency, currentTolerance);
      eventName = isChef ? "foodInspector" : "ratTrap";
    } else {
      efficiencyValue = _getUpdatedValue(currentEfficiency, efficiencyIncrement);
      toleranceValue = _getUpdatedValue(currentTolerance, toleranceIncrement);
    }
  }
}
