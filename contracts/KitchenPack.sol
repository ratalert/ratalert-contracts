// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "./IKitchenPack.sol";
import "./ChefRat.sol";
import "./FastFood.sol";

contract KitchenPack is IKitchenPack, Initializable, OwnableUpgradeable, PausableUpgradeable, IERC721ReceiverUpgradeable {
  struct Stake { // Store for a stake's token, owner, and earning values
    uint256 tokenId;
    address owner;
    uint80 timestamp;
  }

  event TokenStaked(uint256 tokenId, address owner, uint256 timestamp);
  event ChefClaimed(uint256 tokenId, uint256 earned, bool unstaked);
  event RatClaimed(uint256 tokenId, uint256 earned, bool unstaked);

  ChefRat chefRat; // Reference to the ChefRat NFT contract
  FastFood fastFood; // Reference to the $FFOOD contract

  mapping(uint256 => Stake) public kitchen; // Maps tokenId to stake
  mapping(uint256 => Stake) public pack; // Maps tokenId to stake

  uint256 public constant FFOOD_CLAIM_TAX_PERCENTAGE = 20; // Rats steal x% of all $FFOOD claimed
  uint256 public constant MINIMUM_TO_EXIT = 8 hours; // Cannot unstake before EOB
  uint256 public constant FFOOD_MAX_SUPPLY = 1000000000 ether; // There will only ever be x $FFOOD earned through staking
  uint256 public constant DAILY_FFOOD_RATE = 1000 ether; // Chefs earn x $FFOOD per day

  uint256 public totalChefsStaked; // Number of Chefs staked in the Kitchen
  uint256 public totalRatsStaked; // Number of Rats staked in the Pack
  uint256 public totalFastFoodEarned; // Amount of $FFOOD earned so far
  uint256 public unaccountedRewards; // Any rewards distributed when no Rats are staked
  uint256 public fastFoodPerRat; // Amount of $FFOOD due for each alpha point staked
  uint256 public lastClaimTimestamp; // The last time $FFOOD was claimed

  function initialize(address _chefRat, address _fastFood) external initializer {
    __Ownable_init();
    __Pausable_init();

    chefRat = ChefRat(_chefRat);
    fastFood = FastFood(_fastFood);
    unaccountedRewards = 0;
    fastFoodPerRat = 0;
    lastClaimTimestamp = 0;
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
      timestamp: uint80(block.timestamp)
    });
    totalRatsStaked ++;
    emit TokenStaked(tokenId, account, block.timestamp);
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
//    require(!(unstake && block.timestamp - stake.timestamp < MINIMUM_TO_EXIT), "Cannot leave before EOB");

    owed = (block.timestamp - stake.timestamp) * DAILY_FFOOD_RATE / 1 days;
    if (totalFastFoodEarned + owed > FFOOD_MAX_SUPPLY) {
      owed = FFOOD_MAX_SUPPLY - totalFastFoodEarned;
    }

    if (owed > 0) {
      lastClaimTimestamp = block.timestamp;
      totalFastFoodEarned += owed;
      _carelesslyLeaveToRats(owed * FFOOD_CLAIM_TAX_PERCENTAGE / 100); // Percentage stolen by staked Rats
      owed = owed * (100 - FFOOD_CLAIM_TAX_PERCENTAGE) / 100; // Remainder goes to Chef owner
    }

    if (unstake) {
      chefRat.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // Send Chef back to owner
      delete kitchen[tokenId];
      totalChefsStaked --;
    } else {
      kitchen[tokenId] = Stake({ // Reset stake
        tokenId: uint16(tokenId),
        owner: _msgSender(),
        timestamp: uint80(block.timestamp)
      });
    }
    emit ChefClaimed(tokenId, owed, unstake);
  }

  /**
   * Claim $FFOOD earnings for a single Rat and optionally unstake it
   * Rats steal $FFOOD proportional to their skill level
   * @param tokenId - The ID of the Rat to claim earnings from
   * @param unstake - Whether or not to unstake the Rat
   * @return owed - The amount of $FFOOD earned
   */
  function _claimRatFromPack(uint256 tokenId, bool unstake) internal returns (uint256 owed) {
    delete kitchen[tokenId];
    totalRatsStaked --;
    // TODO Implement $FFOOD distribution
    emit RatClaimed(tokenId, owed, unstake);
  }

  /**
   * Checks if the token is a Chef
   * @param tokenId - The ID of the token to check
   * @return chef - Whether or not the token is a Chef
   */
  function isChef(uint256 tokenId) public pure returns (bool chef) {
    tokenId;
    chef = true; // TODO Implement with (chef, , , , , , , , , ) = chefRat.tokenTraits(tokenId);
  }

  /**
   * Add $FFOOD to claimable pot for the Pack
   * @param amount - $FFOOD to add to the pot
   */
  function _carelesslyLeaveToRats(uint256 amount) internal {
    if (totalRatsStaked == 0) {
      unaccountedRewards += amount; // Keep track for Rats staked in the future
      return;
    }
    // Makes sure to include any unaccounted $FFOOD
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
