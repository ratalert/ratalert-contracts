const Config = require('../config');
const {deployProxy} = require("@openzeppelin/truffle-upgrades");

const Properties = artifacts.require('Properties');
const Paywall = artifacts.require('Paywall');
const Character = artifacts.require('Character');
const KitchenShop = artifacts.require('KitchenShop');
const McStake = artifacts.require('McStake');
const TheStakehouse = artifacts.require('TheStakehouse');
const LeStake = artifacts.require('LeStake');
const Gym = artifacts.require('Gym');

module.exports = async (deployer, network, accounts) => {
    const config = Config(network, accounts);

    const properties = await Properties.deployed();
    const paywall = await Paywall.deployed();
    const character = await Character.deployed();
    const kitchenShop = await KitchenShop.deployed();
    const mcStake = await McStake.deployed();
    const theStakehouse = await TheStakehouse.deployed();
    const leStake = await LeStake.deployed();
    const gym = await Gym.deployed();

    await properties.configure(...config.properties, { from: config.dao.address });
    await paywall.configure(...config.payWall, { from: config.dao.address });
    await character.configure(...config.character, { from: config.dao.address });
    await kitchenShop.configure(...config.kitchenShop, { from: config.dao.address });
    await mcStake.configure(      config.kitchen.mcStake.foodTokenMaxSupply,       [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements,                                                                                           config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, { from: config.dao.address });
    await theStakehouse.configure(config.kitchen.theStakehouse.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, config.kitchen.theStakehouse.minEfficiency, config.kitchen.chefsPerKitchen,    config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, { from: config.dao.address });
    await leStake.configure(      config.kitchen.leStake.foodTokenMaxSupply,       [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements,       config.kitchen.leStake.minEfficiency,       config.kitchen.chefsPerKitchen,    config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, { from: config.dao.address });
    await gym.configure(...config.gym, { from: config.dao.address });
};
