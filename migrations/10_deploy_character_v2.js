const { admin } = require('@openzeppelin/truffle-upgrades');
const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');
const { scheduleAndExecute } = require('../test/helper');
const Config = require('../config');

const Character = artifacts.require('Character');
const CharacterNew = artifacts.require('CharacterV2');

module.exports = async (deployer, network, accounts) => {
  const config = Config(network, accounts);
  const character = await Character.deployed();
  const address = await prepareUpgrade(character.address, CharacterNew, { deployer });
  const characterNew = { address };

  console.log(`Upgrading Character proxy ${character.address} to CharacterV2 implementation ${characterNew.address}.`);
  const adminInstance = await admin.getInstance();
  const res = await scheduleAndExecute(adminInstance, 'upgrade', [character.address, characterNew.address], { from: config.dao.address, network: network, raw: network === 'main' });
  if (res && Array.isArray(res)) {
    console.log(res);
  }
  // TODO Update CharacterV2.json?
};
