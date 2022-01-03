const { readFile, writeFile } = require('fs/promises');
const { prepareUpgrade } = require('@openzeppelin/truffle-upgrades');

const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

module.exports = async (deployer, network) => {
    if (network !== 'live') {
        const contractsDir = `${__dirname}/../contracts`;
        const chefRatContents = (await readFile(`${contractsDir}/ChefRat.sol`, 'utf8'))
            .replace(/contract ChefRat/g, 'contract ChefRatTest')
            .replace(/MINT_PRICE = .1 ether/g, 'MINT_PRICE = .01 ether');
        const kitchenPackContents = (await readFile(`${contractsDir}/KitchenPack.sol`, 'utf8'))
            .replace(/contract KitchenPack/g, 'contract KitchenPackTest')
            .replace(/1 days/g, '1 hours');
        await writeFile(`${contractsDir}/ChefRatTest.sol`, chefRatContents);
        await writeFile(`${contractsDir}/KitchenPackTest.sol`, kitchenPackContents);

        const ChefRatTest = artifacts.require('ChefRatTest');
        const KitchenPackTest = artifacts.require('KitchenPackTest');
        const chefRat = await ChefRat.deployed();
        const kitchenPack = await KitchenPack.deployed();
        await prepareUpgrade(chefRat.address, ChefRatTest, { deployer });
        await prepareUpgrade(kitchenPack.address, KitchenPackTest, { deployer });
    }
};
