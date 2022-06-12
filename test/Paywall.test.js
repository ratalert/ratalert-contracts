const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { toWei, scheduleAndExecute, decodeRawLogs } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const Paywall = artifacts.require('Paywall');

contract('Paywall (proxy)', (accounts) => {
  const owner = accounts[0];
  const anon = accounts[1];
  const dao = accounts[9];
  let salt = 0;

  before(async () => {
    this.paywall = await Paywall.deployed();
    await scheduleAndExecute(this.paywall, 'addController', [[owner]], { from: dao }, salt++);
  });

  describe('toggleWhitelist()', () => {
    it('turns it on', async () => {
      await expect(this.paywall.onlyWhitelist()).to.eventually.be.false;
      await this.paywall.toggleWhitelist(true, { from: dao });
      await expect(this.paywall.onlyWhitelist()).to.eventually.be.true;
    });

    it('turns it off', async () => {
      await this.paywall.toggleWhitelist(false, { from: dao });
      await expect(this.paywall.onlyWhitelist()).to.eventually.be.false;
    });
  });

  describe('addToWhitelist()', () => {
    it('adds addresses', async () => {
      await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq('0');
      for (let i = 1; i <= 5; i++) {
        let res = await this.paywall.addToWhitelist([owner, anon], { from: dao });
        const logs = decodeRawLogs(res, this.paywall, 'UpdateWhitelist');
        expect(logs).to.have.length(2);
        expect(logs[0].event).to.equal('UpdateWhitelist');
        expect(logs[1].event).to.equal('UpdateWhitelist');
        expect(logs[0].args.amount).to.be.a.bignumber.eq(i.toString());
        expect(logs[1].args.amount).to.be.a.bignumber.eq(i.toString());
        await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq(i.toString());
        await expect(this.paywall.whitelist(anon)).to.eventually.be.a.bignumber.eq(i.toString());
      }
    });
  });

  describe('removeFromWhitelist()', () => {
    it('removes addresses', async () => {
      for (let i = 4; i >= 0; i--) {
        const res = await this.paywall.removeFromWhitelist([owner, anon], { from: dao });
        const logs = decodeRawLogs(res, this.paywall, 'UpdateWhitelist');
        expect(logs).to.have.length(2);
        expect(logs[0].event).to.equal('UpdateWhitelist');
        expect(logs[1].event).to.equal('UpdateWhitelist');
        expect(logs[0].args.amount).to.be.a.bignumber.eq(i.toString());
        expect(logs[1].args.amount).to.be.a.bignumber.eq(i.toString());
        await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq(i.toString());
        await expect(this.paywall.whitelist(anon)).to.eventually.be.a.bignumber.eq(i.toString());
      }
    });
    it('does not overflow', async () => {
      const res = await this.paywall.removeFromWhitelist([owner], { from: dao });
      const logs = decodeRawLogs(res, this.paywall, 'UpdateWhitelist');
      expect(logs).to.have.length(1);
      expect(logs).to.have.length(1);
      expect(logs[0].event).to.equal('UpdateWhitelist');
      expect(logs[0].args.amount).to.be.a.bignumber.eq('0');
      await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq('0');
    });
  });

  describe('addToFreeMints()', () => {
    it('adds addresses', async () => {
      await expect(this.paywall.freeMints(owner)).to.eventually.be.a.bignumber.eq('0');
      for (let i = 1; i <= 5; i++) {
        const res = await this.paywall.addToFreeMints([owner, anon], { from: dao });
        const logs = decodeRawLogs(res, this.paywall, 'UpdateFreeMints');
        expect(logs).to.have.length(2);
        expect(logs[0].event).to.equal('UpdateFreeMints');
        expect(logs[1].event).to.equal('UpdateFreeMints');
        expect(logs[0].args.amount).to.be.a.bignumber.eq(i.toString());
        expect(logs[1].args.amount).to.be.a.bignumber.eq(i.toString());
        await expect(this.paywall.freeMints(owner)).to.eventually.be.a.bignumber.eq(i.toString());
        await expect(this.paywall.freeMints(anon)).to.eventually.be.a.bignumber.eq(i.toString());
      }
    });
  });

  describe('removeFromFreeMints()', () => {
    it('removes addresses', async () => {
      for (let i = 4; i >= 0; i--) {
        const res = await this.paywall.removeFromFreeMints([owner, anon], { from: dao });
        const logs = decodeRawLogs(res, this.paywall, 'UpdateFreeMints');
        expect(logs).to.have.length(2);
        expect(logs[0].event).to.equal('UpdateFreeMints');
        expect(logs[1].event).to.equal('UpdateFreeMints');
        expect(logs[0].args.amount).to.be.a.bignumber.eq(i.toString());
        expect(logs[1].args.amount).to.be.a.bignumber.eq(i.toString());
        await expect(this.paywall.freeMints(owner)).to.eventually.be.a.bignumber.eq(i.toString());
        await expect(this.paywall.freeMints(anon)).to.eventually.be.a.bignumber.eq(i.toString());
      }
    });
    it('does not overflow', async () => {
      const res = await this.paywall.removeFromFreeMints([owner], { from: dao });
      const logs = decodeRawLogs(res, this.paywall, 'UpdateFreeMints');
      expect(logs).to.have.length(1);
      expect(logs[0].event).to.equal('UpdateFreeMints');
      expect(logs[0].args.amount).to.be.a.bignumber.eq('0');
      await expect(this.paywall.freeMints(owner)).to.eventually.be.a.bignumber.eq('0');
    });
  });

  describe('handle()', () => {
    it('fails without sufficient whitelist spots', async () => {
      await this.paywall.toggleWhitelist(true, { from: dao });
      await this.paywall.addToWhitelist([owner, owner], { from: dao });
      await expect(this.paywall.handle(owner, 3, toWei(0.3), 0, 100, 10)).to.eventually.be.rejectedWith('Not whitelisted');
    });
    it('succeeds with sufficient whitelist spots', async () => {
      await this.paywall.addToWhitelist([owner], { from: dao });
      const { logs } = await this.paywall.handle(owner, 3, toWei(0.27), 0, 100, 10);
      expect(logs).to.have.length(1);
      expect(logs[0].event).to.equal('UpdateWhitelist');
      expect(logs[0].args.amount).to.be.a.bignumber.eq('0');
      await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq('0');
    });
    it('succeeds with whitelisting disabled', async () => {
      await this.paywall.toggleWhitelist(false, { from: dao });
      const { logs } = await this.paywall.handle(anon, 2, toWei(0.2), 0, 100, 10);
      expect(logs).to.have.length(0);
    });
    it('still gets a discount', async () => {
      await this.paywall.addToWhitelist([anon], { from: dao });
      await expect(this.paywall.whitelist(anon)).to.eventually.be.a.bignumber.eq('1');
      await expect(this.paywall.handle(anon, 1, toWei(0.09), 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true); // discounted
      await expect(this.paywall.handle(anon, 1, toWei(0.1), 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true); // regular
    });
    it('succeeds with sufficient free mint spots', async () => {
      await this.paywall.toggleWhitelist(true, { from: dao });
      await this.paywall.addToFreeMints([anon, anon, anon], { from: dao });
      const { logs } = await this.paywall.handle(anon, 2, 0, 0, 100, 10);
      expect(logs).to.have.length(1);
      expect(logs[0].event).to.equal('UpdateFreeMints');
      expect(logs[0].args.amount).to.be.a.bignumber.eq('1');
    });
    it('still gets the free mint', async () => {
      await this.paywall.toggleWhitelist(false, { from: dao });
      const { logs } = await this.paywall.handle(anon, 1, 0, 0, 100, 10);
      expect(logs).to.have.length(1);
      expect(logs[0].event).to.equal('UpdateFreeMints');
      expect(logs[0].args.amount).to.be.a.bignumber.eq('0');
      await expect(this.paywall.handle(anon, 1, 0, 0, 100, 10)).to.eventually.be.rejectedWith('Invalid payment amount'); // Next one costs
    });
    it('uses free mints before whitelist spots', async () => {
      await this.paywall.addToFreeMints([anon], { from: dao });
      await this.paywall.addToWhitelist([anon], { from: dao });
      await expect(this.paywall.handle(anon, 1, 0, 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true);
      await expect(this.paywall.handle(anon, 1, toWei(0.09), 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true);
      await expect(this.paywall.handle(anon, 1, toWei(0.1), 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true);
    });
    it('allows Gen1 free mints', async () => {
      await this.paywall.addToFreeMints([anon, anon, anon, anon], { from: dao });
      await expect(this.paywall.handle(anon, 4, 0, 6, 10, 5)).to.eventually.have.nested.property('receipt.status', true);
      await expect(this.paywall.handle(anon, 1, 0, 10, 10, 5)).to.eventually.be.rejectedWith('All tokens minted'); // Next one costs
    });
  });
});
