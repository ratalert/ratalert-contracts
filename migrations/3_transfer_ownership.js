const { admin } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network) {
    const gnosisSafe = {
        rinkeby: '0xf0B3Ee1FA257E0E7816DA1A6E13A0A0bC0c585fD',
    };

    if (gnosisSafe[network]) {
        console.log(`Setting Gnosis Safe: ${gnosisSafe[network]}`);
        await admin.transferProxyAdminOwnership(gnosisSafe[network]);
    }
};
