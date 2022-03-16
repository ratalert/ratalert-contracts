const { readdir, readFile } = require('fs/promises');
const chai = require('chai');
require('@openzeppelin/test-helpers');
const Config = require('../config');

const expect = chai.expect;
const config = Config('development')

exports.toWei = (ether) => web3.utils.toWei(ether.toString(), 'ether');
exports.fromWei = (wei) => Number(web3.utils.fromWei(wei, 'ether'));
exports.advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_increaseTime',
            params: [time],
            id: Date.now(),
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
};
exports.advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_mine',
            id: Date.now(),
        }, (err) => {
            if (err) { return reject(err); }
            const newBlockHash = web3.eth.getBlock('latest').hash;
            return resolve(newBlockHash)
        });
    });
};
exports.advanceTimeAndBlock = async (time) => {
    await module.exports.advanceTime(time);
    await module.exports.advanceBlock();
    return Promise.resolve(web3.eth.getBlock('latest'));
};
exports.loadTraits = async () => {
    const data = { chef: {}, rat: {} };
    const path = `${__dirname}/../images/characters`;
    const files = (await readdir(path)).sort();
    await files.reduce(async (previousPromise, file) => {
        await previousPromise;
        if (!file.includes('.png')) {
            return;
        }
        const [type, trait, , traitName, name] = file.substr(0, file.indexOf('.')).split('_')
        const png = (await readFile(`${path}/${file}`)).toString('base64');
        if (!data[type][trait]) {
            data[type][trait] = ['body', 'head'].includes(traitName) ? [] : [{ name: '', png: '' }];
        }
        data[type][trait].push({ name, png });
    }, Promise.resolve());
    return data;
};
exports.uploadCharacters = async (traits) => {
    const data = await module.exports.loadTraits();
    const res1 = await Promise.all(Object.values(data.chef).map((trait, i) => traits.uploadTraits(i, trait)));
    const res2 = await Promise.all(Object.values(data.rat).map((trait, i) => traits.uploadTraits(i + 10, trait)));
    return res1.concat(res2);
};
exports.loadKitchens = async () => {
    const data = [];
    const path = `${__dirname}/../images/kitchens`;
    const files = (await readdir(path)).sort();
    await files.reduce(async (previousPromise, file) => {
        await previousPromise;
        if (!file.includes('.png')) {
            return;
        }
        const [, name] = file.substr(0, file.indexOf('.')).split('_')
        const png = (await readFile(`${path}/${file}`)).toString('base64');
        data.push({ name, png });
    }, Promise.resolve());
    return data;
};
exports.uploadKitchens = async (kitchenShop) => {
    const data = await module.exports.loadKitchens();
    return Promise.all(data.map((kitchen, i) => kitchenShop.uploadImage(i, kitchen)));
};
exports.fulfill = async function (res) {
    const randomNumberRequestedAbi = this.mint.abi.find(item => item.name === 'RandomNumberRequested');
    const transferAbi = this.mint.abi.find(item => item.name === 'Transfer');
    const randomNumberFulfilledAbi = this.claim.abi.find(item => item.name === 'RandomNumberFulfilled');
    const randomNumberRequestedEvent = res.receipt.rawLogs.find(item => item.topics[0] === randomNumberRequestedAbi.signature);
    const requestId = web3.eth.abi.decodeLog(randomNumberRequestedAbi.inputs, randomNumberRequestedEvent.data, randomNumberRequestedEvent.topics).requestId;
    const res2 = await this.vrfCoordinator.callBackWithRandomness(requestId, 458948534, this.mint.address);
    const transferEvents = res2.receipt.rawLogs.filter(item => item.topics[0] === transferAbi.signature);
    const randomNumberFulfilledEvents = res2.receipt.rawLogs.filter(item => item.topics[0] === randomNumberFulfilledAbi.signature);
    res2.requestId = requestId;
    res2.logs = transferEvents.map(item => {
        item.args = web3.eth.abi.decodeLog(transferAbi.inputs, item.data, item.topics.slice(1));
        item.event = 'Transfer';
        delete item.data;
        delete item.topics;
        return item;
    });
    randomNumberFulfilledEvents.forEach(item => {
        item.args = web3.eth.abi.decodeLog(randomNumberFulfilledAbi.inputs, item.data, item.topics);
        item.event = 'RandomNumberFulfilled';
        delete item.data;
        delete item.topics;
        res2.logs.push(item);
    });
    return res2;
};
exports.mintAndFulfill = async function (amount, stake, options = { args: {} }) {
    const character = options.character || this.character;
    const args = options.args || {};
    args.value = typeof args.value !== 'undefined' ? args.value : exports.toWei(amount * 0.1);
    const res1 = await character.mint(amount, stake, { gasPrice: await web3.eth.getGasPrice(), ...args });
    const res2 = await exports.fulfill.call(this, res1);
    res1.requestId = res2.requestId;
    res1.logs = res2.logs;
    return res1;
};
exports.mintUntilWeHave = async function (numChefs, numRats, options, lists = { all: [], chefs: [], rats: [] }) {
    const { logs } = await exports.mintAndFulfill.call(this, 10, false, options);
    const ids = logs.filter(item => item.event === 'Transfer').map(ev => Number(ev.args.tokenId.toString()));
    await Promise.all(ids.map(async id => {
        const traits = await this.character.getTokenTraits(id);
        const copy = { id, ...traits }; // traits is frozen!
        lists.all.push(copy);
        copy.isChef ? lists.chefs.push(copy) : lists.rats.push(copy);
    }));
    console.log(`        minting characters, currently ${lists.chefs.length}/${numChefs} chefs & ${lists.rats.length}/${numRats} rats...`);
    if (lists.chefs.length < numChefs || lists.rats.length < numRats) {
        return exports.mintUntilWeHave.call(this, numChefs, numRats, options, lists);
    }
    return lists;
};
exports.fulfillClaimMany = async function (res) {
    const randomNumberRequestedAbi = this.claim.abi.find(item => item.name === 'RandomNumberRequested');
    const randomNumberFulfilledAbi = this.claim.abi.find(item => item.name === 'RandomNumberFulfilled');
    const chefClaimedAbi = this.kitchen.abi.find(item => item.name === 'ChefClaimed');
    const ratClaimedAbi = this.kitchen.abi.find(item => item.name === 'RatClaimed');
    const randomNumberRequestedEvent = res.receipt.rawLogs.find(item => item.topics[0] === randomNumberRequestedAbi.signature);
    const requestId = web3.eth.abi.decodeLog(randomNumberRequestedAbi.inputs, randomNumberRequestedEvent.data, randomNumberRequestedEvent.topics).requestId;
    const res2 = await this.vrfCoordinator.callBackWithRandomness(requestId, Math.floor(Math.random() * 1000000000), this.claim.address);
    const randomNumberFulfilledEvents = res2.receipt.rawLogs.filter(item => item.topics[0] === randomNumberFulfilledAbi.signature);
    const chefClaimedEvents = res2.receipt.rawLogs.filter(item => item.topics[0] === chefClaimedAbi.signature);
    const ratClaimedEvents = res2.receipt.rawLogs.filter(item => item.topics[0] === ratClaimedAbi.signature);
    res2.requestId = requestId;
    chefClaimedEvents.forEach(item => {
        item.args = web3.eth.abi.decodeLog(chefClaimedAbi.inputs, item.data, item.topics.slice(1));
        item.event = 'ChefClaimed';
        delete item.data;
        delete item.topics;
        res2.logs.push(item);
    });
    ratClaimedEvents.forEach(item => {
        item.args = web3.eth.abi.decodeLog(ratClaimedAbi.inputs, item.data, item.topics.slice(1));
        item.event = 'RatClaimed';
        delete item.data;
        delete item.topics;
        res2.logs.push(item);
    });
    randomNumberFulfilledEvents.forEach(item => {
        item.args = web3.eth.abi.decodeLog(randomNumberFulfilledAbi.inputs, item.data, item.topics);
        item.event = 'RandomNumberFulfilled';
        delete item.data;
        delete item.topics;
        res2.logs.push(item);
    });
    return res2;
};
exports.claimManyAndFulfill = async function (venue, ids, unstake, options = { args: {} }) {
    const res1 = await venue.claimMany(ids, unstake, { gasPrice: await web3.eth.getGasPrice(), ...options.args });
    const res2 = await exports.fulfillClaimMany.call(this, res1, options);
    res1.logs = res2.logs;
    return res1;
};
exports.trainUntilWeHave = async function(kitchen, efficiency, tolerance, list, days, unstake, options = {}) {
    process.stdout.write(`        training at ${kitchen.constructor._json.contractName} until efficiency ${efficiency < 0 ? '<' : '>'} ${Math.abs(efficiency)} & tolerance ${tolerance < 0 ? '<' : '>'} ${Math.abs(tolerance)}`);
    const ids = list.map(item => item.id);
    await kitchen.stakeMany(options.from, ids, { gasPrice: await web3.eth.getGasPrice(), ...options }); // Because it needs to be a valid tx params object
    let done;
    while (!done) {
        await exports.advanceTimeAndBlock(86400 * days); // Wait a few days
        const { logs } = await exports.claimManyAndFulfill.call(this, kitchen, ids, false);
        const efficiencyValues = logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event)).map(log => Number((log.args.skill ? log.args.skill : log.args.intelligence).toString()));
        const efficiencyReached = (efficiency < 0) ? efficiencyValues.filter(val => val > -efficiency).length === 0 : efficiencyValues.filter(val => val < efficiency).length === 0;
        const toleranceValues = logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event)).map(log => Number((log.args.insanity ? log.args.insanity : log.args.fatness).toString()));
        const toleranceReached = (tolerance < 0) ? toleranceValues.filter(val => val > -tolerance).length === 0 : toleranceValues.filter(val => val < tolerance).length === 0;
        done = efficiencyReached && toleranceReached;
        process.stdout.write('.');
    }
    process.stdout.write('\n');
    if (unstake) {
        await exports.advanceTimeAndBlock(3600); // Wait another hour so we can unstake
        await exports.claimManyAndFulfill.call(this, kitchen, ids, true);
        await Promise.all(list.map(async (item) => {
            const traits = await this.character.tokenTraits(item.id);
            item.efficiency = Number(traits.efficiency.toString());
            item.tolerance = Number(traits.tolerance.toString());
        }));
        if (list.find(item => item.efficiency < efficiency) || list.find(item => item.tolerance < tolerance)) {
            return exports.trainUntilWeHave.call(this, kitchen, efficiency, tolerance, list, days, unstake, options);
        }
    }
    return list;
};
exports.expectTotalFoodTokenEarnings = () => {
    return expect(this.kitchen.totalFoodTokensEarned()).to.eventually.be.a.bignumber.gte(toWei(totalFoodTokensEarned)).lt(toWei(totalFoodTokensEarned * 1.0001));
};
exports.chefBoost = (efficiency = 0) => {
    return (100 + (efficiency * config.kitchen.chefEfficiencyMultiplier / 100)) / 100;
};
exports.expectChefEarnings = (earned, period, efficiency) => {
    const nominal = period * config.kitchen.dailyChefEarnings / config.kitchen.accrualPeriod;
    const gross = nominal * exports.chefBoost(efficiency);
    const net = gross * (100 - config.kitchen.ratTheftPercentage) / 100;
    expect(earned).to.be.a.bignumber.gte(exports.toWei(net * 0.9999)).lt(exports.toWei(net * 1.0001));
};
exports.ratBoost = (tolerance = 0) => {
    return (((tolerance <= 50 ? tolerance : 100 - tolerance) * config.kitchen.ratEfficiencyMultiplier * 1000 / 100) + (config.kitchen.ratEfficiencyOffset * 1000)) / 100000;
};
exports.expectRatEarnings = (earned, pot, numRats, tolerance) => {
    const factor = exports.ratBoost(tolerance);
    const net = pot * factor / numRats;
    expect(earned).to.be.a.bignumber.gte(exports.toWei(net * 0.9999)).lt(exports.toWei(net * 1.0001));
};
exports.setupVRF = async (linkToken, consumer) => {
    return linkToken.mint(consumer.address, exports.toWei(1000));
};
