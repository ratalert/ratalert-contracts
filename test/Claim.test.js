const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require("@openzeppelin/truffle-upgrades");
const { scheduleAndExecute } = require('./helper');
const Config = require('../config');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const TimelockController = artifacts.require('TimelockController');
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const Claim = artifacts.require('Claim');
const config = Config('development')

contract('Claim (proxy)', (accounts) => {
  const owner = accounts[0];
  const anon = accounts[1];
  const dao = accounts[9];

  before(async () => {
    this.timelockController = await TimelockController.deployed();
    this.vrfCoordinator = await VRFCoordinator.deployed();
    this.linkToken = await LinkToken.deployed();
    this.claim = await Claim.deployed();
    this.claimSandbox = await deployProxy(Claim, config.claim({ vrfCoordinator: this.vrfCoordinator.address, linkToken: this.linkToken.address }));
    await this.claimSandbox.transferOwnership(this.timelockController.address);
    await scheduleAndExecute(this.claim, 'addController', [[dao]], { from: dao });
    await scheduleAndExecute(this.claimSandbox, 'addController', [[dao]], { from: dao });
  });

  describe('requestRandomNumber()', () => {
    it('allows only controllers to execute', async () => {
      await expect(this.claim.requestRandomNumber(owner, [1, 2, 3], false, { from: anon })).to.eventually.be.rejectedWith('Only controllers can execute');
    });
    it('fails if LINK balance is insufficient', async () => {
      await expect(this.claimSandbox.requestRandomNumber(owner, [1, 2, 3], false, { from: dao })).to.eventually.be.rejectedWith('Insufficient LINK');
    });
    it('creates a claimMany request', async () => {
      const { logs } = await this.claim.requestRandomNumber(owner, [1, 2, 3], true, { from: dao });
      const requestId = logs[0].args.requestId;
      expect(logs[0].args.sender).to.equal(owner);
      expect(requestId).to.have.length(66);
      const res = await this.claim.vrfRequests(requestId);
      expect(res.requestId).to.be.a.bignumber.eq(requestId);
      expect(res.sender).to.equal(owner);
      expect(res.unstake).to.be.true;
    });
  });
  describe('withdrawLink()', () => {
    it('allows nobody but the owner to withdraw', async () => {
      await expect(this.claim.withdrawLink(1, { from: anon })).to.eventually.be.rejectedWith('Only DAO can execute');
    });
    it('allows owner to withdraw', async () => {
      const balance = await this.linkToken.balanceOf(this.claim.address);
      await this.claim.withdrawLink(111, { from: dao });
      const newBalance = await this.linkToken.balanceOf(this.claim.address);
      expect(balance.sub(newBalance)).to.be.a.bignumber.eq('111');
      const daoBalance = await this.linkToken.balanceOf(dao);
      expect(daoBalance).to.be.a.bignumber.eq('111');
    });
  });
});
