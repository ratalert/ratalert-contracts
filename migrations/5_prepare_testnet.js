const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');

const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

module.exports = async (deployer, network) => {
    if (network !== 'live') {
        const ChefRatTest = artifacts.require('ChefRatTest');
        const KitchenPackTest = artifacts.require('KitchenPackTest');
        const chefRat = await ChefRat.deployed();
        const kitchenPack = await KitchenPack.deployed();
        await prepareUpgrade(chefRat.address, ChefRatTest, { deployer });
        await prepareUpgrade(kitchenPack.address, KitchenPackTest, { deployer });
    }
};
