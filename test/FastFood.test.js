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
    await scheduleAndExecute(this.foodToken, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), owner], { from: dao });
    expect(await this.foodToken.totalSupply()).to.be.a.bignumber.eq(toWei(0));
  });

  describe('mint()', () => {
    it('returns the cap', async () => {
      await expect(this.foodToken.cap()).to.eventually.be.a.bignumber.eq(toWei(100000000));
    });
  });

  describe('mint()', () => {
    it('denies anonymous to mint', async () => {
      await expect(this.foodToken.mint(anon, toWei(100000000), { from: anon })).to.eventually.be.rejectedWith('AccessControl: account');
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
      await expect(this.foodToken.burn(anon, toWei(99999999), { from: anon })).to.eventually.be.rejectedWith('AccessControl: account');
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

  describe('grantRole()', () => {
    it('denies anonymous to add a role', async () => {
      await expect(this.foodToken.grantRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), anon, { from: anon })).to.eventually.be.rejected;
    });

    it('allows owner to add a role', async () => {
      const res = await scheduleAndExecute(this.foodToken, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), anon], { from: dao });
      await expect(res.receipt.status).to.be.true;
    });
  });

  describe('hasRole()', () => {
    it('returns a role status', async () => {
      await expect(this.foodToken.hasRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), anon)).to.eventually.be.true;
    });
  });

  describe('revokeRole()', () => {
    it('denies anonymous to remove a role', async () => {
      await expect(this.foodToken.revokeRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), anon, { from: anon })).to.eventually.be.rejected;
    });

    it('allows owner to remove a role', async () => {
      const res = await scheduleAndExecute(this.foodToken, 'revokeRole', [web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), anon], { from: dao });
      await expect(res.receipt.status).to.be.true;
      await expect(this.foodToken.hasRole(web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), anon)).to.eventually.be.false;
    });
  });
});
