// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./ITraits.sol";
import "./IChefRat.sol";

contract Traits is Initializable, OwnableUpgradeable, ITraits {
  using Strings for uint256;

  struct Trait { // Struct to store each trait's data for metadata and rendering
    string name;
    string png;
  }

  string[14] _traitTypes;
  string[7] _insanity;
  string[7] _skill;
  string[7] _intelligence;
  string[7] _fatness;
  mapping(uint8 => mapping(uint8 => Trait)) public traitData; // Storage of each trait's name and base64 SVG data

  IChefRat public chefRat;

  function initialize() external initializer {
    __Ownable_init();

    _traitTypes = [ // Mapping from trait type (index) to its name
      "Ears",
      "Eyes",
      "Nose",
      "Mouth",
      "Neck",
      "Feet",
      "Skill",
      "Insanity",
      "Intelligence",
      "Fatness",
      "Skill percentage",
      "Insanity percentage",
      "Intelligence quotient",
      "Fatness percentage"
    ];
    _insanity = ["bored", "unconventional", "fancy", "brilliant", "creative genius", "guru", "insane"];
    _skill = ["anxious", "shy", "restrained", "mainstream", "confident", "proud", "unicorn"];
    _intelligence = ["braindead", "stupid", "foolish", "average", "bright", "smart", "genius"];
    _fatness = ["anorexic", "skinny", "lean", "athletic", "chubby", "fat", "obese"];
  }

  /**
   * Generates a base64 encoded metadata response without referencing off-chain content
   * @param tokenId - The ID of the token to generate the metadata for
   * @return A base64 encoded JSON dictionary of the token's metadata and SVG
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    IChefRat.ChefRatStruct memory s = chefRat.getTokenTraits(tokenId);

    string memory metadata = string(abi.encodePacked(
      '{',
      '"name":"', s.isChef ? 'Chef #' : 'Rat #', tokenId.toString(), '",',
      '"description":"TODO",', // TODO Add description
      '"image":"data:image/svg+xml;base64,', base64(bytes(drawSVG(tokenId))), '",',
      '"attributes":', getAttributes(tokenId),
      '}'
    ));

    return string(abi.encodePacked(
      "data:application/json;base64,",
      base64(bytes(metadata))
    ));
  }

  function getBodyIndex(uint8 value) internal view returns(uint8) {
    uint256 val = value * _insanity.length / 100;
    return val > _insanity.length - 1 ? uint8(_insanity.length - 1) : uint8(val);
  }

  /**
   * Generates an entire SVG by composing multiple <image> elements of PNGs
   * @param tokenId - The ID of the token to generate an SVG for
   * @return A valid SVG of the Chef / Rat
   */
  function drawSVG(uint256 tokenId) public view returns (string memory) {
    IChefRat.ChefRatStruct memory s = chefRat.getTokenTraits(tokenId);
    uint8 shift = s.isChef ? 0 : 10;
    uint8 head = getBodyIndex(s.isChef ? s.skill : s.intelligence);
    uint8 body = getBodyIndex(s.isChef ? s.insanity : s.fatness);
    string memory svgString = string(abi.encodePacked(
      drawTrait(traitData[0 + shift][body]),
      drawTrait(traitData[1 + shift][head]),
      drawTrait(traitData[2 + shift][s.ears]),
      drawTrait(traitData[3 + shift][s.eyes]),
      drawTrait(traitData[4 + shift][s.nose]),
      drawTrait(traitData[5 + shift][s.mouth]),
      drawTrait(traitData[6 + shift][s.neck]),
      drawTrait(traitData[7 + shift][s.feet])
    ));

    return string(abi.encodePacked(
      '<svg id="', s.isChef ? 'chef' : 'rat', '" width="100%" height="100%" version="1.1" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
      svgString,
      "</svg>"
    ));
  }

  /**
   * Generates an <image> element using base64 encoded PNGs
   * @param trait - The trait storing the PNG data
   * @return The <image> element
   */
  function drawTrait(Trait memory trait) internal pure returns (string memory) {
    if (bytes(trait.png).length == 0) trait.png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';
    return string(abi.encodePacked(
      '<image x="0" y="0" width="100" height="100" image-rendering="pixelated" preserveAspectRatio="xMidYMid" xlink:href="data:image/png;base64,',
      trait.png,
      '"/>'
    ));
  }

  /**
   * Generates an array composed of all the individual traits and values
   * @param tokenId - The ID of the token to compose the metadata for
   * @return A JSON array of all of the attributes for given token ID
   */
  function getAttributes(uint256 tokenId) public view returns (string memory) {
    IChefRat.ChefRatStruct memory s = chefRat.getTokenTraits(tokenId);
    string memory traits;
    if (s.isChef) {
      traits = string(abi.encodePacked(
        getAttribute(_traitTypes[0], traitData[2][s.ears].name, false), ',',
        getAttribute(_traitTypes[1], traitData[3][s.eyes].name, false), ',',
        getAttribute(_traitTypes[2], traitData[4][s.nose].name, false), ',',
        getAttribute(_traitTypes[3], traitData[5][s.mouth].name, false), ',',
        getAttribute(_traitTypes[4], traitData[6][s.neck].name, false), ',',
        getAttribute(_traitTypes[5], traitData[7][s.feet].name, false), ',',
        getAttribute(_traitTypes[7], _insanity[getBodyIndex(s.insanity)], false), ',',
        getAttribute(_traitTypes[6], _skill[getBodyIndex(s.skill)], false), ',',
        getAttribute(_traitTypes[11], Strings.toString(s.insanity), true), ',',
        getAttribute(_traitTypes[10], Strings.toString(s.skill), true), ','
      ));
    } else {
      traits = string(abi.encodePacked(
        getAttribute(_traitTypes[0], traitData[12][s.ears].name, false), ',',
        getAttribute(_traitTypes[1], traitData[13][s.eyes].name, false), ',',
        getAttribute(_traitTypes[2], traitData[14][s.nose].name, false), ',',
        getAttribute(_traitTypes[3], traitData[15][s.mouth].name, false), ',',
        getAttribute(_traitTypes[4], traitData[16][s.neck].name, false), ',',
        getAttribute(_traitTypes[5], traitData[17][s.feet].name, false), ',',
        getAttribute(_traitTypes[8], _intelligence[getBodyIndex(s.intelligence)], false), ',',
        getAttribute(_traitTypes[9], _fatness[getBodyIndex(s.fatness)], false), ',',
        getAttribute(_traitTypes[12], Strings.toString(s.intelligence), true), ',',
        getAttribute(_traitTypes[13], Strings.toString(s.fatness), true), ','
      ));
    }
    return string(abi.encodePacked(
      '[',
        '{"trait_type":"Type","value":', s.isChef ? '"Chef"' : '"Rat"', '},',
        traits,
        '{"trait_type":"Generation","value":', tokenId <= chefRat.getPaidTokens() ? '"Gen 0"' : '"Gen 1"', '}',
      ']'
    ));
  }

  /**
   * Generates an attribute for the attributes array in the ERC721 metadata standard
   * @param traitType - The trait type to reference as the metadata key
   * @param value - The token's trait associated with the key
   * @return A JSON dictionary for the single attribute
   */
  function getAttribute(string memory traitType, string memory value, bool isInteger) internal pure returns (string memory) {
    string memory val = isInteger ? value : string(abi.encodePacked('"', value, '"'));
    return string(abi.encodePacked(
      '{',
        '"trait_type":"', traitType, '",',
        isInteger ? '"max_value":100,' : '',
        '"value":', val,
      '}'
    ));
  }

  function setChefRat(address _chefRat) external onlyOwner {
    chefRat = IChefRat(_chefRat);
  }

  /**
   * Used by admin to upload the names and images associated with each trait
   * @param traitIndex - The trait type to upload the traits for (see traitTypes for a mapping)
   * @param traits - The names and base64 encoded PNGs for each trait
   */
  function uploadTraits(uint8 traitIndex, Trait[] calldata traits) external onlyOwner {
    require(traits.length > 0, "traits array empty");
    for (uint8 i = 0; i < traits.length; i++) {
      traitData[traitIndex][i] = Trait(
        traits[i].name,
        traits[i].png
      );
    }
  }

  /** BASE 64 - Written by Brech Devos */
  string internal constant TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64(bytes memory data) internal pure returns (string memory) {
    if (data.length == 0) return '';
    string memory table = TABLE; // load the table into memory
    uint256 encodedLen = 4 * ((data.length + 2) / 3); // multiply by 4/3 rounded up
    string memory result = new string(encodedLen + 32); // add some extra buffer at the end required for the writing
    assembly {
      mstore(result, encodedLen) // set the actual output length
      let tablePtr := add(table, 1) // prepare the lookup table
      let dataPtr := data // input ptr
      let endPtr := add(dataPtr, mload(data))
      let resultPtr := add(result, 32) // result ptr, jump over length
      for {} lt(dataPtr, endPtr) {} // run over the input, 3 bytes at a time
      {
        dataPtr := add(dataPtr, 3)
        let input := mload(dataPtr) // read 3 bytes
        // write 4 characters
        mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(18, input), 0x3F)))))
        resultPtr := add(resultPtr, 1)
        mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr(12, input), 0x3F)))))
        resultPtr := add(resultPtr, 1)
        mstore(resultPtr, shl(248, mload(add(tablePtr, and(shr( 6, input), 0x3F)))))
        resultPtr := add(resultPtr, 1)
        mstore(resultPtr, shl(248, mload(add(tablePtr, and(        input,  0x3F)))))
        resultPtr := add(resultPtr, 1)
      }
      // padding with '='
      switch mod(mload(data), 3)
      case 1 { mstore(sub(resultPtr, 2), shl(240, 0x3d3d)) }
      case 2 { mstore(sub(resultPtr, 1), shl(248, 0x3d)) }
    }
    return result;
  }
}
