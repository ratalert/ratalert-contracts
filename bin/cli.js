const mri = require('mri');
const { scheduleAndExecute } = require('../test/helper');
const { toWei } = require('../test/helper');

const commands = {
    addController: async(contract, account) => {
        const instance = await artifacts.require(contract).deployed();
        if (account === 'dao') account = this.config.dao.address;
        return scheduleAndExecute(instance, 'addController', [[account]], { from: account }, Date.now());
    },
    mintFoodToken: async(contract, recipient, amount) => {
        const instance = await artifacts.require(contract).deployed();
        return instance.mint(recipient, toWei(amount), { from: this.config.dao.address });
    },
    configure: async(contract) => {
        const instance = await artifacts.require(contract).deployed();
        const config = this.config;
        const theStakehouse = await artifacts.require('TheStakehouse').deployed();
        const leStake = await artifacts.require('LeStake').deployed();
        const args = {
            Properties: [...config.properties],
            Paywall: [...config.payWall],
            Character: [...config.character],
            KitchenShop: [...config.kitchenShop],
            KitchenUsage: [...config.kitchenUsage, [theStakehouse.address, leStake.address]],
            McStake: [config.kitchen.mcStake.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee],
            TheStakehouse: [config.kitchen.theStakehouse.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, config.kitchen.theStakehouse.minEfficiency, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee],
            LeStake: [config.kitchen.leStake.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements, config.kitchen.leStake.minEfficiency, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee],
            Gym: [...config.gym],
        }
        console.log(`Configuring ${contract} with`, args[contract]);
        return scheduleAndExecute(instance, 'configure', args[contract], { from: this.config.dao.address }, Date.now());
    },
    toggleWhitelist: async(enable) => {
        console.log(`Setting whitelist status to ${enable}...`);
        console.log(await scheduleAndExecute(await this.getInst('Paywall'), 'toggleWhitelist', [enable === 'true'], { from: this.config.dao.address }, Date.now()));
    },
    onlyWhitelist: async() => {
        const status = await (await this.getInst('Paywall')).onlyWhitelist();
        console.log(`Whitelist only is ${status ? 'enabled' : 'disabled'}.`);
    },
    checkWhitelist: async (address) => {
        const amount = (await (await this.getInst('Paywall')).whitelist(address)).toString();
        console.log(`${address} has ${amount} whitelist spots.`);
    },
    addToWhitelist: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Adding ${amount} whitelist spots for ${addresses.split(',').length} addresses...`);
        console.log(await scheduleAndExecute(await this.getInst('Paywall'), 'addToWhitelist', [cumulated], { from: this.config.dao.address }, Date.now()));
        console.log('Done.');
    },
    removeFromWhitelist: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Removing ${amount} whitelist spots for ${addresses.split(',').length} addresses...`);
        console.log(await scheduleAndExecute(await this.getInst('Paywall'), 'removeFromWhitelist', [cumulated], { from: this.config.dao.address }, Date.now()));
        console.log('Done.');
    },
    checkFreeMints: async (address) => {
        const amount = (await (await this.getInst('Paywall')).freeMints(address)).toString();
        console.log(`${address} has ${amount} free mints spots.`);
    },
    addToFreeMints: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Adding ${amount} free mint spots for ${addresses.split(',').length} addresses...`);
        console.log(await scheduleAndExecute(await this.getInst('Paywall'), 'addToFreeMints', [cumulated], { from: this.config.dao.address }, Date.now()));
        console.log('Done.');
    },
    removeFromFreeMints: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Removing ${amount} free mint spots for ${addresses.split(',').length} addresses...`);
        console.log(await scheduleAndExecute(await this.getInst('Paywall'), 'removeFromFreeMints', [cumulated], { from: this.config.dao.address }, Date.now()));
        console.log('Done.');
    },
    manualFulfillRandomness: async (requestId) => {
        const randomness = Math.floor(Math.random() * 1000000000);
        console.log(`Fulfilling requestId ${requestId} with randomness ${randomness}`);
        const Mint = artifacts.require('MintV2');
        const mint = await Mint.deployed();
        console.log(await mint.manualFulfillRandomness(requestId, randomness));
    },
};

module.exports = async (callback) => {
    const argv = mri(process.argv.slice(4));
    const [cmd, ...args] = argv._
    const exec = commands[cmd];

    this.network = argv.network || 'develop';
    this.accounts = await web3.eth.getAccounts();
    this.config = require('../config')(this.network, this.accounts);
    this.getInst = contract => artifacts.require(contract).deployed();

    global.artifacts = artifacts;
    global.web3 = web3;

    if (!exec) {
        console.log('Usage: truffle exec bin/cli.js <cmd>');
        console.log('Commands:');
        Object.keys(commands).map(c => console.log(' ', c, commands[c].toString().split('\n')[0].match(/\((.*)\)/)[1].split(', ').map(a => a ? `<${a}>` : '').join(' ')));
        return callback();
    }
    if (args.length !== exec.length) {
        console.log(`${cmd} requires ${exec.length} argument(s):`, exec.toString().split('\n')[0].match(/\((.*)\)/)[1].split(', ').map(a => a ? `<${a}>` : '').join(' '));
        return callback();
    }
    await exec(...args, callback);
    callback();
};
