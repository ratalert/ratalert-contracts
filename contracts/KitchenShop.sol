// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./GenericPausable.sol";
import "./FastFood.sol";
import "./CasualFood.sol";
import "./Character.sol";

contract KitchenShop is Initializable, OwnableUpgradeable, GenericPausable, ERC1155Upgradeable {
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
   * Mints new ERC1155 token(s) of a kitchen
   * @param amount Number of tokens to mint
   */
  function mint(uint8 kitchen, uint8 amount) external payable whenNotPaused {
    require(tx.origin == _msgSender(), "EOA only");
    require(kitchen > 0 && kitchen <= 2, "Invalid kitchen");
    require(amount > 0 && amount <= maxMintsPerTx, "Invalid mint amount");
    require(minted[kitchen] + amount <= maxTokens[kitchen], "All tokens minted");
    require(msg.value == 0, "Invalid payment type");

    uint256 totalCost = 0;
    for (uint i = 0; i < amount; i++) {
      minted[kitchen] ++;
      totalCost += mintCost(kitchen, minted[kitchen]);
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
   *    1 - 1000: 2000 $FFOOD
   * 1001 - 2000: 3000 $FFOOD
   * 2001 - 3000: 4000 $FFOOD
   * 3001 - 4000: 5000 $FFOOD
   * 4001 - 5000: 6000 $FFOOD
   * @param tokenId - The token ID to check
   * @return The minting cost of the given ID
   */
  function mintCost(uint8 kitchen, uint256 tokenId) public view returns (uint256) {
    if (tokenId <= maxTokens[kitchen] * 1 / 5) return priceTier0;
    if (tokenId <= maxTokens[kitchen] * 2 / 5) return priceTier1;
    if (tokenId <= maxTokens[kitchen] * 3 / 5) return priceTier2;
    if (tokenId <= maxTokens[kitchen] * 4 / 5) return priceTier3;
    return priceTier4;
  }

  function uri(uint256 tokenId) public view override returns (string memory) {
    require(tokenId > 0 && tokenId <= 2, "ERC1155Metadata: URI query for non-existent token");
    KitchenData memory kitchen = kitchenData[tokenId - 1];

    string memory metadata = string(abi.encodePacked(
      '{',
        '"name":"', kitchen.name, '",',
        '"description":"RatAlert, the NFT game that lets you Train2Earn your characters on-chain for higher rewards! https://ratalert.com/",',
        '"external_url":"https://ratalert.com/kitchens/', tokenId.toString(), '",',
        '"image":"data:image/png;base64,', bytes(kitchen.png), '"',
      '}'
    ));

    return string(abi.encodePacked("data:application/json;base64,", base64(bytes(metadata))));
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

  /** BASE 64 - Written by Brech Devos */
  string internal constant TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64(bytes memory data) internal pure returns (string memory) {
    if (data.length == 0) return '';
    string memory table = TABLE; // load the table into memory
    uint256 encodedLen = 4 * ((data.length + 2) / 3); // multiply by 4/3 rounded up
    string memory result = new string(encodedLen + 32); // add some extra buffer at the end required for the writing
    assembly {
      mstore(result, encodedLen) // set the actual output length
      let tablePtr := add(table, 1) // prepare the lookup table
      let dataPtr := data // input ptr
      let endPtr := add(dataPtr, mload(data))
      let resultPtr := add(result, 32) // result ptr, jump over length
      for {} lt(dataPtr, endPtr) {} // run over the input, 3 bytes at a time
      {
        dataPtr := add(dataPtr, 3)
        let input := mload(dataPtr) // read 3 bytes
        // write 4 characters
        mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(18, input), 0x3F)))))
        resultPtr := add(resultPtr, 1)
        mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(12, input), 0x3F)))))
        resultPtr := add(resultPtr, 1)
        mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr( 6, input), 0x3F)))))
        resultPtr := add(resultPtr, 1)
        mstore(resultPtr, shl(248, mload(add(tablePtr, and(        input,  0x3F)))))
        resultPtr := add(resultPtr, 1)
      }
      // padding with '='
      switch mod(mload(data), 3)
      case 1 { mstore(sub(resultPtr, 2), shl(240, 0x3d3d)) }
      case 2 { mstore(sub(resultPtr, 1), shl(248, 0x3d)) }
    }
    return result;
  }
}
