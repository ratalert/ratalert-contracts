// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./ControllableUpgradeable.sol";
import "./FastFood.sol";

contract Paywall is Initializable, OwnableUpgradeable, ControllableUpgradeable {
  uint256 public mintPrice;
  int8 public whitelistBoost;
  uint8 public maxMintsPerTx; // Maximum number of tokens that can be minted in a single tx
  uint256 public gen1PriceTier0;
  uint256 public gen1PriceTier1;
  uint256 public gen1PriceTier2;
  uint256 public gen1PriceTier3;
  mapping(address => uint8) public whitelist; // Mapping from address to a number of remaining whitelist spots
  mapping(address => uint8) public freeMints; // Mapping from address to a number of remaining free mint spots
  bool public onlyWhitelist; // Whether minting is only open for whitelisted addresses

  FastFood fastFood; // Reference to the $FFOOD contract

  event UpdateWhitelist(address account, uint8 amount);
  event UpdateFreeMints(address account, uint8 amount);

  function initialize(address _fastFood) external initializer {
    __Ownable_init();

    fastFood = FastFood(_fastFood);
    onlyWhitelist = false;
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(uint256 _mintPrice, int8 _whitelistBoost, uint8 _maxMintsPerTx, uint256[] memory _gen1Prices) external onlyOwner {
    mintPrice = _mintPrice;
    whitelistBoost = _whitelistBoost;
    maxMintsPerTx = _maxMintsPerTx;
    gen1PriceTier0 = _gen1Prices[0];
    gen1PriceTier1 = _gen1Prices[1];
    gen1PriceTier2 = _gen1Prices[2];
    gen1PriceTier3 = _gen1Prices[3];
  }

  /**
   * Toggles the whitelist on and off
   * @param _enable - true enables it
   */
  function toggleWhitelist(bool _enable) external onlyOwner {
    onlyWhitelist = _enable;
  }

  /**
   * Adds a list of addresses to the whitelist
   * @param addresses - An array of addresses to add
   */
  function addToWhitelist(address[] memory addresses) external onlyOwner {
    for (uint i = 0; i < addresses.length; i++) {
      uint8 amount = whitelist[addresses[i]];
      whitelist[addresses[i]] = amount < 100 ? amount + 1 : 100;
      emit UpdateWhitelist(addresses[i], whitelist[addresses[i]]);
    }
  }

  /**
   * Removes a list of addresses from the whitelist
   * @param addresses - An array of addresses to remove
   */
  function removeFromWhitelist(address[] memory addresses) external onlyOwner {
    for (uint i = 0; i < addresses.length; i++) {
      uint8 amount = whitelist[addresses[i]];
      whitelist[addresses[i]] = amount > 1 ? amount - 1 : 0;
      emit UpdateWhitelist(addresses[i], whitelist[addresses[i]]);
    }
  }

  /**
   * Adds a list of addresses to the free mints
   * @param addresses - An array of addresses to add
   */
  function addToFreeMints(address[] memory addresses) external onlyOwner {
    for (uint i = 0; i < addresses.length; i++) {
      uint8 amount = freeMints[addresses[i]];
      freeMints[addresses[i]] = amount < 100 ? amount + 1 : 100;
      emit UpdateFreeMints(addresses[i], freeMints[addresses[i]]);
    }
  }

  /**
   * Removes a list of addresses from the free mints
   * @param addresses - An array of addresses to remove
   */
  function removeFromFreeMints(address[] memory addresses) external onlyOwner {
    for (uint i = 0; i < addresses.length; i++) {
      uint8 amount = freeMints[addresses[i]];
      freeMints[addresses[i]] = amount > 1 ? amount - 1 : 0;
      emit UpdateFreeMints(addresses[i], freeMints[addresses[i]]);
    }
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
   * @return boost - Boost percentage if the token was minted using a whitelist spot
   */
  function handle(address sender, uint8 amount, uint256 msgValue, uint16 minted, uint256 maxTokens, uint256 gen0Tokens) external onlyController returns (int8 boost) {
    require(amount > 0 && amount <= maxMintsPerTx, "Invalid mint amount");
    require(minted + amount <= maxTokens, "All tokens minted");
    boost = 0;
    uint256 txMintPrice = mintPrice;
    if (onlyWhitelist) {
      require(freeMints[sender] >= amount || whitelist[sender] >= amount, "Not whitelisted");
    }
    if (freeMints[sender] >= amount) {
      freeMints[sender] -= amount;
      emit UpdateFreeMints(sender, freeMints[sender]);
      txMintPrice = 0;
    } else if (whitelist[sender] >= amount) {
      whitelist[sender] -= amount;
      emit UpdateWhitelist(sender, whitelist[sender]);
      txMintPrice = mintPrice * 90 / 100;
      boost = whitelistBoost;
    }
    uint256 totalCost = 0;
    if (minted < gen0Tokens) {
      require(minted + amount <= gen0Tokens, "Not enough Gen 0 tokens left, reduce amount");
      require(amount * txMintPrice == msgValue, "Invalid payment amount");
    } else {
      require(msgValue == 0, "Invalid payment type, accepting food tokens only");
      for (uint i = 1; i <= amount; i++) {
        totalCost += mintCost(minted + i, maxTokens, gen0Tokens);
      }
    }
    if (totalCost > 0) fastFood.burn(sender, totalCost);
  }

  /**
   * Returns the latest mint price for the given token using 5 price breaks
   * @param tokenId - The token ID to check
   * @param maxTokens - The total supply of tokens
   * @param gen0Tokens - The supply of Gen0 tokens
   * @return The minting cost of the given ID
   */
  function mintCost(uint256 tokenId, uint256 maxTokens, uint256 gen0Tokens) public view returns (uint256) {
    if (tokenId <= gen0Tokens) return 0;
    if (tokenId <= maxTokens * 2 / 5) return gen1PriceTier0;
    if (tokenId <= maxTokens * 3 / 5) return gen1PriceTier1;
    if (tokenId <= maxTokens * 4 / 5) return gen1PriceTier2;
    return gen1PriceTier3;
  }
}
