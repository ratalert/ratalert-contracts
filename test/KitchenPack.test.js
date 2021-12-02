const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { toWei } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const FastFood = artifacts.require('FastFood');
const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

contract('KitchenPack (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.fastFood = await FastFood.new({ from: owner });
        this.chefRat = await deployProxy(ChefRat, { from: owner });
        this.kitchenPack = await deployProxy(KitchenPack, [this.chefRat.address, this.fastFood.address], { from: owner });
        await this.fastFood.addController(this.kitchenPack.address, { from: owner });
    });

    describe('stake()', () => {
        it('fails to stake non-existent tokens');
        it('fails to stake someone else\'s tokens');
        it('stakes many tokens', async () => {
            await this.chefRat.mint(2, { from: owner, value: toWei(0.2) });
            await this.chefRat.setApprovalForAll(this.kitchenPack.address, true, { from: owner });
            await this.kitchenPack.stakeMany(owner, [1, 2], { from: owner });
            await expect(this.chefRat.ownerOf(1)).to.eventually.equal(this.kitchenPack.address);
            await expect(this.chefRat.ownerOf(2)).to.eventually.equal(this.kitchenPack.address);
        });
    });
    describe('unstake()', () => {
        it('fails to unstake someone else\'s tokens', async () => {
            await expect(this.kitchenPack.claimMany([1, 2], true, { from: anon })).to.eventually.be.rejected;
        });
        it('claims without unstaking tokens', async () => {
            await this.kitchenPack.claimMany([1, 2], false, { from: owner });
            await expect(this.chefRat.ownerOf(1)).to.eventually.equal(this.kitchenPack.address);
            await expect(this.chefRat.ownerOf(2)).to.eventually.equal(this.kitchenPack.address);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals('33');
        });
        it('claims & unstakes many tokens', async () => {
            await this.kitchenPack.claimMany([1, 2], true, { from: owner });
            await expect(this.chefRat.ownerOf(1)).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(2)).to.eventually.equal(owner);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals('66');
        });
    });
});
