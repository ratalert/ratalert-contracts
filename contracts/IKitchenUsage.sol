// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IKitchenUsage {
  struct Stake { // Store for a kitchen's staking position
    address owner;
    uint8 kitchenId;
    uint256 amount;
    uint80 timestamp;
  }

  function stake(address account, uint8 kitchenId, uint256 amount) external;
  function claim(address account, uint8 kitchenId, uint256 amount) external;
  function spaceInStaking(address account, uint8 kitchenId) external view returns (uint256);
  function spaceInWallet(address account, uint8 kitchenId) external view returns (uint256);
  function checkSpace(address account, uint8 kitchenId, uint256 spaceUsed) external view returns (int256);
}
