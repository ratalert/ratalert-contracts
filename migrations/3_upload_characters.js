const { uploadCharacters } = require("../test/helper");

const Traits = artifacts.require('Traits');

module.exports = async (deployer, network, accounts) => {
  const traits = await Traits.deployed();
  await uploadCharacters(traits, accounts[0]);
};
