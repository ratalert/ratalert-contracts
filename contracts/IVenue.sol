// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVenue {
  function stakeMany(address account, uint16[] calldata tokenIds) external;
}
