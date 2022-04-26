// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract Config is Initializable, OwnableUpgradeable {
  using Strings for uint8;
  using Strings for uint256;

  struct PaywallData {
    uint256 mintPrice;
    uint8 whitelistBoost;
    uint8 maxMintsPerTx;
    uint256 gen1PriceTier0;
    uint256 gen1PriceTier1;
    uint256 gen1PriceTier2;
    uint256 gen1PriceTier3;
  }
  struct KitchenShopData {
    uint256[] tokenSupply;
    uint8 maxMintsPerTx;
    uint256 priceTier0;
    uint256 priceTier1;
    uint256 priceTier2;
    uint256 priceTier3;
    uint256 priceTier4;
    uint8 chefsPerKitchen;
  }
  struct PropertiesData {
    uint8 disasterEfficiencyMinimumChef;
    uint8 disasterEfficiencyMinimumRat;
    uint8 disasterEfficiencyLossChef;
    uint8 disasterEfficiencyLossRat;
    uint8 disasterToleranceLossChef;
    uint8 disasterToleranceLossRat;
    uint8 mishapEfficiencyMinimumChef;
    uint8 mishapEfficiencyMinimumRat;
    uint8 mishapEfficiencyLossChef;
    uint8 mishapEfficiencyLossRat;
    uint8 mishapToleranceLossChef;
    uint8 mishapToleranceLossRat;
  }
  struct VenueData { // Struct containing all Venue parameters
    int8 dailySkillRate;
    int8 dailyFreakRate;
    int8 dailyIntelligenceRate;
    int8 dailyBodyMassRate;
    uint256 vestingPeriod;
    uint256 accrualPeriod;
    uint8 maxClaimsPerTx;
    uint256 claimFee;
  }
  struct KitchenData { // Struct containing all Kitchen parameters
    uint256 foodTokenMaxSupply;
    uint256 dailyChefEarnings;
    uint256 ratTheftPercentage;
    uint8 chefEfficiencyMultiplier;
    uint256 ratEfficiencyMultiplier;
    uint256 ratEfficiencyOffset;
  }
  struct EntrepreneurialKitchenData { // Struct containing all EntrepreneurialKitchen parameters
    uint8 minEfficiency;
  }

  PaywallData paywall;
  KitchenShopData kitchenShop;
  PropertiesData properties;

  VenueData mcStakeVenue;
  KitchenData mcStakeKitchen;
  VenueData theStakehouseVenue;
  KitchenData theStakehouseKitchen;
  EntrepreneurialKitchenData theStakehouseEntrepreneurialKitchen;
  VenueData leStakeVenue;
  KitchenData leStakeKitchen;
  EntrepreneurialKitchenData leStakeEntrepreneurialKitchen;
  VenueData gymVenue;

  function initialize(
  ) external initializer {
    __Ownable_init();
  }

  /**
   * Returns the UI configuration as a base64 encoded JSON string
   * @return base64 encoded JSON string
   */
  function get() external view returns (string memory) {
    string memory metadata = string(abi.encodePacked(
      '{',
        '"Paywall":', _getPaywall(paywall), ',',
        '"KitchenShop":', _getKitchenShop(kitchenShop), ',',
        '"Properties":', _getProperties(properties), ',',
        '"McStake":{',
          '"Venue":', _getVenue(mcStakeVenue), ',',
          '"Kitchen":', _getKitchen(mcStakeKitchen), '',
        '},',
        '"TheStakehouseStake":{',
          '"Venue":', _getVenue(theStakehouseVenue), ',',
          '"Kitchen":', _getKitchen(theStakehouseKitchen), ',',
          '"EntrepreneurialKitchen":', _getEntrepreneurialKitchen(theStakehouseEntrepreneurialKitchen),
        '},',
        '"LeStake":{',
          '"Venue":', _getVenue(leStakeVenue), ',',
          '"Kitchen":', _getKitchen(leStakeKitchen), ',',
          '"EntrepreneurialKitchen":', _getEntrepreneurialKitchen(leStakeEntrepreneurialKitchen),
        '},',
        '"Gym":{',
          '"Venue":', _getVenue(gymVenue), '',
        '}',
      '}'
    ));
    return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(metadata))));
  }

  /**
   * Returns the given PaywallData as a JSON string
   * @param data - The struct to JSONify
   * @return A valid JSON string
   */
  function _getPaywall(PaywallData memory data) private pure returns (string memory) {
    return string(abi.encodePacked(
        '{',
          '"mintPrice":"', data.mintPrice.toString(), '",',
          '"whitelistBoost":"', data.whitelistBoost.toString(), '",',
          '"maxMintsPerTx":"', data.maxMintsPerTx.toString(), '",',
          '"gen1PriceTier0":"', data.gen1PriceTier0.toString(), '",',
          '"gen1PriceTier1":"', data.gen1PriceTier1.toString(), '",',
          '"gen1PriceTier2":"', data.gen1PriceTier2.toString(), '",',
          '"gen1PriceTier3":"', data.gen1PriceTier3.toString(), '"',
        '}'
      ));
  }

  /**
   * Returns the given KitchenShopData as a JSON string
   * @param data - The struct to JSONify
   * @return A valid JSON string
   */
  function _getKitchenShop(KitchenShopData memory data) private pure returns (string memory) {
    return string(abi.encodePacked(
        '{',
          '"tokenSupply":["', data.tokenSupply[0].toString(), '", "', data.tokenSupply[1].toString(), '"],',
          '"maxMintsPerTx":"', data.maxMintsPerTx.toString(), '",',
          '"priceTier0":"', data.priceTier0.toString(), '",',
          '"priceTier1":"', data.priceTier1.toString(), '",',
          '"priceTier2":"', data.priceTier2.toString(), '",',
          '"priceTier3":"', data.priceTier3.toString(), '",',
          '"priceTier4":"', data.priceTier4.toString(), '",',
          '"chefsPerKitchen":"', data.chefsPerKitchen.toString(), '"',
        '}'
      ));
  }

  /**
   * Returns the given PropertiesData as a JSON string
   * @param data - The struct to JSONify
   * @return A valid JSON string
   */
  function _getProperties(PropertiesData memory data) private pure returns (string memory) {
    return string(abi.encodePacked(
        '{',
          '"disasterEfficiencyMinimumChef":"', data.disasterEfficiencyMinimumChef.toString(), '",',
          '"disasterEfficiencyMinimumRat":"', data.disasterEfficiencyMinimumRat.toString(), '",',
          '"disasterEfficiencyLossChef":"', data.disasterEfficiencyLossChef.toString(), '",',
          '"disasterEfficiencyLossRat":"', data.disasterEfficiencyLossRat.toString(), '",',
          '"disasterToleranceLossChef":"', data.disasterToleranceLossChef.toString(), '",',
          '"disasterToleranceLossRat":"', data.disasterToleranceLossRat.toString(), '",',
          '"mishapEfficiencyMinimumChef":"', data.mishapEfficiencyMinimumChef.toString(), '",',
          '"mishapEfficiencyMinimumRat":"', data.mishapEfficiencyMinimumRat.toString(), '",',
          '"mishapEfficiencyLossChef":"', data.mishapEfficiencyLossChef.toString(), '",',
          '"mishapEfficiencyLossRat":"', data.mishapEfficiencyLossRat.toString(), '",',
          '"mishapToleranceLossChef":"', data.mishapToleranceLossChef.toString(), '",',
          '"mishapToleranceLossRat":"', data.mishapToleranceLossRat.toString(), '"',
        '}'
      ));
  }

  /**
   * Returns the given VenueData as a JSON string
   * @param data - The struct to JSONify
   * @return A valid JSON string
   */
  function _getVenue(VenueData memory data) private pure returns (string memory) {
    uint8[4] memory dailyRates = [
      data.dailySkillRate < 0 ? 255 - uint8(data.dailySkillRate) + 1 : uint8(data.dailySkillRate),
      data.dailyFreakRate < 0 ? 255 - uint8(data.dailyFreakRate) + 1 : uint8(data.dailyFreakRate),
      data.dailyIntelligenceRate < 0 ? 255 - uint8(data.dailyIntelligenceRate) + 1 : uint8(data.dailyIntelligenceRate),
      data.dailyBodyMassRate < 0 ? 255 - uint8(data.dailyBodyMassRate) + 1 : uint8(data.dailyBodyMassRate)
    ];
    return string(abi.encodePacked(
      '{',
        '"dailySkillRate":"', data.dailySkillRate < 0 ? '-' : '', dailyRates[0].toString(), '",',
        '"dailyFreakRate":"', data.dailyFreakRate < 0 ? '-' : '', dailyRates[1].toString(), '",',
        '"dailyIntelligenceRate":"', data.dailyIntelligenceRate < 0 ? '-' : '', dailyRates[2].toString(), '",',
        '"dailyBodyMassRate":"', data.dailyBodyMassRate < 0 ? '-' : '', dailyRates[3].toString(), '",',
        '"vestingPeriod":"', data.vestingPeriod.toString(), '",',
        '"accrualPeriod":"', data.accrualPeriod.toString(), '",',
        '"maxClaimsPerTx":"', data.maxClaimsPerTx.toString(), '",',
        '"claimFee":"', data.claimFee.toString(), '"',
      '}'
    ));
  }

  /**
   * Returns the given KitchenData as a JSON string
   * @param data - The struct to JSONify
   * @return A valid JSON string
   */
  function _getKitchen(KitchenData memory data) private pure returns (string memory) {
    return string(abi.encodePacked(
      '{',
        '"foodTokenMaxSupply":"', data.foodTokenMaxSupply.toString(), '",',
        '"dailyChefEarnings":"', data.dailyChefEarnings.toString(), '",',
        '"ratTheftPercentage":"', data.ratTheftPercentage.toString(), '",',
        '"chefEfficiencyMultiplier":"', data.chefEfficiencyMultiplier.toString(), '",',
        '"ratEfficiencyMultiplier":"', data.ratEfficiencyMultiplier.toString(), '",',
        '"ratEfficiencyOffset":"', data.ratEfficiencyOffset.toString(), '"',
      '}'
    ));
  }

  /**
   * Returns the given EntrepreneurialKitchenData as a JSON string
   * @param data - The struct to JSONify
   * @return A valid JSON string
   */
  function _getEntrepreneurialKitchen(EntrepreneurialKitchenData memory data) private pure returns (string memory) {
    return string(abi.encodePacked(
      '{',
        '"minEfficiency":"', data.minEfficiency.toString(), '"',
      '}'
    ));
  }

  /**
   * Allows DAO to update parameters
   */
  function set(
    PaywallData calldata _paywall,
    KitchenShopData calldata _kitchenShop,
    PropertiesData calldata _properties,
    VenueData[] calldata _venueData,
    KitchenData[] calldata _kitchenData,
    EntrepreneurialKitchenData[] calldata _entrepreneurialKitchenData
  ) external onlyOwner {
    require(_venueData.length == 4, "entrepreneurialKitchenData array empty");
    require(_kitchenData.length == 3, "entrepreneurialKitchenData array empty");
    require(_entrepreneurialKitchenData.length == 2, "entrepreneurialKitchenData array empty");

    paywall = _paywall;
    kitchenShop = _kitchenShop;
    properties = _properties;

    mcStakeVenue = _venueData[0];
    theStakehouseVenue = _venueData[1];
    leStakeVenue = _venueData[2];
    gymVenue = _venueData[3];

    mcStakeKitchen = _kitchenData[0];
    theStakehouseKitchen = _kitchenData[1];
    leStakeKitchen = _kitchenData[2];

    theStakehouseEntrepreneurialKitchen = _entrepreneurialKitchenData[0];
    leStakeEntrepreneurialKitchen = _entrepreneurialKitchenData[1];
  }
}
