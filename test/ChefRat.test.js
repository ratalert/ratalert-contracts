const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const ChefRat = artifacts.require('ChefRat');

contract('ChefRat (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.chefRat = await deployProxy(ChefRat, { from: owner, /*initializer: 'store'*/ });
        await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.chefRat.balanceOf(owner, 0)).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.chefRat.balanceOf(anon, 0)).to.eventually.be.a.bignumber.that.equals('0');
    });

    describe('mint()', () => {
        it('only allows to mint 1-10 tokens', async () => {
            await expect(this.chefRat.mint(0)).to.eventually.be.rejected;
            await expect(this.chefRat.mint(11)).to.eventually.be.rejected;
        });

        it('allows owner to mint', async () => {
            const res = await this.chefRat.mint(10);
            await expect(res.receipt.status).to.be.true;
            await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('10');
            await expect(this.chefRat.balanceOf(owner, 0)).to.eventually.be.a.bignumber.that.equals('10');
        });

        it('allows anonymous to mint', async () => {
            const res = await this.chefRat.mint(5, { from: anon });
            await expect(res.receipt.status).to.be.true;
            await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('15');
            await expect(this.chefRat.balanceOf(anon, 0)).to.eventually.be.a.bignumber.that.equals('5');
        });
    });
});
