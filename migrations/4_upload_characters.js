const { uploadCharacters } = require("../test/helper");

const Traits = artifacts.require('Traits');

module.exports = async (deployer) => {
    const traits = await Traits.deployed();
    await uploadCharacters(traits);
};
