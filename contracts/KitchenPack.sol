// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "./IKitchenPack.sol";
import "./IChefRat.sol";
import "./ChefRat.sol";
import "./FastFood.sol";

contract KitchenPack is IKitchenPack, Initializable, OwnableUpgradeable, PausableUpgradeable, IERC721ReceiverUpgradeable {
  struct Stake { // Store for a stake's token, owner, and earning values
    uint256 tokenId;
    address owner;
    uint80 value;
    uint80 timestamp;
  }

  event TokenStaked(uint256 tokenId, address owner, uint256 value);
  event ChefClaimed(uint256 tokenId, uint256 earned, bool unstaked, uint8 skill, uint8 insanity, string eventName);
  event RatClaimed(uint256 tokenId, uint256 earned, bool unstaked, uint8 intelligence, uint8 fatness, string eventName);

  ChefRat chefRat; // Reference to the ChefRat NFT contract
  FastFood fastFood; // Reference to the $FFOOD contract

  mapping(uint256 => Stake) public kitchen; // Maps tokenId to stake
  mapping(uint256 => Stake) public pack; // Maps tokenId to stake

  uint256 public constant FFOOD_CLAIM_TAX_PERCENTAGE = 20; // Rats steal x% of all $FFOOD claimed
  uint256 public constant MINIMUM_TO_EXIT = 8 hours; // Cannot unstake before EOB
  uint256 public constant FFOOD_MAX_SUPPLY = 1000000000 ether; // There will only ever be x $FFOOD earned through staking
  uint256 public constant DAILY_FFOOD_RATE = 1000 ether; // Chefs earn x $FFOOD per day
  uint8 public constant DAILY_SKILL_RATE = 2;
  uint8 public constant DAILY_INSANITY_RATE = 4;
  uint8 public constant DAILY_INTELLIGENCE_RATE = 2;
  uint8 public constant DAILY_FATNESS_RATE = 8;

  uint256 public totalChefsStaked; // Number of Chefs staked in the Kitchen
  uint256 public totalRatsStaked; // Number of Rats staked in the Pack
  uint256 public unaccountedRewards; // any rewards distributed when no Rats are staked
  uint256 public fastFoodPerRat; // amount of $FFOOD due for each staked Rat
  uint256 public totalFastFoodEarned; // Amount of $FFOOD earned so far
  uint256 public lastClaimTimestamp; // The last time $FFOOD was claimed
  uint256 public accrualPeriod; // The period over which $FFOOD & levels are accrued
  uint8 public chefEfficiencyMultiplier;

  function initialize(address _chefRat, address _fastFood, uint256 _accrualPeriod, uint8 _chefEfficiencyMultiplier) external initializer {
    __Ownable_init();
    __Pausable_init();

    chefRat = ChefRat(_chefRat);
    fastFood = FastFood(_fastFood);
    unaccountedRewards = 0;
    fastFoodPerRat = 0;
    lastClaimTimestamp = 0;
    accrualPeriod = _accrualPeriod;
    chefEfficiencyMultiplier = _chefEfficiencyMultiplier;
  }

  /**
   * Adds Chefs to Kitchen & Rats to Pack
   * @param account - The address of the staker
   * @param tokenIds - The IDs of the Chefs & Rats to stake
   */
  function stakeMany(address account, uint16[] calldata tokenIds) external {
    require(account == _msgSender() || _msgSender() == address(chefRat), "Do not lose your tokens");
    for (uint i = 0; i < tokenIds.length; i++) {
      if (_msgSender() != address(chefRat)) { // Not necessary if it's a mint & stake
        require(chefRat.ownerOf(tokenIds[i]) == _msgSender(), "Not your token");
        chefRat.transferFrom(_msgSender(), address(this), tokenIds[i]);
      } else if (tokenIds[i] == 0) {
        continue; // There may be gaps in the array for stolen tokens
      }

      if (isChef(tokenIds[i])) {
        _stakeChefToKitchen(account, tokenIds[i]);
      } else {
        _stakeRatToPack(account, tokenIds[i]);
      }
    }
  }

  /**
   * Adds a single Chef to the Kitchen
   * @param account - The address of the staker
   * @param tokenId - The ID of the Chef to add to the Kitchen
   */
  function _stakeChefToKitchen(address account, uint256 tokenId) internal whenNotPaused {
    kitchen[tokenId] = Stake({
      tokenId: uint16(tokenId),
      owner: account,
      value: uint80(block.timestamp),
      timestamp: uint80(block.timestamp)
    });
    totalChefsStaked ++;
    emit TokenStaked(tokenId, account, block.timestamp);
  }

  /**
   * Adds a single Rat to the Pack
   * @param account - The address of the staker
   * @param tokenId - The ID of the Rat to add to the Pack
   */
  function _stakeRatToPack(address account, uint256 tokenId) internal whenNotPaused {
    pack[tokenId] = Stake({
      tokenId: uint16(tokenId),
      owner: account,
      value: uint80(fastFoodPerRat),
      timestamp: uint80(block.timestamp)
    });
    totalRatsStaked ++;
    emit TokenStaked(tokenId, account, fastFoodPerRat);
  }

  /**
   * Claim $FFOOD earnings and optionally unstake tokens from the Kitchen / Pack
   * @param tokenIds - The IDs of the tokens to claim earnings from
   * @param unstake - Whether or not to unstake ALL of the tokens listed in tokenIds
   */
  function claimMany(uint16[] calldata tokenIds, bool unstake) external whenNotPaused {
    uint256 owed = 0;
    for (uint i = 0; i < tokenIds.length; i++) {
      if (isChef(tokenIds[i]))
        owed += _claimChefFromKitchen(tokenIds[i], unstake);
      else
        owed += _claimRatFromPack(tokenIds[i], unstake);
    }
    if (owed == 0) return;
    fastFood.mint(_msgSender(), owed);
  }

  /**
   * Claim $FFOOD earnings for a single Chef and optionally unstake him
   * If not unstaking, pay a 20% tax to the staked Rats
   * If unstaking, there's a 50% chance all $FFOOD is stolen
   * @param tokenId - The ID of the Chef to claim earnings from
   * @param unstake - Whether or not to unstake the Chef
   * @return owed - The amount of $FFOOD earned
   */
  function _claimChefFromKitchen(uint256 tokenId, bool unstake) internal returns (uint256 owed) {
    Stake memory stake = kitchen[tokenId];
    require(stake.owner == _msgSender(), "Not your token");
//    require(!(unstake && block.timestamp - stake.value < MINIMUM_TO_EXIT), "Cannot leave before EOB");

    uint8 efficiency = getEfficiency(tokenId);
    uint256 nominal = (block.timestamp - stake.value) * DAILY_FFOOD_RATE / accrualPeriod;
    uint256 multiplier = 100000 + (uint256(efficiency) * chefEfficiencyMultiplier * 10);
    owed = nominal * multiplier / 100000;
    if (totalFastFoodEarned + owed > FFOOD_MAX_SUPPLY) {
      owed = FFOOD_MAX_SUPPLY - totalFastFoodEarned;
    }

    if (owed > 0) {
      lastClaimTimestamp = block.timestamp;
      totalFastFoodEarned += owed;
      _carelesslyLeaveToRats(owed * FFOOD_CLAIM_TAX_PERCENTAGE / 100); // percentage tax to staked Rats
      owed = owed * (100 - FFOOD_CLAIM_TAX_PERCENTAGE) / 100; // Remainder goes to Chef owner
    }

    (uint8 newEfficiency, uint8 newTolerance, string memory eventName) = updateCharacter(tokenId);

    if (unstake) {
      chefRat.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // Send Chef back to owner
      delete kitchen[tokenId];
      totalChefsStaked --;
    } else {
      kitchen[tokenId] = Stake({ // Reset stake
        tokenId: uint16(tokenId),
        owner: _msgSender(),
        value: uint80(block.timestamp),
        timestamp: uint80(block.timestamp)
      });
    }
    emit ChefClaimed(tokenId, owed, unstake, newEfficiency, newTolerance, eventName);
  }

  function updateCharacter(uint256 tokenId) internal returns(uint8 efficiency, uint8 tolerance, string memory eventName) {
    Stake memory k = kitchen[tokenId];
    Stake memory p = pack[tokenId];
    uint256 diff = block.timestamp - (isChef(tokenId) ? k.timestamp : p.timestamp);

    (efficiency, tolerance, eventName) = chefRat.updateCharacter(
      tokenId,
      getCharacterIncrement(diff, isChef(tokenId) ? DAILY_SKILL_RATE : DAILY_INTELLIGENCE_RATE),
      getCharacterIncrement(diff, isChef(tokenId) ? DAILY_INSANITY_RATE : DAILY_FATNESS_RATE)
    );
  }

  function getCharacterIncrement(uint256 diff, uint8 multiplier) internal view returns(int8) {
    uint256 owed = diff * multiplier / accrualPeriod;
    uint8 increment = owed > 100 ? 100 : uint8(owed);
    return int8(increment);
  }

  /**
   * Claim $FFOOD earnings for a single Rat and optionally unstake it
   * Rats steal $FFOOD proportional to their efficiency level
   * @param tokenId - The ID of the Rat to claim earnings from
   * @param unstake - Whether or not to unstake the Rat
   * @return owed - The amount of $FFOOD earned
   */
  function _claimRatFromPack(uint256 tokenId, bool unstake) internal returns (uint256 owed) {
    Stake memory stake = pack[tokenId];
    require(stake.owner == _msgSender(), "Not your token");
//    require(!(unstake && block.timestamp - stake.value < MINIMUM_TO_EXIT), "Cannot leave your pack starving so early");

    owed = (1) * (fastFoodPerRat - stake.value); // Calculate individual share
    (uint8 efficiency, uint8 tolerance, string memory eventName) = updateCharacter(tokenId);

    if (unstake) {
      chefRat.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // Send Rat back to owner
      delete pack[tokenId];
      totalRatsStaked --;
    } else {
      pack[tokenId] = Stake({ // Reset stake
        tokenId: uint16(tokenId),
        owner: _msgSender(),
        value: uint80(fastFoodPerRat),
        timestamp: uint80(block.timestamp)
      });
    }
    emit RatClaimed(tokenId, owed, unstake, efficiency, tolerance, eventName);
  }

  /**
   * Checks if the token is a Chef
   * @param tokenId - The ID of the token to check
   * @return chef - Whether or not the token is a Chef
   */
  function isChef(uint256 tokenId) public view returns (bool chef) {
    (chef, , , , , , , , ,) = chefRat.tokenTraits(tokenId);
  }

  /**
   * Get the character's efficiency
   * @param tokenId - The ID of the token to check
   * @return efficiency - Efficiency value
   */
  function getEfficiency(uint256 tokenId) public view returns (uint8 efficiency) {
    (, , , , , , , , efficiency,) = chefRat.tokenTraits(tokenId);
  }

  /**
   * Add $FFOOD to claimable pot for the Pack
   * @param amount - $FFOOD to add to the pot
   */
  function _carelesslyLeaveToRats(uint256 amount) internal {
    if (totalRatsStaked == 0) { // if there are no staked Rats
      unaccountedRewards += amount; // keep track of $FFOOD due to Rats
      return;
    }
    // makes sure to include any unaccounted $FFOOD
    fastFoodPerRat += (amount + unaccountedRewards) / totalRatsStaked;
    unaccountedRewards = 0;
  }

  function onERC721Received(address, address from, uint256, bytes calldata) external pure override returns (bytes4) {
    require(from == address(0x0), "Cannot send tokens to Kitchen directly");
    return IERC721ReceiverUpgradeable.onERC721Received.selector;
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
