// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./ControllableUpgradeable.sol";
import "./VRFConsumer.sol";
import "./IClaim.sol";
import "./IVenue.sol";

contract Claim is Initializable, OwnableUpgradeable, IClaim, VRFConsumer, ControllableUpgradeable {
  mapping(address => IVenue) venues; // Mapping from an address to a reference to the Venue
  bytes32 internal keyHash;
  uint256 internal fee;
  mapping(bytes32 => VRFStruct) public vrfRequests; // Mapping from tokenId to a struct containing the token's traits

  event RandomNumberRequested(
    bytes32 requestId,
    address sender
  );

  function initialize(
    address _vrfCoordinator,
    address _link,
    bytes32 _keyHash,
    uint256 _fee
  ) external initializer {
    __Ownable_init();

    vrfCoordinator = _vrfCoordinator;
    link = LinkTokenInterface(_link);
    keyHash = _keyHash;
    fee = _fee;
  }

  /**
   * Set ChainLink VRF params
   */
  function setVrfParams(
    address _vrfCoordinator,
    address _link,
    bytes32 _keyHash,
    uint256 _fee
  ) external onlyOwner {
    vrfCoordinator = _vrfCoordinator;
    link = LinkTokenInterface(_link);
    keyHash = _keyHash;
    fee = _fee;
  }

  function requestRandomNumber(address sender, uint16[] memory tokenIds, bool unstake) external onlyController returns (bytes32 requestId) {
    require(link.balanceOf(address(this)) >= fee, "Insufficient LINK");
    requestId = requestRandomness(keyHash, fee);
    VRFStruct memory v = VRFStruct({ requestId: requestId, venue: _msgSender(), sender: sender, tokenIds: tokenIds, unstake: unstake });
    vrfRequests[requestId] = v;
    emit RandomNumberRequested(
      requestId,
      _msgSender()
    );
  }

  function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
    VRFStruct memory v = vrfRequests[requestId];
    require(v.requestId != 0, "VRF request ID not found");
    venues[v.venue].fulfillClaimMany(vrfRequests[requestId], randomness);
    delete vrfRequests[requestId];
  }

  /**
   * Enables a venue address to fulfill claims
   * @param _venue - The address to enable
   */
  function addVenue(address _venue) external onlyOwner {
    venues[_venue] = IVenue(_venue);
  }

  /**
   * Disables a venue address from fulfilling claims
   * @param _venue the address to disable
   */
  function removeVenue(address _venue) external onlyOwner {
    delete venues[_venue];
  }
}