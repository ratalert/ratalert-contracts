const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const FastFood = artifacts.require('FastFood');
const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

module.exports = async (deployer) => {
    await deployer.deploy(FastFood);
    const fastFood = await FastFood.deployed();
    const chefRat = await deployProxy(ChefRat, { deployer });
    const kitchenPack = await deployProxy(KitchenPack, [chefRat.address, fastFood.address], { deployer });
    fastFood.addController(kitchenPack.address);
};
