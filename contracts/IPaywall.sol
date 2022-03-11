// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPaywall {
  function handle(address sender, uint8 amount, uint256 msgValue, uint16 minted, uint256 maxTokens, uint256 gen0Tokens) external;
}
