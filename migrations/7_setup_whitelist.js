const Paywall = artifacts.require('Paywall');

module.exports = async (deployer) => {
    const whitelist = (process.env.WHITELIST || '').split(' ').filter(item => item.length === 42);
    const freeMints = (process.env.FREEMINTS || '').split(' ').filter(item => item.length === 42);
    const paywall = await Paywall.deployed();
    if (whitelist.length) {
        await paywall.addToWhitelist(whitelist);
    }
    if (freeMints.length) {
        await paywall.addToFreeMints(freeMints);
    }
};
