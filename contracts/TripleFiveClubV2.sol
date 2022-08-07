// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./VenueV2.sol";
import "./DAOGourmetFood.sol";

contract TripleFiveClubV2 is VenueV2 {
  event StakedGen1(uint256 value);

  uint256[] public stakedGen1; // Maps generation (0 | 1) to array of Character IDs
  int8 boostLevel;
  uint256 entranceFeeGen0;
  uint256 entranceFeeGen1;
  uint256 weekModuloStart;
  uint256 weekModuloEnd;
  uint256 maxConcurrentGen1;
  DAOGourmetFood gourmetFood; // Reference to the $GFOOD contract

  function initialize(
    address _character,
    address _claim,
    address _gourmetFood
  ) external initializer {
    __Ownable_init();
    __Pausable_init();

    character = CharacterV2(_character);
    claim = IClaim(_claim);
    gourmetFood = DAOGourmetFood(_gourmetFood);
  }

  /**
   * Allows DAO to update game parameters
   */
  function configure(
    uint256 _vestingPeriod,
    uint256 _accrualPeriod,
    int8 _dailyFreakRate,
    int8 _dailyBodyMassRate,
    int8 _boostLevel,
    uint256[] memory _entranceFees,
    uint256[] memory _weekModulo,
    uint256 _maxConcurrentGen1,
    uint8 _maxClaimsPerTx,
    uint256 _claimFee
  ) external onlyOwner {
    vestingPeriod = _vestingPeriod;
    accrualPeriod = _accrualPeriod;
    dailyFreakRate = _dailyFreakRate;
    dailyBodyMassRate = _dailyBodyMassRate;
    boostLevel = _boostLevel;
    entranceFeeGen0 = _entranceFees[0];
    entranceFeeGen1 = _entranceFees[1];
    weekModuloStart = _weekModulo[0];
    weekModuloEnd = _weekModulo[1];
    maxConcurrentGen1 = _maxConcurrentGen1;
    maxClaimsPerTx = _maxClaimsPerTx;
    claimFee = _claimFee;
  }

  /**
   * Checks if the token is Generation 0
   * @param tokenId - The ID of the token to check
   * @return true if it's a Gen0 token
   */
  function _isGen0(uint256 tokenId) internal view returns(bool) {
    return tokenId <= character.getGen0Tokens();
  }

  /**
   * Checks if we are within an open door period
   * @return true during open door periods
   */
  function isOpenForPublic() public view returns(bool) {
    uint256 weekModulo = block.timestamp % 604800;
    return weekModulo >= weekModuloStart && weekModulo < weekModuloEnd; // All UTC period long...
  }

  /**
   * Find and remove the token ID from the stakedGen1 array
   * @param tokenId - The ID of the token
   */
  function _removeFromGen1(uint256 tokenId) internal {
    for (uint i = 0; i < stakedGen1.length; i++) {
      if (stakedGen1[i] == tokenId) {
        stakedGen1[i] = stakedGen1[stakedGen1.length - 1];
        stakedGen1.pop();
      }
    }
    emit StakedGen1(stakedGen1.length);
  }

  /**
   * Eject a particular Gen1 token ID if it has reached its vesting period
   * @param tokenId - The ID of the token
   * @param unstake - If true, user intends to unstake or gets force ejected
   * @return Updated unstake value
   */
  function _ejectIfVested(uint256 tokenId, bool unstake) internal returns (bool) {
    Stake memory stake = isChef(tokenId) ? chefs[tokenId] : rats[tokenId];
    if (!_isGen0(tokenId) && (unstake || block.timestamp - stake.timestamp >= vestingPeriod)) {
      unstake = true;
      _removeFromGen1(tokenId);
    }
    return unstake;
  }

  /**
   * Make room for other Gen1s by ejecting all Gen1 tokens that have reached their vesting period
   * @param ids - The IDs of the tokens in question
   * @param forceEject - If true, the vesting period is disregarded (used by DAO)
   *
   */
  function _ejectMultiIfVested(uint256[] memory ids, bool forceEject) internal {
    for (uint i = 0; i < ids.length; i++) {
      bool unstake = _ejectIfVested(ids[i], forceEject);
      if (unstake || forceEject) {
        Stake memory stake = isChef(ids[i]) ? chefs[ids[i]] : rats[ids[i]];
        if (isChef(ids[i])) {
          _claimChef(ids[i], stake.owner, true, false, 0);
        } else {
          _claimRat(ids[i], stake.owner, true, false, 0);
        }
      }
    }
  }

  /**
   * DAO function to force-unstake all tokens and send them back to their respective owners
   * @param ids - The IDs of the tokens to force-unstake
   */
  function multiEject(uint256[] memory ids) external onlyDao {
    _ejectMultiIfVested(ids, true);
  }

  /**
   * Return the amount of Gen1 tokens in staking
   * @return Number of Gen1 tokens staked
   */
  function getStakedGen1() external view returns(uint256) {
    return stakedGen1.length;
  }

  /**
   * Handle Gen1 restrictions & entry fee token burn
   * @param tokenId - The ID of the Character
   */
  function _handleGen1(uint256 tokenId) internal {
    _ejectMultiIfVested(stakedGen1, false);
    bool gen0 = _isGen0(tokenId);
    if (!gen0) {
      require(isOpenForPublic(), "Gen0 only");
      require(stakedGen1.length < maxConcurrentGen1, "Gen1 limit reached");
      stakedGen1.push(tokenId);
      emit StakedGen1(stakedGen1.length);
    }
    gourmetFood.burn(_msgSender(), gen0 ? entranceFeeGen0 : entranceFeeGen1);
  }

  /**
   * Override Venue._stakeChef() to handle Gen1 logic & populate stakedGen1[]
   */
  function _stakeChef(address account, uint256 tokenId) internal override whenNotPaused {
    _handleGen1(tokenId);
    return super._stakeChef(account, tokenId);
  }

  /**
   * Override Venue._stakeRat() to handle Gen1 logic & populate stakedGen1[]
   */
  function _stakeRat(address account, uint256 tokenId) internal override whenNotPaused {
    _handleGen1(tokenId);
    return super._stakeRat(account, tokenId);
  }

  /**
   * Override Venue._claimChef() to clean up stakedGen1[]
   */
  function _claimChef(uint256 tokenId, address sender, bool unstake, bool noEarnings, uint256 randomVal) internal override returns (uint256 owed) {
    unstake = _ejectIfVested(tokenId, unstake);
    return super._claimChef(tokenId, sender, unstake, noEarnings, randomVal);
  }

  /**
   * Override Venue._claimRat() to clean up stakedGen1[]
   */
  function _claimRat(uint256 tokenId, address sender, bool unstake, bool noEarnings, uint256 randomVal) internal override returns (uint256 owed) {
    unstake = _ejectIfVested(tokenId, unstake);
    return super._claimRat(tokenId, sender, unstake, noEarnings, randomVal);
  }

  /**
   * Override Venue._updateCharacter() to update the Character's boost level
   */
  function _updateCharacter(uint256 tokenId, uint256 randomVal) internal override returns(uint8 efficiency, uint8 tolerance, string memory eventName) {
    if (_isGen0(tokenId)) {
      character.updateBoost(tokenId, boostLevel);
    }
    return super._updateCharacter(tokenId, randomVal);
  }
}
