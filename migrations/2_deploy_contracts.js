const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const web3 = require('web3');
const toWei = web3.utils.toWei;

const FastFood = artifacts.require('FastFood');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

module.exports = async (deployer, network) => {
    const mintPrice = network === 'live' ? toWei('0.1', 'ether') : toWei('0.01', 'ether');
    const accrualPeriod = network === 'live' ? 86400 : 3600;

    await deployer.deploy(FastFood);
    const fastFood = await FastFood.deployed();
    const traits = await deployProxy(Traits, { deployer });
    const properties = await deployProxy(Properties, [[86, 86, 0, 0, 0, 0], [15, 15, 10, 10, 25, 50]], { deployer });
    const chefRat = await deployProxy(ChefRat, [traits.address, properties.address, 50000, mintPrice], { deployer });
    const kitchenPack = await deployProxy(KitchenPack, [chefRat.address, fastFood.address, accrualPeriod, 175], { deployer });
    await traits.setChefRat(chefRat.address);
    await fastFood.addController(kitchenPack.address);
    await chefRat.addController(kitchenPack.address);
    await chefRat.setKitchenPack(kitchenPack.address);
};
