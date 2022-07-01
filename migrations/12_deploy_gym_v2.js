const { admin } = require('@openzeppelin/truffle-upgrades');
const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');
const { scheduleAndExecute } = require('../test/helper');
const Config = require('../config');

const Gym = artifacts.require('Gym');
const GymNew = artifacts.require('GymV2');

global.web3 = web3;

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const gym = await Gym.deployed();
  const address = await prepareUpgrade(gym.address, GymNew, { deployer });
  const gymNew = { address };

  console.log(`Upgrading Gym proxy ${gym.address} to GymV2 implementation ${gymNew.address}.`);
  const adminInstance = await admin.getInstance();
  const res = await scheduleAndExecute(adminInstance, 'upgrade', [gym.address, gymNew.address], { from: config.dao.address, network: network, raw: network === 'main' });
  if (res && Array.isArray(res)) {
    console.log(res);
  }
};
