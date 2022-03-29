const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');
const { admin } = require('@openzeppelin/truffle-upgrades');
const Config = require('../config');

const Traits = artifacts.require('Traits');
const TraitsNew = artifacts.require('TraitsV2');
// const Character = artifacts.require('Character');
// const CharacterNew = artifacts.require('Character');

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const traits = await Traits.deployed();
  // const character = await Character.deployed();

  let traitsNew = { address: await prepareUpgrade(traits.address, TraitsNew, { deployer }) };
  // let characterNew = { address: await prepareUpgrade(character.address, CharacterNew, { deployer }) };
  if (network === 'development') {
    const adminInstance = await admin.getInstance();
    await adminInstance.upgrade(traits.address, traitsNew.address, { from: config.dao.address });
    // await adminInstance.upgrade(character.address, characterNew.address, { from: config.dao.address });
  }
  console.log(`Upgrade Traits    from ${traits.address} to ${traitsNew.address}`);
  // console.log(`Upgrade Character from ${character.address} to ${characterNew.address}`);
};
