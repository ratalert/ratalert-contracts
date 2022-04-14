const { toWei, scheduleAndExecute } = require('./helper');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const expect = chai.expect;
const FastFood = artifacts.require('FastFood');

contract('FastFood', (accounts) => {
  const owner = accounts[0];
  const anon = accounts[1];
  const dao = accounts[9];

  before(async () => {
    this.foodToken = await FastFood.deployed();
    await scheduleAndExecute(this.foodToken, 'addController', [[dao]], { from: dao });
    expect(await this.foodToken.totalSupply()).to.be.a.bignumber.eq(toWei(0));
  });

  describe('mint()', () => {
    it('returns the cap', async () => {
      await expect(this.foodToken.cap()).to.eventually.be.a.bignumber.eq(toWei(100000000));
    });
  });

  describe('mint()', () => {
    it('denies anonymous to mint', async () => {
      await expect(this.foodToken.mint(anon, toWei(100000000), { from: anon })).to.eventually.be.rejectedWith('Only controllers can execute');
    });

    it('allows owner to mint', async () => {
      const res = await this.foodToken.mint(anon, toWei(100000000), { from: dao });
      await expect(res.receipt.status).to.be.true;
      await expect(this.foodToken.totalSupply()).to.eventually.be.a.bignumber.eq(toWei(100000000));
      await expect(this.foodToken.balanceOf(anon)).to.eventually.be.a.bignumber.eq(toWei(100000000));
    });
    it('fails to mint more than the cap', async () => {
      await expect(this.foodToken.mint(anon, 1, { from: dao })).to.eventually.be.rejectedWith('ERC20Capped: cap exceeded');
    });
  });

  describe('burn()', () => {
    it('denies anonymous to burn', async () => {
      await expect(this.foodToken.burn(anon, toWei(99999999), { from: anon })).to.eventually.be.rejectedWith('Only controllers can execute');
    });

    it('allows owner to burn', async () => {
      const res = await this.foodToken.burn(anon, toWei(99999999), { from: dao });
      await expect(res.receipt.status).to.be.true;
      await expect(this.foodToken.totalSupply()).to.eventually.be.bignumber.eq(toWei(1));
      await expect(this.foodToken.balanceOf(anon)).to.eventually.be.bignumber.eq(toWei(1));
    });
    it('fails to burn more than available', async () => {
      await expect(this.foodToken.burn(anon, toWei(2), { from: dao })).to.eventually.be.rejectedWith('burn amount exceeds balance');
    });
  });

  describe('addController()', () => {
    it('denies anonymous to add a controller', async () => {
      await expect(this.foodToken.addController([anon], { from: anon })).to.eventually.be.rejected;
    });

    it('allows owner to add a controller', async () => {
      const res = await scheduleAndExecute(this.foodToken, 'addController', [[owner]], { from: dao });
      await expect(res.receipt.status).to.be.true;
    });
  });

  describe('controller()', () => {
    it('returns a controller status', async () => {
      await expect(this.foodToken.controller(owner)).to.eventually.be.true;
    });
  });

  describe('removeController()', () => {
    it('denies anonymous to remove a controller', async () => {
      await expect(this.foodToken.removeController([anon], { from: anon })).to.eventually.be.rejected;
    });

    it('allows owner to remove a controller', async () => {
      const res = await scheduleAndExecute(this.foodToken, 'removeController', [[owner]], { from: dao });
      await expect(res.receipt.status).to.be.true;
      await expect(this.foodToken.controller(owner)).to.eventually.be.false;
    });
  });
});
