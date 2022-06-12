const { admin } = require('@openzeppelin/truffle-upgrades');
const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');
const { scheduleAndExecute } = require('../test/helper');
const Config = require('../config');

const Paywall = artifacts.require('Paywall');
const PaywallNew = artifacts.require('PaywallV2');

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const paywall = await Paywall.deployed();
  const address = await prepareUpgrade(paywall.address, PaywallNew, { deployer });
  const paywallNew = { address };

  console.log(`Upgrading Paywall proxy ${paywall.address} to PaywallV2 implementation ${paywallNew.address}.`);
  const adminInstance = await admin.getInstance();
  const res = await scheduleAndExecute(adminInstance, 'upgrade', [paywall.address, paywallNew.address], { from: config.dao.address, network: network, raw: network === 'main' });
  if (res && Array.isArray(res)) {
    console.log(res);
  }
  // TODO Update PaywallV2.json?
};
