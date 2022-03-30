const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');
const { admin } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');

const Properties = artifacts.require('Properties');
const PropertiesNew = artifacts.require('PropertiesV2');
const Gym = artifacts.require('Gym');
const GymNew = artifacts.require('GymV2');

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const properties = await Properties.deployed();
  const gym = await Gym.deployed();

  let propertiesNew = { address: await prepareUpgrade(properties.address, PropertiesNew, { deployer }) };
  let gymNew = { address: await prepareUpgrade(gym.address, GymNew, { deployer }) };
  if (network === 'development') {
    const adminInstance = await admin.getInstance();
    await adminInstance.upgrade(properties.address, propertiesNew.address, { from: config.dao.address });
    await adminInstance.upgrade(gym.address, gymNew.address, { from: config.dao.address });
  }
  console.log(`Upgrade Properties from ${properties.address} to ${propertiesNew.address}`);
  console.log(`Upgrade Gym        from ${gym.address} to ${gymNew.address}`);
};

// beta: Previous Properties implementation: 0xD2b73054efDadaBA3c28Bf9EE9386A8a5fa4EDc3
// beta: Previous Gym        implementation: 0x07DF1a414E1Cc2bA2E6C53334411E56Afa2392fa
