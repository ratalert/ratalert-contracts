// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IChefRat {
  struct ChefRatStruct { // Struct to store each token's traits
    bool isChef;
    uint8 body;
    uint8 head;
    uint8 ears;
    uint8 eyes;
    uint8 nose;
    uint8 mouth;
    uint8 neck;
    uint8 feet;
  }

  function mint(uint8 amount) external payable;
  function getPaidTokens() external view returns (uint256);
  function getTokenTraits(uint256 tokenId) external view returns (ChefRatStruct memory);
}
