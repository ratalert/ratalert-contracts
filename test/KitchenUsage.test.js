const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { scheduleAndExecute, toWei, mintUntilWeHave, trainUntilWeHave, claimManyAndFulfill, advanceTimeAndBlock } = require('./helper');
require('@openzeppelin/test-helpers');
const Config = require('../config');

chai.use(chaiAsPromised);
const expect = chai.expect;
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const FastFood = artifacts.require('FastFood');
const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');
const Character = artifacts.require('Character');
const KitchenShop = artifacts.require('KitchenShop');
const KitchenUsage = artifacts.require('KitchenUsage');
const TheStakehouse = artifacts.require('TheStakehouse');
const McStake = artifacts.require('McStake');

contract('KitchenUsage (proxy)', (accounts) => {
  const config = Config('development', accounts)
  const owner = accounts[0];
  const anon = accounts[1];
  const dao = accounts[9];
  let block;

  before(async () => {
    this.vrfCoordinator = await VRFCoordinator.deployed();
    this.fastFood = await FastFood.deployed();
    this.mint = await Mint.deployed();
    this.claim = await Claim.deployed();
    this.character = await Character.deployed();
    this.kitchenShop = await KitchenShop.deployed();
    this.kitchenUsage = await KitchenUsage.deployed();
    this.kitchen = await TheStakehouse.deployed();
    this.mcStake = await McStake.deployed();
    await scheduleAndExecute(this.fastFood, 'addController', [[dao]], { from: dao });
    await scheduleAndExecute(this.kitchenUsage, 'addController', [[dao]], { from: dao });

    await scheduleAndExecute(this.kitchen, 'configure', [config.kitchen.theStakehouse.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.theStakehouse.propertyIncrements, 4, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee], { from: dao });

    lists = await mintUntilWeHave.call(this, 13, 0);
    lists.eligible = lists.chefs.slice(0, 13);

    await this.character.setApprovalForAll(this.kitchen.address, true, { from: owner });
    await this.character.setApprovalForAll(this.mcStake.address, true, { from: owner });
    lists.eligible1 = await trainUntilWeHave.call(this, this.mcStake, 4, 4, lists.eligible.slice(0, 10), 10, true, true, { from: owner });
    lists.eligible2 = await trainUntilWeHave.call(this, this.mcStake, 4, 4, lists.eligible.slice(10, 13), 10, true, true, { from: owner });
  });

  describe('stake()', () => {
    it('fails if balance is not sufficient', async () => {
      await expect(this.kitchenUsage.stake(owner, 1, 1)).to.eventually.be.rejectedWith('Insufficient tokens');
    });
    it('creates a new staking position', async () => {
      await this.fastFood.mint(owner, toWei(10000), { from: dao }); // Need kitchen space first
      await this.kitchenShop.mint(1, 5);
      await this.kitchenShop.setApprovalForAll(this.kitchenUsage.address, true);
      const res = await this.kitchenUsage.stake(owner, 1, 3);
      block = await web3.eth.getBlock('latest');
      expect(res.receipt.status).to.be.true;
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('2');
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('3');
      const stake = await this.kitchenUsage.stakers(owner, 1);
      expect(stake.owner).to.equal(owner);
      expect(stake.kitchenId).to.be.a.bignumber.eq('1');
      expect(stake.amount).to.be.a.bignumber.eq('3');
      expect(stake.timestamp).to.be.a.bignumber.eq(block.timestamp.toString());
    });
    it('updates a staking position', async () => {
      const res = await this.kitchenUsage.stake(owner, 1, 2);
      expect(res.receipt.status).to.be.true;
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('5');
      const stake = await this.kitchenUsage.stakers(owner, 1);
      expect(stake.owner).to.equal(owner);
      expect(stake.kitchenId).to.be.a.bignumber.eq('1');
      expect(stake.amount).to.be.a.bignumber.eq('5');
      expect(stake.timestamp).to.be.a.bignumber.eq(block.timestamp.toString());
    });
  });

  describe('claim()', () => {
    it('fails if balance is not sufficient', async () => {
      await expect(this.kitchenUsage.claim(owner, 1, 10)).to.eventually.be.rejectedWith('Insufficient tokens');
    });
    it('updates a staking position', async () => {
      const res = await this.kitchenUsage.claim(owner, 1, 4);
      expect(res.receipt.status).to.be.true;
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('1');
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('4');
      const stake = await this.kitchenUsage.stakers(owner, 1);
      expect(stake.owner).to.equal(owner);
      expect(stake.kitchenId).to.be.a.bignumber.eq('1');
      expect(stake.amount).to.be.a.bignumber.eq('1');
      expect(stake.timestamp).to.be.a.bignumber.eq(block.timestamp.toString());
    });
    it('deletes a staking position', async () => {
      const res = await this.kitchenUsage.claim(owner, 1, 1);
      expect(res.receipt.status).to.be.true;
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('5');
      const stake = await this.kitchenUsage.stakers(owner, 1);
      expect(stake.owner).to.equal('0x0000000000000000000000000000000000000000');
    });
    it('creates a staking position when staking chefs', async () => {
      await this.kitchen.stakeMany(owner, lists.eligible1.slice(0, 5).map(item => item.id));
      block = await web3.eth.getBlock('latest');
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('1');
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('4');
      const stake = await this.kitchenUsage.stakers(owner, 1);
      expect(stake.owner).to.equal(owner);
      expect(stake.kitchenId).to.be.a.bignumber.eq('1');
      expect(stake.amount).to.be.a.bignumber.eq('1');
      expect(stake.timestamp).to.be.a.bignumber.eq(block.timestamp.toString());
    });
    it('fails to unstake a kitchen if it is still in use', async () => {
      await expect(this.kitchenUsage.claim(owner, 1, 1)).to.eventually.be.rejectedWith('Still in use');
    });
    it('uses staked kitchen space entirely', async () => {
      await this.kitchen.stakeMany(owner, lists.eligible1.slice(5, 10).map(item => item.id));
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('1');
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('4');
    });
    it('adds to the staking position if necessary', async () => {
      await this.kitchen.stakeMany(owner, lists.eligible2.map(item => item.id));
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('2');
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('3');
    });
    it('reduces the staking position when unstaking some chefs', async () => {
      await advanceTimeAndBlock(86400); // Wait a day
      await claimManyAndFulfill.call(this, this.kitchen, lists.eligible2.map(item => item.id), true);
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('1');
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('4');
    });
    it('deletes a staking position when unstaking all chefs', async () => {
      await advanceTimeAndBlock(86400); // Wait a day
      await claimManyAndFulfill.call(this, this.kitchen, lists.eligible1.map(item => item.id), true); // Also unstakes the remaining kitchen
      await expect(this.kitchenShop.balanceOf(this.kitchenUsage.address, 1)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('5');
      const stake = await this.kitchenUsage.stakers(owner, 1);
      expect(stake.owner).to.equal('0x0000000000000000000000000000000000000000');
    });
  });

  describe('spaceInWallet()', () => {
    it('returns the maximum if no kitchen is staked', async () => {
      await expect(this.kitchenUsage.spaceInWallet(owner, 1)).to.eventually.be.a.bignumber.eq('50');
    });
    it('returns 0 if all kitchens are staked', async () => {
      await this.kitchenUsage.stake(owner, 1, 5);
      await expect(this.kitchenUsage.spaceInWallet(owner, 1)).to.eventually.be.a.bignumber.eq('0');
    });
  });

  describe('spaceInStaking()', () => {
    it('returns the maximum if all kitchens are staked', async () => {
      await expect(this.kitchenUsage.spaceInStaking(owner, 1)).to.eventually.be.a.bignumber.eq('50');
    });
    it('returns 0 if no kitchen is staked', async () => {
      await this.kitchenUsage.claim(owner, 1, 5);
      await expect(this.kitchenUsage.spaceInStaking(owner, 1)).to.eventually.be.a.bignumber.eq('0');
    });
  });

  describe('checkSpace()', () => {
    it('returns -1 if the owner has no kitchens', async () => {
      await this.kitchenShop.safeTransferFrom(owner, anon, 1, 5, 0x0);
      // await expect(this.kitchenUsage.checkSpace(owner, 1, 0)).to.eventually.be.a.bignumber.eq('-1');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 1)).to.eventually.be.a.bignumber.eq('-1');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 9)).to.eventually.be.a.bignumber.eq('-1');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 10)).to.eventually.be.a.bignumber.eq('-1');
    });
    it('returns 0 if no kitchen is staked but a balance is in the wallet', async () => {
      await this.fastFood.mint(owner, toWei(4000), { from: dao }); // Need kitchen space first
      await this.kitchenShop.mint(1, 2);
      await expect(this.kitchenUsage.checkSpace(owner, 1, 1)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 20)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 21)).to.eventually.be.a.bignumber.eq('-1');
    });
    it('returns the remaining kitchen space identifier if a kitchen is staked and a balance is in the wallet', async () => {
      await this.kitchenUsage.stake(owner, 1, 1);
      await expect(this.kitchenUsage.checkSpace(owner, 1, 0)).to.eventually.be.a.bignumber.eq('2');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 1)).to.eventually.be.a.bignumber.eq('1');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 10)).to.eventually.be.a.bignumber.eq('1');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 11)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 20)).to.eventually.be.a.bignumber.eq('0');
      await expect(this.kitchenUsage.checkSpace(owner, 1, 21)).to.eventually.be.a.bignumber.eq('-1');
    });
  });

  describe('onERC1155Received()', () => {
    it('does not accept tokens sent directly', async () => {
      await expect(this.kitchenShop.safeTransferFrom(owner, this.kitchenUsage.address, 1, 1, '0x0')).to.eventually.be.rejectedWith('Cannot send tokens directly');
    });
  });

  describe('onERC1155BatchReceived()', () => {
    it('does not accept tokens sent directly in batch', async () => {
      await expect(this.kitchenShop.safeTransferFrom(owner, this.kitchenUsage.address, [1], [1], '0x0')).to.eventually.be.rejectedWith('Cannot send tokens directly');
    });
  });
});
