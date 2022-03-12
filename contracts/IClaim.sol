// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IClaim {
  struct VRFStruct { // Struct to store mint requests
    bytes32 requestId;
    address venue;
    address sender;
    uint16[] tokenIds;
    bool unstake;
  }

  function requestRandomNumber(address sender, uint16[] calldata tokenIds, bool unstake) external returns (bytes32 requestId);
}
