const { admin } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');

const TimelockController = artifacts.require('TimelockController');

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const contracts = [
    'CasualFood', 'Character', 'Claim', 'Config', 'FastFood', 'GourmetFood', 'Gym', 'KitchenShop',
    'KitchenUsage', 'LeStake', 'McStake', 'Mint', 'Paywall', 'Properties', 'TheStakehouse', 'Traits', 'TripleFiveClub',
  ];

  let timelockController = { address: config.timelock.address };
  if (!config.timelock.address) {
    timelockController = await TimelockController.deployed();
  }

  console.log(`Changing ownership to TimelockController at ${timelockController.address}`);
  await contracts.reduce(async (previousPromise, name) => {
    await previousPromise;
    const contract = await artifacts.require(name).deployed();
    await contract.transferOwnership(timelockController.address);
  }, Promise.resolve());


  const adminInstance = await admin.getInstance();
  const adminOwner = await adminInstance.owner();
  if (adminOwner !== timelockController.address) {
    await admin.transferProxyAdminOwnership(timelockController.address);
  }
};
