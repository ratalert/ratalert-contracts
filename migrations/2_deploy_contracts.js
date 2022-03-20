const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');

const FastFood = artifacts.require('FastFood');
const CasualFood = artifacts.require('CasualFood');
const GourmetFood = artifacts.require('GourmetFood');
const Mint = artifacts.require('Mint');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Paywall = artifacts.require('Paywall');
const Character = artifacts.require('Character');
const KitchenShop = artifacts.require('KitchenShop');
const Claim = artifacts.require('Claim');
const McStake = artifacts.require('McStake');
const TheStakehouse = artifacts.require('TheStakehouse');
const LeStake = artifacts.require('LeStake');
const Gym = artifacts.require('Gym');

module.exports = async (deployer, network, accounts) => {
    const config = Config(network, accounts);

    let vrfCoordinator = {};
    let linkToken = {};
    if (network === 'development') {
        const LinkTokenMock = artifacts.require('LinkTokenMock');
        await deployer.deploy(LinkTokenMock);
        linkToken = await LinkTokenMock.deployed();
        const VRFCoordinatorMock = artifacts.require('VRFCoordinatorMock');
        await deployer.deploy(VRFCoordinatorMock, linkToken.address);
        vrfCoordinator = await VRFCoordinatorMock.deployed();
    }
    await deployer.deploy(FastFood);
    await deployer.deploy(CasualFood);
    await deployer.deploy(GourmetFood);
    const fastFood = await FastFood.deployed();
    const casualFood = await CasualFood.deployed();
    const gourmetFood = await GourmetFood.deployed();
    const mint = await deployProxy(Mint, config.mint({ vrfCoordinator: vrfCoordinator.address, linkToken: linkToken.address }), { deployer });
    const traits = await deployProxy(Traits, { deployer });
    const properties = await deployProxy(Properties, { deployer });
    const paywall = await deployProxy(Paywall, [fastFood.address], { deployer });
    const character = await deployProxy(Character, [paywall.address, mint.address, traits.address, properties.address, config.dao.address], { deployer });
    const kitchenShop = await deployProxy(KitchenShop, [fastFood.address, casualFood.address, character.address], { deployer });
    const claim = await deployProxy(Claim, config.claim({ vrfCoordinator: vrfCoordinator.address, linkToken: linkToken.address }), { deployer });
    const mcStake       = await deployProxy(McStake,       [character.address, claim.address, fastFood.address],                         { deployer });
    const theStakehouse = await deployProxy(TheStakehouse, [character.address, claim.address, casualFood.address,  kitchenShop.address], { deployer });
    const leStake       = await deployProxy(LeStake,       [character.address, claim.address, gourmetFood.address, kitchenShop.address], { deployer });
    const gym           = await deployProxy(Gym,           [character.address, claim.address],                                           { deployer });

    await properties.configure(...config.properties);
    await paywall.configure(...config.payWall);
    await character.configure(...config.character);
    await kitchenShop.configure(...config.kitchenShop);
    await mcStake.configure(      config.kitchen.mcStake.foodTokenMaxSupply,       [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements,                                                                                           config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx);
    await theStakehouse.configure(config.kitchen.theStakehouse.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, config.kitchen.theStakehouse.minEfficiency, config.kitchen.chefsPerKitchen,    config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx);
    await leStake.configure(      config.kitchen.leStake.foodTokenMaxSupply,       [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements,       config.kitchen.leStake.minEfficiency,       config.kitchen.chefsPerKitchen,    config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx);
    await gym.configure(...config.gym);

    await traits.setCharacter(character.address);
    await mint.addController([character.address]);
    await mint.setCharacter(character.address);
    await claim.addController([mcStake.address, theStakehouse.address, leStake.address, gym.address]);
    await claim.addVenue([mcStake.address, theStakehouse.address, leStake.address, gym.address]);
    await fastFood.addController([paywall.address, mcStake.address, kitchenShop.address]);
    await casualFood.addController([theStakehouse.address, kitchenShop.address]);
    await gourmetFood.addController([leStake.address, kitchenShop.address]);
    await paywall.addController([character.address]);
    await character.addController([mcStake.address, theStakehouse.address, leStake.address, gym.address]);
    await character.setKitchen(mcStake.address);
};
