// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol";

contract VRFCoordinatorMock is VRFCoordinatorV2Mock {
  constructor(uint96 _baseFee, uint96 _gasPriceLink) VRFCoordinatorV2Mock(_baseFee, _gasPriceLink) {}

// TODO Implement a synchronous override for local testing without callback
//  function mockRandomWords(uint256 numWords) internal view returns (uint256[] memory) {
//    uint256[] memory words = new uint256[](numWords);
//    for (uint i = 0; i < numWords; i++) {
//      words[i] = uint256(keccak256(abi.encodePacked(
//          tx.origin,
//          blockhash(block.number - 1),
//          block.timestamp,
//          block.difficulty,
//          numWords,
//          i
//        )));
//    }
//    return words;
//  }
}
