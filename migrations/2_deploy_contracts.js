const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const FastFood = artifacts.require('FastFood');
const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

module.exports = async (deployer) => {
    const foo = await deployer.deploy(FastFood);
    const fastFood = await FastFood.deployed();
    // const fastFood = await deployProxy(FastFood, { deployer });
    const chefRat = await deployProxy(ChefRat, { deployer });
    await deployProxy(KitchenPack, [chefRat.address, fastFood.address], { deployer });
};
