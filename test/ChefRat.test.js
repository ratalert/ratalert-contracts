const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { toWei } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const ChefRat = artifacts.require('ChefRat');

contract('ChefRat (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.chefRat = await deployProxy(ChefRat, { from: owner });
        await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.chefRat.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.chefRat.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('0');
    });

    describe('mint()', () => {
        it('only allows to mint 1-10 tokens', async () => {
            await expect(this.chefRat.mint(0, { from: owner, value: toWei(0) })).to.eventually.be.rejected;
            await expect(this.chefRat.mint(11, { from: owner, value: toWei(1.1) })).to.eventually.be.rejected;
        });

        it('rejects invalid payments', async () => {
            await expect(this.chefRat.mint(1, { from: owner })).to.eventually.be.rejected;
            await expect(this.chefRat.mint(2, { from: owner, value: toWei(0.1) })).to.eventually.be.rejected;
            await expect(this.chefRat.mint(3, { from: owner, value: toWei(0.4) })).to.eventually.be.rejected;
        });

        it('allows owner to mint', async () => {
            const res = await this.chefRat.mint(10, { from: owner, value: toWei(1) });
            await expect(web3.eth.getBalance(this.chefRat.address)).to.eventually.be.a.bignumber.that.equals(toWei(1));
            await expect(res.receipt.status).to.be.true;
            await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('10');
            await expect(this.chefRat.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals('10');
            await expect(this.chefRat.ownerOf(1)).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(10)).to.eventually.equal(owner);
        });

        it('allows anonymous to mint', async () => {
            const res = await this.chefRat.mint(5, { from: anon, value: toWei(0.5) });
            await expect(web3.eth.getBalance(this.chefRat.address)).to.eventually.be.a.bignumber.that.equals(toWei(1.5));
            await expect(res.receipt.status).to.be.true;
            await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('15');
            await expect(this.chefRat.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('5');
            await expect(this.chefRat.ownerOf(11)).to.eventually.equal(anon);
            await expect(this.chefRat.ownerOf(15)).to.eventually.equal(anon);
        });
    });
});
