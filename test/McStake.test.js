const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { BN } = require('@openzeppelin/test-helpers');
const { toWei, fromWei, advanceTimeAndBlock, mintUntilWeHave, chefBoost, expectChefEarnings, ratBoost, expectRatEarnings, mintAndFulfill, claimManyAndFulfill, doesSvgTraitMatch, scheduleAndExecute } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);
const expect = chai.expect;
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');
const FastFood = artifacts.require('FastFood');
const Paywall = artifacts.require('Paywall');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');

let totalFoodTokensEarned = 0;

function expectTotalFoodTokenEarnings() {
  return expect(this.kitchen.totalFoodTokensEarned()).to.eventually.be.a.bignumber.gte(toWei(totalFoodTokensEarned)).lt(toWei(totalFoodTokensEarned * 1.0001));
}

contract('McStake (proxy)', (accounts) => {
  const owner = accounts[0];
  const anon = accounts[1];
  const dao = accounts[9];
  let lists;
  let ownerBalance;

  before(async () => {
    this.vrfCoordinator = await VRFCoordinator.deployed();
    this.linkToken = await LinkToken.deployed();
    this.mint = await Mint.deployed();
    this.claim = await Claim.deployed();
    this.foodToken = await FastFood.deployed();
    this.paywall = await Paywall.deployed();
    this.character = await Character.deployed();
    this.kitchen = await McStake.deployed();

    lists = await mintUntilWeHave.call(this, 8, 3);
    lists.cutoff = [lists.chefs[2], lists.rats[2]];
    lists.chefs = [lists.chefs[0], lists.chefs[1]];
    lists.rats = [lists.rats[0], lists.rats[1]];
    lists.all = lists.chefs.concat(lists.rats);
  });

  describe('stakeMany()', () => {
    it('fails to stake non-existent tokens', async () => {
      await expect(this.kitchen.stakeMany(owner, [9999], { from: owner })).to.eventually.be.rejectedWith('owner query for nonexistent token');
    });
    it('fails to stake someone else\'s tokens', async () => {
      const { logs } = await mintAndFulfill.call(this, 1, false, { args: { from: anon } });
      const tokenId = Number(logs[0].args.tokenId.toString());
      await expect(this.kitchen.stakeMany(owner, [tokenId], { from: owner })).to.eventually.be.rejectedWith('Not your token');
    });
    it('stakes many tokens', async () => {
      const { logs } = await this.kitchen.stakeMany(owner, lists.all.map(item => item.id), { from: owner });
      const block = await web3.eth.getBlock('latest');
      logs.forEach((log, i) => {
        const tokenId = Number(log.args.tokenId.toString());
        expect(log.event).to.equal('TokenStaked');
        expect(tokenId).to.equal(lists.all[i].id);
        expect(log.args.owner).to.equal(owner);
        if (lists.chefs.find(item => item.id === tokenId)) {
          expect(Number(log.args.value.toString())).to.equal(block.timestamp);
        } else {
          expect(Number(log.args.value.toString())).to.equal(0);
        }
      });
      await Promise.all(lists.chefs.map(async (item, i) => {
        item.stakerIndex = i;
        const stakerIndexId = await this.kitchen.stakers(owner, i);
        expect(stakerIndexId).to.be.a.bignumber.eq(item.id.toString());
      }));
      expect(this.kitchen.stakers(owner, 2)).to.eventually.be.rejected;
      await expect(this.character.ownerOf(lists.chefs[0].id)).to.eventually.equal(this.kitchen.address);
      await expect(this.character.ownerOf(lists.rats[1].id)).to.eventually.equal(this.kitchen.address);
      const chef0 = await this.kitchen.chefs(lists.chefs[0].id);
      const rat0 = await this.kitchen.rats(lists.rats[0].id);
      await expect(chef0.owner).to.equal(owner);
      await expect(rat0.owner).to.equal(owner);
      await expect(chef0.value.toString()).to.equal(block.timestamp.toString());
      await expect(rat0.value.toString()).to.equal('0');
    });
  });
  describe('claimMany()', () => {
    it('fails to unstake someone else\'s tokens', async () => {
      const ids = [lists.chefs[0].id, lists.rats[0].id];
      await expect(this.kitchen.claimMany(ids, true, { from: anon })).to.eventually.be.rejectedWith('Not your token');
    });
    it('cannot claim before EOB', async () => {
      await expect(this.kitchen.claimMany([lists.chefs[0].id, lists.chefs[1].id], false)).to.eventually.be.rejectedWith('Cannot claim before EOB');
    });
    it('claims from chefs', async () => {
      await advanceTimeAndBlock(86400 / 2); // Wait half a day
      const chefs = [lists.chefs[0].id, lists.chefs[1].id];
      const { logs } = await claimManyAndFulfill.call(this, this.kitchen, chefs, false);
      const fulfilledEvent = logs.find(item => item.event === 'RandomNumberFulfilled');
      expect(fulfilledEvent.args.sender).to.equal(owner);
      const claimEvents = logs.filter(item => item.event === 'ChefClaimed');
      claimEvents.forEach((log, i) => {
        expect(log.event).to.equal('ChefClaimed');
        expect(log.args.tokenId).to.be.a.bignumber.eq(chefs[i].toString());
        expectChefEarnings(log.args.earned, 86400 / 2, 0);
        expect(log.args.unstaked).to.be.false;
        expect(log.args.skill).to.be.a.bignumber.eq('1');
        expect(log.args.freak).to.be.a.bignumber.eq('2');
        expect(log.args.eventName).to.equal('');
        expect(log.args.foodTokensPerRat).to.be.a.bignumber.gte(toWei((i + 1) * 25 / lists.rats.length)).lt(toWei((i + 1) * 25 * 1.0001 / lists.rats.length));
      });
      totalFoodTokensEarned += 2 * 125 * 0.8; // 2 chefs for half a day at skill 0
      await expect(this.character.ownerOf(chefs[0])).to.eventually.equal(this.kitchen.address);
      await expect(this.character.ownerOf(chefs[1])).to.eventually.equal(this.kitchen.address);
      await expect(this.foodToken.balanceOf(owner)).to.eventually.be.a.bignumber.gte(toWei(200)).lt(toWei(200.1)); // 2 chefs staked for half a day = 5000^18 each
      await expectTotalFoodTokenEarnings.call(this);
      await expect(this.kitchen.foodTokensPerRat()).to.eventually.be.a.bignumber.gte(toWei(50 / lists.rats.length)).lt(toWei(50.01 / lists.rats.length));
      const ts = (await web3.eth.getBlock('latest')).timestamp;
      await expect(this.kitchen.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());

      await Promise.all(chefs.map(async id => {
        const traits = await this.character.getTokenTraits(id);
        expect(traits.efficiency).to.be.a.bignumber.eq('1');
        expect(traits.tolerance).to.be.a.bignumber.eq('2');
      }));
    });
    it('claims from rats', async () => {
      const rats = [lists.rats[0].id, lists.rats[1].id];
      ownerBalance = BN(await this.foodToken.balanceOf(owner));
      const { logs } = await claimManyAndFulfill.call(this, this.kitchen, rats, false);
      const claimEvents = logs.filter(item => item.event === 'RatClaimed');
      claimEvents.forEach((log, i) => {
        expect(log.event).to.equal('RatClaimed');
        expect(log.args.tokenId).to.be.a.bignumber.eq(rats[i].toString());
        expectRatEarnings(log.args.earned, 50, lists.rats.length, 0);
        expect(log.args.unstaked).to.be.false;
        expect(log.args.intelligence).to.be.a.bignumber.eq('1');
        expect(log.args.bodyMass).to.be.a.bignumber.eq('4');
        expect(log.args.eventName).to.equal('');
        expect(log.args.foodTokensPerRat).to.be.a.bignumber.gt('0');
        ownerBalance.iadd(new BN(log.args.earned));
      });
      totalFoodTokensEarned += 2 * 25 * 0.55; // 2 rats for half a day at bodyMass 0
      await expect(this.character.ownerOf(rats[0])).to.eventually.equal(this.kitchen.address);
      await expect(this.character.ownerOf(rats[1])).to.eventually.equal(this.kitchen.address);
      await expect(this.foodToken.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
      await expectTotalFoodTokenEarnings.call(this);
      await expect(this.kitchen.foodTokensPerRat()).to.eventually.be.a.bignumber.gte(toWei(50 / lists.rats.length)).lt(toWei(50.01 / lists.rats.length));
      const ts = (await web3.eth.getBlock('latest')).timestamp;
      await expect(this.kitchen.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());

      await Promise.all(rats.map(async id => {
        const traits = await this.character.getTokenTraits(id);
        expect(traits.efficiency).to.be.a.bignumber.eq('1');
        expect(traits.tolerance).to.be.a.bignumber.eq('4');
      }));
    });
    it('distributes nothing when claimed twice', async () => {
      await expect(this.kitchen.claimMany([lists.rats[0].id, lists.rats[1].id], false)).to.eventually.be.rejectedWith('Cannot claim before EOB');
    });
    it('unstakes many chefs', async () => {
      await advanceTimeAndBlock(86400 / 2); // Wait half a day
      const chefs = [lists.chefs[0].id, lists.chefs[1].id];
      ownerBalance = BN(await this.foodToken.balanceOf(owner));
      const { logs } = await claimManyAndFulfill.call(this, this.kitchen, chefs, true);
      const claimEvents = logs.filter(item => item.event === 'ChefClaimed');
      claimEvents.forEach((log, i) => {
        expect(log.event).to.equal('ChefClaimed');
        expect(log.args.tokenId).to.be.a.bignumber.eq(chefs[i].toString());
        expectChefEarnings(log.args.earned, 86400 / 2, 1);
        expect(log.args.unstaked).to.be.true;
        expect(log.args.skill).to.be.a.bignumber.eq('2');
        expect(log.args.freak).to.be.a.bignumber.eq('4');
        expect(log.args.eventName).to.equal('');
        expect(log.args.foodTokensPerRat).to.be.a.bignumber.gte(toWei((50 + (i + 1) * 25 * chefBoost(1)) / lists.rats.length)).lt(toWei((50 + (i + 1) * 25.4475) / lists.rats.length));
        ownerBalance.iadd(new BN(log.args.earned));
      });
      await Promise.all(lists.chefs.map(async item => {
        await expect(this.kitchen.stakers(owner, item.stakerIndex)).to.eventually.be.rejected;
      }));
      totalFoodTokensEarned += 2 * 125 * chefBoost(1) * 0.8; // 2 chefs for half a day at skill 1
      await expect(this.character.ownerOf(chefs[0])).to.eventually.equal(owner);
      await expect(this.character.ownerOf(chefs[1])).to.eventually.equal(owner);
      await expect(this.foodToken.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
      await expectTotalFoodTokenEarnings.call(this);
      await expect(this.kitchen.foodTokensPerRat()).to.eventually.be.a.bignumber.gte(toWei((50 + 50 * chefBoost(1)) / lists.rats.length)).lt(toWei((50 + 50 * chefBoost(1)) * 1.0001 / lists.rats.length));
      const ts = (await web3.eth.getBlock('latest')).timestamp;
      await expect(this.kitchen.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());

      const chef0 = await this.kitchen.chefs(chefs[0]);
      const chef1 = await this.kitchen.chefs(chefs[1]);
      await expect(chef0.owner).to.equal('0x0000000000000000000000000000000000000000');
      await expect(chef1.owner).to.equal('0x0000000000000000000000000000000000000000');
      await expect(chef0.value.toString()).to.equal('0');
      await expect(chef1.value.toString()).to.equal('0');

      await Promise.all(chefs.map(async id => {
        const traits = await this.character.getTokenTraits(id);
        expect(traits.efficiency).to.be.a.bignumber.eq('2');
        expect(traits.tolerance).to.be.a.bignumber.eq('4');
      }));
    });
    it('fails to unstake chefs twice', async () => {
      const chefs = [lists.chefs[0].id, lists.chefs[1].id];
      await expect(this.kitchen.claimMany(chefs, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
    });
    it('unstakes many rats', async () => {
      const rats = lists.rats.map(item => item.id);
      ownerBalance = BN(await this.foodToken.balanceOf(owner));
      const { logs } = await claimManyAndFulfill.call(this, this.kitchen, rats, true);
      const claimEvents = logs.filter(item => item.event === 'RatClaimed');
      claimEvents.forEach((log, i) => {
        expect(log.event).to.equal('RatClaimed');
        expect(log.args.tokenId).to.be.a.bignumber.eq(rats[i].toString());
        expectRatEarnings(log.args.earned, 50 * chefBoost(1), lists.rats.length, 4);
        expect(log.args.unstaked).to.be.true;
        expect(log.args.intelligence).to.be.a.bignumber.eq('2');
        expect(log.args.bodyMass).to.be.a.bignumber.eq('8');
        expect(log.args.eventName).to.equal('');
        expect(log.args.foodTokensPerRat).to.be.a.bignumber.gt('0');
        ownerBalance.iadd(new BN(log.args.earned));
      });
      totalFoodTokensEarned += 2 * 25 * chefBoost(1) * ratBoost(4); // food tokens from 2 skill 1 chefs for 2 rats for half a day at bodyMass 4
      await expect(this.character.ownerOf(rats[0])).to.eventually.equal(owner);
      await expect(this.character.ownerOf(rats[1])).to.eventually.equal(owner);
      await expect(this.foodToken.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
      await expectTotalFoodTokenEarnings.call(this);
      await expect(this.kitchen.foodTokensPerRat()).to.eventually.be.a.bignumber.gte(toWei((50 + 50 * chefBoost(1)) / lists.rats.length)).lt(toWei((50 + 50 * chefBoost(1)) * 1.0001 / lists.rats.length));

      const rat0 = await this.kitchen.rats(rats[0]);
      const rat1 = await this.kitchen.rats(rats[1]);
      await expect(rat0.owner).to.equal('0x0000000000000000000000000000000000000000');
      await expect(rat1.owner).to.equal('0x0000000000000000000000000000000000000000');
      await expect(rat0.value.toString()).to.equal('0');
      await expect(rat1.value.toString()).to.equal('0');

      await Promise.all(rats.map(async id => {
        const traits = await this.character.getTokenTraits(id);
        expect(traits.efficiency).to.be.a.bignumber.eq('2');
        expect(traits.tolerance).to.be.a.bignumber.eq('8');
      }));
    });
    it('fails to unstake rats twice', async () => {
      const rats = [lists.rats[0].id, lists.rats[1].id];
      await expect(this.kitchen.claimMany(rats, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
    });
    it('handles level upgrades', async () => {
      const list = { chef: { id: lists.chefs[0].id }, rat: { id: lists.rats[0].id } };
      const { logs } = await this.kitchen.stakeMany(owner, Object.values(list).map(item => item.id), { from: owner });
      logs.forEach((log) => {
        const tokenId = Number(log.args.tokenId.toString());
        if (tokenId === list.rat.id) {
          expect(log.args.value).to.be.a.bignumber.gte(toWei((50 + 50 * chefBoost(1)) / lists.rats.length)).lt(toWei((50 + 50 * chefBoost(1)) * 1.0001 / lists.rats.length));
        }
      });
      await Promise.all(Object.values(list).map(async item => {
        const traits = await this.character.getTokenTraits(item.id);
        item.efficiency = Number(traits.efficiency.toString());
        item.tolerance = Number(traits.tolerance.toString());
      }));
      process.stdout.write('        running 100 claims');
      const events = { foodInspector: 0, burnout: 0, ratTrap: 0, cat: 0 };
      for (let i = 0; i <= 100; i += 1) {
        await advanceTimeAndBlock(86400); // Wait a day
        const { logs } = await claimManyAndFulfill.call(this, this.kitchen, Object.values(list).map(item => item.id), false);
        const claimEvents = logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event));
        await Promise.all(claimEvents.map(async ({ event, args }) => {
          const efficiency = Number((event === 'ChefClaimed' ? args.skill : args.intelligence).toString());
          const tolerance = Number((event === 'ChefClaimed' ? args.freak : args.bodyMass).toString());
          const tokenUri = await this.character.tokenURI(args.tokenId);
          const json = JSON.parse(Buffer.from(tokenUri.split(',')[1], 'base64').toString());
          const svg = Buffer.from(json.image.split(',')[1], 'base64').toString();

          if (event === 'ChefClaimed') {
            expectChefEarnings(args.earned, 86400, list.chef.efficiency);
            list.chef.earned = args.earned;
            if (args.eventName === 'foodInspector') {
              const newEfficiency = (10 > list.chef.efficiency) ? 0 : list.chef.efficiency - 10;
              const newTolerance = (25 > list.chef.tolerance) ? 0 : list.chef.tolerance - 25;
              expect(efficiency).to.equal(newEfficiency);
              expect(tolerance).to.equal(newTolerance);
              list.chef.efficiency = newEfficiency;
              list.chef.tolerance = newTolerance;
            } else if (args.eventName === 'burnout') {
              expect(efficiency).to.equal(0);
              expect(tolerance).to.equal(0);
              list.chef.efficiency = 0;
              list.chef.tolerance = 0;
            } else {
              const newEfficiency = (list.chef.efficiency + 2 > 100) ? 100 : list.chef.efficiency + 2;
              const newTolerance = (list.chef.tolerance + 4 > 100) ? 100 : list.chef.tolerance + 4;
              expect(efficiency).to.equal(newEfficiency);
              expect(tolerance).to.equal(newTolerance);
              list.chef.efficiency = newEfficiency;
              list.chef.tolerance = newTolerance;
            }
            await expect(doesSvgTraitMatch(svg, 'chef','body', efficiency)).to.eventually.be.true;
            await expect(doesSvgTraitMatch(svg, 'chef','head', tolerance)).to.eventually.be.true;
          } else {
            expectRatEarnings(args.earned, fromWei(list.chef.earned) / 8 * 2, 1, list.rat.tolerance);
            if (args.eventName === 'ratTrap') {
              const newEfficiency = (10 > list.rat.efficiency) ? 0 : list.rat.efficiency - 10;
              const newTolerance = (50 > list.rat.tolerance) ? 0 : list.rat.tolerance - 50;
              expect(efficiency).to.equal(newEfficiency);
              expect(tolerance).to.equal(newTolerance);
              list.rat.efficiency = newEfficiency;
              list.rat.tolerance = newTolerance;
            } else if (args.eventName === 'cat') {
              expect(efficiency).to.equal(0);
              expect(tolerance).to.equal(0);
              list.rat.efficiency = 0;
              list.rat.tolerance = 0;
            } else {
              const newEfficiency = (list.rat.efficiency + 2 > 100) ? 100 : list.rat.efficiency + 2;
              const newTolerance = (list.rat.tolerance + 8 > 100) ? 100 : list.rat.tolerance + 8;
              expect(efficiency).to.equal(newEfficiency);
              expect(tolerance).to.equal(newTolerance);
              list.rat.efficiency = newEfficiency;
              list.rat.tolerance = newTolerance;
            }
            await expect(doesSvgTraitMatch(svg, 'rat','body', efficiency)).to.eventually.be.true;
            await expect(doesSvgTraitMatch(svg, 'rat','head', tolerance)).to.eventually.be.true;
          }
          if (args.eventName) {
            events[args.eventName] += 1;
          }
        }));
        process.stdout.write('.');
      }
      process.stdout.write(`\n        done, events: ${Object.entries(events).map(([k, v]) => `${v} ${k}s`).join(', ')}\n`);
    });
    it('does not upgrade beyond cutoff', async () => {
      await this.kitchen.stakeMany(owner, Object.values(lists.cutoff).map(item => item.id), { from: owner });
      await advanceTimeAndBlock(86400 * 3); // Wait 3 days
      const { logs } = await claimManyAndFulfill.call(this, this.kitchen, Object.values(lists.cutoff).map(item => item.id), false);
      const claimEvents = logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event));
      claimEvents.forEach(({ event, args }) => {
        const efficiency = Number((event === 'ChefClaimed' ? args.skill : args.intelligence).toString());
        const tolerance = Number((event === 'ChefClaimed' ? args.freak : args.bodyMass).toString());
        if (event === 'ChefClaimed') {
          expectChefEarnings(args.earned, 86400, 0);
          expect(efficiency).to.equal(2);
          expect(tolerance).to.equal(4);
        } else {
          expect(efficiency).to.equal(2);
          expect(tolerance).to.equal(8);
        }
      });
    });
    it('boosts efficiency if staked long enough', async () => {
      await scheduleAndExecute(this.paywall, 'addToWhitelist', [[anon, anon, anon, anon, anon, anon, anon, anon, anon, anon]], { from: dao });
      const boostLists = await mintUntilWeHave.call(this, 0, 0, { args: { from: anon, value: toWei(0.9) } });
      await this.kitchen.stakeMany(anon, Object.values(boostLists.all).map(item => item.id), { from: anon });
      await advanceTimeAndBlock(86400 * 2); // Wait 3 days
      const { logs } = await claimManyAndFulfill.call(this, this.kitchen, Object.values(boostLists.all).map(item => item.id), false, { args: { from: anon } });
      const claimEvents = logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event));
      claimEvents.forEach(({ event, args }) => {
        const efficiency = Number((event === 'ChefClaimed' ? args.skill : args.intelligence).toString());
        const tolerance = Number((event === 'ChefClaimed' ? args.freak : args.bodyMass).toString());
        if (event === 'ChefClaimed') {
          expectChefEarnings(args.earned, 86400, 0);
          expect(efficiency).to.equal(3);
          expect(tolerance).to.equal(4);
        } else {
          expect(efficiency).to.equal(3);
          expect(tolerance).to.equal(8);
        }
      });
    });
    it('does not boost efficiency if not staked long enough', async () => {
      await scheduleAndExecute(this.paywall, 'addToWhitelist', [[anon, anon, anon, anon, anon, anon, anon, anon, anon, anon]], { from: dao }, 1);
      const boostLists = await mintUntilWeHave.call(this, 0, 0, { args: { from: anon, value: toWei(0.9) } });
      await this.kitchen.stakeMany(anon, Object.values(boostLists.all).map(item => item.id), { from: anon });
      await advanceTimeAndBlock(43200); // Wait 3 days
      const { logs } = await claimManyAndFulfill.call(this, this.kitchen, Object.values(boostLists.all).map(item => item.id), false, { args: { from: anon } });
      const claimEvents = logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event));
      claimEvents.forEach(({ event, args }) => {
        const efficiency = Number((event === 'ChefClaimed' ? args.skill : args.intelligence).toString());
        const tolerance = Number((event === 'ChefClaimed' ? args.freak : args.bodyMass).toString());
        if (event === 'ChefClaimed') {
          expect(efficiency).to.equal(1);
          expect(tolerance).to.equal(2);
        } else {
          expect(efficiency).to.equal(1);
          expect(tolerance).to.equal(4);
        }
      });
    });
  });
});
