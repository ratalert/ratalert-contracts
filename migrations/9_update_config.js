const Config = require('../config');

const McStake = artifacts.require('McStake');
const TheStakehouse = artifacts.require('TheStakehouse');
const LeStake = artifacts.require('LeStake');
const Gym = artifacts.require('Gym');

module.exports = async (deployer, network) => {
    const config = Config(network);
    const mcStake = await McStake.deployed();
    const theStakehouse = await TheStakehouse.deployed();
    const leStake = await LeStake.deployed();
    const gym = await Gym.deployed();

    await mcStake.configure(      config.kitchen.mcStake.foodTokenMaxSupply,       [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements,                                                                                      config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx);
    await theStakehouse.configure(config.kitchen.theStakehouse.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, config.kitchen.theStakehouse.minEfficiency, config.kitchen.chefsPerKitchen,    config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx);
    await leStake.configure(      config.kitchen.leStake.foodTokenMaxSupply,       [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements,       config.kitchen.leStake.minEfficiency,       config.kitchen.chefsPerKitchen,    config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx);
    await gym.configure(       ...config.gym);
};
