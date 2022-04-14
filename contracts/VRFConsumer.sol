// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/VRFRequestIDBase.sol";
import "./DOWable.sol";

abstract contract VRFConsumer is Initializable, VRFRequestIDBase, DOWable {
  LinkTokenInterface internal link;
  address vrfCoordinator;

  mapping(bytes32 => uint256) // keyHash > nonce
  private nonces;

  /**
   * @param _vrfCoordinator - Address of VRFCoordinator contract
   */
  function initialize(address _vrfCoordinator, address _link) external initializer virtual {
    vrfCoordinator = _vrfCoordinator;
    link = LinkTokenInterface(_link);
  }

  /**
   * Internal function that gets implemented in  Mint & Claim contracts
   * @param requestId - The Id initially returned by requestRandomness
   * @param randomness - The VRF output
   */
  function fulfillRandomness(bytes32 requestId, uint256 randomness) internal virtual;

  uint256 private constant USER_SEED_PLACEHOLDER = 0;

  /**
   * Internal function that is used by Mint & Claim contracts
   * @param _keyHash ID of public key against which randomness is generated
   * @param _fee The amount of LINK to send with the request
   * @return requestId unique ID for this request
   */
  function requestRandomness(bytes32 _keyHash, uint256 _fee) internal returns (bytes32 requestId) {
    link.transferAndCall(vrfCoordinator, _fee, abi.encode(_keyHash, USER_SEED_PLACEHOLDER));
    uint256 vRFSeed = makeVRFInputSeed(_keyHash, USER_SEED_PLACEHOLDER, address(this), nonces[_keyHash]);
    nonces[_keyHash] = nonces[_keyHash] + 1;
    return makeRequestId(_keyHash, vRFSeed);
  }

  /**
   * Callback function used by ChainLink
   * @param requestId - Unique ID for this request
   * @param randomness - The VRF output
   */
  function rawFulfillRandomness(bytes32 requestId, uint256 randomness) external {
    require(msg.sender == vrfCoordinator, "Only VRFCoordinator can fulfill");
    fulfillRandomness(requestId, randomness);
  }

  /**
   * Sends the given LINK amount back to the owner
   * @param amount - Amount of LINK to send
   * @return success - Whether the transaction succeeded
   */
  function withdrawLink(uint amount) external onlyDao returns(bool success) {
    return link.transfer(tx.origin, amount);
  }
}
