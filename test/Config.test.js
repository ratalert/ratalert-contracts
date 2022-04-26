const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { scheduleAndExecute } = require('./helper');
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
      const json = JSON.parse(Buffer.from(res.split(',')[1], 'base64').toString());
      expect(json).to.be.an('object');
    });
  });
  describe('set()', () => {
    it('denies anonymous to execute', async () => {
      await expect(this.config.set(...config.config(config))).to.eventually.be.rejectedWith('caller is not the owner');
    });
    it('allows DAO to execute', async () => {
      const newConfig = config.config(config);
      newConfig[0].mintPrice = 666;
      const res = await scheduleAndExecute(this.config, 'set', [...newConfig], { from: dao });
      expect(res.receipt.status).to.be.true;
      const res2 = await this.config.get();
      const json = JSON.parse(Buffer.from(res2.split(',')[1], 'base64').toString());
      expect(json.Paywall.mintPrice).to.equal('666');
    });
  });
});
