// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./GenericPausable.sol";
import "./ControllableUpgradeable.sol";
import "./ICharacter.sol";
import "./IMint.sol";
import "./ITraits.sol";
import "./IProperties.sol";
import "./IVenue.sol";
import "./IPaywall.sol";

contract Character is Initializable, OwnableUpgradeable, GenericPausable, ICharacter, ERC721Upgradeable, ControllableUpgradeable {
  uint16 public paid;
  uint16 public minted;
  uint16 public numChefs;
  uint16 public numRats;
  uint256 public maxTokens; // Max number of tokens that can be minted
  uint256 gen0Tokens; // Number of tokens that are purchased with native token

  mapping(uint256 => CharacterStruct) public tokenTraits; // Mapping from tokenId to a struct containing the token's traits

  IMint public theMint; // Reference to Mint
  ITraits public traits; // Reference to Traits
  IProperties public properties; // Reference to Properties
  IVenue kitchen;
  IPaywall paywall;

  function initialize(
    address _paywall,
    address _mint,
    address _traits,
    address _properties
  ) external initializer {
    __Ownable_init();
    __Pausable_init();
    __ERC721_init("RatAlert Characters", "RATCAST");

    paywall = IPaywall(_paywall);
    theMint = IMint(_mint);
    traits = ITraits(_traits);
    properties = IProperties(_properties);
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(uint256 _maxTokens, uint256 _gen0Tokens) external onlyOwner {
    maxTokens = _maxTokens;
    gen0Tokens = _gen0Tokens;
  }

  /**
   * ChainLink VRF request: Mints a new ERC721 token: 90% chefs, 10% rats
   * The first 20% are purchased with native token, the remaining cost $FFOOD
   * @param amount Number of tokens to mint
   * @param stake Number of tokens to mint
   */
  function mint(uint8 amount, bool stake) external payable whenNotPaused {
    require(tx.origin == _msgSender(), "EOA only");
    int8 boost = paywall.handle(_msgSender(), amount, msg.value, paid, maxTokens, gen0Tokens);
    theMint.requestRandomNumber(_msgSender(), amount, stake, boost);
    paid += amount;
  }

  /**
   * Callback for mint(), called by Mint.fulfillRandomness()
   * @param requestId - The VRF request ID
   * @param tokens - List of characters created by the Mint
   */
  function fulfillMint(bytes32 requestId, CharacterStruct[] memory tokens) external whenNotPaused {
    require(requestId != 0, "Invalid vrfRequest");
    IMint.VRFStruct memory v = theMint.getVrfRequest(requestId);
    require(requestId == v.requestId, "vrfRequest not found");
    require(msg.sender == address(theMint), "Only the Mint can fulfill");
    uint16[] memory tokenIds = new uint16[](v.amount);
    for (uint i = 0; i < v.amount; i++) {
      minted ++;
      _safeMint(v.stake ? address(kitchen) : v.sender, minted);
      tokenIds[i] = minted;
      tokenTraits[minted] = tokens[i];
      tokens[i].isChef ? numChefs++ : numRats++;
    }
    if (v.stake) kitchen.stakeMany(v.sender, tokenIds);
  }

  /**
   * Allows the venues to update the character's efficiency & tolerance values when claiming
   * @param tokenId - The ID of the Character
   * @param efficiencyIncrement - The value to add/subtract to the current value
   * @param toleranceIncrement - The value to add/subtract to the current value
   * @param randomVal - A ChainLink VRF random number
   */
  function updateCharacter(uint256 tokenId, int8 efficiencyIncrement, int8 toleranceIncrement, uint256 randomVal) external onlyController returns(uint8 efficiencyValue, uint8 toleranceValue, string memory eventName) {
    bool isChef = tokenTraits[tokenId].isChef;
    uint8 currentEfficiency = tokenTraits[tokenId].efficiency;
    uint8 currentTolerance = tokenTraits[tokenId].tolerance;
    (efficiencyValue, toleranceValue, eventName) = properties.getEventUpdates(isChef, currentEfficiency, currentTolerance, efficiencyIncrement, toleranceIncrement, randomVal);
    tokenTraits[tokenId].efficiency = efficiencyValue;
    tokenTraits[tokenId].tolerance = toleranceValue;
  }

  /**
   * Returns the base64 encoded ERC721 metadata
   * @param tokenId - The ID of the Character
   * @return base64 encoded JSON string
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for non-existent token");
    return traits.tokenURI(tokenId);
  }

  /**
   * Returns the Character's struct
   * @param tokenId - The ID of the Character
   * @return Current CharacterStruct
   */
  function getTokenTraits(uint256 tokenId) external view override returns (CharacterStruct memory) {
    require(_exists(tokenId), "ERC721Metadata: URI query for non-existent token");
    return tokenTraits[tokenId];
  }

  /**
   * Custom getter required for Traits contract
   */
  function getGen0Tokens() external view override returns (uint256) {
    return gen0Tokens;
  }

  /**
   * Allows DAO to withdraw funds
   */
  function withdrawPayments() external onlyDao {
    payable(dao).transfer(address(this).balance); // Transfer to DAO wallet
  }

  /**
   * Sets the kitchen address to optionally stake newly minted characters in
   * @param _kitchen - The address of the Kitchen
   */
  function setKitchen(address _kitchen) external onlyOwner {
    kitchen = IVenue(_kitchen);
  }
}
