// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "./ITraits.sol";
import "./ICharacter.sol";

contract Traits is Initializable, OwnableUpgradeable, ITraits {
  using Strings for uint256;

  struct Trait { // Struct to store each trait's data for metadata and rendering
    string name;
    string png;
  }

  string[16] _traitTypes;
  uint16 public numHeadAndBodyTraits;
  mapping(uint8 => mapping(uint8 => Trait)) public traitData; // Storage of each trait's name and base64 SVG data

  ICharacter public character;

  function initialize() external initializer {
    __Ownable_init();

    numHeadAndBodyTraits = 7;
    _traitTypes = [ // Mapping from trait type (index) to its name
      "Hat",
      "Eyes",
      "Piercing",
      "Mouth",
      "Neck",
      "Hand",
      "Tail",
      "Skill",
      "Freak",
      "Intelligence",
      "Body mass",
      "Skill percentage",
      "Freak percentage",
      "Intelligence quotient",
      "Body mass percentage",
      "Boost"
    ];
  }

  /**
   * Generates a base64 encoded metadata response without referencing off-chain content
   * @param tokenId - The ID of the token to generate the metadata for
   * @return A base64 encoded JSON dictionary of the token's metadata and SVG
   */
  function tokenURI(uint256 tokenId) external view override returns (string memory) {
    ICharacter.CharacterStruct memory s = character.getTokenTraits(tokenId);

    string memory metadata = string(abi.encodePacked(
      '{',
      '"name":"', s.isChef ? 'Chef #' : 'Rat #', tokenId.toString(), '",',
      '"description":"RatAlert, the NFT game that lets you Train2Earn your characters on-chain for higher rewards! https://ratalert.com/",',
      '"external_url":"https://ratalert.com/characters/', tokenId.toString(), '",',
      '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(this.drawSVG(tokenId))), '",',
      '"attributes":', this.getAttributes(tokenId),
      '}'
    ));

    return string(abi.encodePacked(
      "data:application/json;base64,",
      Base64.encode(bytes(metadata))
    ));
  }

  /**
   * Returns the array index to use for rendering the respective head or body by the given value
   * @param value - skill or tolerance value
   * @return Array index
   */
  function getBodyIndex(uint8 value) internal view returns(uint8) {
    uint256 val = value * numHeadAndBodyTraits / 100;
    return val > numHeadAndBodyTraits - 1 ? uint8(numHeadAndBodyTraits - 1) : uint8(val);
  }

  /**
   * Generates an entire SVG by composing multiple <image> elements of PNGs
   * @param tokenId - The ID of the token to generate an SVG for
   * @return A valid SVG string of the Character
   */
  function drawSVG(uint256 tokenId) external view returns (string memory) {
    ICharacter.CharacterStruct memory s = character.getTokenTraits(tokenId);
    uint8 shift = s.isChef ? 0 : 10;
    uint8 head = getBodyIndex(s.isChef ? s.tolerance : s.efficiency);
    uint8 body = getBodyIndex(s.isChef ? s.efficiency : s.tolerance);
    uint8[17] memory order = [body, head, s.eyes, s.hat, s.neck, s.mouth, s.hand, 0, 0, 0, body, s.tail, head, s.piercing, s.eyes, s.hat, s.neck];
    string memory svgString = string(abi.encodePacked(
      drawTrait(traitData[0 + shift][order[0 + shift]]),
      drawTrait(traitData[1 + shift][order[1 + shift]]),
      drawTrait(traitData[2 + shift][order[2 + shift]]),
      drawTrait(traitData[3 + shift][order[3 + shift]]),
      drawTrait(traitData[4 + shift][order[4 + shift]]),
      drawTrait(traitData[5 + shift][order[5 + shift]]),
      drawTrait(traitData[6 + shift][order[6 + shift]])
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
  function getAttributes(uint256 tokenId) external view returns (string memory) {
    ICharacter.CharacterStruct memory s = character.getTokenTraits(tokenId);
    string memory traits;
    uint16 boost = s.boost < 0 ? 256 - uint8(s.boost) : uint8(s.boost);
    bool boostNegative = s.boost < 0;
    if (s.isChef) {
      traits = string(abi.encodePacked(
        getAttribute(_traitTypes[0], "", traitData[3][s.hat].name, false, false),
        getAttribute(_traitTypes[1], "", traitData[2][s.eyes].name, false, false),
        getAttribute(_traitTypes[3], "", traitData[5][s.mouth].name, false, false),
        getAttribute(_traitTypes[4], "", traitData[4][s.neck].name, false, false),
        getAttribute(_traitTypes[5], "", traitData[6][s.hand].name, false, false),
        getAttribute(_traitTypes[7], "", traitData[0][getBodyIndex(s.efficiency)].name, false, false),
        getAttribute(_traitTypes[8], "", traitData[1][getBodyIndex(s.tolerance)].name, false, false),
        getAttribute(_traitTypes[11], "", Strings.toString(s.efficiency), true, false),
        getAttribute(_traitTypes[12], "", Strings.toString(s.tolerance), true, false),
        getAttribute(_traitTypes[15], "boost_percentage", Strings.toString(boost), true, boostNegative)
      ));
    } else {
      traits = string(abi.encodePacked(
        getAttribute(_traitTypes[0], "", traitData[15][s.hat].name, false, false),
        getAttribute(_traitTypes[1], "", traitData[14][s.eyes].name, false, false),
        getAttribute(_traitTypes[2], "", traitData[13][s.piercing].name, false, false),
        getAttribute(_traitTypes[4], "", traitData[16][s.neck].name, false, false),
        getAttribute(_traitTypes[6], "", traitData[11][s.tail].name, false, false),
        getAttribute(_traitTypes[9], "", traitData[12][getBodyIndex(s.efficiency)].name, false, false),
        getAttribute(_traitTypes[10], "", traitData[10][getBodyIndex(s.tolerance)].name, false, false),
        getAttribute(_traitTypes[13], "", Strings.toString(s.efficiency), true, false),
        getAttribute(_traitTypes[14], "", Strings.toString(s.tolerance), true, false),
        getAttribute(_traitTypes[15], "boost_percentage", Strings.toString(boost), true, boostNegative)
      ));
    }
    return string(abi.encodePacked(
      '[',
        '{"trait_type":"Type","value":', s.isChef ? '"Chef"' : '"Rat"', '},',
        traits,
        '{"trait_type":"Generation","value":', tokenId <= character.getGen0Tokens() ? '"Gen 0"' : '"Gen 1"', '}',
      ']'
    ));
  }

  /**
   * Generates an attribute for the attributes array in the ERC721 metadata standard
   * @param traitType - The trait type to reference as the metadata key
   * @param value - The token's trait associated with the key
   * @return A JSON dictionary for the single attribute
   */
  function getAttribute(string memory traitType, string memory valueType, string memory value, bool isInteger, bool isNegative) internal pure returns (string memory) {
    if (!isInteger && bytes(value).length == 0) return '';
    string memory val = isInteger ? (isNegative ? string(abi.encodePacked('-', value)) : value) : string(abi.encodePacked('"', value, '"'));
    string memory displayType = bytes(valueType).length > 0 ? string(abi.encodePacked('"display_type":"', valueType, '",')) : '';
    return string(abi.encodePacked(
      '{',
        '"trait_type":"', traitType, '",',
        bytes(displayType).length > 0 ? displayType : '',
        isInteger ? '"max_value":100,' : '',
        '"value":', val,
      '},'
    ));
  }

  /**
   * Sets the character interface
   * @param _character - The character contract address
   */
  function setCharacter(address _character) external onlyOwner {
    character = ICharacter(_character);
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
}
