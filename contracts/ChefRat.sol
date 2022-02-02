// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./IChefRat.sol";
import "./IKitchenPack.sol";
import "./ITraits.sol";
import "./IProperties.sol";

contract ChefRat is IChefRat, Initializable, OwnableUpgradeable, PausableUpgradeable, ERC721Upgradeable {
  uint16 public minted;
  uint16 public numChefs;
  uint16 public numRats;
  uint256 public mintPrice;
  uint256 public MAX_TOKENS; // Max number of tokens that can be minted - 50000 in production
  uint256 public PAID_TOKENS; // Number of tokens that can be claimed for free - 20% of MAX_TOKENS

  mapping(uint256 => ChefRatStruct) public tokenTraits; // Mapping from tokenId to a struct containing the token's traits
  mapping(uint256 => uint256) public existingCombinations; // Mapping from hashed(tokenTrait) to the tokenId it's associated with, used to ensure there are no duplicates
  mapping(address => bool) controllers; // a mapping from an address to whether or not it can mint / burn
  uint8[][18] public rarities; // List of probabilities for each trait type, 0 - 9 are associated with Chefs, 10 - 18 are associated with Rats

  ITraits public traits; // Reference to Traits
  IProperties public properties; // Reference to Properties
  IKitchenPack public kitchenPack;

  function initialize(address _traits, address _properties, uint256 _maxTokens, uint256 _mintPrice) external initializer {
    __Ownable_init();
    __Pausable_init();
    __ERC721_init("RatAlert Chefs & Rats", "CHEFRAT");

    minted = 0;
    numChefs = 0;
    numRats = 0;
    traits = ITraits(_traits);
    properties = IProperties(_properties);
    MAX_TOKENS = _maxTokens;
    PAID_TOKENS = _maxTokens / 5;
    mintPrice = _mintPrice;

    // Chefs
    rarities[2] = [255, 223, 191, 159, 127, 95]; // hat
    rarities[3] = [255, 223, 191, 159, 127, 95, 63, 31]; // eyes
    rarities[4] = [255, 223, 191, 159, 127, 95]; // mouth
    rarities[5] = [255, 207, 159, 111, 63, 15]; // neck
    rarities[6] = [255, 223, 191, 159, 127, 95]; // hand
    // Rats
    rarities[12] = [255, 223, 191, 159, 127, 95]; // hat
    rarities[13] = [255, 223, 191, 159, 127, 95, 63, 31]; // eyes
    rarities[14] = [255, 223, 191, 159, 127, 95]; // piercing
    rarities[15] = [255, 207, 159, 111, 63, 15]; // neck
    rarities[16] = [255, 223, 191, 159, 127, 95]; // tail
  }

  /**
   * Mints a new ERC721 token: 90% chefs, 10% rats
   * The first 20% are free to claim, the remaining cost $FFOOD
   * @param amount Number of tokens to mint
   */
  function mint(uint8 amount, bool stake) external payable whenNotPaused {
    require(amount > 0 && amount <= 10, "Invalid mint amount");
    require(amount * mintPrice == msg.value, "Invalid payment amount");

    uint16[] memory tokenIds = stake ? new uint16[](amount) : new uint16[](0);
    uint256 seed;
    ChefRatStruct memory s;
    for (uint i = 0; i < amount; i++) {
      minted++;
      seed = random(minted);
      s = generate(minted, seed);
      if (stake) {
        _safeMint(address(kitchenPack), minted);
        tokenIds[i] = minted;
      } else {
        _safeMint(_msgSender(), minted);
      }
      s.isChef ? numChefs++ : numRats++;
    }
    if (stake) kitchenPack.stakeMany(_msgSender(), tokenIds);
  }

  /**
   * Generates traits for a specific token, checking to make sure it's unique
   * @param tokenId - The id of the token to generate traits for
   * @param seed - A pseudorandom 256 bit number to derive traits from
   * @return t - A struct of traits for the given token ID
   */
  function generate(uint256 tokenId, uint256 seed) internal returns (ChefRatStruct memory t) {
    t = selectTraits(seed);
    uint256 hash = structToHash(t);
    if (existingCombinations[hash] == 0) {
      tokenTraits[tokenId] = t;
      existingCombinations[hash] = tokenId;
      return t;
    }
    return generate(tokenId, random(seed));
  }

  /**
   * Selects the species and all of its traits based on the seed value
   * @param seed - A pseudorandom 256 bit number to derive traits from
   * @return t -  A struct of randomly selected traits
   */
  function selectTraits(uint256 seed) internal view returns (ChefRatStruct memory t) {
    t.isChef = (seed & 0xFFFF) % 10 != 0;
    if (t.isChef) {
      t.hat = selectTrait(seed, 2);
      t.eyes = selectTrait(seed, 3);
      t.mouth = selectTrait(seed, 4);
      t.neck = selectTrait(seed, 5);
      t.hand = selectTrait(seed, 6);
    } else {
      t.hat = selectTrait(seed, 12);
      t.eyes = selectTrait(seed, 13);
      t.piercing = selectTrait(seed, 14);
      t.neck = selectTrait(seed, 15);
      t.tail = selectTrait(seed, 16);
    }
    return t;
  }

  /**
   * Uses A.J. Walker's Alias algorithm for O(1) rarity table lookup
   * ensuring O(1) instead of O(n) reduces mint cost by more than 50%
   * probability & alias tables are generated off-chain beforehand
   * @param seed - Portion of the 256 bit seed to remove trait correlation
   * @param traitIndex - The trait index to select a trait for
   * @return The ID of the randomly selected trait
   */
  function selectTrait(uint256 seed, uint8 traitIndex) internal view returns (uint8) {
    seed = seed >>= (traitIndex % 10 * 16);
    uint8 trait = uint8(seed) % uint8(rarities[traitIndex].length); // Selected trait index
    uint8 rand = uint8(seed & 0xFFFF >> 8); // Random integer from 0 to 255
    if (rand <= rarities[traitIndex][trait]) return trait;
    return 0;
  }

  /**
   * Converts a struct to a 256 bit hash to check for uniqueness
   * @param s - The struct to pack into a hash
   * @return The 256 bit hash of the struct
   */
  function structToHash(ChefRatStruct memory s) internal pure returns (uint256) {
    return uint256(bytes32(
      abi.encodePacked(
        s.isChef,
        s.hat,
        s.eyes,
        s.piercing,
        s.mouth,
        s.neck,
        s.hand,
        s.tail
      )
    ));
  }

  function updateCharacter(uint256 tokenId, int8 efficiencyIncrement, int8 toleranceIncrement) public returns(uint8 efficiencyValue, uint8 toleranceValue, string memory eventName) {
    require(controllers[msg.sender], "Only controllers can update");
    bool isChef = tokenTraits[tokenId].isChef;
    uint8 currentEfficiency = tokenTraits[tokenId].efficiency;
    uint8 currentTolerance = tokenTraits[tokenId].tolerance;
    (efficiencyValue, toleranceValue, eventName) = properties.getEventUpdates(isChef, currentEfficiency, currentTolerance, efficiencyIncrement, toleranceIncrement);
    tokenTraits[tokenId].efficiency = efficiencyValue;
    tokenTraits[tokenId].tolerance = toleranceValue;
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for non-existent token");
    return traits.tokenURI(tokenId);
  }

  function getTokenTraits(uint256 tokenId) external view override returns (ChefRatStruct memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for non-existent token");
    return tokenTraits[tokenId];
  }

  function getPaidTokens() external view override returns (uint256) {
    return PAID_TOKENS;
  }

  /**
   * Gets controller status by address
   * @param controller the address to check
   */
  function getController(address controller) external view onlyOwner returns (bool) {
    return controllers[controller];
  }

  /**
   * Enables an address to mint / burn
   * @param controller the address to enable
   */
  function addController(address controller) external onlyOwner {
    controllers[controller] = true;
  }

  /**
   * Disables an address from minting / burning
   * @param controller the address to disable
   */
  function removeController(address controller) external onlyOwner {
    controllers[controller] = false;
  }

  /**
   * called after deployment to avoid cyclical dependencies
   * @param _kitchenPack the address of the KitchenPack
   */
  function setKitchenPack(address _kitchenPack) external onlyOwner {
    kitchenPack = IKitchenPack(_kitchenPack);
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
