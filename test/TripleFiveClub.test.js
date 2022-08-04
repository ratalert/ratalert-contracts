const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { advanceTimeAndBlock, mintAndFulfill, claimManyAndFulfill, scheduleAndExecute, toWei, trainUntilWeHave } = require('./helper');
const Config = require('../config');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);
const expect = chai.expect;
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const FastFood = artifacts.require('FastFood');
const GourmetFood = artifacts.require('GourmetFood');
const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');
const Properties = artifacts.require('Properties');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');
const TripleFiveClub = artifacts.require('TripleFiveClub');

function skipSeconds(ts) {
  const week = 60 * 60 * 24 * 7;
  const d0 = Math.floor(new Date('2021-11-21 01:00:00').getTime() / 1000);
  const d1 = Math.floor(new Date('2021-11-22 01:00:00').getTime() / 1000);

  if (ts % week < d0 % week) {
    return d0 % week - ts % week;
  } else if (ts % week >= d1 % week) {
    return week - ts % week + d0 % week;
  }
  return 0;
}

contract('TripleFiveClub (proxy)', (accounts) => {
  const config = Config('development', accounts)
  const owner = accounts[0];
  const dao = accounts[9];
  let lists = {};

  before(async () => {
    this.vrfCoordinator = await VRFCoordinator.deployed();
    this.linkToken = await LinkToken.deployed();
    this.fastFood = await FastFood.deployed();
    this.gourmetFood = await GourmetFood.deployed();
    this.mint = await Mint.deployed();
    this.claim = await Claim.deployed();
    this.properties = await Properties.deployed();
    this.character = await Character.deployed();
    this.kitchen = await McStake.deployed();
    this.tripleFiveClub = await TripleFiveClub.deployed();

    const tripleFiveClubConfig = config.tripleFiveClub;
    tripleFiveClubConfig[7] = 3;
    await scheduleAndExecute(this.fastFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), dao], { from: dao });
    await scheduleAndExecute(this.gourmetFood, 'grantRole', [web3.utils.soliditySha3(web3.utils.fromAscii('MINTER_ROLE')), dao], { from: dao });
    await scheduleAndExecute(this.character, 'configure', [10, 5, this.properties.address], { from: dao });
    await scheduleAndExecute(this.tripleFiveClub, 'configure', config.tripleFiveClub, { from: dao });
    await this.fastFood.mint(owner, toWei(100000), { from: dao });

    const res1 = await mintAndFulfill.call(this, 5, false, { character: this.character });
    lists.gen0 = res1.logs.filter(item => item.event === 'Transfer').map(it => Number(it.args.tokenId.toString()));
    const res2 = await mintAndFulfill.call(this, 5, false, { character: this.character, args: { value: 0 } });
    lists.gen1 = res2.logs.filter(item => item.event === 'Transfer').map(it => Number(it.args.tokenId.toString()));
    lists.all = lists.gen0.concat(lists.gen1);
    await this.character.setApprovalForAll(this.kitchen.address, true);
    lists.trained = await trainUntilWeHave.call(this, this.kitchen, 0, 4, lists.all.map(id => ({ id })), 1, true, true, { verbose: true, args: { from: owner } });
    await this.character.setApprovalForAll(this.tripleFiveClub.address, true);

    // Make sure it's not Sunday
    const ts = (await web3.eth.getBlock('latest')).timestamp;
    const weekModulo = ts % 604800;
    if (weekModulo >= 259200 && weekModulo < 345600) {
      await advanceTimeAndBlock(86400); // Skip a day
    }
  });

  describe('stakeMany()', () => {
    it('denies entry to non-Gen0 characters', async () => {
      await expect(this.tripleFiveClub.stakeMany(owner, lists.gen1)).to.eventually.be.rejectedWith('Gen0 only');
    });
    it('requires an entry-fee', async () => {
      await expect(this.tripleFiveClub.stakeMany(owner, lists.gen0)).to.eventually.be.rejectedWith('burn amount exceeds balance');
    });
    it('grants entry to Gen0 characters', async () => {
      await this.gourmetFood.mint(owner, toWei(0.5), {from: dao});
      await this.tripleFiveClub.stakeMany(owner, lists.gen0);
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('0');
      await expect(this.character.ownerOf(lists.gen0[0])).to.eventually.equal(this.tripleFiveClub.address);
      await expect(this.character.ownerOf(lists.gen0[4])).to.eventually.equal(this.tripleFiveClub.address);
    });
    it('limits simultaneous Gen1 access during open door events', async () => {
      const ts = (await web3.eth.getBlock('latest')).timestamp;
      await advanceTimeAndBlock(skipSeconds(ts)); // Skip to the next open door event
      await this.gourmetFood.mint(owner, toWei(5), {from: dao});
      await expect(this.tripleFiveClub.stakeMany(owner, lists.gen1.slice(0, 5))).to.eventually.be.rejectedWith('Gen1 limit reached');
    });
    it('grants entry to Gen1 characters during open door events', async () => {
      const { logs } = await this.tripleFiveClub.stakeMany(owner, lists.gen1.slice(0, 3));
      const stakedGen1 = logs.filter(item => item.event === 'StakedGen1').map(item => item.args.value.toString());
      expect(stakedGen1[stakedGen1.length - 1]).to.equal('3');
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('3');
      await expect(this.character.ownerOf(lists.gen1[0])).to.eventually.equal(this.tripleFiveClub.address);
      await expect(this.character.ownerOf(lists.gen1[1])).to.eventually.equal(this.tripleFiveClub.address);
      await expect(this.character.ownerOf(lists.gen1[2])).to.eventually.equal(this.tripleFiveClub.address);
    });
    it('force-ejects Gen1 characters after the vesting period', async () => {
      await advanceTimeAndBlock(3600); // Skip an hour
      const { logs } = await this.tripleFiveClub.stakeMany(owner, lists.gen1.slice(3, 5));
      const stakedGen1 = logs.filter(item => item.event === 'StakedGen1').map(item => item.args.value.toString());
      expect(stakedGen1[stakedGen1.length - 1]).to.equal('2');
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('2');
      await expect(this.character.ownerOf(lists.gen1[0])).to.eventually.equal(owner);
      await expect(this.character.ownerOf(lists.gen1[1])).to.eventually.equal(owner);
      await expect(this.character.ownerOf(lists.gen1[2])).to.eventually.equal(owner);
      await expect(this.character.ownerOf(lists.gen1[3])).to.eventually.equal(this.tripleFiveClub.address);
      await expect(this.character.ownerOf(lists.gen1[4])).to.eventually.equal(this.tripleFiveClub.address);
    });
    it('leaves Gen0 characters staked', async () => {
      await expect(this.character.ownerOf(lists.gen0[0])).to.eventually.equal(this.tripleFiveClub.address);
      await expect(this.character.ownerOf(lists.gen0[4])).to.eventually.equal(this.tripleFiveClub.address);
    });
  });
  describe('claimMany()', () => {
    it('cannot claim without a claim fee', async () => {
      await expect(this.tripleFiveClub.claimMany(lists.gen0, false)).to.eventually.be.rejectedWith('Invalid claim fee');
    });
    it('cannot claim before EOB', async () => {
      await expect(this.tripleFiveClub.claimMany(lists.gen1.slice(3, 5), false, { value: config.kitchen.claimFee })).to.eventually.be.rejectedWith('Cannot claim before EOB');
    });
    it('grants the boost to Gen0', async () => {
      await advanceTimeAndBlock(3600); // Wait an hour so we can unstake
      await claimManyAndFulfill.call(this, this.tripleFiveClub, lists.gen0, true);
      await Promise.all(lists.gen0.map(async (id) => {
        const traits = await this.character.tokenTraits(id);
        await expect(this.character.ownerOf(id)).to.eventually.equal(owner);
        expect(traits.boost).to.be.a.bignumber.eq('2');
        expect(traits.efficiency).to.be.a.bignumber.eq((lists.trained.find(it => it.id === id).efficiency).toString());
        expect(traits.tolerance).to.be.a.bignumber.eq((lists.trained.find(it => it.id === id).tolerance - 2).toString());
      }));
    });
    it('does not grant the boost to Gen1', async () => {
      await claimManyAndFulfill.call(this, this.tripleFiveClub, lists.gen1.slice(3, 5), true);
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('0');
      await Promise.all(lists.gen1.slice(3, 5).map(async (id) => {
        const traits = await this.character.tokenTraits(id);
        await expect(this.character.ownerOf(id)).to.eventually.equal(owner);
        expect(traits.boost).to.be.a.bignumber.eq('0');
        expect(traits.efficiency).to.be.a.bignumber.eq((lists.trained.find(it => it.id === id).efficiency).toString());
        expect(traits.tolerance).to.be.a.bignumber.eq((lists.trained.find(it => it.id === id).tolerance - (traits.isChef ? 2 : 1)).toString());
      }));
    });
    it('lets Gen1 claim within open door events', async () => {
      await this.gourmetFood.mint(owner, toWei(3), {from: dao});
      await this.tripleFiveClub.stakeMany(owner, lists.gen1.slice(0, 3));
      await advanceTimeAndBlock(3600); // Wait an hour so we can unstake
      await claimManyAndFulfill.call(this, this.tripleFiveClub, lists.gen1.slice(0, 3), false);
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('0');
      await Promise.all(lists.gen1.slice(0, 3).map(async (id) => {
        await expect(this.character.ownerOf(id)).to.eventually.equal(owner); // Got ejected
      }));
    });
    it('lets Gen1 claim outside open door events', async () => {
      await this.gourmetFood.mint(owner, toWei(3), {from: dao});
      await this.tripleFiveClub.stakeMany(owner, lists.gen1.slice(0, 3));
      await advanceTimeAndBlock(86400); // Wait an hour so we can unstake
      await claimManyAndFulfill.call(this, this.tripleFiveClub, lists.gen1.slice(0, 1), false);
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('2');
      await expect(this.character.ownerOf(lists.gen1[0])).to.eventually.equal(owner);
      await expect(this.character.ownerOf(lists.gen1[1])).to.eventually.equal(this.tripleFiveClub.address);
      await expect(this.character.ownerOf(lists.gen1[2])).to.eventually.equal(this.tripleFiveClub.address);
    });
    it('kicks out Gen1 after open door events', async () => {
      await advanceTimeAndBlock(86400); // Wait an hour so we can unstake
      await this.gourmetFood.mint(owner, toWei(0.5), {from: dao});
      await this.tripleFiveClub.stakeMany(owner, lists.gen0);
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('0');
      await Promise.all(lists.gen1.slice(1, 3).map(async (id) => {
        await expect(this.character.ownerOf(id)).to.eventually.equal(owner);
      }));
      await Promise.all(lists.gen0.map(async (id) => {
        await expect(this.character.ownerOf(id)).to.eventually.equal(this.tripleFiveClub.address);
      }));
    });
  });
  describe('multiEject()', () => {
    it('denies access to anonymous', async () => {
      await expect(this.tripleFiveClub.multiEject(lists.gen1.slice(0, 3))).to.eventually.be.rejectedWith('Only DAO can execute');
    });
    it('ejects', async () => {
      const ts = (await web3.eth.getBlock('latest')).timestamp;
      await advanceTimeAndBlock(skipSeconds(ts)); // Skip to the next open door event
      await this.gourmetFood.mint(owner, toWei(3), {from: dao});
      const { logs } = await this.tripleFiveClub.stakeMany(owner, lists.gen1.slice(0, 3));
      const stakedGen1 = logs.filter(item => item.event === 'StakedGen1').map(item => item.args.value.toString());
      expect(stakedGen1[stakedGen1.length - 1]).to.equal('3');
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('3');
      await this.tripleFiveClub.pause({ from: dao });
      await expect(this.tripleFiveClub.stakeMany(owner, lists.gen1.slice(3, 5))).to.eventually.be.rejectedWith('Pausable: paused');
      await this.tripleFiveClub.multiEject(lists.gen1.slice(0, 3), { from: dao });
      await expect(this.tripleFiveClub.getStakedGen1()).to.eventually.be.a.bignumber.eq('0');
      await expect(this.character.ownerOf(lists.gen1[0])).to.eventually.equal(owner);
      await expect(this.character.ownerOf(lists.gen1[1])).to.eventually.equal(owner);
      await expect(this.character.ownerOf(lists.gen1[2])).to.eventually.equal(owner);
    });
  });
  describe('isOpenForPublic()', () => {
    it('is true within the period', async () => {
      await expect(this.tripleFiveClub.isOpenForPublic()).to.eventually.be.true;
    });
    it('is false outside of the period', async () => {
      await advanceTimeAndBlock(86400); // Skip a day
      await expect(this.tripleFiveClub.isOpenForPublic()).to.eventually.be.false;
    });
  });
});
