const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const FastFood = artifacts.require('FastFood');
const ChefRat = artifacts.require('ChefRat');

module.exports = async (deployer) => {
    await deployer.deploy(FastFood);
    await deployProxy(ChefRat, { deployer });
};
