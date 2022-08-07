const { admin } = require('@openzeppelin/truffle-upgrades');
const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');
const { scheduleAndExecute } = require('../test/helper');
const Config = require('../config');

const TripleFiveClub = artifacts.require('TripleFiveClub');
const TripleFiveClubNew = artifacts.require('TripleFiveClubV2');

global.web3 = web3;

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const tripleFiveClub = await TripleFiveClub.deployed();
  const address = await prepareUpgrade(tripleFiveClub.address, TripleFiveClubNew, { deployer });
  const tripleFiveClubNew = { address };

  console.log(`Upgrading TripleFiveClub proxy ${tripleFiveClub.address} to TripleFiveClubV2 implementation ${tripleFiveClubNew.address}.`);
  const adminInstance = await admin.getInstance();
  const res = await scheduleAndExecute(adminInstance, 'upgrade', [tripleFiveClub.address, tripleFiveClubNew.address], { from: config.dao.address, network: network, raw: network === 'main' });
  if (res && Array.isArray(res)) {
    console.log(res);
  }
};
