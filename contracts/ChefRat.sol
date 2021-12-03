// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "./IChefRat.sol";

contract ChefRat is IChefRat, Initializable, OwnableUpgradeable, PausableUpgradeable, ERC721Upgradeable {
  uint16 public minted;
  uint256 public constant MINT_PRICE = .1 ether;
//  uint256 public constant CHEF = 0;
//  uint256 public constant RAT = 1;

  event NFTMinted(uint256 tokenId, address owner, uint256 value);

  function initialize() external initializer {
    __Ownable_init();
    __Pausable_init();
    __ERC721_init("Rat Alert Chefs & Rats", "RATS");

    minted = 0;
  }

  /**
   * Mints a new ERC721 token: 90% chefs, 10% rats
   * The first 20% are free to claim, the remaining cost $FFOOD
   * @param amount Number of tokens to mint
   */
  function mint(uint8 amount) external payable whenNotPaused {
    require(amount > 0 && amount <= 10, "Invalid mint amount");
    // require(amount * MINT_PRICE == msg.value, "Invalid payment amount" + amount, amount);

    uint16[] memory tokenIds = new uint16[](amount);
    for (uint i = 0; i < amount; i++) {
      minted++;
      _safeMint(_msgSender(), minted);
      tokenIds[i] = minted;
      emit NFTMinted(minted, _msgSender(), block.timestamp);

    }
  }
}
