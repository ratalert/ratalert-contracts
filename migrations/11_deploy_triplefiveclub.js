const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { scheduleAndExecute } = require('../test/helper');
const Config = require('../config');

const TimelockController = artifacts.require('TimelockController');
const GourmetFood = artifacts.require('DAOGourmetFood');
const Character = artifacts.require('Character');
const Claim = artifacts.require('Claim');
const TripleFiveClub = artifacts.require('TripleFiveClub');

global.web3 = web3;

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);

  const gourmetFood = await GourmetFood.deployed();
  const character = await Character.deployed();
  const claim = await Claim.deployed();
  const tripleFiveClub = await deployProxy(TripleFiveClub, [character.address, claim.address, gourmetFood.address], {deployer});

  await tripleFiveClub.configure(...config.tripleFiveClub);
  await tripleFiveClub.setDao(config.dao.address);

  const res1 = await scheduleAndExecute(claim, 'addController', [[tripleFiveClub.address]], { from: config.dao.address, network: network, raw: network === 'main' });
  if (res1 && Array.isArray(res1)) console.log(res1);
  const res2 = await scheduleAndExecute(claim, 'addVenue', [[tripleFiveClub.address]], { from: config.dao.address, network: network, raw: network === 'main' });
  if (res2 && Array.isArray(res2)) console.log(res2);
  const res3 = await scheduleAndExecute(character, 'addController', [[tripleFiveClub.address]], { from: config.dao.address, network: network, raw: network === 'main' });
  if (res3 && Array.isArray(res3)) console.log(res3);
  const res4 = await scheduleAndExecute(gourmetFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), tripleFiveClub.address], { from: config.dao.address, network: network, raw: network === 'main' });
  if (res4 && Array.isArray(res4)) console.log(res4);

  let timelockController = { address: config.timelock.address };
  if (!config.timelock.address) {
    timelockController = await TimelockController.deployed();
  }
  await tripleFiveClub.transferOwnership(timelockController.address);
};
