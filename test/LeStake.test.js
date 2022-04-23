const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { toWei, advanceTimeAndBlock, mintUntilWeHave, trainUntilWeHave, claimManyAndFulfill, scheduleAndExecute } = require('./helper');
const Config = require('../config');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);
const expect = chai.expect;
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');
const CasualFood = artifacts.require('CasualFood');
const GourmetFood = artifacts.require('GourmetFood');
const Character = artifacts.require('Character');
const KitchenShop = artifacts.require('KitchenShop');
const KitchenUsage = artifacts.require('KitchenUsage');
const McStake = artifacts.require('McStake');
const LeStake = artifacts.require('LeStake');

contract('LeStake (proxy)', (accounts) => {
  const config = Config('development', accounts)
  const owner = accounts[0];
  const dao = accounts[9];
  let lists;

  before(async () => {
    this.vrfCoordinator = await VRFCoordinator.deployed();
    this.linkToken = await LinkToken.deployed();
    this.mint = await Mint.deployed();
    this.claim = await Claim.deployed();
    this.foodToken = await GourmetFood.deployed();
    this.character = await Character.deployed();
    this.kitchen = await LeStake.deployed();
    this.mcStake = await McStake.deployed();
    this.kitchenShop = await KitchenShop.deployed();
    this.kitchenUsage = await KitchenUsage.deployed();
    this.casualFood = await CasualFood.deployed();
    await scheduleAndExecute(this.mcStake, 'configure', [config.kitchen.mcStake.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, 100], { from: dao });
    await scheduleAndExecute(this.kitchen, 'configure', [config.kitchen.leStake.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements, 4, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx], { from: dao });
    await scheduleAndExecute(this.casualFood, 'addController', [[dao]], { from: dao });

    lists = await mintUntilWeHave.call(this, 12, 3);
    lists.eligibleChefs = lists.chefs.slice(1, 12);
    lists.eligibleRats = lists.rats.slice(1, 12);
    lists.eligibleAll = lists.eligibleChefs.concat(lists.eligibleRats);
    lists.chefs = [lists.chefs[0]];
    lists.rats = [lists.rats[0]];
    lists.all = lists.chefs.concat(lists.rats);

    await this.character.setApprovalForAll(this.kitchen.address, true, { from: owner });
    await this.character.setApprovalForAll(this.mcStake.address, true, { from: owner });
    lists.eligibleAll = await trainUntilWeHave.call(this, this.mcStake, 4, 4, lists.eligibleAll, 10, true, true, { from: owner });
  });

  describe('stakeMany()', () => {
    it('does not allow staking ineligible characters', async () => {
      await expect(this.kitchen.stakeMany(owner, lists.chefs.map(item => item.id), { from: owner })).to.eventually.be.rejectedWith('Not eligible');
      await expect(this.kitchen.stakeMany(owner, lists.rats.map(item => item.id), { from: owner })).to.eventually.be.rejectedWith('Not eligible');
    });
    it('fails if kitchen space is missing', async () => {
      await expect(this.kitchen.stakeMany(owner, [lists.eligibleChefs[0].id], { from: owner })).to.eventually.be.rejectedWith('Kitchen space required');
    });
    it('fails if kitchen is not approved', async () => {
      await this.casualFood.mint(owner, toWei(2000), { from: dao }); // Need kitchen space first
      await this.kitchenShop.mint(2, 1);
      await expect(this.kitchen.stakeMany(owner, lists.eligibleChefs.slice(0, 10).map(item => item.id), { from: owner })).to.eventually.be.rejectedWith('ERC1155: caller is not owner nor approved');
    });
    it('fails if kitchen space is missing', async () => {
      await this.kitchenShop.setApprovalForAll(this.kitchenUsage.address, true);
      await expect(this.kitchen.stakeMany(owner, lists.eligibleChefs.slice(0, 11).map(item => item.id), { from: owner })).to.eventually.be.rejectedWith('Kitchen space required');
    });
    it('stakes eligible chefs along with a kitchen', async () => {
      const res = await this.kitchen.stakeMany(owner, lists.eligibleChefs.slice(0, 10).map(item => item.id), { from: owner });
      await expect(res.receipt.status).to.be.true;
      await expect(this.kitchenUsage.spaceInWallet(owner, 2)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenUsage.spaceInStaking(owner, 2)).to.eventually.be.a.bignumber.eq('10');
    });
    it('fails if additional kitchen space is missing', async () => {
      await expect(this.kitchen.stakeMany(owner, [lists.eligibleChefs[10].id], { from: owner })).to.eventually.be.rejectedWith('Kitchen space required');
    });
    it('does not take rats into account', async () => {
      const res = await this.kitchen.stakeMany(owner, lists.eligibleRats.map(item => item.id), { from: owner });
      expect(res.receipt.status).to.be.true;
    });
  });
  describe('claimMany()', () => {
    it('force-unstakes ineligible characters', async () => {
      await advanceTimeAndBlock(86400 / 2); // Wait half a day
      lists.ineligible = [lists.eligibleChefs[0], lists.eligibleRats[0]];
      lists.remainingChefs = lists.eligibleChefs.slice(1, 10);
      lists.remainingRats = lists.eligibleRats.slice(1, 10);
      lists.remaining = lists.remainingChefs.concat(lists.remainingRats);
      await trainUntilWeHave.call(this, this.kitchen, -4, -101, lists.ineligible, 10, false, false, { from: owner });

      await Promise.all(lists.ineligible.map(async (item) => {
        await expect(this.character.ownerOf(item.id)).to.eventually.equal(owner);
        await expect(this.kitchen.stakers(owner, item.stakerIndex)).to.eventually.be.rejected;
        const token = await this.kitchen[item.isChef ? 'chefs' : 'rats'](item.id);
        await expect(token.owner).to.equal('0x0000000000000000000000000000000000000000');
        await expect(token.value.toString()).to.equal('0');
      }));
      await Promise.all(lists.remaining.map(async ({ id }) => { // The others are still in
        await expect(this.character.ownerOf(id)).to.eventually.equal(this.kitchen.address);
      }));
    });
    it('fails to unstake a kitchen if it is still in use', async () => {
      await expect(this.kitchenUsage.claim(owner, 2, 1)).to.eventually.be.rejectedWith('Still in use');
    });
    it('automatically unstakes a kitchen once the last chef left', async () => {
      let res = await claimManyAndFulfill.call(this, this.kitchen, lists.remainingChefs.map(item => item.id), true);
      await expect(this.kitchenUsage.spaceInStaking(owner, 2)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenUsage.spaceInWallet(owner, 2)).to.eventually.be.a.bignumber.eq('10');

      let claimEvents = res.logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event));
      await Promise.all(claimEvents.map(async (log, i) => {
        const tokenId = Number(log.args.tokenId.toString());
        expect(tokenId).to.equal(lists.remainingChefs[i].id);
        expect(log.args.earned).to.be.a.bignumber.gt('0');
        expect(log.args.unstaked).to.be.true;
        await expect(this.character.ownerOf(tokenId)).to.eventually.equal(owner);
      }));
      res = await claimManyAndFulfill.call(this, this.kitchen, lists.remainingRats.map(item => item.id), false);
      claimEvents = res.logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event));
      await Promise.all(claimEvents.map(async (log, i) => {
        const tokenId = Number(log.args.tokenId.toString());
        expect(tokenId).to.equal(lists.remainingRats[i].id);
        expect(log.args.earned).to.be.a.bignumber.gte('0');
        expect(log.args.unstaked).to.be.false;
        await expect(this.character.ownerOf(tokenId)).to.eventually.equal(this.kitchen.address);
      }));
    });
  });
});
