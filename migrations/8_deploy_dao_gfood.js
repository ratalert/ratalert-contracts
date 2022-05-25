const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');
const { scheduleAndExecute } = require('../test/helper');

const TimelockController = artifacts.require('TimelockController');
const DAOGourmetFood = artifacts.require('DAOGourmetFood');
const Character = artifacts.require('Character');
const KitchenShop = artifacts.require('KitchenShop');
const KitchenUsage = artifacts.require('KitchenUsage');
const Claim = artifacts.require('Claim');
const TheStakehouse = artifacts.require('TheStakehouse');
const LeStake = artifacts.require('LeStake');

global.web3 = web3;

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);

  let timelockController = { address: config.timelock.address };
  if (!config.timelock.address) {
    timelockController = await TimelockController.deployed();
  }

  const character = await Character.deployed();
  const kitchenShop = await KitchenShop.deployed();
  const kitchenUsage = await KitchenUsage.deployed();
  const claim = await Claim.deployed();
  const theStakehouse = await TheStakehouse.deployed();
  const leStakeOld = await LeStake.deployed();

  await deployer.deploy(DAOGourmetFood, timelockController.address);
  const daoGourmetFood = await DAOGourmetFood.deployed();
  const leStake = await deployProxy(LeStake, [character.address, claim.address, daoGourmetFood.address, kitchenUsage.address], {deployer});

  await leStake.configure(config.kitchen.leStake.foodTokenMaxSupply, [config.kitchen.leStake.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements, config.kitchen.leStake.minEfficiency, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee);
  await leStake.setDao(config.dao.address);

  // This block has to be done manually in Gnosis Safe on mainnet
  if (network === 'development') {
    await scheduleAndExecute(kitchenUsage, 'configure', [...config.kitchenUsage, [theStakehouse.address, leStake.address]], { from: config.dao.address });
    await scheduleAndExecute(character, 'removeController', [[leStakeOld.address]], { from: config.dao.address });
    await scheduleAndExecute(character, 'addController', [[leStake.address]], { from: config.dao.address });
    await scheduleAndExecute(kitchenUsage, 'removeController', [[leStakeOld.address]], { from: config.dao.address });
    await scheduleAndExecute(kitchenUsage, 'addController', [[leStake.address]], { from: config.dao.address });
    await scheduleAndExecute(claim, 'removeController', [[leStakeOld.address]], { from: config.dao.address });
    await scheduleAndExecute(claim, 'addController', [[leStake.address]], { from: config.dao.address });
    await scheduleAndExecute(claim, 'removeVenue', [[leStakeOld.address]], { from: config.dao.address });
    await scheduleAndExecute(claim, 'addVenue', [[leStake.address]], { from: config.dao.address });
    await leStakeOld.pause({ from: config.dao.address });
  }

  await daoGourmetFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), config.dao.address);
  await daoGourmetFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), config.dao.address);
  await daoGourmetFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), leStake.address);
  await daoGourmetFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), kitchenShop.address);

  await daoGourmetFood.transferOwnership(timelockController.address);
  await leStake.transferOwnership(timelockController.address);
};
