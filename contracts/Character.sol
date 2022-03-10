// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./ICharacter.sol";
import "./FastFood.sol";
import "./IMint.sol";
import "./ITraits.sol";
import "./IProperties.sol";
import "./IVenue.sol";

contract Character is ICharacter, Initializable, OwnableUpgradeable, PausableUpgradeable, ERC721Upgradeable {
  uint16 public minted;
  uint16 public numChefs;
  uint16 public numRats;
  uint256 public mintPrice;
  uint256 public maxTokens; // Max number of tokens that can be minted - 50000 in production
  uint256 public gen0Tokens; // Number of tokens that can be claimed for free - 20% of maxTokens

  mapping(uint256 => CharacterStruct) public tokenTraits; // Mapping from tokenId to a struct containing the token's traits
  mapping(uint256 => uint256) public existingCombinations; // Mapping from hashed(tokenTrait) to the tokenId it's associated with, used to ensure there are no duplicates
  mapping(address => bool) controllers; // Mapping from an address to whether or not it can mint / burn
  mapping(bytes32 => uint16[]) public mintRequests;

  FastFood fastFood; // Reference to the $FFOOD contract
  IMint public theMint; // Reference to Mint
  ITraits public traits; // Reference to Traits
  IProperties public properties; // Reference to Properties
  IVenue public kitchen;

  function initialize(
    address[] memory _addresses, // fastFood, mint, traits, properties
    uint256 _maxTokens,
    uint256 _mintPrice
  ) external initializer {
    __Ownable_init();
    __Pausable_init();
    __ERC721_init("RatAlert Characters", "RATCAST");

    fastFood = FastFood(_addresses[0]);
    theMint = IMint(_addresses[1]);
    traits = ITraits(_addresses[2]);
    properties = IProperties(_addresses[3]);
    maxTokens = _maxTokens;
    gen0Tokens = _maxTokens / 5;
    mintPrice = _mintPrice;
    minted = 0;
    numChefs = 0;
    numRats = 0;
  }

  /**
   * ChainLink VRF request: Mints a new ERC721 token: 90% chefs, 10% rats
   * The first 20% are free to claim, the remaining cost $FFOOD
   * @param amount Number of tokens to mint
   * @param stake Number of tokens to mint
   */
  function mint(uint8 amount, bool stake) external payable whenNotPaused {
    require(tx.origin == _msgSender(), "EOA only");
    require(amount > 0 && amount <= 10, "Invalid mint amount");
    require(minted + amount <= maxTokens, "All tokens minted");
    uint256 totalCost = 0;
    if (minted < gen0Tokens) {
      require(minted + amount <= gen0Tokens, "Not enough Gen 0 tokens left, reduce amount");
      require(amount * mintPrice == msg.value, "Invalid payment amount");
    } else {
      require(msg.value == 0, "Invalid payment type, accepting food tokens only");
      for (uint i = 1; i <= amount; i++) {
        totalCost += mintCost(minted + i);
      }
    }
    if (totalCost > 0) fastFood.burn(_msgSender(), totalCost);
    bytes32 requestId = theMint.requestRandomNumber(_msgSender(), amount, stake);
    mintRequests[requestId] = new uint16[](amount);
    for (uint i = 0; i < amount; i++) {
      minted++;
      mintRequests[requestId][i] = minted;
    }
  }

  /**
   *     1 - 10000: cost ETH
   * 10001 - 20000: 1000 $FFOOD
   * 20001 - 30000: 1500 $FFOOD
   * 30001 - 40000: 2000 $FFOOD
   * 40001 - 50000: 3000 $FFOOD
   * @param tokenId - The token ID to check
   * @return The minting cost of the given ID
   */
  function mintCost(uint256 tokenId) public view returns (uint256) {
    if (tokenId <= gen0Tokens) return 0;
    if (tokenId <= maxTokens * 2 / 5) return 1000 ether;
    if (tokenId <= maxTokens * 3 / 5) return 1500 ether;
    if (tokenId <= maxTokens * 4 / 5) return 2000 ether;
    return 3000 ether;
  }

  /**
   * ChainLink VRF callback for mint()
   * @param v - VRF struct for the corresponding request
   * @param tokens - List of characters created by the Mint
   */
  function fulfillMint(IMint.VRFStruct memory v, CharacterStruct[] memory tokens) external {
    require(msg.sender == address(theMint), "Only the Mint can fulfill");
    require(mintRequests[v.requestId].length > 0, "Mint request not found");
    uint16[] memory tokenIds = mintRequests[v.requestId];
    delete mintRequests[v.requestId];
    for (uint i = 0; i < tokenIds.length; i++) {
      _safeMint(v.stake ? address(kitchen) : v.sender, tokenIds[i]);
      tokenTraits[tokenIds[i]] = tokens[i];
      tokens[i].isChef ? numChefs++ : numRats++;
    }
    if (v.stake) kitchen.stakeMany(v.sender, tokenIds);
  }

  function updateCharacter(uint256 tokenId, int8 efficiencyIncrement, int8 toleranceIncrement, uint256 randomVal) public returns(uint8 efficiencyValue, uint8 toleranceValue, string memory eventName) {
    require(controllers[msg.sender], "Only controllers can update");
    bool isChef = tokenTraits[tokenId].isChef;
    uint8 currentEfficiency = tokenTraits[tokenId].efficiency;
    uint8 currentTolerance = tokenTraits[tokenId].tolerance;
    (efficiencyValue, toleranceValue, eventName) = properties.getEventUpdates(isChef, currentEfficiency, currentTolerance, efficiencyIncrement, toleranceIncrement, randomVal);
    tokenTraits[tokenId].efficiency = efficiencyValue;
    tokenTraits[tokenId].tolerance = toleranceValue;
  }

  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for non-existent token");
    return traits.tokenURI(tokenId);
  }

  function getTokenTraits(uint256 tokenId) external view override returns (CharacterStruct memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for non-existent token");
    return tokenTraits[tokenId];
  }

  function getGen0Tokens() external view override returns (uint256) {
    return gen0Tokens;
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
   * Sets the kitchen address to optionally stake newly minted characters in
   * @param _kitchen - The address of the Kitchen
   */
  function setKitchen(address _kitchen) external onlyOwner {
    kitchen = IVenue(_kitchen);
  }
}
