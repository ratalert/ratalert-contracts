const { setupVRF } = require("../test/helper");

const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');

module.exports = async (deployer, network) => {
    if (network === 'development') {
        global.web3 = require('web3');
        const LinkTokenMock = artifacts.require('LinkTokenMock');
        const linkToken = await LinkTokenMock.deployed();
        const mint = await Mint.deployed();
        const claim = await Claim.deployed();
        await setupVRF(linkToken, mint);
        await setupVRF(linkToken, claim);
    }
};
