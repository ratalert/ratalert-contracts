const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { scheduleAndExecute, getUIConfig } = require('./helper');
const Config = require('../config');

chai.use(chaiAsPromised);

const expect = chai.expect;
const ConfigContract = artifacts.require('Config');

contract('Mint (proxy)', (accounts) => {
  const config = Config('development', accounts);
  const dao = accounts[9];

  before(async () => {
    this.config = await ConfigContract.deployed();
  });

  describe('get()', () => {
    it('gets valid JSON', async () => {
      const res = await this.config.get();
      expect(res).to.equal(getUIConfig(config));
    });
  });
  describe('set()', () => {
    it('denies anonymous to execute', async () => {
      await expect(this.config.set(getUIConfig(config))).to.eventually.be.rejectedWith('caller is not the owner');
    });
    it('allows DAO to execute', async () => {
      const newConfig = JSON.parse(getUIConfig(config));
      newConfig.Paywall.mintPrice = 666;
      const res = await scheduleAndExecute(this.config, 'set', [JSON.stringify(newConfig)], { from: dao });
      expect(res.receipt.status).to.be.true;
      const res2 = await this.config.get();
      const json = JSON.parse(res2);
      expect(json.Paywall.mintPrice).to.equal(666);
    });
  });
});
