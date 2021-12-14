const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { toWei, advanceTimeAndBlock, uploadTraits } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const FastFood = artifacts.require('FastFood');
const Traits = artifacts.require('Traits');
const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

contract('KitchenPack (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.fastFood = await FastFood.new({ from: owner });
        this.traits = await deployProxy(Traits, { from: owner });
        this.chefRat = await deployProxy(ChefRat, [this.traits.address, 50000], { from: owner });
        await this.traits.setChefRat(this.chefRat.address);
        await uploadTraits(this.traits);
        this.kitchenPack = await deployProxy(KitchenPack, [this.chefRat.address, this.fastFood.address], { from: owner });
        await this.fastFood.addController(this.kitchenPack.address, { from: owner });
    });

    describe('stake()', () => {
        it('fails to stake non-existent tokens', async () => {
            await expect(this.kitchenPack.stakeMany(owner, [99], { from: owner })).to.eventually.be.rejectedWith('owner query for nonexistent token');
        });
        it('fails to stake someone else\'s tokens', async () => {
            await this.chefRat.mint(1, { from: anon, value: toWei(0.1) });
            await expect(this.kitchenPack.stakeMany(owner, [1], { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('stakes many tokens', async () => {
            await this.chefRat.mint(2, { from: owner, value: toWei(0.2) });
            await this.chefRat.setApprovalForAll(this.kitchenPack.address, true, { from: owner });
            await this.kitchenPack.stakeMany(owner, [2, 3], { from: owner });
            const block = await web3.eth.getBlock('latest');
            await expect(this.chefRat.ownerOf(2)).to.eventually.equal(this.kitchenPack.address);
            await expect(this.chefRat.ownerOf(3)).to.eventually.equal(this.kitchenPack.address);
            const staked1 = await this.kitchenPack.kitchen(2);
            const staked2 = await this.kitchenPack.kitchen(3);
            await expect(staked1.owner).to.equal(owner);
            await expect(staked2.owner).to.equal(owner);
            await expect(staked1.timestamp.toString()).to.equal(block.timestamp.toString());
            await expect(staked2.timestamp.toString()).to.equal(block.timestamp.toString());
        });
    });
    describe('unstake()', () => {
        it('fails to unstake someone else\'s tokens', async () => {
            await expect(this.kitchenPack.claimMany([2, 3], true, { from: anon })).to.eventually.be.rejectedWith('Not your token');
        });
        it('claims without unstaking tokens', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            await this.kitchenPack.claimMany([2, 3], false, { from: owner });
            const ts = (await web3.eth.getBlock('latest')).timestamp;
            await expect(this.chefRat.ownerOf(2)).to.eventually.equal(this.kitchenPack.address);
            await expect(this.chefRat.ownerOf(3)).to.eventually.equal(this.kitchenPack.address);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.gte('800000000000000000000').lt('800080000000000000000'); // 2 chefs staked for half a day = 5000^18 each
            await expect(this.kitchenPack.totalFastFoodEarned()).to.eventually.be.a.bignumber.gte('1000000000000000000000').lt('1000100000000000000000');
            await expect(this.kitchenPack.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());
        });
        it('claims & unstakes many tokens', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            await this.kitchenPack.claimMany([2, 3], true, { from: owner });
            const ts = (await web3.eth.getBlock('latest')).timestamp;
            await expect(this.chefRat.ownerOf(2)).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(3)).to.eventually.equal(owner);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.gte('1600000000000000000000').lt('1600160000000000000000');
            await expect(this.kitchenPack.totalFastFoodEarned()).to.eventually.be.a.bignumber.gte('2000000000000000000000').lt('2000200000000000000000');
            await expect(this.kitchenPack.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());
            const staked1 = await this.kitchenPack.kitchen(2);
            const staked2 = await this.kitchenPack.kitchen(3);
            await expect(staked1.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(staked2.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(staked1.timestamp.toString()).to.equal('0');
            await expect(staked2.timestamp.toString()).to.equal('0');
        });
        it('fails to unstake twice', async () => {
            await expect(this.kitchenPack.claimMany([2, 3], true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
    });
});
