const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');
const web3 = require('web3');

const FastFood = artifacts.require('FastFood');
const CasualFood = artifacts.require('CasualFood');
const GourmetFood = artifacts.require('GourmetFood');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Character = artifacts.require('Character');
const KitchenShop = artifacts.require('KitchenShop');
const McStake = artifacts.require('McStake');
const TheStakehouse = artifacts.require('TheStakehouse');
const LeStake = artifacts.require('LeStake');
const Gym = artifacts.require('Gym');

module.exports = async (deployer, network) => {
    const config = Config(network);

    await deployer.deploy(FastFood);
    await deployer.deploy(CasualFood);
    await deployer.deploy(GourmetFood);
    const fastFood = await FastFood.deployed();
    const casualFood = await CasualFood.deployed();
    const gourmetFood = await GourmetFood.deployed();
    const traits = await deployProxy(Traits, { deployer });
    const properties = await deployProxy(Properties, config.properties, { deployer });
    const character = await deployProxy(Character, [traits.address, properties.address].concat(config.character), { deployer });
    const kitchenShop = await deployProxy(KitchenShop, [fastFood.address, casualFood.address, character.address].concat(config.kitchenShop), { deployer });
    const mcStake = await deployProxy(McStake, [character.address, fastFood.address, config.kitchen.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset], { deployer });
    const theStakehouse = await deployProxy(TheStakehouse, [character.address, casualFood.address, kitchenShop.address, config.kitchen.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, config.kitchen.theStakehouse.minEfficiency, config.kitchen.charactersPerKitchen, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset], { deployer });
    const leStake = await deployProxy(LeStake, [character.address, gourmetFood.address, kitchenShop.address, config.kitchen.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements, config.kitchen.leStake.minEfficiency, config.kitchen.charactersPerKitchen, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset], { deployer });
    const gym = await deployProxy(Gym, [character.address].concat(config.gym), { deployer });

    await traits.setCharacter(character.address);
    await fastFood.addController(mcStake.address);
    await fastFood.addController(kitchenShop.address);
    await casualFood.addController(theStakehouse.address);
    await casualFood.addController(kitchenShop.address);
    await gourmetFood.addController(leStake.address);
    await gourmetFood.addController(kitchenShop.address);
    await character.addController(mcStake.address);
    await character.addController(theStakehouse.address);
    await character.addController(leStake.address);
    await character.setKitchen(mcStake.address);
    await character.addController(gym.address);
};
