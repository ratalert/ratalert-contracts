const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { toWei, advanceTimeAndBlock, mintUntilWeHave, trainUntilWeHave, claimManyAndFulfill, scheduleAndExecute, expectChefEarnings, doesSvgTraitMatch } = require('./helper');
const { BN } = require('@openzeppelin/test-helpers');
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
    await scheduleAndExecute(this.mcStake, 'configure', [config.kitchen.mcStake.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.mcStake.propertyIncrements, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, 100, config.kitchen.claimFee], { from: dao });
    await scheduleAndExecute(this.kitchen, 'configure', [config.kitchen.leStake.foodTokenMaxSupply, [config.kitchen.dailyChefEarnings, config.kitchen.ratTheftPercentage, config.kitchen.vestingPeriod, config.kitchen.accrualPeriod], config.kitchen.leStake.propertyIncrements, 4, config.kitchen.chefEfficiencyMultiplier, config.kitchen.ratEfficiencyMultiplier, config.kitchen.ratEfficiencyOffset, config.kitchen.maxClaimsPerTx, config.kitchen.claimFee], { from: dao });
    await scheduleAndExecute(this.casualFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), dao], { from: dao });

    lists = await mintUntilWeHave.call(this, 12, 3);
    lists.eligibleChefs = lists.chefs.slice(1, 12);
    lists.eligibleRats = lists.rats.slice(1, 12);
    lists.eligibleAll = lists.eligibleChefs.concat(lists.eligibleRats);
    lists.chefs = [lists.chefs[0]];
    lists.rats = [lists.rats[0]];
    lists.all = lists.chefs.concat(lists.rats);

    await this.character.setApprovalForAll(this.kitchen.address, true, { from: owner });
    await this.character.setApprovalForAll(this.mcStake.address, true, { from: owner });
    lists.eligibleAll = await trainUntilWeHave.call(this, this.mcStake, 4, 4, lists.eligibleAll, 10, true, true, { verbose: true, args: { from: owner } });
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
    it('fails if additional kitchen space is missing', async () => {
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
    it('handles level upgrades', async () => {
      const verbose = process.argv.includes('-v');
      const list = lists.eligibleChefs.slice(0, 5).concat(lists.eligibleRats.slice(0, 2));
      await advanceTimeAndBlock(86400); // Wait a random amount of days (1 to 10)
      await claimManyAndFulfill.call(this, this.kitchen, Object.values(list).map(item => item.id), true);
      await this.kitchen.stakeMany(owner, Object.values(list).map(item => item.id), { from: owner });
      await Promise.all(list.map(async item => {
        const traits = await this.character.getTokenTraits(item.id);
        item.efficiency = Number(traits.efficiency.toString());
        item.tolerance = Number(traits.tolerance.toString());
      }));
      process.stdout.write(`        running 10 claims${verbose ? '\n' : ''}`);
      const events = { foodInspector: 0, burnout: 0, ratTrap: 0, cat: 0 };
      for (let i = 0; i < 10; i += 1) {
        await advanceTimeAndBlock(86400 * Math.ceil(Math.random()*10)); // Wait a random amount of days (1 to 10)
        const { logs } = await claimManyAndFulfill.call(this, this.kitchen, list.map(item => item.id), false);
        const claimEvents = logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event));
        await Promise.all(claimEvents.map(async ({ event, args }) => {
          const token = list.find(it => it.id === Number(args.tokenId))
          const efficiency = Number((event === 'ChefClaimed' ? args.skill : args.intelligence).toString());
          const tolerance = Number((event === 'ChefClaimed' ? args.freak : args.bodyMass).toString());
          const tokenUri = await this.character.tokenURI(args.tokenId);
          const json = JSON.parse(Buffer.from(tokenUri.split(',')[1], 'base64').toString());
          const svg = Buffer.from(json.image.split(',')[1], 'base64').toString();
          if (verbose) {
            console.log(`          [${i}] ${event} #${args.tokenId} E${args.skill || args.intelligence} T${args.freak || args.bodyMass} $${args.earned}   ${args.eventName}`);
          }
          if (args.eventName) {
            events[args.eventName] += 1;
          }
          let newEfficiency;
          let newTolerance;
          if (event === 'ChefClaimed') {
            expectChefEarnings(args.earned, 86400, token.efficiency);
            token.earned = args.earned;
            if (args.eventName === 'foodInspector') {
              newEfficiency = (10 > token.efficiency) ? 0 : token.efficiency - 10;
              newTolerance = (25 > token.tolerance) ? 0 : token.tolerance - 25;
            } else if (args.eventName === 'burnout') {
              newEfficiency = 0;
              newTolerance = 0;
            } else {
              newEfficiency = (token.efficiency + 6 > 100) ? 100 : token.efficiency + 6;
              newTolerance = (token.tolerance + 8 > 100) ? 100 : token.tolerance + 8;
            }
            expect(efficiency).to.equal(newEfficiency);
            expect(tolerance).to.equal(newTolerance);
            token.efficiency = efficiency;
            token.tolerance = tolerance;
            await expect(doesSvgTraitMatch(svg, 'chef','body', efficiency)).to.eventually.be.true;
            await expect(doesSvgTraitMatch(svg, 'chef','head', tolerance)).to.eventually.be.true;
          } else {
            // expectRatEarnings(args.earned, fromWei(args.earned) / 8 * 2, 2, token.tolerance);
            expect(args.earned).to.be.a.bignumber.gte('90000000000000000000'); // Improve this
            if (args.eventName === 'ratTrap') {
              newEfficiency = (10 > token.efficiency) ? 0 : token.efficiency - 10;
              newTolerance = (50 > token.tolerance) ? 0 : token.tolerance - 50;
            } else if (args.eventName === 'cat') {
              newEfficiency = 0;
              newTolerance = 0;
            } else {
              newEfficiency = (token.efficiency + 6 > 100) ? 100 : token.efficiency + 6;
              newTolerance = (token.tolerance + 4 > 100) ? 100 : token.tolerance + 4;
            }
            await expect(doesSvgTraitMatch(svg, 'rat','body', tolerance)).to.eventually.be.true;
            await expect(doesSvgTraitMatch(svg, 'rat','head', efficiency)).to.eventually.be.true;
          }
          expect(efficiency).to.equal(newEfficiency);
          expect(tolerance).to.equal(newTolerance);
          token.efficiency = efficiency;
          token.tolerance = tolerance;
          if (token.efficiency < 4) {
            await trainUntilWeHave.call(this, this.mcStake, 4, 4, [token], 10, true, true, { verbose, args: { from: owner } });
            await this.kitchen.stakeMany(owner, [token.id], { from: owner });
          }
        }));
        if (!verbose) {
          process.stdout.write('.');
        }
      }
      if (verbose) {
        console.log(`        done, events: ${Object.entries(events).map(([k, v]) => `${v} ${k}s`).join(', ')}\n`);
      } else {
        process.stdout.write('\n');
      }
    });
    it('force-unstakes ineligible characters', async () => {
      await advanceTimeAndBlock(86400 / 2); // Wait half a day
      lists.ineligible = [lists.eligibleChefs[0], lists.eligibleRats[0]];
      lists.remainingChefs = lists.eligibleChefs.slice(1, 10);
      lists.remainingRats = lists.eligibleRats.slice(1, 10);
      lists.remaining = lists.remainingChefs.concat(lists.remainingRats);
      await trainUntilWeHave.call(this, this.kitchen, -4, -101, lists.ineligible, 10, false, false, { verbose: true, args: { from: owner } });

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

  describe('withdrawPayments()', () => {
    it('denies anonymous to withdraw', async () => {
      await expect(this.kitchen.withdrawPayments()).to.eventually.be.rejectedWith('Only DAO can execute');
    });
    it('allows DAO to withdraw', async () => {
      const contractBalance = await web3.eth.getBalance(this.kitchen.address);
      const daoBalance = await web3.eth.getBalance(config.dao.address);
      const res = await this.kitchen.withdrawPayments({ from: dao });
      expect(res.receipt.status).to.be.true;
      await expect(web3.eth.getBalance(this.kitchen.address)).to.eventually.be.a.bignumber.that.equals('0');
      await expect(web3.eth.getBalance(config.dao.address)).to.eventually.be.a.bignumber.gte(new BN(daoBalance).add(new BN(contractBalance)).sub(new BN(toWei(0.0001)))); // Minus a buffer that is higher than the gas costs for some reason
    });
  });
});
