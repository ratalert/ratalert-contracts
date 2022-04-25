// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155ReceiverUpgradeable.sol";
import "./IKitchenUsage.sol";
import "./GenericPausable.sol";
import "./ControllableUpgradeable.sol";
import "./KitchenShop.sol";
import "./IVenue.sol";

contract KitchenUsage is IKitchenUsage, Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, GenericPausable, ControllableUpgradeable, IERC1155ReceiverUpgradeable {
  KitchenShop kitchenShop;

  event KitchenStaked(address owner, uint8 kitchenId, uint256 amount);
  event KitchenClaimed(address owner, uint8 kitchenId, uint256 amount);

  mapping(address => mapping(uint8 => Stake)) public stakers; // Maps address to a map of kitchenId to staking positions
  mapping(uint8 => uint256) public totalKitchensStaked; // Maps kitchenId to amount of kitchens staked
  mapping(uint256 => IVenue) venues; // Maps kitchenId to venue address
  uint8 public chefsPerKitchen;

  function initialize(
    address _kitchenShop
  ) external initializer {
    __Ownable_init();
    __Pausable_init();

    kitchenShop = KitchenShop(_kitchenShop);
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(uint8 _chefsPerKitchen, address[] memory _venues) external onlyOwner {
    chefsPerKitchen = _chefsPerKitchen;
    for (uint i = 0; i < _venues.length; i++) {
      venues[i + 1] = IVenue(_venues[i]);
    }
  }

  /**
   * Adds Kitchens to staking
   * @param account - User wallet address
   * @param kitchenId - The ID of the kitchen
   * @param amount - The amount of kitchens to stake
   */
  function stake(address account, uint8 kitchenId, uint256 amount) external nonReentrant whenNotPaused {
    require((tx.origin == _msgSender() && account == _msgSender()) || controllers[_msgSender()], "EOA only");
    require(kitchenShop.balanceOf(account, kitchenId) >= amount, "Insufficient tokens");
    Stake memory position = stakers[account][kitchenId];
    if (position.amount > 0) {
      stakers[account][kitchenId].amount += amount;
    } else {
      stakers[account][kitchenId] = Stake({
        owner: account,
        kitchenId: kitchenId,
        amount: amount,
        timestamp: uint80(block.timestamp)
      });
    }
    totalKitchensStaked[kitchenId] += amount;
    kitchenShop.safeTransferFrom(account, address(this), kitchenId, amount, new bytes(0));
    emit KitchenStaked(account, kitchenId, amount);
  }

  /**
   * Claims a kitchen from staking
   * @param account - User wallet address
   * @param kitchenId - The ID of the kitchen
   * @param amount - The amount of kitchens to stake
   */
  function claim(address account, uint8 kitchenId, uint256 amount) external nonReentrant whenNotPaused {
    require((tx.origin == _msgSender() && account == _msgSender()) || controllers[_msgSender()], "EOA only");
    Stake memory position = stakers[account][kitchenId];
    require(position.owner == account, "Not your token");
    require(position.amount >= amount, "Insufficient tokens");
    require(this.checkUsage(account, kitchenId, amount), "Still in use");

    totalKitchensStaked[kitchenId] -= amount;
    stakers[account][kitchenId].amount -= amount;
    if (stakers[account][kitchenId].amount == 0) {
      delete stakers[account][kitchenId];
    }

    kitchenShop.safeTransferFrom(address(this), account, kitchenId, amount, new bytes(0));
    emit KitchenClaimed(account, kitchenId, amount);
  }

  /**
   * Returns the amount of available kitchen space in wallet
   * @param account - User wallet address
   * @param kitchenId - Kitchen type
   * @return Amount of available kitchen space
   */
  function spaceInWallet(address account, uint8 kitchenId) external view returns (uint256) {
    return kitchenShop.balanceOf(account, kitchenId) * chefsPerKitchen;
  }

  /**
   * Returns the amount of available kitchen space in staking
   * @param account - User wallet address
   * @param kitchenId - Kitchen type
   * @return Amount of available kitchen space
   */
  function spaceInStaking(address account, uint8 kitchenId) external view returns (uint256) {
    return stakers[account][kitchenId].amount * chefsPerKitchen;
  }

  /**
   * Checks if there is kitchen space for the given amount of chefs (rats have no limit)
   * @param account - User wallet address
   * @param kitchenId - Kitchen type
   * @param spaceUsed - Amount of space in use by chefs
   * @return Amount of kitchen space in staking, 0 if (all is in use but) available in wallet, -1 if out of kitchen space
   */
  function checkSpace(address account, uint8 kitchenId, uint256 spaceUsed) external view returns (int256) {
    uint256 inStaking = this.spaceInStaking(account, kitchenId);
    uint256 inWallet = this.spaceInWallet(account, kitchenId);
    if (inStaking >= spaceUsed) {
      return inStaking + 1 - spaceUsed == 11 ? int256(2) : int256(1); // 1 is the minimum, additional kitchen space does not need to be staked yet
    }
    return inWallet >= spaceUsed - inStaking ? int256(0) : int256(-1);
  }

  /**
   * Checks if the staked kitchen space is sufficient for staked chefs and returns an identifier
   * @param account - User wallet address
   * @param kitchenId - Kitchen type
   * @param amountToRemove - Amount of kitchen space to remove
   * @return Whether the remaining kitchen space is sufficient
   *   -  2: Space in staking is not used at all, in fact, a kitchen could be claimed
   *   -  1: Space in staking is partially used, can not be claimed
   *   -  0: No space in staking but available in wallet
   *   - -1: No space available, neither in staking nor in wallet
   */
  function checkUsage(address account, uint8 kitchenId, uint256 amountToRemove) external view returns (bool) {
    uint256 inStaking = this.spaceInStaking(account, kitchenId);
    uint256 chefsStaked = venues[kitchenId].getChefsStaked(account);
    return inStaking - (amountToRemove * chefsPerKitchen) >= chefsStaked;
  }

  /**
   * IERC1155ReceiverUpgradeable interface: We do not accept tokens sent directly
   */
  function onERC1155Received(address operator, address, uint256, uint256, bytes calldata) external view override returns (bytes4) {
    require(operator == address(this), "Cannot send tokens directly");
    return this.onERC1155Received.selector;
  }

  /**
   * IERC1155ReceiverUpgradeable interface: We do not accept tokens sent directly
   */
  function onERC1155BatchReceived(address operator, address, uint256[] calldata, uint256[] calldata, bytes calldata) external view override returns (bytes4) {
    require(operator == address(this), "Cannot send tokens directly");
    return this.onERC1155BatchReceived.selector;
  }

  /**
   * IERC1155ReceiverUpgradeable interface: We do not support ERC165 interfaces
   */
  function supportsInterface(bytes4) external pure override returns (bool) {
    return false;
  }
}
