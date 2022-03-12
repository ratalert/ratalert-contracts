// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LinkTokenMock is ERC20 {
  constructor() ERC20("ChainLink Token", "LINK") {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function transferAndCall(address _to, uint _value, bytes memory) public returns (bool success) {
    return transfer(_to, _value);
  }
}
