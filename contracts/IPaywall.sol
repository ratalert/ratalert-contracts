// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPaywall {
  function toggleWhitelist(bool _enable) external;
  function addToWhitelist(address[] memory addresses) external;
  function removeFromWhitelist(address[] memory addresses) external;
  function addToFreeMints(address[] memory addresses) external;
  function handle(address sender, uint8 amount, uint256 msgValue, uint16 minted, uint256 maxTokens, uint256 gen0Tokens) external;
}
