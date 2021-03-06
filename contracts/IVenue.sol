// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IClaim.sol";

interface IVenue {
  function stakeMany(address account, uint16[] calldata tokenIds) external;
  function claimMany(uint16[] calldata tokenIds, bool unstake) external payable;
  function fulfillClaimMany(IClaim.VRFStruct memory v, uint256 randomVal) external;
  function getChefsStaked(address account) external view returns (uint256);
}
