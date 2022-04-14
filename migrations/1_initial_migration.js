const { rm } = require('fs/promises');

const Migrations = artifacts.require('Migrations');

module.exports = async (deployer) => {
  await rm(`${__dirname}/../.openzeppelin/unknown-1337.json`, { force: true }); // TimelockController requires a fresh ProxyAdmin each time
  deployer.deploy(Migrations);
};
