const { admin } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const contracts = [
    'CasualFood', 'Character', 'Claim', 'FastFood', 'GourmetFood', 'Gym', 'KitchenShop',
    'LeStake', 'McStake', 'Mint', 'Paywall', 'Properties', 'TheStakehouse', 'Traits',
  ];

  console.log(`Changing ownership to ${config.dao.address}`);
  await Promise.all(contracts.map(async (name) => {
    const contract = await artifacts.require(name).deployed();
    await contract.transferOwnership(config.dao.address);
  }));

  const adminInstance = await admin.getInstance();
  const adminOwner = await adminInstance.owner();
  if (adminOwner !== config.dao.address) {
    await admin.transferProxyAdminOwnership(config.dao.address);
  }
};
