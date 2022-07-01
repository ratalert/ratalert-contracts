const { readdir, readFile } = require('fs/promises');
const crypto = require('crypto');
const chai = require('chai');
require('@openzeppelin/test-helpers');
const Config = require('../config');

const expect = chai.expect;
const config = Config('development')

Number.prototype.fix = function () { return parseFloat(this.toFixed(10)); } // Javascript precision quick fix
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
      if (err) {
        return reject(err);
      }
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
      if (err) {
        return reject(err);
      }
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
  if (exports.traits) {
    return exports.traits;
  }
  exports.traits = { chef: {}, rat: {} };
  const path = `${__dirname}/../images/characters`;
  const files = (await readdir(path)).sort();
  await files.reduce(async (previousPromise, file) => {
    await previousPromise;
    if (!file.includes('.png')) {
      return;
    }
    const [type, , , traitName, name] = file.substr(0, file.indexOf('.')).split('_');
    const png = (await readFile(`${path}/${file}`)).toString('base64');
    const md5 = crypto.createHash('md5').update(png);
    if (!exports.traits[type][traitName]) {
      exports.traits[type][traitName] = ['body', 'head'].includes(traitName) ? [] : [{ name: '', png: '', md5: '' }];
    }
    exports.traits[type][traitName].push({ name, png, md5: md5.digest('hex') });
  }, Promise.resolve());
  return exports.traits;
};
exports.uploadCharacters = async (traits, options) => {
  const data = await module.exports.loadTraits();
  const responses = [];
  for (let character in data) {
    await Object.values(data[character]).reduce(async (previousPromise, trait, i) => {
      await previousPromise;
      const offset = character === 'chef' ? 0 : 10;
      let res;
      if (options) {
        res = await exports.scheduleAndExecute(traits, 'uploadTraits', [offset + i, trait], options, i);
      } else {
        res = await traits.uploadTraits(offset + i, trait);
      }
      responses.push(res);
    }, Promise.resolve());
  }
  return responses;
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
  const res1 = await venue.claimMany(ids, unstake, { value: config.kitchen.claimFee, ...options.args });
  const res2 = await exports.fulfillClaimMany.call(this, res1, options);
  res1.logs = res2.logs;
  return res1;
};
exports.trainUntilWeHave = async function (kitchen, efficiency, tolerance, list, days, stake, unstake, options = { verbose: false, args: {} }) {
  if (options.verbose) {
    process.stdout.write(`        training at ${kitchen.constructor._json.contractName} until efficiency ${efficiency < 0 ? '<' : '>'} ${Math.abs(efficiency)} & tolerance ${tolerance < 0 ? '<' : '>'} ${Math.abs(tolerance)}`);
  }
  const events = { foodInspector: 0, ratTrap: 0, burnout: 0, cat: 0 };
  let ids = list.map(item => item.id);
  if (stake) {
    await kitchen.stakeMany(options.args.from, ids, { gasPrice: await web3.eth.getGasPrice(), ...options.args }); // Because it needs to be a valid tx params object
  }
  let done;
  while (!done) {
    await exports.advanceTimeAndBlock(86400 * days); // Wait a few days
    const { logs } = await exports.claimManyAndFulfill.call(this, kitchen, ids, false);
    ids = [];
    logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event)).map(log => {
      if (log.args.eventName) {
        events[log.args.eventName] ++;
      }
      const tokenEfficiency = Number((log.args.skill || log.args.intelligence).toString());
      const tokenTolerance = Number((log.args.freak || log.args.bodyMass).toString());
      const efficiencyReached = (efficiency < 0) ? tokenEfficiency < -efficiency : tokenEfficiency > efficiency;
      const toleranceReached = (efficiency < 0) ? tokenTolerance < -tolerance : tokenTolerance > tolerance;
      if (!efficiencyReached || !toleranceReached) {
        ids.push(Number(log.args.tokenId));
      }
    });
    done = ids.length === 0;
    process.stdout.write(options.verbose ? '.' : 'T');
  }
  if (options.verbose) {
    process.stdout.write(`\n        done, events: ${Object.entries(events).map(([k, v]) => `${v} ${k}s`).join(', ')}\n`);
  }
  if (unstake) {
    await exports.advanceTimeAndBlock(3600); // Wait another hour so we can unstake
    await exports.claimManyAndFulfill.call(this, kitchen, list.map(item => item.id), true);
    await Promise.all(list.map(async (item) => {
      const traits = await this.character.tokenTraits(item.id);
      item.efficiency = Number(traits.efficiency.toString());
      item.tolerance = Number(traits.tolerance.toString());
    }));
    if (list.find(item => item.efficiency < efficiency) || list.find(item => item.tolerance < tolerance)) {
      return exports.trainUntilWeHave.call(this, kitchen, efficiency, tolerance, list, days, stake, unstake, options);
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
exports.doesSvgTraitMatch = async (svg, type, trait, val) => {
  let idx = Math.floor(val * 7 / 100);
  if (idx > 6) idx = 6;
  const traitObj = (await exports.loadTraits())[type][trait][idx];
  svg = svg.split('>').join('>\n');
  let matches = svg.match(/"data:image\/png;base64,.*"/g);
  matches = matches.map(m => {
    const png = m.match(/"data:image\/png;base64,(.*)"/)[1];
    const md5 = crypto.createHash('md5').update(png);
    return { png, md5: md5.digest('hex') };
  });
  return typeof matches.find(m => m.md5 === traitObj.md5) !== 'undefined'; // found?
};
exports.getInstance = async (contract) => {
  try {
    return await artifacts.require(contract).deployed();
  } catch (e) {
    if (contract === 'TimelockController') {
      return { abi: [{"inputs":[{"internalType":"uint256","name":"minDelay","type":"uint256"},{"internalType":"address[]","name":"proposers","type":"address[]"},{"internalType":"address[]","name":"executors","type":"address[]"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"uint256","name":"index","type":"uint256"},{"indexed":false,"internalType":"address","name":"target","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"}],"name":"CallExecuted","type":"event","signature":"0xc2617efa69bab66782fa219543714338489c4e9e178271560a91b82c3f612b58"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"uint256","name":"index","type":"uint256"},{"indexed":false,"internalType":"address","name":"target","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"bytes32","name":"predecessor","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"delay","type":"uint256"}],"name":"CallScheduled","type":"event","signature":"0x4cf4410cc57040e44862ef0f45f3dd5a5e02db8eb8add648d4b0e236f1d07dca"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"Cancelled","type":"event","signature":"0xbaa1eb22f2a492ba1a5fea61b8df4d27c6c8b5f3971e63bb58fa14ff72eedb70"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"oldDuration","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"newDuration","type":"uint256"}],"name":"MinDelayChange","type":"event","signature":"0x11c24f4ead16507c69ac467fbd5e4eed5fb5c699626d2cc6d66421df253886d5"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event","signature":"0xbd79b86ffe0ab8e8776151514217cd7cacd52c909f66475c3af44e129f0b00ff"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event","signature":"0x2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event","signature":"0xf6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b"},{"inputs":[],"name":"CANCELLER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function","constant":true,"signature":"0xb08e51c0"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function","constant":true,"signature":"0xa217fddf"},{"inputs":[],"name":"EXECUTOR_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x07bd0265"},{"inputs":[],"name":"PROPOSER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x8f61f4f5"},{"inputs":[],"name":"TIMELOCK_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x0d3cf6fc"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x248a9ca3"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function","signature":"0x2f2ff15d"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x91d14854"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function","signature":"0x36568abe"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function","signature":"0xd547741f"},{"stateMutability":"payable","type":"receive","payable":true},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x01ffc9a7"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"isOperation","outputs":[{"internalType":"bool","name":"pending","type":"bool"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x31d50750"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"isOperationPending","outputs":[{"internalType":"bool","name":"pending","type":"bool"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x584b153e"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"isOperationReady","outputs":[{"internalType":"bool","name":"ready","type":"bool"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x13bc9f20"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"isOperationDone","outputs":[{"internalType":"bool","name":"done","type":"bool"}],"stateMutability":"view","type":"function","constant":true,"signature":"0x2ab0f529"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"getTimestamp","outputs":[{"internalType":"uint256","name":"timestamp","type":"uint256"}],"stateMutability":"view","type":"function","constant":true,"signature":"0xd45c4435"},{"inputs":[],"name":"getMinDelay","outputs":[{"internalType":"uint256","name":"duration","type":"uint256"}],"stateMutability":"view","type":"function","constant":true,"signature":"0xf27a0c92"},{"inputs":[{"internalType":"address","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes32","name":"predecessor","type":"bytes32"},{"internalType":"bytes32","name":"salt","type":"bytes32"}],"name":"hashOperation","outputs":[{"internalType":"bytes32","name":"hash","type":"bytes32"}],"stateMutability":"pure","type":"function","constant":true,"signature":"0x8065657f"},{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"},{"internalType":"uint256[]","name":"values","type":"uint256[]"},{"internalType":"bytes[]","name":"payloads","type":"bytes[]"},{"internalType":"bytes32","name":"predecessor","type":"bytes32"},{"internalType":"bytes32","name":"salt","type":"bytes32"}],"name":"hashOperationBatch","outputs":[{"internalType":"bytes32","name":"hash","type":"bytes32"}],"stateMutability":"pure","type":"function","constant":true,"signature":"0xb1c5f427"},{"inputs":[{"internalType":"address","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes32","name":"predecessor","type":"bytes32"},{"internalType":"bytes32","name":"salt","type":"bytes32"},{"internalType":"uint256","name":"delay","type":"uint256"}],"name":"schedule","outputs":[],"stateMutability":"nonpayable","type":"function","signature":"0x01d5062a"},{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"},{"internalType":"uint256[]","name":"values","type":"uint256[]"},{"internalType":"bytes[]","name":"payloads","type":"bytes[]"},{"internalType":"bytes32","name":"predecessor","type":"bytes32"},{"internalType":"bytes32","name":"salt","type":"bytes32"},{"internalType":"uint256","name":"delay","type":"uint256"}],"name":"scheduleBatch","outputs":[],"stateMutability":"nonpayable","type":"function","signature":"0x8f2a0bb0"},{"inputs":[{"internalType":"bytes32","name":"id","type":"bytes32"}],"name":"cancel","outputs":[],"stateMutability":"nonpayable","type":"function","signature":"0xc4d252f5"},{"inputs":[{"internalType":"address","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"bytes32","name":"predecessor","type":"bytes32"},{"internalType":"bytes32","name":"salt","type":"bytes32"}],"name":"execute","outputs":[],"stateMutability":"payable","type":"function","payable":true,"signature":"0x134008d3"},{"inputs":[{"internalType":"address[]","name":"targets","type":"address[]"},{"internalType":"uint256[]","name":"values","type":"uint256[]"},{"internalType":"bytes[]","name":"payloads","type":"bytes[]"},{"internalType":"bytes32","name":"predecessor","type":"bytes32"},{"internalType":"bytes32","name":"salt","type":"bytes32"}],"name":"executeBatch","outputs":[],"stateMutability":"payable","type":"function","payable":true,"signature":"0xe38335e5"},{"inputs":[{"internalType":"uint256","name":"newDelay","type":"uint256"}],"name":"updateDelay","outputs":[],"stateMutability":"nonpayable","type":"function","signature":"0x64d62353"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bytes","name":"","type":"bytes"}],"name":"onERC721Received","outputs":[{"internalType":"bytes4","name":"","type":"bytes4"}],"stateMutability":"nonpayable","type":"function","signature":"0x150b7a02"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"bytes","name":"","type":"bytes"}],"name":"onERC1155Received","outputs":[{"internalType":"bytes4","name":"","type":"bytes4"}],"stateMutability":"nonpayable","type":"function","signature":"0xf23a6e61"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"},{"internalType":"bytes","name":"","type":"bytes"}],"name":"onERC1155BatchReceived","outputs":[{"internalType":"bytes4","name":"","type":"bytes4"}],"stateMutability":"nonpayable","type":"function","signature":"0xbc197c81"}] };
    }
    throw e;
  }
};
exports.encodeFunctionCall = (contract, func, args = []) => {
  const abi = contract.abi.find(item => item.name === func);
  return web3.eth.abi.encodeFunctionCall(abi, args);
};
exports.decodeFunctionCall = async (contract, func, data) => {
  const instance = await exports.getInstance(contract);
  const params = instance.abi.find(item => item.name === func).inputs.map(item => item.type);
  return web3.eth.abi.decodeParameters(params, data.slice(10));
};
exports.scheduleAndExecute = async (contract, func, args, options, salt = 0, delay = 0) => {
  const cfg = Config(options.network || 'development');
  const timelockController = await exports.getInstance('TimelockController');
  const data = exports.encodeFunctionCall(contract, func, args);
  const timelockArgs = [
    contract.address,
    0, // value
    data,
    '0x0', // predecessor
    `0x${salt}`, // salt
    delay || cfg.timelock.minDelay,
  ];
  if (options.raw) {
    console.log(`Wrapped: ${contract.constructor._json.contractName}[${contract.address}].${func}(${timelockArgs.length} args) \n\nAddress: ${cfg.timelock.address}\n\nABI:\n${JSON.stringify(timelockController.abi)}\n`);
    return [
      {
        method: 'schedule',
        data: exports.encodeFunctionCall(timelockController, 'schedule', timelockArgs),
      },
      {
        method: 'execute',
        data: exports.encodeFunctionCall(timelockController, 'execute', timelockArgs.slice(0, -1)),
      },
    ];
  }
  await timelockController.schedule(...timelockArgs, options);
  await new Promise(resolve => setTimeout(resolve, delay * 1000));
  return timelockController.execute(...timelockArgs.slice(0, -1), options);
};
exports.decodeRawLogs = (res, contract, eventName, slice = 0) => {
  const abi = contract.abi.find(item => item.name === eventName);
  const ev = res.receipt.rawLogs.filter(item => item.topics[0] === abi.signature);
  return ev.map(item => {
    item.args = web3.eth.abi.decodeLog(abi.inputs, item.data, item.topics.slice(slice));
    item.event = abi.name;
    delete item.data;
    delete item.topics;
    res.logs.push(item);
    return item;
  });
};
exports.getUIConfig = (cfg) => {
  const getVenue = name => ({
    dailySkillRate: name === 'gym' ? 0 : cfg.kitchen[name].propertyIncrements[0],
    dailyFreakRate: name === 'gym' ? cfg.gym[2] : cfg.kitchen[name].propertyIncrements[1],
    dailyIntelligenceRate: name === 'gym' ? 0 : cfg.kitchen[name].propertyIncrements[2],
    dailyBodyMassRate: name === 'gym' ? cfg.gym[3] : cfg.kitchen[name].propertyIncrements[3],
    vestingPeriod: name === 'gym' ? cfg.gym[0] : cfg.kitchen.vestingPeriod,
    accrualPeriod: name === 'gym' ? cfg.gym[1] : cfg.kitchen.accrualPeriod,
    maxClaimsPerTx: name === 'gym' ? cfg.gym[4] : cfg.kitchen.maxClaimsPerTx,
    claimFee: name === 'gym' ? cfg.gym[5] : cfg.kitchen.claimFee,
  });
  const getKitchen = name => ({
    foodTokenMaxSupply: cfg.kitchen[name].foodTokenMaxSupply,
    dailyChefEarnings: cfg.kitchen.dailyChefEarnings,
    ratTheftPercentage: cfg.kitchen.ratTheftPercentage,
    chefEfficiencyMultiplier: cfg.kitchen.chefEfficiencyMultiplier,
    ratEfficiencyMultiplier: cfg.kitchen.ratEfficiencyMultiplier,
    ratEfficiencyOffset: cfg.kitchen.ratEfficiencyOffset,
  });
  const getEntrepreneurialKitchen = name => ({
    minEfficiency: cfg.kitchen[name].minEfficiency
  });
  const out = {
    Character: {
      maxTokens: cfg.character[0],
      gen0Tokens: cfg.character[1],
    },
    Paywall: {
      mintPrice: cfg.payWall[0],
      whitelistBoost: cfg.payWall[1],
      maxMintsPerTx: cfg.payWall[2],
      gen1PriceTier0: cfg.payWall[3][0],
      gen1PriceTier1: cfg.payWall[3][1],
      gen1PriceTier2: cfg.payWall[3][2],
      gen1PriceTier3: cfg.payWall[3][3],
    },
    KitchenShop: {
      tokenSupply: cfg.kitchenShop[0],
      maxMintsPerTx: cfg.kitchenShop[1],
      priceTier0: cfg.kitchenShop[3][0],
      priceTier1: cfg.kitchenShop[3][1],
      priceTier2: cfg.kitchenShop[3][2],
      priceTier3: cfg.kitchenShop[3][3],
      priceTier4: cfg.kitchenShop[3][4],
      chefsPerKitchen: cfg.kitchenUsage[0],
    },
    Properties: {
      disaster: {
        toleranceMinimumChef: cfg.properties[0][0],
        toleranceMinimumRat: cfg.properties[0][1],
        efficiencyLossChef: cfg.properties[0][2],
        efficiencyLossRat: cfg.properties[0][3],
        toleranceLossChef: cfg.properties[0][4],
        toleranceLossRat: cfg.properties[0][5],
      },
      mishap: {
        efficiencyMinimumChef: cfg.properties[1][0],
        efficiencyMinimumRat: cfg.properties[1][1],
        efficiencyLossChef: cfg.properties[1][2],
        efficiencyLossRat: cfg.properties[1][3],
        toleranceLossChef: cfg.properties[1][4],
        toleranceLossRat: cfg.properties[1][5],
      },
      likelihood: {
        disasterLikelihoodDividerChef: cfg.properties[2][0],
        disasterLikelihoodMultiplierChef: cfg.properties[2][1],
        disasterLikelihoodOffsetChef: cfg.properties[2][2],
        disasterLikelihoodDividerRat: cfg.properties[2][3],
        disasterLikelihoodMultiplierRat: cfg.properties[2][4],
        disasterLikelihoodOffsetRat: cfg.properties[2][5],
        mishapLikelihoodDividerChef: cfg.properties[2][6],
        mishapLikelihoodMultiplierChef: cfg.properties[2][7],
        mishapLikelihoodOffsetChef: cfg.properties[2][8],
        mishapLikelihoodDividerRat: cfg.properties[2][9],
        mishapLikelihoodMultiplierRat: cfg.properties[2][10],
        mishapLikelihoodOffsetRat: cfg.properties[2][11],
      }
    },
    McStake: {
      Venue: getVenue('mcStake'),
      Kitchen: getKitchen('mcStake'),
    },
    TheStakehouse: {
      Venue: getVenue('theStakehouse'),
      Kitchen: getKitchen('theStakehouse'),
      EntrepreneurialKitchen: getEntrepreneurialKitchen('theStakehouse'),
    },
    LeStake: {
      Venue: getVenue('leStake'),
      Kitchen: getKitchen('leStake'),
      EntrepreneurialKitchen: getEntrepreneurialKitchen('leStake'),
    },
    Gym: {
      Venue: getVenue('gym'),
    },
    TripleFiveClub: {
      Venue: {
        dailySkillRate: 0,
        dailyFreakRate: cfg.tripleFiveClub[2],
        dailyIntelligenceRate: 0,
        dailyBodyMassRate: cfg.tripleFiveClub[3],
        vestingPeriod: cfg.tripleFiveClub[0],
        accrualPeriod: cfg.tripleFiveClub[1],
        maxClaimsPerTx: cfg.tripleFiveClub[8],
        claimFee: cfg.tripleFiveClub[9],
      },
      boostLevel: cfg.tripleFiveClub[4],
      entranceFees: {
        gen0: cfg.tripleFiveClub[5][0],
        gen1: cfg.tripleFiveClub[5][1],
      },
      weekModulo: {
        start: cfg.tripleFiveClub[6][0],
        end: cfg.tripleFiveClub[6][1],
      },
      maxConcurrentGen1: cfg.tripleFiveClub[7],
    },
  };
  return JSON.stringify(out);
};
