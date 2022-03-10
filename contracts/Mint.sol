// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./VRFConsumer.sol";
import "./IMint.sol";
import "./ICharacter.sol";

contract Mint is Initializable, OwnableUpgradeable, IMint, VRFConsumer {
  uint8[][18] public rarities; // List of probabilities for each trait type, 0 - 9 are associated with Chefs, 10 - 18 are associated with Rats
  mapping(uint256 => bytes32) public existingCombinations; // Mapping from hashed(tokenTrait) to the tokenId it's associated with, used to ensure there are no duplicates
  mapping(address => bool) controllers; // Mapping from an address to whether or not it can mint / burn

  ICharacter character; // Reference to the Character
  bytes32 internal keyHash;
  uint256 internal fee;
  mapping(bytes32 => VRFStruct) public vrfRequests; // Mapping from tokenId to a struct containing the token's traits

  event RandomNumberRequested(
    bytes32 requestId,
    address sender
  );

  function initialize(
    address _vrfCoordinator,
    address _link,
    bytes32 _keyHash,
    uint256 _fee
  ) external initializer {
    __Ownable_init();

    vrfCoordinator = _vrfCoordinator;
    link = LinkTokenInterface(_link);
    keyHash = _keyHash;
    fee = _fee;

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
   * Set ChainLink VRF params
   */
  function setVrfParams(
    address _vrfCoordinator,
    address _link,
    bytes32 _keyHash,
    uint256 _fee
  ) external onlyOwner {
    vrfCoordinator = _vrfCoordinator;
    link = LinkTokenInterface(_link);
    keyHash = _keyHash;
    fee = _fee;
  }

  function requestRandomNumber(address sender, uint8 amount, bool stake) external returns (bytes32 requestId) {
    require(controllers[_msgSender()], "Only controllers can request randomness");
    require(link.balanceOf(address(this)) >= fee, "Insufficient LINK");
    requestId = requestRandomness(keyHash, fee);
    VRFStruct memory v = VRFStruct({ requestId: requestId, sender: sender, amount: amount, stake: stake });
    vrfRequests[requestId] = v;
    emit RandomNumberRequested(
      requestId,
      _msgSender()
    );
  }

  function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
    require(vrfRequests[requestId].requestId != 0, "VRF request ID not found");
    VRFStruct memory v = vrfRequests[requestId];
    ICharacter.CharacterStruct[] memory tokens = new ICharacter.CharacterStruct[](v.amount);

    for (uint i = 0; i < v.amount; i++) {
      tokens[i] = generate(requestId, uint256(keccak256(abi.encode(randomness, i))));
    }

    character.fulfillMint(vrfRequests[requestId], tokens);
    delete vrfRequests[requestId];
  }

  /**
   * Generates traits for a specific token, checking to make sure it's unique
   * @param requestId - A VRF request ID
   * @param seed - A VRF seed
   * @return t - A struct of traits for the given token ID
   */
  function generate(bytes32 requestId, uint256 seed) internal returns (ICharacter.CharacterStruct memory t) {
    t = selectTraits(seed);
    uint256 hash = structToHash(t);
    if (existingCombinations[hash] == 0) {
      existingCombinations[hash] = requestId;
      return t;
    }
    return generate(requestId, uint256(keccak256(abi.encodePacked(seed - 1))));
  }

  /**
   * Selects the species and all of its traits based on the seed value
   * @param seed - A pseudorandom 256 bit number to derive traits from
   * @return t -  A struct of randomly selected traits
   */
  function selectTraits(uint256 seed) internal view returns (ICharacter.CharacterStruct memory t) {
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
  function structToHash(ICharacter.CharacterStruct memory s) internal pure returns (uint256) {
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

  /**
   * Set the character address
   * @param _character - The address of the Character
   */
  function setCharacter(address _character) external onlyOwner {
    character = ICharacter(_character);
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
}
