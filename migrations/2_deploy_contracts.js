const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const web3 = require('web3');
const toWei = web3.utils.toWei;

const FastFood = artifacts.require('FastFood');
const CasualFood = artifacts.require('CasualFood');
const GourmetFood = artifacts.require('GourmetFood');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');
const TheStakehouse = artifacts.require('TheStakehouse');
const LeStake = artifacts.require('LeStake');

module.exports = async (deployer, network) => {
    const mintPrice = network === 'live' ? toWei('0.1', 'ether') : toWei('0.01', 'ether');
    const accrualPeriod = network === 'live' ? 86400 : 3600;

    await deployer.deploy(FastFood);
    await deployer.deploy(CasualFood);
    await deployer.deploy(GourmetFood);
    const fastFood = await FastFood.deployed();
    const casualFood = await CasualFood.deployed();
    const gourmetFood = await GourmetFood.deployed();
    const traits = await deployProxy(Traits, { deployer });
    const properties = await deployProxy(Properties, [[86, 86, 0, 0, 0, 0], [15, 15, 10, 10, 25, 50]], { deployer });
    const character = await deployProxy(Character, [traits.address, properties.address, 50000, mintPrice], { deployer });
    const mcStake = await deployProxy(McStake, [character.address, fastFood.address, accrualPeriod, 2, 4, 2, 8, 175, 90, 55], { deployer });
    const theStakehouse = await deployProxy(TheStakehouse, [character.address, casualFood.address, accrualPeriod, 2, 4, 2, 8, 175, 90, 55], { deployer });
    const leStake = await deployProxy(LeStake, [character.address, gourmetFood.address, accrualPeriod, 2, 4, 2, 8, 175, 90, 55], { deployer });
    await traits.setCharacter(character.address);
    await fastFood.addController(mcStake.address);
    await casualFood.addController(theStakehouse.address);
    await gourmetFood.addController(leStake.address);
    await character.addController(mcStake.address);
    await character.addController(theStakehouse.address);
    await character.addController(leStake.address);
    await character.setKitchen(mcStake.address);
};
