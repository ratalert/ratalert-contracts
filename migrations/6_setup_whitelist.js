const Paywall = artifacts.require('Paywall');
const Config = require('../config');

module.exports = async (deployer, network, accounts) => {
  if (network === 'development') {
    const config = Config(network, accounts);

    const whitelist = (process.env.WHITELIST || '').split(' ').filter(item => item.length === 42);
    const freeMints = (process.env.FREEMINTS || '').split(' ').filter(item => item.length === 42);
    const paywall = await Paywall.deployed();
    if (whitelist.length) {
      await paywall.addToWhitelist(whitelist, { from: config.dao.address });
    }
    if (freeMints.length) {
      await paywall.addToFreeMints(freeMints, { from: config.dao.address });
    }
  }
};
