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
   * @param efficiency - The character's current value
   * @return true if event occurred
   */
  function doesDisasterOccur(bool isChef, int8 efficiency) internal view returns(bool) {
    if (efficiency <= (isChef ? disasterEfficiencyMinimumChef : disasterEfficiencyMinimumRat)) {
      return false;
    }
    uint8 likelihood = uint8(((efficiency - 100) / -4 * 10) + 20);
    return random(uint8(efficiency)) % 1000 < likelihood;
  }

  /**
   * Does a food inspector / rat trap event occur?
   * @param efficiency - The character's current value
   * @return true if event occurred
   */
  function doesMishapOccur(bool isChef, int8 efficiency) internal view returns(bool) {
    if (efficiency <= (isChef ? mishapEfficiencyMinimumChef : mishapEfficiencyMinimumRat)) {
      return false;
    }
    uint8 likelihood = uint8(((efficiency - 100) * -1) + 20);
    return random(uint8(efficiency)) % 1000 < likelihood;
  }

  function resolveDisaster() internal pure returns(uint8, uint8) {
    return (0, 0);
  }

  function resolveMishap(bool isChef, uint8 efficiencyValue, uint8 toleranceValue) internal view returns(uint8, uint8) {
    uint8 efficiencyLoss = isChef ? mishapEfficiencyLossChef : mishapEfficiencyLossRat;
    uint8 toleranceLoss = isChef ? mishapToleranceLossChef : mishapToleranceLossRat;
    efficiencyValue = (efficiencyLoss > efficiencyValue) ? 0 : efficiencyValue - efficiencyLoss;
    toleranceValue = (toleranceLoss > toleranceValue) ? 0 : toleranceValue - toleranceLoss;
    return (efficiencyValue, toleranceValue);
  }

  function getUpdatedValue(uint8 old, int8 increment) internal pure returns(uint8) {
    if (increment >= 0) {
      return (uint8(increment) + old > 100) ? 100 : old + uint8(increment);
    } else {
      return (uint8(-increment) > old) ? 0 : old - uint8(-increment);
    }
  }

  function getEventUpdates(bool isChef, uint8 currentEfficiency, uint8 currentTolerance, int8 efficiencyIncrement, int8 toleranceIncrement) public view returns(uint8 efficiencyValue, uint8 toleranceValue, string memory eventName) {
    eventName = "";
    if (doesDisasterOccur(isChef, int8(currentEfficiency))) {
      (efficiencyValue, toleranceValue) = resolveDisaster();
      eventName = isChef ? "burnout" : "cat";
    } else if (doesMishapOccur(isChef, int8(currentEfficiency))) {
      (efficiencyValue, toleranceValue) = resolveMishap(isChef, currentEfficiency, currentTolerance);
      eventName = isChef ? "foodInspector" : "ratTrap";
    } else {
      efficiencyValue = getUpdatedValue(currentEfficiency, efficiencyIncrement);
      toleranceValue = getUpdatedValue(currentTolerance, toleranceIncrement);
    }
  }

  /**
   * Generates a pseudorandom number
   * @param seed - A value to ensure different outcomes for different sources in the same block
   * @return A pseudorandom value
   */
  function random(uint256 seed) internal view returns (uint256) {
    return uint256(keccak256(abi.encodePacked(
        tx.origin,
        blockhash(block.number - 1),
        block.timestamp,
        seed
      )));
  }
}
