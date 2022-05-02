const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { getUIConfig } = require('../test/helper');
const Config = require('../config');

const TimelockController = artifacts.require('TimelockController');
const FastFood = artifacts.require('FastFood');
const CasualFood = artifacts.require('CasualFood');
const GourmetFood = artifacts.require('GourmetFood');
const ConfigContract = artifacts.require('Config');
const Mint = artifacts.require('Mint');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Paywall = artifacts.require('Paywall');
const Character = artifacts.require('Character');
const KitchenShop = artifacts.require('KitchenShop');
const KitchenUsage = artifacts.require('KitchenUsage');
const Claim = artifacts.require('Claim');
const McStake = artifacts.require('McStake');
const TheStakehouse = artifacts.require('TheStakehouse');
const LeStake = artifacts.require('LeStake');
const Gym = artifacts.require('Gym');

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);

  let timelockController = { address: config.timelock.address };
  if (!config.timelock.address) {
    await deployer.deploy(TimelockController, config.timelock.minDelay, config.timelock.proposers.split(' '), config.timelock.executors.split(' '));
    timelockController = await TimelockController.deployed();
  }

  let vrfCoordinator = {};
  let linkToken = {};
  if (network === 'development') {
    const LinkTokenMock = artifacts.require('LinkTokenMock');
    await deployer.deploy(LinkTokenMock);
    linkToken = await LinkTokenMock.deployed();
    const VRFCoordinatorMock = artifacts.require('VRFCoordinatorMock');
    await deployer.deploy(VRFCoordinatorMock, linkToken.address);
    if (process.env.LOCAL_VRF === 'true') {
      vrfCoordinator = { address: accounts[8] };
      console.log('   Using local VRFCoordinator', vrfCoordinator);
    } else {
      vrfCoordinator = await VRFCoordinatorMock.deployed();
    }
  }

  await deployer.deploy(FastFood, timelockController.address);
  await deployer.deploy(CasualFood, timelockController.address);
  await deployer.deploy(GourmetFood, timelockController.address);
  const fastFood = await FastFood.deployed();
  const casualFood = await CasualFood.deployed();
  const gourmetFood = await GourmetFood.deployed();
  const configContract = await deployProxy(ConfigContract, {deployer});
  const mint = await deployProxy(Mint, config.mint({ vrfCoordinator: vrfCoordinator.address, linkToken: linkToken.address }), {deployer});
  const traits = await deployProxy(Traits, {deployer});
  const properties = await deployProxy(Properties, {deployer});
  const paywall = await deployProxy(Paywall, [fastFood.address], {deployer});
  const character = await deployProxy(Character, [paywall.address, mint.address, traits.address, properties.address], {deployer});
  const kitchenShop = await deployProxy(KitchenShop, [fastFood.address, casualFood.address, character.address], {deployer});
  const kitchenUsage = await deployProxy(KitchenUsage, [kitchenShop.address], {deployer});
  const claim = await deployProxy(Claim, config.claim({ vrfCoordinator: vrfCoordinator.address, linkToken: linkToken.address }), {deployer});
  const mcStake = await deployProxy(McStake, [character.address, claim.address, fastFood.address], {deployer});
  const theStakehouse = await deployProxy(TheStakehouse, [character.address, claim.address, casualFood.address, kitchenUsage.address], {deployer});
  const leStake = await deployProxy(LeStake, [character.address, claim.address, gourmetFood.address, kitchenUsage.address], {deployer});
  const gym = await deployProxy(Gym, [character.address, claim.address], {deployer});

  await configContract.set(getUIConfig(config));
  await properties.configure(...config.properties);
  await paywall.configure(...config.payWall);
  await character.configure(...config.character);
  await kitchenShop.configure(...config.kitchenShop);
  await kitchenUsage.configure(...config.kitchenUsage, [theStakehouse.address, leStake.address]);
  await mcStake.configure(config.kitchen.mcStake.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee);
  await theStakehouse.configure(config.kitchen.theStakehouse.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, config.kitchen.theStakehouse.minEfficiency, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee);
  await leStake.configure(config.kitchen.leStake.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements, config.kitchen.leStake.minEfficiency, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee);
  await gym.configure(...config.gym);

  await mint.setDao(config.dao.address);
  await character.setDao(config.dao.address);
  await kitchenShop.setDao(config.dao.address);
  await claim.setDao(config.dao.address);
  await mcStake.setDao(config.dao.address);
  await theStakehouse.setDao(config.dao.address);
  await leStake.setDao(config.dao.address);
  await gym.setDao(config.dao.address);

  await traits.setCharacter(character.address);
  await mint.addController([character.address]);
  await mint.setCharacter(character.address);
  await claim.addController([mcStake.address, theStakehouse.address, leStake.address, gym.address]);
  await claim.addVenue([mcStake.address, theStakehouse.address, leStake.address, gym.address]);

  await fastFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), config.dao.address);
  await fastFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), config.dao.address);
  await fastFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), mcStake.address);
  await fastFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), paywall.address);
  await fastFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), kitchenShop.address);
  await casualFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), config.dao.address);
  await casualFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), config.dao.address);
  await casualFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), theStakehouse.address);
  await casualFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), kitchenShop.address);
  await gourmetFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), config.dao.address);
  await gourmetFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), config.dao.address);
  await gourmetFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), leStake.address);
  await gourmetFood.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), kitchenShop.address);
  await paywall.addController([character.address]);
  await character.addController([mcStake.address, theStakehouse.address, leStake.address, gym.address]);
  await character.setKitchen(mcStake.address);
  await kitchenUsage.addController([theStakehouse.address, leStake.address]);
};
