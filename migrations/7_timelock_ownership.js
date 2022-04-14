const { admin } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');

const TimelockController = artifacts.require('TimelockController');

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const contracts = [
    'CasualFood', 'Character', 'Claim', 'FastFood', 'GourmetFood', 'Gym', 'KitchenShop',
    'LeStake', 'McStake', 'Mint', 'Paywall', 'Properties', 'TheStakehouse', 'Traits',
  ];

  await deployer.deploy(TimelockController, config.timelock.minDelay, config.timelock.proposers.split(' '), config.timelock.executors.split(' ')/*, { gasPrice: await web3.eth.getGasPrice(), overwrite: false }*/);
  const timelockController = await TimelockController.deployed();

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
