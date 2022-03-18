// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IMint {
  struct VRFStruct { // Struct to store mint requests
    bytes32 requestId;
    address sender;
    uint8 amount;
    bool stake;
  }

  event Transfer(address indexed from, address indexed to, uint256 indexed tokenId); // Proxied from Character > ERC721Upgradeable

  function requestRandomNumber(address sender, uint8 amount, bool stake) external returns (bytes32 requestId);
  function getVrfRequest(bytes32 requestId) external view returns(VRFStruct memory);
}
