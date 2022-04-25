// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./GenericPausable.sol";
import "./FastFood.sol";
import "./CasualFood.sol";
import "./Character.sol";

contract KitchenShop is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, GenericPausable, ERC1155Upgradeable {
  using Strings for uint256;

  struct KitchenData { // Struct to store each kitchen's metadata
    string name;
    string png;
  }

  FastFood fastFood; // Reference to the $FFOOD contract
  CasualFood casualFood; // Reference to the $CFOOD contract
  Character character; // Reference to the Character contract

  string public name;
  string public symbol;
  uint256 public tokenSupply;
  uint256 public priceTier0;
  uint256 public priceTier1;
  uint256 public priceTier2;
  uint256 public priceTier3;
  uint256 public priceTier4;
  uint8 public maxMintsPerTx; // Maximum number of tokens that can be minted in a single tx
  mapping (uint8 => uint256) public maxTokens;
  mapping (uint8 => uint256) public minSkill;
  mapping (uint8 => uint256) public minted;
  mapping(uint256 => KitchenData) public kitchenData; // Storage of each kitchen's metadata

  function initialize(address _fastFood, address _casualFood, address _character) external initializer {
    __Ownable_init();
    __Pausable_init();

    fastFood = FastFood(_fastFood);
    casualFood = CasualFood(_casualFood);
    character = Character(_character);
    minted[1] = 0;
    minted[2] = 0;

    name = "RatAlert Kitchens";
    symbol = "RATCUISINE";
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(
    uint256[] memory _maxTokens,
    uint8 _maxMintsPerTx,
    uint8[] memory _minSkill,
    uint256[] memory _prices
  ) external onlyOwner {
    maxTokens[1] = _maxTokens[0];
    maxTokens[2] = _maxTokens[1];
    maxMintsPerTx = _maxMintsPerTx;
    minSkill[1] = _minSkill[0];
    minSkill[2] = _minSkill[1];
    priceTier0 = _prices[0];
    priceTier1 = _prices[1];
    priceTier2 = _prices[2];
    priceTier3 = _prices[3];
    priceTier4 = _prices[4];
    tokenSupply = _maxTokens[0] + _maxTokens[1];
  }

  /**
   * Mints new ERC1155 token(s) of the given kitchen type
   * @param kitchen - The kitchen type
   * @param amount - Number of tokens to mint
   */
  function mint(uint8 kitchen, uint8 amount) external payable nonReentrant whenNotPaused {
    require(tx.origin == _msgSender(), "EOA only");
    require(kitchen > 0 && kitchen <= 2, "Invalid kitchen");
    require(amount > 0 && amount <= maxMintsPerTx, "Invalid mint amount");
    require(minted[kitchen] + amount <= maxTokens[kitchen], "All tokens minted");
    require(msg.value == 0, "Invalid payment type");

    uint256 totalCost = 0;
    for (uint i = 0; i < amount; i++) {
      minted[kitchen] ++;
      totalCost += this.mintCost(kitchen, minted[kitchen]);
    }
    _mint(_msgSender(), kitchen, amount, "");
    if (totalCost > 0) {
      if (kitchen == 2) {
        casualFood.burn(_msgSender(), totalCost);
      } else {
        fastFood.burn(_msgSender(), totalCost);
      }
    }
  }

  /**
   * Returns the latest mint price for the given token using 5 price breaks
   * @param kitchen - The kitchen type
   * @param tokenId - The token ID to check
   * @return The minting cost of the given ID
   */
  function mintCost(uint8 kitchen, uint256 tokenId) external view returns (uint256) {
    if (tokenId <= maxTokens[kitchen] * 1 / 5) return priceTier0;
    if (tokenId <= maxTokens[kitchen] * 2 / 5) return priceTier1;
    if (tokenId <= maxTokens[kitchen] * 3 / 5) return priceTier2;
    if (tokenId <= maxTokens[kitchen] * 4 / 5) return priceTier3;
    return priceTier4;
  }

  /**
   * Returns the base64 encoded ERC1155 metadata
   * @param tokenId - The ID of the Kitchen
   * @return base64 encoded JSON string
   */
  function uri(uint256 tokenId) public view override returns (string memory) {
    require(tokenId > 0 && tokenId <= 2, "ERC1155Metadata: URI query for non-existent token");
    KitchenData memory kitchen = kitchenData[tokenId - 1];

    string memory metadata = string(abi.encodePacked(
      '{',
        '"name":"', kitchen.name, '",',
        '"description":"RatAlert, the NFT game that lets you Train2Earn your characters on-chain for higher rewards! https://ratalert.com/",',
        '"external_url":"https://ratalert.com/kitchens/', tokenId.toString(), '",',
        '"image":"data:image/png;base64,', Base64.encode(bytes(drawSVG(bytes(kitchen.png)))), '"',
      '}'
    ));

    return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(metadata))));
  }

  /**
   * Generates an SVG by composing kitchen PNG, this has better OpenSea support
   * @param png - The png to add
   * @return A valid SVG string of the kitchen
   */
  function drawSVG(bytes memory png) private pure returns (string memory) {
    return string(abi.encodePacked(
        '<svg id="kitchen" width="100%" height="100%" version="1.1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
          '<image x="0" y="0" width="100" height="100" image-rendering="pixelated" preserveAspectRatio="xMidYMid" xlink:href="data:image/png;base64,',
            png,
          '"/>',
        "</svg>"
      ));
  }

  /**
   * Used by admin to upload the kitchen images
   * @param imageIndex - The index at which to upload the image
   * @param kitchen - The base64 encoded PNG for that kitchen
   */
  function uploadImage(uint256 imageIndex, KitchenData calldata kitchen) external onlyOwner {
    kitchenData[imageIndex] = KitchenData(
      kitchen.name,
      kitchen.png
    );
  }
}
