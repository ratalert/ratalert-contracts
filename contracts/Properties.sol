// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract Properties is Initializable, OwnableUpgradeable {
  int8 public disasterToleranceMinimumChef; // Minimum skill percentage for chefs during a burnout event
  int8 public disasterToleranceMinimumRat; // Minimum intelligence percentage for rats during a burnout event
  uint8 public disasterEfficiencyLossChef; // Skill percentage loss for chefs during a burnout event
  uint8 public disasterEfficiencyLossRat; // Intelligence percentage loss for rats during a cat event
  uint8 public disasterToleranceLossChef; // Freak percentage loss for chefs during a burnout event
  uint8 public disasterToleranceLossRat; // BodyMass percentage loss for rats during a cat event

  int8 public mishapEfficiencyMinimumChef; // Minimum skill percentage for chefs during a foot inspector event
  int8 public mishapEfficiencyMinimumRat; // Minimum intelligence percentage for rats during a rat trap event
  uint8 public mishapEfficiencyLossChef; // Skill percentage loss for chefs during a food inspector event
  uint8 public mishapEfficiencyLossRat; // Intelligence percentage loss for rats during a rat trap event
  uint8 public mishapToleranceLossChef; // Freak percentage loss for chefs during a food inspector event
  uint8 public mishapToleranceLossRat; // BodyMass percentage loss for rats during a rat trap event

  int16 public disasterLikelihoodDividerChef; // Divider used for chefs in the disaster likelihood calculation
  int16 public disasterLikelihoodMultiplierChef; // Multiplier used for chefs in the disaster likelihood calculation
  int16 public disasterLikelihoodOffsetChef; // Offset used for chefs in the disaster likelihood calculation
  int16 public disasterLikelihoodDividerRat; // Divider used for rats in the disaster likelihood calculation
  int16 public disasterLikelihoodMultiplierRat; // Multiplier used for rats in the disaster likelihood calculation
  int16 public disasterLikelihoodOffsetRat; // Offset used for rats in the disaster likelihood calculation
  int16 public mishapLikelihoodDividerChef; // Divider used for chefs in the mishap likelihood calculation
  int16 public mishapLikelihoodMultiplierChef; // Multiplier used for chefs in the mishap likelihood calculation
  int16 public mishapLikelihoodOffsetChef; // Offset used for chefs in the mishap likelihood calculation
  int16 public mishapLikelihoodDividerRat; // Divider used for rats in the mishap likelihood calculation
  int16 public mishapLikelihoodMultiplierRat; // Multiplier used for rats in the mishap likelihood calculation
  int16 public mishapLikelihoodOffsetRat; // Offset used for rats in the mishap likelihood calculation

  function initialize() external initializer {
    __Ownable_init();
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(uint8[] memory _disasterParams, uint8[] memory _mishapParams, int16[] memory _likelihoodParams) external onlyOwner {
    disasterToleranceMinimumChef = int8(_disasterParams[0]);
    disasterToleranceMinimumRat = int8(_disasterParams[1]);
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

    disasterLikelihoodDividerChef = _likelihoodParams[0];
    disasterLikelihoodMultiplierChef = _likelihoodParams[1];
    disasterLikelihoodOffsetChef = _likelihoodParams[2];
    disasterLikelihoodDividerRat = _likelihoodParams[3];
    disasterLikelihoodMultiplierRat = _likelihoodParams[4];
    disasterLikelihoodOffsetRat = _likelihoodParams[5];
    mishapLikelihoodDividerChef = _likelihoodParams[6];
    mishapLikelihoodMultiplierChef = _likelihoodParams[7];
    mishapLikelihoodOffsetChef = _likelihoodParams[8];
    mishapLikelihoodDividerRat = _likelihoodParams[9];
    mishapLikelihoodMultiplierRat = _likelihoodParams[10];
    mishapLikelihoodOffsetRat = _likelihoodParams[11];
  }

  /**
   * Does a burnout / cat event occur?
   * @param isChef - Whether it's a Chef or not
   * @param efficiency - The character's current value
   * @param randomVal - A ChainLink VRF random number
   * @return Whether an event occurred
   */
  function _doesDisasterOccur(bool isChef, int8 efficiency, int8 tolerance, uint256 randomVal) internal view returns(bool) {
    if (randomVal == 0) return false;
    if (tolerance <= (isChef ? disasterToleranceMinimumChef : disasterToleranceMinimumRat)) return false;
    int16 divider = isChef ? disasterLikelihoodDividerChef : disasterLikelihoodDividerRat;
    int16 multiplier = isChef ? disasterLikelihoodMultiplierChef : disasterLikelihoodMultiplierRat;
    int16 offset = isChef ? disasterLikelihoodOffsetChef : disasterLikelihoodOffsetRat;
    uint16 likelihood = uint16(((efficiency - 100) / divider * multiplier) + offset);
    return randomVal % 1000 < likelihood;
  }

  /**
   * Does a food inspector / rat trap event occur?
   * @param isChef - Whether it's a Chef or not
   * @param efficiency - The character's current value
   * @param randomVal - A ChainLink VRF random number
   * @return Whether an event occurred
   */
  function _doesMishapOccur(bool isChef, int8 efficiency, uint256 randomVal) internal view returns(bool) {
    if (randomVal == 0) return false;
    if (efficiency <= (isChef ? mishapEfficiencyMinimumChef : mishapEfficiencyMinimumRat)) return false;
    int16 divider = isChef ? mishapLikelihoodDividerChef : mishapLikelihoodDividerRat;
    int16 multiplier = isChef ? mishapLikelihoodMultiplierChef : mishapLikelihoodMultiplierRat;
    int16 offset = isChef ? mishapLikelihoodOffsetChef : mishapLikelihoodOffsetRat;
    uint16 likelihood = uint16(((efficiency - 100) / divider * multiplier) + offset);
    return randomVal % 1000 < likelihood;
  }

  /**
   * Returns the efficiency & tolerance values after a disaster event occurred
   * @return New efficiency value
   * @return New tolerance value
   */
  function _resolveDisaster() internal pure returns(uint8, uint8) {
    return (0, 0);
  }

  /**
   * Returns the efficiency & tolerance values after a mishap event occurred
   * @param isChef - Whether this is a chef
   * @param efficiencyValue - Current efficiency value
   * @param toleranceValue - Current tolerance value
   * @return New efficiency value
   * @return New tolerance value
   */
  function _resolveMishap(bool isChef, uint8 efficiencyValue, uint8 toleranceValue) internal view returns(uint8, uint8) {
    uint8 efficiencyLoss = isChef ? mishapEfficiencyLossChef : mishapEfficiencyLossRat;
    uint8 toleranceLoss = isChef ? mishapToleranceLossChef : mishapToleranceLossRat;
    efficiencyValue = (efficiencyLoss > efficiencyValue) ? 0 : efficiencyValue - efficiencyLoss;
    toleranceValue = (toleranceLoss > toleranceValue) ? 0 : toleranceValue - toleranceLoss;
    return (efficiencyValue, toleranceValue);
  }

  /**
   * Adds/subtracts the given increment to/from the old value within a 0 - 100 range
   * @param old - Current value
   * @param increment - Value to add/subtract
   * @return New value
   */
  function _getUpdatedValue(uint8 old, int8 increment) internal pure returns(uint8) {
    if (increment >= 0) {
      return (uint8(increment) + old > 100) ? 100 : old + uint8(increment);
    } else {
      return (uint8(-increment) > old) ? 0 : old - uint8(-increment);
    }
  }

  /**
   * Event & level dispatcher, checks if events are triggered and returns new levels accordingly
   * @param isChef - Whether it's a Chef or not
   * @param currentEfficiency - The character's current efficiency value
   * @param currentTolerance - The character's current tolerance value
   * @param efficiencyIncrement - Value to add/subtract to/from efficiency
   * @param toleranceIncrement - Value to add/subtract to/from tolerance
   * @param randomVal - A ChainLink VRF random number
   * @return efficiencyValue - New efficiency value
   * @return toleranceValue - New tolerance value
   * @return eventName - String containing the event or empty string if none occurred
   */
  function getEventUpdates(bool isChef, uint8 currentEfficiency, uint8 currentTolerance, int8 efficiencyIncrement, int8 toleranceIncrement, uint256 randomVal) external view returns(uint8 efficiencyValue, uint8 toleranceValue, string memory eventName) {
    eventName = "";
    if (_doesDisasterOccur(isChef, int8(currentEfficiency), int8(currentTolerance), randomVal)) {
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
