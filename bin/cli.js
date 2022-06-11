const mri = require('mri');
const { scheduleAndExecute, getUIConfig, encodeFunctionCall, toWei, decodeFunctionCall } = require('../test/helper');

const commands = {
    pause: async(contract) => {
        console.log(`Pausing ${contract}...`);
        const res = await this.executeOrEncode(await getInst(contract), 'pause');
        if (res) console.log(res);
    },
    unpause: async(contract) => {
        console.log(`Unpausing ${contract}...`);
        const res = await this.executeOrEncode(await getInst(contract), 'unpause');
        if (res) console.log(res);
    },
    paused: async(contract) => {
        const status = await (await this.getInst(contract)).paused();
        console.log(`${contract} is ${status ? 'paused' : 'not paused'}`);
    },
    addController: async(contract, account) => {
        if (account === 'dao') account = this.config.dao.address;
        const res = await scheduleAndExecute(await getInst(contract), 'addController', [[account]], { from: this.config.dao.address, network: this.network, raw: this.network === 'main' }, Date.now());
        if (res) console.log(res);
    },
    removeController: async(contract, account) => {
        if (account === 'dao') account = this.config.dao.address;
        const res = await scheduleAndExecute(await getInst(contract), 'removeController', [[account]], { from: this.config.dao.address, network: this.network, raw: this.network === 'main' }, Date.now());
        if (res) console.log(res);
    },
    addVenue: async(contract, account) => {
        if (account === 'dao') account = this.config.dao.address;
        const res = await scheduleAndExecute(await getInst(contract), 'addVenue', [[account]], { from: this.config.dao.address, network: this.network, raw: this.network === 'main' }, Date.now());
        if (res) console.log(res);
    },
    removeVenue: async(contract, account) => {
        if (account === 'dao') account = this.config.dao.address;
        const res = await scheduleAndExecute(await getInst(contract), 'removeVenue', [[account]], { from: this.config.dao.address, network: this.network, raw: this.network === 'main' }, Date.now());
        if (res) console.log(res);
    },
    mintFoodToken: async(contract, recipient, amount) => {
        const instance = await artifacts.require(contract).deployed();
        const res = this.executeOrEncode(instance, 'mint', [recipient, toWei(amount)]);
        if (res) console.log(res);
    },
    withdrawPayments: async(contract) => {
        const instance = await artifacts.require(contract).deployed();
        const res = this.executeOrEncode(instance, 'withdrawPayments');
        if (res) console.log(res);
    },
    withdrawLink: async(contract, amount) => {
        const instance = await artifacts.require(contract).deployed();
        const res = this.executeOrEncode(instance, 'withdrawLink', [toWei(amount)]);
        if (res) console.log(res);
    },
    configure: async(contract) => {
        const instance = await artifacts.require(contract).deployed();
        const config = this.config;
        const theStakehouse = await artifacts.require('TheStakehouse').deployed();
        const properties = await artifacts.require('Properties').deployed();
        const leStake = await artifacts.require('LeStake').deployed();
        const args = {
            Properties: [...config.properties],
            Paywall: [...config.payWall],
            Character: [...config.character, properties.address],
            KitchenShop: [...config.kitchenShop],
            KitchenUsage: [...config.kitchenUsage, [theStakehouse.address, leStake.address]],
            McStake: [config.kitchen.mcStake.foodTokenMaxSupply, [config.kitchen.mcStake.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee],
            TheStakehouse: [config.kitchen.theStakehouse.foodTokenMaxSupply, [config.kitchen.theStakehouse.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, config.kitchen.theStakehouse.minEfficiency, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee],
            LeStake: [config.kitchen.leStake.foodTokenMaxSupply, [config.kitchen.leStake.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements, config.kitchen.leStake.minEfficiency, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee],
            Gym: [...config.gym],
        };
        console.log(`Configuring ${contract} with`, args[contract]);
        const res = await scheduleAndExecute(instance, 'configure', args[contract], { from: this.config.dao.address, network: this.network, raw: this.network === 'main' }, Date.now());
        if (res) console.log(res);
    },
    setConfig: async() => {
        console.log('Updating UI config:\n', getUIConfig(this.config));
        const res = await scheduleAndExecute(await this.getInst('Config'), 'set', [getUIConfig(this.config)], { from: this.config.dao.address, network: this.network, raw: this.network === 'main' }, Date.now());
        if (res) console.log(res);
    },
    transferOwnership: async(contract, to) => {
        if (to === 'dao') to = this.config.dao.address;
        console.log(`Configuring ${contract} ownership to ${to}`);
        const res = await scheduleAndExecute(await this.getInst(contract), 'transferOwnership', [this.config.dao.address], { from: this.config.dao.address, network: this.network, raw: this.network === 'main' }, Date.now());
        if (res) console.log(res);
    },
    toggleWhitelist: async(enable) => {
        console.log(`Setting whitelist status to ${enable}...`);
        const res = await this.executeOrEncode(await getInst('Paywall'), 'toggleWhitelist', [enable === true]);
        if (res) console.log(res);
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
        const res = await this.executeOrEncode(await getInst('Paywall'), 'addToWhitelist', [cumulated]);
        if (res) console.log(res);
    },
    removeFromWhitelist: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Removing ${amount} whitelist spots for ${addresses.split(',').length} addresses...`);
        const res = await this.executeOrEncode(await getInst('Paywall'), 'removeFromWhitelist', [cumulated]);
        if (res) console.log(res);
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
        const res = await this.executeOrEncode(await getInst('Paywall'), 'addToFreeMints', [cumulated]);
        if (res) console.log(res);
    },
    removeFromFreeMints: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Removing ${amount} free mint spots for ${addresses.split(',').length} addresses...`);
        const res = await this.executeOrEncode(await getInst('Paywall'), 'removeFromFreeMints', [cumulated]);
        if (res) console.log(res);
    },
    manualFulfillRandomness: async (requestId) => {
        const randomness = Math.floor(Math.random() * 1000000000);
        console.log(`Fulfilling requestId ${requestId} with randomness ${randomness}`);
        const Mint = artifacts.require('MintV2');
        const mint = await Mint.deployed();
        console.log(await mint.manualFulfillRandomness(requestId, randomness));
    },
    decodeFunctionCall: async (contract, func, data) => {
        console.log(await decodeFunctionCall(contract, func, data));
    }
};

module.exports = async (callback) => {
    const argv = mri(process.argv.slice(4));
    const [cmd, ...args] = argv._
    const exec = commands[cmd];

    this.network = argv.network || 'develop';
    this.accounts = await web3.eth.getAccounts();
    this.config = require('../config')(this.network, this.accounts);
    this.getInst = contract => artifacts.require(contract).deployed();
    this.executeOrEncode = (instance, method, args, options = {}) => {
        if (this.network === 'main') {
            const data = encodeFunctionCall(instance, method, args);
            console.log(`Address: ${instance.address}\n\nABI:\n${JSON.stringify(instance.abi)}\n\nData: ${data}`);
            return;
        }
        return instance[method](...args, { from: this.config.dao.address, ...options });
    };

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
