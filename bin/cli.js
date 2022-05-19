const mri = require('mri');

const commands = {
    checkWhitelist: async (address) => {
        const amount = (await this.paywall.whitelist(address)).toString();
        console.log(`${address} has ${amount} free mints spots.`);
    },
    addToWhitelist: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Adding ${amount} whitelist spots for ${addresses.split(',').length} addresses...`);
        console.log(await this.paywall.addToWhitelist(cumulated));
        console.log('Done.');
    },
    removeFromWhitelist: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Removing ${amount} whitelist spots for ${addresses.split(',').length} addresses...`);
        console.log(await this.paywall.removeFromWhitelist(cumulated));
        console.log('Done.');
    },
    checkFreeMints: async (address) => {
        const amount = (await this.paywall.freeMints(address)).toString();
        console.log(`${address} has ${amount} free mints spots.`);
    },
    addToFreeMints: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Adding ${amount} free mint spots for ${addresses.split(',').length} addresses...`);
        console.log(await this.paywall.addToFreeMints(cumulated));
        console.log('Done.');
    },
    removeFromFreeMints: async (amount, addresses) => {
        let cumulated = [];
        for (let i = 0; i < amount; i++) {
            cumulated = cumulated.concat(addresses.split(','));
        }
        console.log(`Removing ${amount} free mint spots for ${addresses.split(',').length} addresses...`);
        console.log(await this.paywall.removeFromFreeMints(cumulated));
        console.log('Done.');
    },
    manualFulfillRandomness: async (requestId) => {
        const randomness = Math.floor(Math.random() * 1000000000);
        console.log(`Fulfilling requestId ${requestId} with randomness ${randomness}`);
        const Mint = artifacts.require('MintV2');
        const mint = await Mint.deployed();
        console.log(await mint.manualFulfillRandomness(requestId, randomness));
    },
    decodeRawLogs: async (contractName, eventName, data, topics) => {
        const contract = (await artifacts.require(contractName).deployed());
        const abi = contract.abi.find(item => item.name === eventName);
        const res = {
            logs: [],
            receipt: {
                rawLogs: [{ data, topics: topics.split(',') }]
            }
        };
        const slice = 0;
        const ev = res.receipt.rawLogs.filter(item => item.topics[0] === abi.signature);
        console.log(ev.map(item => {
            item.args = web3.eth.abi.decodeLog(abi.inputs, item.data, item.topics.slice(slice));
            item.event = abi.name;
            delete item.data;
            delete item.topics;
            res.logs.push(item);
            return item;
        }));
    }
};

module.exports = async (callback) => {
    const Paywall = artifacts.require('Paywall');

    this.paywall = await Paywall.deployed();

    const argv = mri(process.argv.slice(4));
    const [cmd, ...args] = argv._
    const exec = commands[cmd];
    if (!exec) {
        console.log('Usage: truffle exec bin/cli.js <cmd>');
        return callback();
    }
    if (args.length !== exec.length) {
        console.log(`${cmd} requires ${exec.length} argument(s):`, exec.toString().split('\n')[0].match(/\((.*)\)/)[1]);
        return callback();
    }
    await exec(...args, callback);
    callback();
};
