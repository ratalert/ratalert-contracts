const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { toWei, advanceTimeAndBlock, uploadTraits } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const FastFood = artifacts.require('FastFood');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');

contract('McStake (proxy) load test', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.foodToken = await FastFood.deployed();
        this.character = await Character.deployed();
        this.kitchen = await McStake.deployed();
    });

    it.skip('mints food tokens correctly', async () => {
        const days = 2500; // n days
        const users = [[owner, []], [anon, []]];
        const expected = [
            { users: [{ balance: 20000000 }, { balance: 20000000 }], totalChefsStaked: 20, totalFoodTokensEarned: 50000000, unaccountedRewards: 10000000 },
            { users: [{ balance: 60000000 }, { balance: 60000000 }], totalChefsStaked: 40, totalFoodTokensEarned: 150000000, unaccountedRewards: 30000000 },
            { users: [{ balance: 120000000 }, { balance: 120000000 }], totalChefsStaked: 60, totalFoodTokensEarned: 300000000, unaccountedRewards: 60000000 },
            { users: [{ balance: 200000000 }, { balance: 200000000 }], totalChefsStaked: 80, totalFoodTokensEarned: 500000000, unaccountedRewards: 100000000 },
            { users: [{ balance: 300000000 }, { balance: 300000000 }], totalChefsStaked: 100, totalFoodTokensEarned: 750000000, unaccountedRewards: 150000000 },
            { users: [{ balance: 420000000 }, { balance: 380000000 }], totalChefsStaked: 120, totalFoodTokensEarned: 1000000000, unaccountedRewards: 200000000 }, // uncapped 1050000000
            { users: [{ balance: 420000000 }, { balance: 380000000 }], totalChefsStaked: 140, totalFoodTokensEarned: 1000000000, unaccountedRewards: 200000000 }, // uncapped 1400000000
        ];
        const totalEpochs = 6;
        let epoch = 0;
        for (let i = 0; i <= totalEpochs; i++) {
            console.log(`      [Epoch ${i}/${totalEpochs}] ${expected[epoch].totalChefsStaked} chefs staked, ${expected[epoch].totalFoodTokensEarned} tokens earned after ${(i + 1) * days} days`);
            await Promise.all(users.map(async ([from], j) => {
                const { logs } = await this.character.mint(10, false, { from, value: toWei(1) });
                const ids = logs.map(ev => Number(ev.args.tokenId.toString()));
                users[j][1] = users[j][1].concat(ids);
                await this.kitchen.stakeMany(from, ids, { from });
            }));
            await advanceTimeAndBlock(days * 86400); // Wait "a few" days
            await Promise.all(users.map(async ([from], j) => {
                await this.kitchen.claimMany(users[j][1], false, { from });
                await expect(this.foodToken.balanceOf(from)).to.eventually.be.a.bignumber.gte(toWei(expected[epoch].users[j].balance * 0.0009)).lte(toWei(expected[epoch].users[j].balance * 1.0001));
            }));
            await expect(this.kitchen.totalChefsStaked()).to.eventually.be.a.bignumber.that.equals(expected[epoch].totalChefsStaked.toString());
            await expect(this.kitchen.totalFoodTokensEarned()).to.eventually.be.a.bignumber.gte(toWei(expected[epoch].totalFoodTokensEarned)).lte(toWei(expected[epoch].totalFoodTokensEarned * 1.0001));
            await expect(this.kitchen.unaccountedRewards()).to.eventually.be.a.bignumber.gte(toWei(expected[epoch].unaccountedRewards * 0.0009)).lte(toWei(expected[epoch].unaccountedRewards * 1.0001));
            epoch += 1;
        }
    });
});
