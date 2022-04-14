const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { scheduleAndExecute } = require('./helper');
const Config = require('../config');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const TimelockController = artifacts.require('TimelockController');
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const Mint = artifacts.require('Mint');
const config = Config('development')

contract('Mint (proxy)', (accounts) => {
  const owner = accounts[0];
  const anon = accounts[1];
  const dao = accounts[9];

  before(async () => {
    this.timelockController = await TimelockController.deployed();
    this.vrfCoordinator = await VRFCoordinator.deployed();
    this.linkToken = await LinkToken.deployed();
    this.mint = await Mint.deployed();
    this.mintSandbox = await deployProxy(Mint, config.mint({ vrfCoordinator: this.vrfCoordinator.address, linkToken: this.linkToken.address }));
    await this.mintSandbox.transferOwnership(this.timelockController.address);
    await scheduleAndExecute(this.mint, 'addController', [[owner]], { from: dao });
    await scheduleAndExecute(this.mintSandbox, 'addController', [[owner]], { from: dao });
  });

  describe('requestRandomNumber()', () => {
    it('allows only controllers to execute', async () => {
      await expect(this.mint.requestRandomNumber(owner, 5, false, 1, { from: anon })).to.eventually.be.rejectedWith('Only controllers can execute');
    });
    it('fails if LINK balance is insufficient', async () => {
      await expect(this.mintSandbox.requestRandomNumber(owner, 5, false, 1)).to.eventually.be.rejectedWith('Insufficient LINK');
    });
    it('creates a mint request', async () => {
      const { logs } = await this.mint.requestRandomNumber(owner, 5, true, 1);
      const requestId = logs[0].args.requestId;
      expect(requestId).to.have.length(66);
      expect(logs[0].args.sender).to.equal(owner);
      const res = await this.mint.vrfRequests(requestId);
      expect(res.requestId).to.be.a.bignumber.eq(requestId);
      expect(res.sender).to.equal(owner);
      expect(res.amount).to.be.a.bignumber.eq('5')
      expect(res.stake).to.be.true;
    });
  });
  describe('getVrfRequest()', () => {
    it('returns an invalid object', async () => {
      const res = await this.mint.getVrfRequest('0x');
      expect(res.requestId).to.equal('0x0000000000000000000000000000000000000000000000000000000000000000');
      expect(res.sender).to.equal('0x0000000000000000000000000000000000000000');
      expect(res.amount).to.equal('0');
    });
    it('returns a valid object', async () => {
      const { logs } = await this.mint.requestRandomNumber(owner, 5, true, 1);
      const requestId = logs[0].args.requestId;
      const res = await this.mint.getVrfRequest(requestId);
      expect(res.requestId).to.equal(requestId);
      expect(res.sender).to.equal(owner);
      expect(res.amount).to.equal('5');
    })
  });
  describe('withdrawLink()', () => {
    it('allows nobody but the owner to withdraw', async () => {
      await expect(this.mint.withdrawLink(1, { from: anon })).to.eventually.be.rejectedWith('Only DAO can execute');
    });
    it('allows owner to withdraw', async () => {
      const balance = await this.linkToken.balanceOf(this.mint.address);
      await this.mint.withdrawLink(111, { from: dao });
      const newBalance = await this.linkToken.balanceOf(this.mint.address);
      expect(balance.sub(newBalance)).to.be.a.bignumber.eq('111');
      const daoBalance = await this.linkToken.balanceOf(dao);
      expect(daoBalance).to.be.a.bignumber.eq('111');
    });
  });
});
