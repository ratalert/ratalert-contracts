// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "./IVenue.sol";
import "./Character.sol";

abstract contract Venue is IVenue, Initializable, OwnableUpgradeable, PausableUpgradeable, IERC721ReceiverUpgradeable {
  struct Stake { // Store for a stake's token, owner, and earning values
    uint256 tokenId;
    address owner;
    uint80 value;
    uint80 timestamp;
  }

  event TokenStaked(uint256 tokenId, address owner, uint256 value);
  event ChefClaimed(uint256 tokenId, uint256 earned, bool unstaked, uint8 skill, uint8 insanity, string eventName, uint256 foodTokensPerRat);
  event RatClaimed(uint256 tokenId, uint256 earned, bool unstaked, uint8 intelligence, uint8 fatness, string eventName);

  Character character; // Reference to the Character NFT contract

  mapping(uint256 => Stake) public chefs; // Maps tokenId to stake
  mapping(uint256 => Stake) public rats; // Maps tokenId to stake
  mapping(address => uint256[]) public stakers; // Maps address to array of character IDs
  int8 public dailySkillRate;
  int8 public dailyInsanityRate;
  int8 public dailyIntelligenceRate;
  int8 public dailyFatnessRate;
  uint256 public totalChefsStaked; // Number of Chefs staked
  uint256 public totalRatsStaked; // Number of Rats staked
  uint256 public accrualPeriod; // The period over which earnings & levels are accrued
  uint256 public foodTokensPerRat; // amount of food tokens due for each staked Rat
  uint256 public vestingPeriod; // Cannot unstake for this many seconds

  function initialize(address _character, uint256 _accrualPeriod) external initializer {
    __Ownable_init();
    __Pausable_init();

    character = Character(_character);
    accrualPeriod = _accrualPeriod;

    dailySkillRate = 0;
    dailyInsanityRate = 0;
    dailyIntelligenceRate = 0;
    dailyFatnessRate = 0;
  }

  /**
   * Adds Chefs & Rats
   * @param account - The address of the staker
   * @param tokenIds - The IDs of the Chefs & Rats to stake
   */
  function stakeMany(address account, uint16[] calldata tokenIds) external {
    require(account == _msgSender() || _msgSender() == address(character), "Do not lose your tokens");
    require(_checkSpace(tokenIds.length), "Kitchen space required");
    for (uint i = 0; i < tokenIds.length; i++) {
      if (_msgSender() != address(character)) { // Not necessary if it's a mint & stake
        require(character.ownerOf(tokenIds[i]) == _msgSender(), "Not your token");
        character.transferFrom(_msgSender(), address(this), tokenIds[i]);
      } else if (tokenIds[i] == 0) {
        continue; // There may be gaps in the array for stolen tokens
      }

      require(_checkEligibility(tokenIds[i]), "Not eligible");
      if (isChef(tokenIds[i])) {
        _stakeChef(account, tokenIds[i]);
      } else {
        _stakeRat(account, tokenIds[i]);
      }

      stakers[account].push(tokenIds[i]);
    }
  }

  /**
   * Adds a single Chef
   * @param account - The address of the staker
   * @param tokenId - The ID of the Chef
   */
  function _stakeChef(address account, uint256 tokenId) internal whenNotPaused {
    chefs[tokenId] = Stake({
      tokenId: uint16(tokenId),
      owner: account,
      value: uint80(block.timestamp),
      timestamp: uint80(block.timestamp)
    });
    totalChefsStaked ++;
    emit TokenStaked(tokenId, account, block.timestamp);
  }

  /**
   * Adds a single Rat
   * @param account - The address of the staker
   * @param tokenId - The ID of the Rat
   */
  function _stakeRat(address account, uint256 tokenId) internal whenNotPaused {
    rats[tokenId] = Stake({
      tokenId: uint16(tokenId),
      owner: account,
      value: _getRatStakeValue(),
      timestamp: uint80(block.timestamp)
    });
    totalRatsStaked ++;
    emit TokenStaked(tokenId, account, foodTokensPerRat);
  }

  /**
   * Claim food token earnings, level-ups and optionally unstake characters
   * @param tokenIds - The IDs of the tokens in question
   * @param unstake - Whether or not to unstake the given tokens
   */
  function claimMany(uint16[] calldata tokenIds, bool unstake) external virtual whenNotPaused {
    address account = _msgSender();
    uint256 owed = 0;
    for (uint i = 0; i < tokenIds.length; i++) {
      bool space = _checkSpace(0);
      if (isChef(tokenIds[i]))
        owed += _claimChef(tokenIds[i], !space || unstake, !space);
      else
        owed += _claimRat(tokenIds[i], !space || unstake, !space);
      for (uint j = 0; j < stakers[account].length; j++) {
        if (stakers[account][j] == tokenIds[i]) {
          stakers[account][j] = stakers[account][stakers[account].length - 1];
          stakers[account].pop();
        }
      }
    }
    if (owed > 0) {
      _mintFoodToken(owed);
    }
  }

  /**
   * Claim food tokens & level-ups for a single Chef and optionally unstake him
   * @param tokenId - The ID of the Chef to level up
   * @param unstake - Whether or not to unstake the Chef
   * @param noEarnings - Whether or not to cancel earnings
   * @return owed - Food tokens produced during staking
   */
  function _claimChef(uint256 tokenId, bool unstake, bool noEarnings) internal returns (uint256 owed) {
    Stake memory stake = chefs[tokenId];
    require(stake.owner == _msgSender(), "Not your token");
    require(!(unstake && block.timestamp - stake.timestamp < vestingPeriod), "Cannot leave before EOB");

    owed = noEarnings ? 0 : _getOwedByChef(stake);

    (uint8 efficiency, uint8 tolerance, string memory eventName) = _updateCharacter(tokenId);

    if (!_checkEligibility(tokenId)) {
      unstake = true;
    }

    if (unstake) {
      character.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // Send Chef back to owner
      delete chefs[tokenId];
      totalChefsStaked --;
    } else {
      chefs[tokenId] = Stake({ // Reset stake
        tokenId: uint16(tokenId),
        owner: _msgSender(),
        value: uint80(block.timestamp),
        timestamp: uint80(block.timestamp)
      });
    }
    emit ChefClaimed(tokenId, owed, unstake, efficiency, tolerance, eventName, foodTokensPerRat);
  }

  /**
   * Claim food tokens & level-ups for a single Rat and optionally unstake it
   * @param tokenId - The ID of the Rat to level up
   * @param unstake - Whether or not to unstake the Rat
   * @param noEarnings - Whether or not to cancel earnings
   * @return owed - Food tokens stolen during staking
   */
  function _claimRat(uint256 tokenId, bool unstake, bool noEarnings) internal returns (uint256 owed) {
    Stake memory stake = rats[tokenId];
    require(stake.owner == _msgSender(), "Not your token");
    require(!(unstake && block.timestamp - stake.timestamp < vestingPeriod), "Cannot leave before EOB");

    owed = noEarnings ? 0 : _getOwedByRat(stake);

    (uint8 efficiency, uint8 tolerance, string memory eventName) = _updateCharacter(tokenId);

    if (!_checkEligibility(tokenId)) {
      unstake = true;
    }

    if (unstake) {
      character.safeTransferFrom(address(this), _msgSender(), tokenId, ""); // Send Rat back to owner
      delete rats[tokenId];
      totalRatsStaked --;
    } else {
      rats[tokenId] = Stake({ // Reset stake
        tokenId: uint16(tokenId),
        owner: _msgSender(),
        value: _getRatStakeValue(),
        timestamp: uint80(block.timestamp)
      });
    }
    emit RatClaimed(tokenId, owed, unstake, efficiency, tolerance, eventName);
  }

  /**
   * Unused here, gets overridden in EntrepreneurKitchen
   * @return true
   */
  function _checkSpace(uint256) internal virtual view returns (bool) {
    return true;
  }

  /**
   * Unused here, gets overridden in EntrepreneurKitchen
   * @return true
   */
  function _checkEligibility(uint256) internal virtual view returns (bool) {
    return true;
  }

  /**
   * Unused here, gets overridden in the kitchen contracts
   * @return 0
   */
  function _getRatStakeValue() internal view virtual returns (uint80) {
    return 0;
  }

  /**
   * Unused here, gets overridden in the kitchen contracts
   * @param amount - Amount of food tokens to mint
   */
  function _mintFoodToken(uint256 amount) internal virtual {}

  /**
   * Unused here, gets overridden in the kitchen contracts
   */
  function _getOwedByChef(Stake memory) internal virtual returns(uint256) {
    return 0;
  }

  /**
   * Unused here, gets overridden in the kitchen contracts
   */
  function _getOwedByRat(Stake memory) internal virtual returns(uint256) {
    return 0;
  }

  /**
   * Level up & return the given Character's efficiency & tolerance values, including a potential mishap or disaster event
   * @param tokenId - The ID of the Character to level up
   * @return efficiency - new value
   * @return tolerance - new value
   * @return eventName - if one occurred, otherwise empty string
   */
  function _updateCharacter(uint256 tokenId) internal returns(uint8 efficiency, uint8 tolerance, string memory eventName) {
    Stake memory k = chefs[tokenId];
    Stake memory p = rats[tokenId];
    uint256 stakingPeriod = block.timestamp - (isChef(tokenId) ? k.timestamp : p.timestamp);
    bool chef = isChef(tokenId);

    (efficiency, tolerance, eventName) = character.updateCharacter(
      tokenId,
      _getCharacterIncrement(chef ? dailySkillRate : dailyIntelligenceRate, stakingPeriod),
      _getCharacterIncrement(chef ? dailyInsanityRate : dailyFatnessRate, stakingPeriod)
    );
  }

  /**
   * Calculates the level that was accrued for the given property over the given staking period
   * @param dailyRate - The amount that can be gained over the accrualPeriod
   * @return The total accrued value
   */
  function _getCharacterIncrement(int8 dailyRate, uint256 stakingPeriod) internal view returns(int8) {
    int256 increment = int256(stakingPeriod) * dailyRate / int256(accrualPeriod);
    if (increment > 100) {
      return 100;
    } else if (increment < -100) {
      return -100;
    } else {
      return int8(increment);
    }
  }

  /**
   * Checks if the token is a Chef
   * @param tokenId - The ID of the token to check
   * @return chef - Whether or not the token is a Chef
   */
  function isChef(uint256 tokenId) public view returns (bool chef) {
    (chef, , , , , , , , ,) = character.tokenTraits(tokenId);
  }

  /**
   * Get the character's properties
   * @param tokenId - The ID of the token to check
   * @return efficiency & tolerance values
   */
  function getProperties(uint256 tokenId) public view returns (uint8 efficiency, uint8 tolerance) {
    (, , , , , , , , efficiency, tolerance) = character.tokenTraits(tokenId);
  }

  function onERC721Received(address, address from, uint256, bytes calldata) external pure override returns (bytes4) {
    require(from == address(0x0), "Cannot send tokens to Venue directly");
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
