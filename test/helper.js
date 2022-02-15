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
    const path = `${__dirname}/../images/final`;
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
exports.uploadTraits = async (traits) => {
    const data = await module.exports.loadTraits();
    const res1 = await Promise.all(Object.values(data.chef).map((trait, i) => traits.uploadTraits(i, trait)));
    const res2 = await Promise.all(Object.values(data.rat).map((trait, i) => traits.uploadTraits(i + 10, trait)));
    return res1.concat(res2);
};
exports.mintUntilWeHave = async function (numChefs, numRats, options = {}, lists = { all: [], chefs: [], rats: [] }) {
    const { logs } = await this.character.mint(10, false, { ...options, value: exports.toWei(1) });
    const ids = logs.map(ev => Number(ev.args.tokenId.toString()));
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
exports.trainUntilWeHave = async function(kitchen, efficiency, tolerance, list, days, options = {}) {
    console.log(`        training at ${kitchen.constructor._json.contractName} until efficiency=${efficiency} & tolerance=${tolerance}...`);
    const ids = list.map(item => item.id);
    await kitchen.stakeMany(options.from, ids, { ...options });
    let done;
    while (!done) {
        await exports.advanceTimeAndBlock(86400 * days); // Wait a few days
        const { logs } = await kitchen.claimMany(ids, false);
        const efficiencyValues = logs.map(log => Number((log.args.skill ? log.args.skill : log.args.intelligence).toString()));
        const toleranceValues = logs.map(log => Number((log.args.insanity ? log.args.insanity : log.args.fatness).toString()));
        done = efficiencyValues.filter(val => val < efficiency).length === 0 && toleranceValues.filter(val => val < tolerance).length === 0;
    }
    await exports.advanceTimeAndBlock(3600); // Wait another hour so we can unstake
    await kitchen.claimMany(ids, true);
    await Promise.all(list.map(async (item) => {
        const traits = await this.character.tokenTraits(item.id);
        item.efficiency = Number(traits.efficiency.toString());
        item.tolerance = Number(traits.tolerance.toString());
    }));
    if (list.find(item => item.efficiency < efficiency) || list.find(item => item.tolerance < tolerance)) {
        return exports.trainUntilWeHave.call(this, kitchen, efficiency, tolerance, list, days, options);
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
