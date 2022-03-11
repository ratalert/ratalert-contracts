// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "./ControllableUpgradeable.sol";
import "./FastFood.sol";

contract Paywall is Initializable, OwnableUpgradeable, PausableUpgradeable, ControllableUpgradeable {
  uint256 public mintPrice;
  mapping(address => uint8) public whitelist; // Mapping from address to a number of remaining whitelist spots
  bool public onlyWhitelist; // Whether minting is only open for whitelisted addresses

  FastFood fastFood; // Reference to the $FFOOD contract

  function initialize(address _fastFood, uint256 _mintPrice) external initializer {
    __Ownable_init();
    __Pausable_init();

    fastFood = FastFood(_fastFood);
    mintPrice = _mintPrice;
  }

  /**
   * ChainLink VRF request: Mints a new ERC721 token: 90% chefs, 10% rats
   * The first 20% are free to claim, the remaining cost $FFOOD
   * @param sender - User wallet address
   * @param amount - Number of tokens to mint
   * @param msgValue - Value sent with the transaction
   * @param minted - Number of total tokens minted
   * @param maxTokens - Max number of tokens that can be minted
   * @param gen0Tokens - Number of tokens that can be claimed for free
   */
  function handle(address sender, uint8 amount, uint256 msgValue, uint16 minted, uint256 maxTokens, uint256 gen0Tokens) external onlyController {
    require(amount > 0 && amount <= 10, "Invalid mint amount");
    require(minted + amount <= maxTokens, "All tokens minted");
    uint256 totalCost = 0;
    if (minted < gen0Tokens) {
      require(minted + amount <= gen0Tokens, "Not enough Gen 0 tokens left, reduce amount");
      require(amount * mintPrice == msgValue, "Invalid payment amount");
    } else {
      require(msgValue == 0, "Invalid payment type, accepting food tokens only");
      for (uint i = 1; i <= amount; i++) {
        totalCost += mintCost(minted + i, maxTokens, gen0Tokens);
      }
    }
    if (totalCost > 0) fastFood.burn(sender, totalCost);
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
  function mintCost(uint256 tokenId, uint256 maxTokens, uint256 gen0Tokens) public pure returns (uint256) {
    if (tokenId <= gen0Tokens) return 0;
    if (tokenId <= maxTokens * 2 / 5) return 1000 ether;
    if (tokenId <= maxTokens * 3 / 5) return 1500 ether;
    if (tokenId <= maxTokens * 4 / 5) return 2000 ether;
    return 3000 ether;
  }

  /**
   * Adds a list of addresses to the whitelist
   * @param addresses - An array of addresses to add
   */
  function addToWhitelist(address[] memory addresses) external onlyOwner {
    for (uint i = 0; i < addresses.length; i++) {
      uint8 amount = whitelist[addresses[i]];
      whitelist[addresses[i]] = amount + 1 > 250 ? 250 : amount + 1;
    }
  }

  /**
   * Remove a list of addresses from the whitelist
   * @param addresses - An array of addresses to remove
   */
  function removeFromWhitelist(address[] memory addresses) external onlyOwner {
    for (uint i = 0; i < addresses.length; i++) {
      uint8 amount = whitelist[addresses[i]];
      whitelist[addresses[i]] = amount - 1 < 0 ? 0 : amount - 1;
    }
  }
}
