const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { toWei, advanceTimeAndBlock, mintUntilWeHave, trainUntilWeHave, claimManyAndFulfill } = require('./helper');
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
const McStake = artifacts.require('McStake');
const LeStake = artifacts.require('LeStake');

contract('LeStake (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
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
        this.casualFood = await CasualFood.deployed();
        await this.casualFood.addController([owner]);

        lists = await mintUntilWeHave.call(this, 8, 3);
        lists.many = lists.all;
        lists.chefs = [lists.chefs[0], lists.chefs[1]];
        lists.rats = [lists.rats[0], lists.rats[1]];
        lists.all = lists.chefs.concat(lists.rats);

        await this.character.setApprovalForAll(this.kitchen.address, true, { from: owner });
        await this.character.setApprovalForAll(this.mcStake.address, true, { from: owner });
    });

    describe('stakeMany()', () => {
        it('fails if kitchen space is missing', async () => {
            await expect(this.kitchen.stakeMany(owner, [1], { from: owner })).to.eventually.be.rejectedWith('Kitchen space required');
        });
        it('fails if additional kitchen space is missing', async () => {
            await this.casualFood.mint(owner, toWei(2000)); // Need kitchen space first
            await this.kitchenShop.mint(2, 1);
            await expect(this.kitchen.stakeMany(owner, lists.many.map(item => item.id), { from: owner })).to.eventually.be.rejectedWith('Kitchen space required');
        });
        it('does not allow to stake ineligible chefs', async () => {
            await expect(this.kitchen.stakeMany(owner, lists.all.map(item => item.id), { from: owner })).to.eventually.be.rejectedWith('Not eligible');
        });
        it('stakes many tokens', async () => {
            lists.all = await trainUntilWeHave.call(this, this.mcStake, 72, 72, lists.all, 10, true, { from: owner });
            const res = await this.kitchen.stakeMany(owner, lists.all.map(item => item.id), { from: owner });
            await expect(res.receipt.status).to.be.true;
        });
    });
    describe('claimMany()', () => {
        it('force-unstakes ineligible characters', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            lists.ineligible = [lists.chefs[1], lists.rats[1]];
            await claimManyAndFulfill.call(this, this.kitchen, lists.ineligible.map(item => item.id), true);
            lists.ineligible = await trainUntilWeHave.call(this, this.kitchen, -71, -71, lists.ineligible, 10, false, { from: owner });

            await Promise.all(lists.ineligible.map(async (item) => {
                await expect(this.character.ownerOf(item.id)).to.eventually.equal(owner);
                await expect(this.kitchen.stakers(owner, item.stakerIndex)).to.eventually.be.rejected;
                const token = await this.kitchen[item.isChef ? 'chefs' : 'rats'](item.id);
                await expect(token.owner).to.equal('0x0000000000000000000000000000000000000000');
                await expect(token.value.toString()).to.equal('0');
            }));
            await Promise.all([lists.chefs[0], lists.rats[0]].map(async ({ id }) => { // The others are still in
                await expect(this.character.ownerOf(id)).to.eventually.equal(this.kitchen.address);
            }));
        });
        it('force unstakes if kitchen space is missing', async () => {
            await this.kitchenShop.safeTransferFrom(owner, anon, 2, 1, 0x0);
            expect(this.kitchenShop.balanceOf(owner, 2)).to.eventually.be.a.bignumber.eq('0');
            lists.remaining = [lists.chefs[0], lists.rats[0]];
            const { logs } = await claimManyAndFulfill.call(this, this.kitchen, lists.remaining.map(item => item.id), false);
            const claimEvents = logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event));
            claimEvents.forEach((log, i) => {
                const tokenId = Number(log.args.tokenId.toString());
                expect(tokenId).to.equal(lists.remaining[i].id);
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.unstaked).to.be.true;
            });
            await Promise.all(lists.remaining.map(async ({ id }) => {
                await expect(this.character.ownerOf(id)).to.eventually.equal(owner);
            }));
        });
    });
});
