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
        this.fastFood = await FastFood.new({ from: owner });
        await this.fastFood.addController(owner, { from: owner });
        expect(await this.fastFood.totalSupply()).to.be.bignumber.equal(new BN(0));
    });

    describe('mint()', () => {
        it('denies anonymous to mint', async () => {
            await expect(this.fastFood.mint(anon, new BN(15), { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to mint', async () => {
            const res = await this.fastFood.mint(anon, new BN(15));
            await expect(res.receipt.status).to.be.true;
            await expect(this.fastFood.totalSupply()).to.eventually.be.bignumber.equal(new BN(15));
            await expect(this.fastFood.balanceOf(anon)).to.eventually.be.bignumber.equal(new BN(15));
        });
    });

    describe('burn()', () => {
        it('denies anonymous to burn', async () => {
            await expect(this.fastFood.burn(anon, new BN(10), { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to burn', async () => {
            const res = await this.fastFood.burn(anon, new BN(10));
            await expect(res.receipt.status).to.be.true;
            await expect(this.fastFood.totalSupply()).to.eventually.be.bignumber.equal(new BN(5));
            await expect(this.fastFood.balanceOf(anon)).to.eventually.be.bignumber.equal(new BN(5));
        });
    });

    describe('addController()', () => {
        it('denies anonymous to add a controller', async () => {
            await expect(this.fastFood.addController(anon, { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to add a controller', async () => {
            const res = await this.fastFood.addController(owner);
            await expect(res.receipt.status).to.be.true;
        });
    });

    describe('getController()', () => {
        it('denies anonymous to get a controller', async () => {
            await expect(this.fastFood.getController(anon, { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to get a controller', async () => {
            await expect(this.fastFood.getController(owner)).to.eventually.be.true;
        });
    });

    describe('removeController()', () => {
        it('denies anonymous to remove a controller', async () => {
            await expect(this.fastFood.removeController(anon, { from: anon })).to.eventually.be.rejected;
        });

        it('allows owner to remove a controller', async () => {
            const res = await this.fastFood.removeController(owner);
            await expect(res.receipt.status).to.be.true;
            await expect(this.fastFood.getController(owner)).to.eventually.be.false;
        });
    });
});
