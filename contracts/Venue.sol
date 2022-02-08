// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "./IVenue.sol";
import "./Character.sol";

contract Venue is IVenue, Initializable, OwnableUpgradeable, PausableUpgradeable, IERC721ReceiverUpgradeable {
  struct Stake { // Store for a stake's token, owner, and earning values
    uint256 tokenId;
    address owner;
    uint80 value;
    uint80 timestamp;
  }

  event TokenStaked(uint256 tokenId, address owner, uint256 value);
  event ChefClaimed(uint256 tokenId, uint256 earned, bool unstaked, uint8 skill, uint8 insanity, string eventName);
  event RatClaimed(uint256 tokenId, uint256 earned, bool unstaked, uint8 intelligence, uint8 fatness, string eventName);

  Character character; // Reference to the Character NFT contract

  mapping(uint256 => Stake) public chefs; // Maps tokenId to stake
  mapping(uint256 => Stake) public rats; // Maps tokenId to stake
  int8 public dailySkillRate;
  int8 public dailyInsanityRate;
  int8 public dailyIntelligenceRate;
  int8 public dailyFatnessRate;
  uint256 public totalChefsStaked; // Number of Chefs staked
  uint256 public totalRatsStaked; // Number of Rats staked
  uint256 public accrualPeriod; // The period over which earnings & levels are accrued

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
    for (uint i = 0; i < tokenIds.length; i++) {
      if (_msgSender() != address(character)) { // Not necessary if it's a mint & stake
        require(character.ownerOf(tokenIds[i]) == _msgSender(), "Not your token");
        character.transferFrom(_msgSender(), address(this), tokenIds[i]);
      } else if (tokenIds[i] == 0) {
        continue; // There may be gaps in the array for stolen tokens
      }

      if (isChef(tokenIds[i])) {
        _stakeChef(account, tokenIds[i]);
      } else {
        _stakeRat(account, tokenIds[i]);
      }
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
    emit TokenStaked(tokenId, account, block.timestamp);
  }

  /**
   * Claim food token earnings, level-ups and optionally unstake characters
   * @param tokenIds - The IDs of the tokens in question
   * @param unstake - Whether or not to unstake the given tokens
   */
  function claimMany(uint16[] calldata tokenIds, bool unstake) external virtual whenNotPaused {
    uint256 owed = 0;
    for (uint i = 0; i < tokenIds.length; i++) {
      if (isChef(tokenIds[i]))
        owed += _claimChef(tokenIds[i], unstake);
      else
        owed += _claimRat(tokenIds[i], unstake);
    }
    if (owed > 0) {
      _mintFoodToken(owed);
    }
  }

  /**
   * Claim food tokens & level-ups for a single Chef and optionally unstake him
   * @param tokenId - The ID of the Chef to level up
   * @param unstake - Whether or not to unstake the Chef
   * @return owed - Food tokens produced during staking
   */
  function _claimChef(uint256 tokenId, bool unstake) internal returns (uint256 owed) {
    Stake memory stake = chefs[tokenId];
    require(stake.owner == _msgSender(), "Not your token");
    // require(!(unstake && block.timestamp - stake.value < MINIMUM_TO_EXIT), "Cannot leave before EOB");

    owed = _getOwedByChef(stake);

    (uint8 efficiency, uint8 tolerance, string memory eventName) = _updateCharacter(tokenId);

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
    emit ChefClaimed(tokenId, owed, unstake, efficiency, tolerance, eventName);
  }

  /**
   * Claim food tokens & level-ups for a single Rat and optionally unstake it
   * @param tokenId - The ID of the Rat to level up
   * @param unstake - Whether or not to unstake the Rat
   * @return owed - Food tokens stolen during staking
   */
  function _claimRat(uint256 tokenId, bool unstake) internal returns (uint256 owed) {
    Stake memory stake = rats[tokenId];
    require(stake.owner == _msgSender(), "Not your token");
    // require(!(unstake && block.timestamp - stake.value < MINIMUM_TO_EXIT), "Cannot leave your pack starving so early");

    owed = _getOwedByRat(stake);

    (uint8 efficiency, uint8 tolerance, string memory eventName) = _updateCharacter(tokenId);

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
