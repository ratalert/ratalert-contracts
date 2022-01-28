const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const FastFood = artifacts.require('FastFood');
const Traits = artifacts.require('Traits');
const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

module.exports = async (deployer) => {
    await deployer.deploy(FastFood);
    const fastFood = await FastFood.deployed();
    const traits = await deployProxy(Traits, { deployer });
    const chefRat = await deployProxy(ChefRat, [traits.address, 50000], { deployer });
    const kitchenPack = await deployProxy(KitchenPack, [chefRat.address, fastFood.address], { deployer });
    await traits.setChefRat(chefRat.address);
    await fastFood.addController(kitchenPack.address);
    await chefRat.addController(kitchenPack.address);
    await chefRat.setKitchenPack(kitchenPack.address);
};
