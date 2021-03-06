const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { toWei, mintUntilWeHave, trainUntilWeHave, scheduleAndExecute } = require('./helper');
const Config = require('../config');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);
const expect = chai.expect;
const TimelockController = artifacts.require('TimelockController');
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');
const FastFood = artifacts.require('FastFood');
const CasualFood = artifacts.require('CasualFood');
const Properties = artifacts.require('Properties');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');
const KitchenShop = artifacts.require('KitchenShop');

contract('KitchenShop (proxy)', (accounts) => {
  const config = Config('development', accounts)
  const owner = accounts[0];
  const dao = accounts[9];
  let lists;
  let fastFoodBalance;

  before(async () => {
    this.timelockController = await TimelockController.deployed();
    this.vrfCoordinator = await VRFCoordinator.deployed();
    this.linkToken = await LinkToken.deployed();
    this.mint = await Mint.deployed();
    this.claim = await Claim.deployed();
    this.fastFood = await FastFood.deployed();
    this.casualFood = await CasualFood.deployed();
    this.properties = await Properties.deployed();
    this.character = await Character.deployed();
    this.kitchen = await McStake.deployed();
    this.kitchenShop = await KitchenShop.deployed();
    this.kitchenShopSandbox = await deployProxy(KitchenShop, [this.fastFood.address, this.fastFood.address, this.character.address]);
    await this.kitchenShopSandbox.transferOwnership(this.timelockController.address);
    await scheduleAndExecute(this.kitchenShopSandbox, 'configure', [[5, 5], 10, [28, 72], [toWei(1000), toWei(2000), toWei(4000), toWei(7000), toWei(11000)]], { from: dao });
    await scheduleAndExecute(this.fastFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), dao], { from: dao });
    await scheduleAndExecute(this.fastFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('BURNER_ROLE')), this.kitchenShopSandbox.address], { from: dao });
    await scheduleAndExecute(this.casualFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), dao], { from: dao });

    lists = await mintUntilWeHave.call(this, 2, 2);
    lists.chefs = [lists.chefs[0], lists.chefs[1]];
    lists.rats = [lists.rats[0], lists.rats[1]];
    lists.all = lists.chefs.concat(lists.rats);

    await this.character.setApprovalForAll(this.kitchen.address, true, { from: owner });
    const propertiesConfig = [[...config.properties[0]], [...config.properties[1]], [...config.properties[2]]];
    propertiesConfig[0][0] = 100;
    propertiesConfig[0][1] = 100;
    propertiesConfig[1][0] = 100;
    propertiesConfig[1][1] = 100;
    await scheduleAndExecute(this.properties, 'configure', propertiesConfig, { from: dao });
    lists.all = await trainUntilWeHave.call(this, this.kitchen, 72, 0, [lists.all[0], lists.all[2]], 10, true, true, { verbose: true, args: { from: owner } });
    await scheduleAndExecute(this.properties, 'configure', config.properties, { from: dao });
  });

  describe('uri()', () => {
    it('returns a valid JSON', async () => {
      const checks = ['TheStakeHouse (CasualFood Kitchen)', 'LeStake (GourmetFood Kitchen)'];
      await Promise.all(checks.map(async (check, i) => {
        const res = await this.kitchenShop.uri(i + 1);
        const json = JSON.parse(Buffer.from(res.split(',')[1], 'base64').toString());
        const svg = Buffer.from(json.image.split(',')[1], 'base64').toString();
        expect(svg).to.include('<svg id="kitchen"');
        expect(json.name).to.equal(check);
        expect(json.description).to.include('https://ratalert.com');
        expect(json.external_url).to.equal(`https://ratalert.com/kitchens/${i + 1}`);
        expect(svg.length).to.be.above(2000); // Contains image
      }));
    });
  });

  describe('name()', () => {
    it('returns the string', async () => {
      await expect(this.kitchenShop.name()).to.eventually.equal('RatAlert Kitchens');
    });
  });

  describe('symbol()', () => {
    it('returns the string', async () => {
      await expect(this.kitchenShop.symbol()).to.eventually.equal('RATCUISINE')
    });
  });

  describe('tokenSupply()', () => {
    it('returns the total supply', async () => {
      await expect(this.kitchenShop.tokenSupply()).to.eventually.be.a.bignumber.eq('1100');
    });
  });

  describe('mint()', () => {
    it('fails to mint invalid kitchens', async () => {
      await expect(this.kitchenShop.mint(0, 1)).to.eventually.be.rejectedWith('Invalid kitchen');
      await expect(this.kitchenShop.mint(3, 1)).to.eventually.be.rejectedWith('Invalid kitchen');
    });

    it('only allows to mint 1-10 kitchens', async () => {
      await expect(this.kitchenShop.mint(1, 0, { value: toWei(0) })).to.eventually.be.rejectedWith('Invalid mint amount');
      await expect(this.kitchenShop.mint(1, 11, { value: toWei(1.1) })).to.eventually.be.rejectedWith('Invalid mint amount');
    });

    it('fails if all kitchens have been minted', async () => {
      await expect(this.kitchenShopSandbox.mint(1, 6)).to.eventually.be.rejectedWith('All tokens minted');
    });

    it('rejects invalid payments', async () => {
      await expect(this.kitchenShop.mint(1, 1, { value: toWei(0.1) })).to.eventually.be.rejectedWith('Invalid payment type');
      await expect(this.kitchenShop.mint(1, 2, { value: toWei(0.2) })).to.eventually.be.rejectedWith('Invalid payment type');
    });

    it('mints TheStakehouse with $FFOOD', async () => {
      await this.fastFood.mint(owner, toWei(5 * 1000), { from: dao });
      fastFoodBalance = await this.fastFood.balanceOf(owner);
      const { logs } = await this.kitchenShop.mint(1, 5);
      expect(logs).to.have.length(1);
      expect(logs[0].args.to).to.equal(owner);
      expect(logs[0].args.id).to.be.a.bignumber.eq('1');
      expect(logs[0].args.value).to.be.a.bignumber.eq('5');

      const newBalance = await this.fastFood.balanceOf(owner);
      expect(fastFoodBalance.sub(newBalance)).to.be.a.bignumber.eq(toWei(5 * 1000));
      expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('5');
      expect(this.kitchenShop.minted(1)).to.eventually.be.a.bignumber.eq('5');
    });

    it('calculates mint price correctly', async () => {
      const price = 1000 + 2000 + 4000 + 7000 + 11000; // each kitchen has a new price break
      await this.fastFood.mint(owner, toWei(price), { from: dao });
      const balance = await this.fastFood.balanceOf(owner);
      const res = await this.kitchenShopSandbox.mint(1, 5);
      await expect(res.receipt.status).to.be.true;
      const newBalance = await this.fastFood.balanceOf(owner);
      expect(balance.sub(newBalance)).to.be.a.bignumber.eq(toWei(price));
    });

    it('fails if out of $FFOOD', async () => {
      await expect(this.kitchenShop.mint(1, 10)).to.eventually.be.rejectedWith('burn amount exceeds balance');
      await expect(this.kitchenShop.balanceOf(owner, 1)).to.eventually.be.a.bignumber.eq('5');
    });

    it('fails if no $CFOOD', async () => {
      await expect(this.kitchenShop.mint(2, 1)).to.eventually.be.rejectedWith('burn amount exceeds balance');
      expect(this.kitchenShop.balanceOf(owner, 2)).to.eventually.be.a.bignumber.eq('0');
    });

    it('mints LeStake with $CFOOD', async () => {
      const price = 5 * 1000;
      await this.casualFood.mint(owner, toWei(price), { from: dao });
      const balance = await this.casualFood.balanceOf(owner);

      const { logs } = await this.kitchenShop.mint(2, 5);
      expect(logs).to.have.length(1);
      expect(logs[0].args.to).to.equal(owner);
      expect(logs[0].args.id).to.be.a.bignumber.eq('2');
      expect(logs[0].args.value).to.be.a.bignumber.eq('5');

      const newBalance = await this.casualFood.balanceOf(owner);
      expect(balance.sub(newBalance)).to.be.a.bignumber.eq(toWei(price));
      expect(this.kitchenShop.balanceOf(owner, 2)).to.eventually.be.a.bignumber.eq('5');
      expect(this.kitchenShop.minted(2)).to.eventually.be.a.bignumber.eq('5');
    });
  });
});
