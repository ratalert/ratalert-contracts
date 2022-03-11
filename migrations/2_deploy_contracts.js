const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');

const FastFood = artifacts.require('FastFood');
const CasualFood = artifacts.require('CasualFood');
const GourmetFood = artifacts.require('GourmetFood');
const Mint = artifacts.require('Mint');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Character = artifacts.require('Character');
const KitchenShop = artifacts.require('KitchenShop');
const Claim = artifacts.require('Claim');
const McStake = artifacts.require('McStake');
const TheStakehouse = artifacts.require('TheStakehouse');
const LeStake = artifacts.require('LeStake');
const Gym = artifacts.require('Gym');

module.exports = async (deployer, network) => {
    const config = Config(network);

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
    const properties = await deployProxy(Properties, config.properties, { deployer });
    const character = await deployProxy(Character, [[fastFood.address, mint.address, traits.address, properties.address]].concat(config.character), { deployer });
    const kitchenShop = await deployProxy(KitchenShop, [fastFood.address, casualFood.address, character.address].concat(config.kitchenShop), { deployer });
    const claim = await deployProxy(Claim, config.claim({ vrfCoordinator: vrfCoordinator.address, linkToken: linkToken.address }), { deployer });
    const mcStake       = await deployProxy(McStake,       [[character.address, claim.address, fastFood.address                        ], config.kitchen.mcStake.foodTokenMaxSupply,       [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements,                                                                                           config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset], { deployer });
    const theStakehouse = await deployProxy(TheStakehouse, [[character.address, claim.address, casualFood.address,  kitchenShop.address], config.kitchen.theStakehouse.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, config.kitchen.theStakehouse.minEfficiency, config.kitchen.charactersPerKitchen,    config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset], { deployer });
    const leStake       = await deployProxy(LeStake,       [[character.address, claim.address, gourmetFood.address, kitchenShop.address], config.kitchen.leStake.foodTokenMaxSupply,       [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements,       config.kitchen.leStake.minEfficiency,       config.kitchen.charactersPerKitchen,    config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset], { deployer });
    const gym           = await deployProxy(Gym,           [[character.address, claim.address]].concat(config.gym), { deployer });

    await traits.setCharacter(character.address);
    await mint.addController(character.address);
    await mint.setCharacter(character.address);
    await claim.addController(mcStake.address); // TODO Single request?
    await claim.addController(theStakehouse.address);
    await claim.addController(leStake.address);
    await claim.addController(gym.address);
    await claim.addVenue(mcStake.address); // TODO Single request?
    await claim.addVenue(theStakehouse.address);
    await claim.addVenue(leStake.address);
    await claim.addVenue(gym.address);
    await fastFood.addController(mcStake.address);
    await fastFood.addController(kitchenShop.address);
    await casualFood.addController(theStakehouse.address);
    await casualFood.addController(kitchenShop.address);
    await gourmetFood.addController(leStake.address);
    await gourmetFood.addController(kitchenShop.address);
    await character.addController(mcStake.address);
    await character.addController(theStakehouse.address);
    await character.addController(leStake.address);
    await character.addController(gym.address);
    await character.setKitchen(mcStake.address);
};
