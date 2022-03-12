const { admin } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');

module.exports = async function (deployer, network, accounts) {
    const config = Config(network, accounts);

    if (network !== 'development') {
        console.log(`Setting Gnosis Safe: ${config.dao.address}`);
        await admin.transferProxyAdminOwnership(config.dao.address);
    }
};
