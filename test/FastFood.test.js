const { BN } = require('@openzeppelin/test-helpers');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const expect = chai.expect;
const FastFood = artifacts.require('FastFood');

contract('FastFood', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.foodToken = await FastFood.new({ from: owner });
        await this.foodToken.addController(owner, { from: owner });
        expect(await this.foodToken.totalSupply()).to.be.bignumber.equal(new BN(0));
    });

    describe('mint()', () => {
        it('denies anonymous to mint', async () => {
            await expect(this.foodToken.mint(anon, new BN(15), { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to mint', async () => {
            const res = await this.foodToken.mint(anon, new BN(15));
            await expect(res.receipt.status).to.be.true;
            await expect(this.foodToken.totalSupply()).to.eventually.be.bignumber.equal(new BN(15));
            await expect(this.foodToken.balanceOf(anon)).to.eventually.be.bignumber.equal(new BN(15));
        });
    });

    describe('burn()', () => {
        it('denies anonymous to burn', async () => {
            await expect(this.foodToken.burn(anon, new BN(10), { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to burn', async () => {
            const res = await this.foodToken.burn(anon, new BN(10));
            await expect(res.receipt.status).to.be.true;
            await expect(this.foodToken.totalSupply()).to.eventually.be.bignumber.equal(new BN(5));
            await expect(this.foodToken.balanceOf(anon)).to.eventually.be.bignumber.equal(new BN(5));
        });
    });

    describe('addController()', () => {
        it('denies anonymous to add a controller', async () => {
            await expect(this.foodToken.addController(anon, { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to add a controller', async () => {
            const res = await this.foodToken.addController(owner);
            await expect(res.receipt.status).to.be.true;
        });
    });

    describe('getController()', () => {
        it('denies anonymous to get a controller', async () => {
            await expect(this.foodToken.getController(anon, { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to get a controller', async () => {
            await expect(this.foodToken.getController(owner)).to.eventually.be.true;
        });
    });

    describe('removeController()', () => {
        it('denies anonymous to remove a controller', async () => {
            await expect(this.foodToken.removeController(anon, { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to remove a controller', async () => {
            const res = await this.foodToken.removeController(owner);
            await expect(res.receipt.status).to.be.true;
            await expect(this.foodToken.getController(owner)).to.eventually.be.false;
        });
    });
});
