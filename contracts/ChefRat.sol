// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./IChefRat.sol";
import "./ITraits.sol";

contract ChefRat is IChefRat, Initializable, OwnableUpgradeable, PausableUpgradeable, ERC721Upgradeable {
  uint16 public minted;
  uint256 public constant MINT_PRICE = .1 ether;
  uint256 public MAX_TOKENS; // Max number of tokens that can be minted - 50000 in production
  uint256 public PAID_TOKENS; // Number of tokens that can be claimed for free - 20% of MAX_TOKENS
//  uint256 public constant CHEF = 0;
//  uint256 public constant RAT = 1;

  mapping(uint256 => ChefRatStruct) public tokenTraits; // Mapping from tokenId to a struct containing the token's traits
  mapping(uint256 => uint256) public existingCombinations; // Mapping from hashed(tokenTrait) to the tokenId it's associated with, used to ensure there are no duplicates
  uint8[][18] public rarities; // List of probabilities for each trait type, 0 - 9 are associated with Chefs, 10 - 18 are associated with Rats

  ITraits public traits; // Reference to Traits

  function initialize(address _traits, uint256 _maxTokens) external initializer {
    __Ownable_init();
    __Pausable_init();
    __ERC721_init("Rat Alert Chefs & Rats", "RATS");

    minted = 0;
    traits = ITraits(_traits);
    MAX_TOKENS = _maxTokens;
    PAID_TOKENS = _maxTokens / 5;

    // Chefs
    rarities[0] = [255, 150, 50]; // body
    rarities[1] = [255, 150, 50]; // head
    rarities[2] = [255, 127, 63, 63, 31, 15, 7, 3, 2, 1]; // ears
    rarities[3] = [255, 239, 223, 207, 191, 175, 159, 143, 127, 111]; // eyes
    rarities[4] = [255, 231, 207, 183, 159, 135, 111, 87, 63, 39]; // nose
    rarities[5] = [255, 239, 223, 207, 191, 175, 159, 143, 127, 111]; // mouth
    rarities[6] = [255, 231, 207, 183, 159, 135, 111, 87, 63, 39]; // neck
    rarities[7] = [255, 239, 223, 207, 191, 175, 159, 143, 127, 111]; // feet
    // Rats
    rarities[10] = [255, 150, 50]; // body
    rarities[11] = [255, 150, 50]; // head
    rarities[12] = [255, 231, 207, 183, 159, 135, 111, 87, 63, 39]; // ears
    rarities[13] = [255, 239, 223, 207, 191, 175, 159, 143, 127, 111]; // eyes
    rarities[14] = [255, 231, 207, 183, 159, 135, 111, 87, 63, 39]; // nose
    rarities[15] = [255, 239, 223, 207, 191, 175, 159, 143, 127, 111]; // mouth
    rarities[16] = [255, 231, 207, 183, 159, 135, 111, 87, 63, 39]; // neck
    rarities[17] = [255, 239, 223, 207, 191, 175, 159, 143, 127, 111]; // feet
  }

  /**
   * Mints a new ERC721 token: 90% chefs, 10% rats
   * The first 20% are free to claim, the remaining cost $FFOOD
   * @param amount Number of tokens to mint
   */
  function mint(uint8 amount) external payable whenNotPaused {
    require(amount > 0 && amount <= 10, "Invalid mint amount");
    require(amount * MINT_PRICE == msg.value, "Invalid payment amount");

    uint16[] memory tokenIds = new uint16[](amount);
    uint256 seed;
    for (uint i = 0; i < amount; i++) {
      minted++;
      seed = random(minted);
      generate(minted, seed);
      _safeMint(_msgSender(), minted);
      tokenIds[i] = minted;
    }
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
    uint8 shift = t.isChef ? 0 : 10;
    t.body = selectTrait(seed, 0 + shift);
    t.head = selectTrait(seed, 1 + shift);
    t.ears = selectTrait(seed, 2 + shift);
    t.eyes = selectTrait(seed, 3 + shift);
    t.nose = selectTrait(seed, 4 + shift);
    t.mouth = selectTrait(seed, 5 + shift);
    t.neck = selectTrait(seed, 6 + shift);
    t.feet = selectTrait(seed, 7 + shift);
    return t;
  }

//  function testSelectTrait(uint256 seed, uint8 traitIndex) external view returns(uint256) {
//    return selectTrait(random(seed), traitIndex);
//  }

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
        s.body,
        s.head,
        s.ears,
        s.eyes,
        s.nose,
        s.mouth,
        s.neck,
        s.feet
      )
    ));
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
   * Generates a pseudorandom number
   * @param seed A value ensure different outcomes for different sources in the same block
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
