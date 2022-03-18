// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IMint.sol";

interface ICharacter {
  struct CharacterStruct { // Struct to store each token's traits
    bool isChef;
    uint8 hat;
    uint8 eyes;
    uint8 piercing;
    uint8 mouth;
    uint8 neck;
    uint8 hand;
    uint8 tail;
    uint8 efficiency;
    uint8 tolerance;
  }
  struct Prop {
    string name;
    int8 value;
  }

  function mint(uint8 amount, bool stake) external payable;
  function getGen0Tokens() external view returns (uint256);
  function getTokenTraits(uint256 tokenId) external view returns (CharacterStruct memory);
  function fulfillMint(bytes32 requestId, CharacterStruct[] memory tokens) external;
}
