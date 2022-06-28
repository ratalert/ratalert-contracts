// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./VenueV2.sol";
import "./GourmetFood.sol";

contract TripleFiveClub is VenueV2 {
  event StakedGen1(uint256 value);

  uint256[] public stakedGen1; // Maps generation (0 | 1) to array of Character IDs
  int8 boostLevel;
  uint256 entranceFeeGen0;
  uint256 entranceFeeGen1;
  uint256 maxConcurrentGen1;
  GourmetFood gourmetFood; // Reference to the $GFOOD contract

  function initialize(
    address _character,
    address _claim,
    address _gourmetFood
  ) external initializer {
    __Ownable_init();
    __Pausable_init();

    character = CharacterV2(_character);
    claim = IClaim(_claim);
    gourmetFood = GourmetFood(_gourmetFood);
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
    uint256 _entranceFeeGen0,
    uint256 _entranceFeeGen1,
    uint256 _maxConcurrentGen1,
    uint8 _maxClaimsPerTx,
    uint256 _claimFee
  ) external onlyOwner {
    vestingPeriod = _vestingPeriod;
    accrualPeriod = _accrualPeriod;
    dailyFreakRate = _dailyFreakRate;
    dailyBodyMassRate = _dailyBodyMassRate;
    boostLevel = _boostLevel;
    entranceFeeGen0 = _entranceFeeGen0;
    entranceFeeGen1 = _entranceFeeGen1;
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
  function _isOpenForPublic() internal view returns(bool) {
    uint256 weekModulo = block.timestamp % 604800;
    return weekModulo >= 259200 && weekModulo < 345600; // All Sunday long (UTC)
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
   * Make room for other Gen1s by ejecting all Gen1 tokens that have reached their vesting period
   * @param ids - The IDs of the tokens in question
   * @param overrideVesting - If true, the vesting period is disregarded (used by DAO)
   *
   */
  function _ejectIfVested(uint256[] memory ids, bool overrideVesting) internal {
    for (uint i = 0; i < ids.length; i++) {
      Stake memory stake = isChef(ids[i]) ? chefs[ids[i]] : rats[ids[i]];
      if (block.timestamp - stake.timestamp >= vestingPeriod || overrideVesting) {
        if (isChef(ids[i])) {
          _claimChef(ids[i], stake.owner, true, false, 0);
        } else {
          _claimRat(ids[i], stake.owner, true, false, 0);
        }
        _removeFromGen1(ids[i]);
      }
    }
  }

  /**
   * DAO function to force-unstake all tokens and send them back to their respective owners
   * @param ids - The IDs of the tokens to force-unstake
   */
  function multiEject(uint256[] memory ids) external onlyDao {
    _ejectIfVested(ids, true);
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
    _ejectIfVested(stakedGen1, false);
    if (!_isGen0(tokenId)) {
      require(_isOpenForPublic(), "Gen0 only");
      require(stakedGen1.length < maxConcurrentGen1, "Gen1 limit reached");
      stakedGen1.push(tokenId);
      emit StakedGen1(stakedGen1.length);
    }
    gourmetFood.burn(_msgSender(), _isGen0(tokenId) ? entranceFeeGen0 : entranceFeeGen1);
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
    _removeFromGen1(tokenId);
    return super._claimChef(tokenId, sender, unstake, noEarnings, randomVal);
  }

  /**
   * Override Venue._claimRat() to clean up stakedGen1[]
   */
  function _claimRat(uint256 tokenId, address sender, bool unstake, bool noEarnings, uint256 randomVal) internal override returns (uint256 owed) {
    _removeFromGen1(tokenId);
    return super._claimRat(tokenId, sender, unstake, noEarnings, randomVal);
  }

  /**
   * Override Venue._updateCharacter() to update the Character's boost level
   */
  function _updateCharacter(uint256 tokenId, uint256 randomVal) internal override returns(uint8 efficiency, uint8 tolerance, string memory eventName) {
    (, , , , , , , , , , int8 boost) = character.tokenTraits(tokenId);
    if (tokenId <= character.getGen0Tokens() && boost != boostLevel) {
      character.updateBoost(tokenId, boostLevel);
    }
    return super._updateCharacter(tokenId, randomVal);
  }
}
