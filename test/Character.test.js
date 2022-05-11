const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { BN } = require('@openzeppelin/test-helpers');
const { toWei, loadTraits, mintUntilWeHave, advanceTimeAndBlock, mintAndFulfill, fulfill, claimManyAndFulfill, doesSvgTraitMatch, scheduleAndExecute, decodeRawLogs } = require('./helper');
const Config = require('../config');
require('@openzeppelin/test-helpers');
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

chai.use(chaiAsPromised);

const expect = chai.expect;
const TimelockController = artifacts.require('TimelockController');
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const FastFood = artifacts.require('FastFood');
const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Paywall = artifacts.require('Paywall');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');

contract('Character (proxy)', (accounts) => {
  const config = Config('development', accounts)
  const owner = accounts[0];
  const anon = accounts[1];
  const dao = accounts[9];
  const stats = { numChefs: 0, numRats: 0 };
  let lists;
  const total = { minted: 0, paid: 0, balance: 0 };

  before(async () => {
    this.timelockController = await TimelockController.deployed();
    this.vrfCoordinator = await VRFCoordinator.deployed();
    this.linkToken = await LinkToken.deployed();
    this.fastFood = await FastFood.deployed();
    this.mint = await Mint.deployed();
    this.claim = await Claim.deployed();
    this.traits = await Traits.deployed();
    this.properties = await Properties.deployed();
    this.paywall = await Paywall.deployed();
    this.traitList = await loadTraits();
    this.character = await Character.deployed();
    this.kitchen = await McStake.deployed();
    this.characterSandbox = await deployProxy(Character, [this.paywall.address, this.mint.address, this.traits.address]);
    await this.characterSandbox.setDao(config.dao.address);
    await this.characterSandbox.transferOwnership(this.timelockController.address);
    await scheduleAndExecute(this.characterSandbox, 'configure', [5, 1, this.properties.address], { from: dao });
    await scheduleAndExecute(this.fastFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), dao], { from: dao });
    await scheduleAndExecute(this.fastFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), this.paywall.address], { from: dao });
    await scheduleAndExecute(this.paywall, 'addController', [[this.characterSandbox.address, dao]], { from: dao });
    await scheduleAndExecute(this.mint, 'addController', [[this.characterSandbox.address]], { from: dao });
  });

  describe('(un)pause()', () => {
    it('denies anonymous to pause', async () => {
      await expect(this.character.pause()).to.eventually.be.rejectedWith('Only DAO can execute');
    });
    it('allows DAO to pause', async () => {
      const res = await this.character.pause({ from: dao });
      expect(res.receipt.status).to.be.true;
      await expect(this.character.paused()).to.eventually.equal(true);
    });
    it('prevents minting when paused', async () => {
      await expect(this.character.mint(1, false, { from: anon, value: toWei(0.1) })).to.eventually.be.rejectedWith('Pausable: paused');
    });
    it('denies anonymous to unpause', async () => {
      await expect(this.character.unpause()).to.eventually.be.rejectedWith('Only DAO can execute');
    });
    it('allows DAO to unpause', async () => {
      const res = await this.character.unpause({ from: dao });
      expect(res.receipt.status).to.be.true;
      await expect(this.character.paused()).to.eventually.equal(false);
    });
  });

  describe('mint()', () => {
    it('only allows to mint 1-10 tokens', async () => {
      await expect(this.character.mint(0, false, { from: owner, value: toWei(0) })).to.eventually.be.rejectedWith('Invalid mint amount');
      await expect(this.character.mint(11, false, { from: owner, value: toWei(1.1) })).to.eventually.be.rejectedWith('Invalid mint amount');
    });

    it('rejects invalid payments', async () => {
      await expect(this.character.mint(1, false, { from: owner })).to.eventually.be.rejectedWith('Invalid payment amount');
      await expect(this.character.mint(2, false, { from: owner, value: toWei(0.1) })).to.eventually.be.rejectedWith('Invalid payment amount');
      await expect(this.character.mint(3, false, { from: owner, value: toWei(0.4) })).to.eventually.be.rejectedWith('Invalid payment amount');
    });

    it('allows nobody but the Mint to fulfill', async () => {
      const res = await this.character.mint(5, false, { value: toWei(0.5) });
      total.paid += 5;
      total.balance += 5 * 0.1;
      const { requestId } = decodeRawLogs(res, this.mint, 'RandomNumberRequested')[0].args;
      const payload = { requestId, sender: owner, amount: 5, stake: false, boost: 0 };
      await expect(this.character.fulfillMint(payload, [])).to.eventually.be.rejectedWith('Only the Mint can fulfill');
      await expect(this.character.paid()).to.eventually.be.a.bignumber.that.equals((total.paid).toString());
    });
    it('fails if all characters have been minted', async () => {
      await expect(this.characterSandbox.mint(6, false)).to.eventually.be.rejectedWith('All tokens minted');
    });
    it('rejects Gen0 exceeding mints', async () => {
      await expect(this.characterSandbox.mint(2, false, { value: toWei(0.2) })).to.eventually.be.rejectedWith('Not enough Gen 0 tokens left, reduce amount');
    });
    it('rejects ETH for Gen1 payments', async () => {
      await scheduleAndExecute(this.mint, 'setCharacter', [this.characterSandbox.address], { from: dao });
      const res = await mintAndFulfill.call(this, 1, false, { character: this.characterSandbox });
      this.mintRequestId = res.requestId;
      await expect(this.characterSandbox.minted()).to.eventually.be.a.bignumber.eq('1');
      await expect(this.characterSandbox.mint(2, false, { value: toWei(0.2) })).to.eventually.be.rejectedWith('Invalid payment type, accepting food tokens only');
      await scheduleAndExecute(this.mint, 'setCharacter', [this.character.address], { from: dao });
    });
    it('fails if out of $FFOOD', async () => {
      await expect(this.characterSandbox.mint(4, false)).to.eventually.be.rejectedWith('burn amount exceeds balance');
    });
    it('calculates mint price correctly', async () => {
      await scheduleAndExecute(this.mint, 'setCharacter', [this.characterSandbox.address], { from: dao }, 1);
      const price = 2000 + 3000 + 5000 + 8000; // each character has a new price break
      await this.fastFood.mint(owner, toWei(price), { from: dao });
      const balance = await this.fastFood.balanceOf(owner);
      expect(balance).to.be.a.bignumber.eq(toWei(18000));
      const res = await mintAndFulfill.call(this, 4, false, { character: this.characterSandbox, args: { value: 0, from: owner } });
      expect(res.receipt.status).to.be.true;
      const newBalance = await this.fastFood.balanceOf(owner);
      expect(newBalance).to.be.a.bignumber.eq('0');
      await expect(this.characterSandbox.paid()).to.eventually.be.a.bignumber.eq('5');
      await expect(this.characterSandbox.minted()).to.eventually.be.a.bignumber.eq('5');
      await scheduleAndExecute(this.mint, 'setCharacter', [this.character.address], { from: dao }, 1);
    });
    it('fails if the max supply is reached', async () => {
      await scheduleAndExecute(this.mint, 'setCharacter', [this.characterSandbox.address], { from: dao }, 2);
      await expect(this.characterSandbox.mint(1, false)).to.eventually.be.rejectedWith('All tokens minted');
      await scheduleAndExecute(this.mint, 'setCharacter', [this.character.address], { from: dao }, 2);
    });
    it('emits the RandomNumberRequested event', async () => {
      const res = await this.character.mint(1, false, { from: anon, value: toWei(0.1) });
      total.paid += 1;
      total.balance += 0.1;
      const randomNumberRequestedEvent = decodeRawLogs(res, this.mint, 'RandomNumberRequested')[0];
      expect(randomNumberRequestedEvent.args.sender).to.equal(anon);
      await expect(this.character.paid()).to.eventually.be.a.bignumber.that.equals(total.paid.toString());
    });

    it('allows owner to mint', async () => {
      lists = await mintUntilWeHave.call(this, 8, 2);
      total.minted += lists.all.length;
      total.paid += lists.all.length;
      total.balance += lists.all.length * 0.1;
      await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals(toWei(total.balance.fix()));
      await expect(this.character.paid()).to.eventually.be.a.bignumber.that.equals(total.paid.toString());
      await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals(total.minted.toString());
      await expect(this.character.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals(lists.all.length.toString());
      await expect(this.character.ownerOf(total.minted - lists.all.length + 1)).to.eventually.equal(owner);
      await expect(this.character.ownerOf(total.minted)).to.eventually.equal(owner);
      const IDs = lists.all.map(item => item.id);
      const checks = {
        isChef: { traitType: 'type', name: 'Type' },
        hat: { traitType: 'trait', name: 'Hat' },
        eyes: { traitType: 'trait', name: 'Eyes' },
        piercing: { traitType: 'trait', name: 'Piercing' },
        mouth: { traitType: 'trait', name: 'Mouth' },
        neck: { traitType: 'trait', name: 'Neck' },
        hand: { traitType: 'trait', name: 'Hand' },
        tail: { traitType: 'trait', name: 'Tail' },
        skill: { traitType: 'dynamic', name: 'Skill', character: 'chef', category: 'efficiency', value: 'Kitchen Scullion', additional: 'Skill percentage' },
        freak: { traitType: 'dynamic', name: 'Freak', character: 'chef', category: 'tolerance', value: 'Bored', additional: 'Freak percentage' },
        intelligence: { traitType: 'dynamic', name: 'Intelligence', character: 'rat', category: 'efficiency', value: 'Braindead', additional: 'Intelligence quotient' },
        bodyMass: { traitType: 'dynamic', name: 'Body mass', character: 'rat', category: 'tolerance', value: 'Anorexic', additional: 'Body mass percentage' },
        boost: {traitType: 'boost', name: 'Boost', value: 0 },
      }
      const traitMap = {
        chef: { Body: 'body', Head: 'head', Eyes: 'eyes', Hat: 'hat', Neck: 'neck', Mouth: 'mouth', Hand: 'hand' },
        rat: { Body: 'body', Tail: 'tail', Head: 'head', Piercing: 'piercing', Eyes: 'eyes', Hat: 'hat', Neck: 'neck' },
      }
      await Promise.all(IDs.map(async id => {
        const traits = await this.character.getTokenTraits(id);
        const tokenUri = await this.character.tokenURI(id);
        const json = JSON.parse(Buffer.from(tokenUri.split(',')[1], 'base64').toString());
        const type = json.attributes.find(attr => attr.trait_type === 'Type').value.toLowerCase();
        const svg = Buffer.from(json.image.split(',')[1], 'base64').toString();
        expect(json.name).to.equal(`${traits.isChef ? 'Chef' : 'Rat'} #${id}`);
        expect(json.description).to.include('https://ratalert.com');
        expect(json.external_url).to.equal(`https://ratalert.com/characters/${id}`);
        expect(json.image.length).to.be.above(2500); // Contains images
        expect(svg.length).to.be.above(2500); // Contains images
        await expect(doesSvgTraitMatch(svg, traits.isChef ? 'chef' : 'rat','body', 0)).to.eventually.be.true;
        await expect(doesSvgTraitMatch(svg, traits.isChef ? 'chef' : 'rat','head', 0)).to.eventually.be.true;
        traits.isChef ? stats.numChefs += 1 : stats.numRats += 1;
        Object.entries(checks).forEach(([key, val]) => {
          const attr = json.attributes.find(v => v.trait_type === val.name);
          if (val.traitType === 'type') {
            expect(traits[key]).to.equal(attr.value === 'Chef');
          }
          if (val.traitType === 'trait') {
            if (traits[key] === '0') {
              expect(attr).to.be.undefined; // No attribute for missing trait
            } else {
              const traitName = this.traitList[type][traitMap[type][attr.trait_type]][traits[key]].name;
              expect(val.name).to.equal(attr.trait_type);
              expect(attr.value).to.equal(traitName);
            }
          }
          if (val.traitType === 'dynamic' && val.character === type) {
            expect(traits[val.category]).to.equal('0');
            expect(val.name).to.equal(attr.trait_type);
            expect(attr.value).to.equal(val.value);
            const additionalAttr = json.attributes.find(v => v.trait_type === val.additional);
            expect(additionalAttr.value).to.equal(0);
            expect(additionalAttr.max_value).to.equal(100);
          }
          if (val.traitType === 'boost') {
            expect(attr.trait_type).to.equal(val.name);
            expect(attr.value).to.equal(val.value);
          }
        });
      }));
      await expect(this.character.numChefs()).to.eventually.be.a.bignumber.that.equals(stats.numChefs.toString());
      await expect(this.character.numRats()).to.eventually.be.a.bignumber.that.equals(stats.numRats.toString());
    });

    it('allows anonymous to mint', async () => {
      const { logs } = await mintAndFulfill.call(this, 5, false, { args: { from: anon } });
      total.minted += 5;
      total.paid += 5;
      total.balance += 5 * 0.1;
      const fulfilledEvent = logs.find(item => item.event === 'RandomNumberFulfilled');
      expect(fulfilledEvent.args.sender).to.equal(anon);
      const IDs = logs.filter(item => item.event === 'Transfer').map(it => Number(it.args.tokenId.toString()));
      await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals(toWei(total.balance.fix()));
      await expect(this.character.paid()).to.eventually.be.a.bignumber.that.equals(total.paid.toString());
      await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals(total.minted.toString());
      await expect(this.character.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('5');
      await Promise.all(IDs.map(async id => {
        await expect(this.character.ownerOf(id)).to.eventually.equal(anon);
        const traits = await this.character.getTokenTraits(id);
        traits.isChef ? stats.numChefs += 1 : stats.numRats += 1;
      }));
      await expect(this.character.numChefs()).to.eventually.be.a.bignumber.that.equals(stats.numChefs.toString());
      await expect(this.character.numRats()).to.eventually.be.a.bignumber.that.equals(stats.numRats.toString());
    });

    it('mints and stakes', async () => {
      const res = await mintAndFulfill.call(this, 5, true, { args: { from: anon } });
      total.minted += 5;
      total.paid += 5;
      total.balance += 5 * 0.1;
      const IDs = res.logs.filter(item => item.event === 'Transfer').map(it => Number(it.args.tokenId.toString()));
      expect(res.receipt.status).to.be.true;
      await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals(toWei(total.balance.fix()));
      await expect(this.character.paid()).to.eventually.be.a.bignumber.that.equals(total.paid.toString());
      await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals(total.minted.toString());
      await expect(this.character.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('5'); // Because they are staked!
      await Promise.all(IDs.map(async id => {
        await expect(this.character.ownerOf(id)).to.eventually.equal(this.kitchen.address);
      }));

      await advanceTimeAndBlock(3600); // Wait an hour so we can unstake
      const { logs } = await claimManyAndFulfill.call(this, this.kitchen, IDs, true, { args: { from: anon } });
      logs.filter(item => ['ChefClaimed', 'RatClaimed'].includes(item.event)).forEach((log, i) => {
        expect(log.args.tokenId).to.be.a.bignumber.eq(IDs[i].toString());
        expect(log.args.unstaked).to.be.true;
      });
      await expect(this.character.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('10');
      await Promise.all(IDs.map(async id => {
        await expect(this.character.ownerOf(id)).to.eventually.equal(anon);
      }));
    });

    it('fullfills correctly no matter the order', async () => {
      const minted = Number((await this.character.minted()).toString());
      const res2a = await this.character.mint(2, false, { from: accounts[2], value: toWei(0.2) });
      const res3a = await this.character.mint(3, false, { from: accounts[3], value: toWei(0.3) });
      const res4a = await this.character.mint(4, false, { from: accounts[4], value: toWei(0.4) });
      const res4b = await fulfill.call(this, res4a);
      const res3b = await fulfill.call(this, res3a);
      const res2b = await fulfill.call(this, res2a);
      total.paid += 9;
      total.minted += 9;
      total.balance += 9 * 0.1;
      res2b.logs.filter(item => item.name === 'Transfer').forEach((log, i) => expect(Number(log.args.tokenId)).to.equal(minted + i + 1));
      res3b.logs.filter(item => item.name === 'Transfer').forEach((log, i) => expect(Number(log.args.tokenId)).to.equal(minted + i + 3));
      res4b.logs.filter(item => item.name === 'Transfer').forEach((log, i) => expect(Number(log.args.tokenId)).to.equal(minted + i + 6));
    });
    it('fails if not whitelisted', async () => {
      await this.paywall.toggleWhitelist(true, { from: dao });
      await expect(mintAndFulfill.call(this, 5, true, { args: { from: anon } })).to.eventually.be.rejectedWith('Not whitelisted');
    });
    it('succeeds with free mints', async () => {
      await this.paywall.addToFreeMints([anon], { from: dao });
      await expect(mintAndFulfill.call(this, 1, true, { args: { from: anon, value: 0 } })).to.eventually.have.nested.property('receipt.status', true); // free
      total.paid += 1;
      total.minted += 1;
      total.balance += 0;
    });
    it('succeeds if whitelisted', async () => {
      await this.paywall.addToWhitelist([anon], { from: dao });
      await expect(mintAndFulfill.call(this, 1, true, { args: { from: anon, value: toWei(0.09) } })).to.eventually.have.nested.property('receipt.status', true); // discounted
      total.paid += 1;
      total.minted += 1;
      total.balance += 0.09;
    });
    it('mints boosted characters', async () => {
      await this.paywall.addToWhitelist([anon, anon, anon], { from: dao });
      const { logs } = await mintAndFulfill.call(this, 3, true, { args: { from: anon, value: toWei(0.27) } });
      total.paid += 3;
      total.minted += 3;
      total.balance += 0.27;
      await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals(toWei(total.balance.fix()));
      await expect(this.character.paid()).to.eventually.be.a.bignumber.that.equals(total.paid.toString());
      await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals(total.minted.toString());
      const IDs = logs.filter(item => item.event === 'Transfer').map(it => Number(it.args.tokenId.toString()));
      await Promise.all(IDs.map(async id => {
        const traits = await this.character.getTokenTraits(id);
        const tokenUri = await this.character.tokenURI(id);
        const json = JSON.parse(Buffer.from(tokenUri.split(',')[1], 'base64').toString());
        const boostAttribute = json.attributes.find(item => item.trait_type === 'Boost');
        expect(boostAttribute.display_type).to.equal('boost_percentage');
        expect(boostAttribute.max_value).to.equal(100);
        expect(boostAttribute.value).to.equal(1);
        expect(traits.boost).to.equal('1');
      }));
    });
  });

  describe('withdrawPayments()', () => {
    it('denies anonymous to withdraw', async () => {
      await expect(this.character.withdrawPayments()).to.eventually.be.rejectedWith('Only DAO can execute');
    });
    it('allows DAO to withdraw', async () => {
      const daoBalance = await web3.eth.getBalance(config.dao.address);
      const res = await this.character.withdrawPayments({ from: dao });
      expect(res.receipt.status).to.be.true;
      await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals('0');
      await expect(web3.eth.getBalance(config.dao.address)).to.eventually.be.a.bignumber.gte(new BN(daoBalance).add(new BN(toWei(total.balance * 0.9999))));
    });
  });

  describe('updateCharacter()', () => {
    it('restricts to controllers only', async () => {
      await expect(this.character.updateCharacter(1, 2, 4, 123456789)).to.eventually.be.rejectedWith('Only controllers can execute');
    });
    it('returns controller status by address', async () => {
      await expect(this.character.controller(this.kitchen.address)).to.eventually.be.true;
      await expect(this.character.controller(this.fastFood.address)).to.eventually.be.false;
    });
  });
});
