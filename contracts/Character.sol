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

contract Character is ICharacter, Initializable, OwnableUpgradeable, GenericPausable, ERC721Upgradeable, ControllableUpgradeable {
  uint16 public minted;
  uint16 public numChefs;
  uint16 public numRats;
  uint256 public maxTokens; // Max number of tokens that can be minted
  uint256 gen0Tokens; // Number of tokens that are purchased with native token

  mapping(uint256 => CharacterStruct) public tokenTraits; // Mapping from tokenId to a struct containing the token's traits
  mapping(bytes32 => uint16[]) public mintRequests;

  IMint public theMint; // Reference to Mint
  ITraits public traits; // Reference to Traits
  IProperties public properties; // Reference to Properties
  IVenue public kitchen;
  IPaywall public paywall;
  address payable dao;

  function initialize(
    address[] memory _addresses, // paywall, mint, traits, properties, dao
    uint256 _maxTokens
  ) external initializer {
    __Ownable_init();
    __Pausable_init();
    __ERC721_init("RatAlert Characters", "RATCAST");

    paywall = IPaywall(_addresses[0]);
    theMint = IMint(_addresses[1]);
    traits = ITraits(_addresses[2]);
    properties = IProperties(_addresses[3]);
    dao = payable(_addresses[4]);
    maxTokens = _maxTokens;
    gen0Tokens = _maxTokens / 5;
    minted = 0;
    numChefs = 0;
    numRats = 0;
  }

  /**
   * ChainLink VRF request: Mints a new ERC721 token: 90% chefs, 10% rats
   * The first 20% are purchased with native token, the remaining cost $FFOOD
   * @param amount Number of tokens to mint
   * @param stake Number of tokens to mint
   */
  function mint(uint8 amount, bool stake) external payable whenNotPaused {
    require(tx.origin == _msgSender(), "EOA only");
    paywall.handle(_msgSender(), amount, msg.value, minted, maxTokens, gen0Tokens);
    if (msg.value > 0) {
      dao.transfer(msg.value); // Transfer to Gnosis Safe
    }
    bytes32 requestId = theMint.requestRandomNumber(_msgSender(), amount, stake);
    mintRequests[requestId] = new uint16[](amount);
    for (uint i = 0; i < amount; i++) {
      minted++;
      mintRequests[requestId][i] = minted;
    }
  }

  /**
   * ChainLink VRF callback for mint()
   * @param v - VRF struct for the corresponding request
   * @param tokens - List of characters created by the Mint
   */
  function fulfillMint(IMint.VRFStruct memory v, CharacterStruct[] memory tokens) external whenNotPaused {
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

  function updateCharacter(uint256 tokenId, int8 efficiencyIncrement, int8 toleranceIncrement, uint256 randomVal) public onlyController returns(uint8 efficiencyValue, uint8 toleranceValue, string memory eventName) {
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
   * Sets the kitchen address to optionally stake newly minted characters in
   * @param _kitchen - The address of the Kitchen
   */
  function setKitchen(address _kitchen) external onlyOwner {
    kitchen = IVenue(_kitchen);
  }
}
