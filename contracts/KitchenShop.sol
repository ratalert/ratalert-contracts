// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "./FastFood.sol";
import "./CasualFood.sol";
import "./Character.sol";

contract KitchenShop is Initializable, OwnableUpgradeable, PausableUpgradeable, ERC1155Upgradeable {
  FastFood fastFood; // Reference to the $FFOOD contract
  CasualFood casualFood; // Reference to the $CFOOD contract
  Character character; // Reference to the Character contract

  mapping (uint8 => uint256) public maxTokens;
  mapping (uint8 => uint256) public minSkill;
  mapping (uint8 => uint256) public minted;

  function initialize(address _fastFood, address _casualFood, address _character, uint256[] memory _maxTokens, uint8[] memory _minSkill) external initializer {
    __Ownable_init();
    __Pausable_init();
    // TODO similar to __ERC721_init("RatAlert Characters", "RATCHAR"); or _setURI(string newuri)?

    fastFood = FastFood(_fastFood);
    casualFood = CasualFood(_casualFood);
    character = Character(_character);
    maxTokens[1] = _maxTokens[0];
    maxTokens[2] = _maxTokens[1];
    minSkill[1] = _minSkill[0];
    minSkill[2] = _minSkill[1];
    minted[1] = 0;
    minted[2] = 0;
  }

  /**
   * Mints new ERC1155 token(s) of a kitchen
   * @param amount Number of tokens to mint
   */
  function mint(uint8 kitchen, uint8 amount) external payable whenNotPaused {
    require(tx.origin == _msgSender(), "EOA only");
    require(kitchen > 0 && kitchen <= 2, "Invalid kitchen");
    require(amount > 0 && amount <= 10, "Invalid mint amount");
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
    if (tokenId <= maxTokens[kitchen] * 1 / 5) return 2000 ether;
    if (tokenId <= maxTokens[kitchen] * 2 / 5) return 3000 ether;
    if (tokenId <= maxTokens[kitchen] * 3 / 5) return 4000 ether;
    if (tokenId <= maxTokens[kitchen] * 4 / 5) return 5000 ether;
    return 6000 ether;
  }
}
