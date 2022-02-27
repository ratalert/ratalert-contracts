// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IMint {
  struct VRFStruct { // Struct to store mint requests
    uint256 requestId;
    address sender;
    uint8 amount;
    bool stake;
  }

  event Transfer(address indexed from, address indexed to, uint256 indexed tokenId); // Proxied from Character > ERC721Upgradeable

  function requestRandomness(address sender, uint8 amount, bool stake) external returns (uint256 requestId);
}
