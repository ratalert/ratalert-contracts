const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { advanceTimeAndBlock, mintUntilWeHave, mintAndFulfill, claimManyAndFulfill, trainUntilWeHave } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);
const expect = chai.expect;
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');
const Gym = artifacts.require('Gym');

contract('Gym (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
    let lists;

    before(async () => {
        this.vrfCoordinator = await VRFCoordinator.deployed();
        this.linkToken = await LinkToken.deployed();
        this.mint = await Mint.deployed();
        this.claim = await Claim.deployed();
        this.character = await Character.deployed();
        this.kitchen = await McStake.deployed();
        this.gym = await Gym.deployed();

        lists = await mintUntilWeHave.call(this, 8, 3);
        lists.events = [lists.chefs[3], lists.chefs[4]];
        lists.chefs = [lists.chefs[0], lists.chefs[1]];
        lists.rats = [lists.rats[0], lists.rats[1]];
        lists.all = lists.chefs.concat(lists.rats);

        await this.character.setApprovalForAll(this.kitchen.address, true, { from: owner });
        lists.all = await trainUntilWeHave.call(this, this.kitchen, 0, 20, lists.all, 1, true, true, { from: owner });
    });

    describe('stakeMany()', () => {
        it('fails to stake non-existent tokens', async () => {
            await expect(this.gym.stakeMany(owner, [9999], { from: owner })).to.eventually.be.rejectedWith('owner query for nonexistent token');
        });
        it('fails to stake someone else\'s tokens', async () => {
            const { logs } = await mintAndFulfill.call(this, 1, false, { args: { from: anon } });
            const tokenId = Number(logs[0].args.tokenId.toString());
            await expect(this.gym.stakeMany(owner, [tokenId], { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('stakes many tokens', async () => {
            await this.character.setApprovalForAll(this.gym.address, true, { from: owner });
            await this.gym.stakeMany(owner, lists.all.map(item => item.id), { from: owner });
            const block = await web3.eth.getBlock('latest');
            await expect(this.character.ownerOf(lists.chefs[0].id)).to.eventually.equal(this.gym.address);
            await expect(this.character.ownerOf(lists.rats[1].id)).to.eventually.equal(this.gym.address);
            const chef0 = await this.gym.chefs(lists.chefs[0].id);
            const rat0 = await this.gym.rats(lists.rats[0].id);
            await expect(chef0.owner).to.equal(owner);
            await expect(rat0.owner).to.equal(owner);
            await expect(chef0.value.toString()).to.equal(block.timestamp.toString());
            await expect(rat0.value.toString()).to.equal('0');
        });
    });
    describe('claimMany()', () => {
        it('fails to unstake someone else\'s tokens', async () => {
            const ids = [lists.chefs[0].id, lists.rats[0].id];
            await expect(this.gym.claimMany(ids, true, { from: anon })).to.eventually.be.rejectedWith('Not your token');
        });
        it('cannot claim before EOB', async () => {
            await expect(this.gym.claimMany([lists.chefs[0].id, lists.chefs[1].id], false)).to.eventually.be.rejectedWith('Cannot claim before EOB');
        });
        it('emits the RandomNumberRequested event', async () => {
            const ids = lists.events.map(item => item.id);
            await this.gym.stakeMany(owner, ids, { from: owner });
            await advanceTimeAndBlock(3600); // Wait an hour so we can unstake
            const res = await this.gym.claimMany(ids, false);
            const randomNumberRequestedAbi = this.claim.abi.find(item => item.name === 'RandomNumberRequested');
            const randomNumberRequestedEvent = res.receipt.rawLogs.find(item => item.topics[0] === randomNumberRequestedAbi.signature);
            randomNumberRequestedEvent.args = web3.eth.abi.decodeLog(randomNumberRequestedAbi.inputs, randomNumberRequestedEvent.data, randomNumberRequestedEvent.topics);
            randomNumberRequestedEvent.event = 'RandomNumberRequested';
            delete randomNumberRequestedEvent.data;
            delete randomNumberRequestedEvent.topics;
            expect(randomNumberRequestedEvent.args.sender).to.equal(owner);
        });
        it('claims from chefs', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            const { logs } = await claimManyAndFulfill.call(this, this.gym, chefs, false);
            const fulfilledEvent = logs.find(item => item.event === 'RandomNumberFulfilled');
            expect(fulfilledEvent.args.sender).to.equal(owner);
            const claimEvents = logs.filter(item => item.event === 'ChefClaimed');
            expect(claimEvents).to.have.length(2);
            claimEvents.forEach((log, i) => {
                expect(log.args.tokenId).to.be.a.bignumber.eq(chefs[i].toString());
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.unstaked).to.be.false;
                expect(log.args.insanity).to.be.a.bignumber.eq((lists.chefs[i].tolerance - 6).toString()); // half a day at the gym
                expect(log.args.eventName).to.equal('');
            });
            await expect(this.character.ownerOf(chefs[0])).to.eventually.equal(this.gym.address);
            await expect(this.character.ownerOf(chefs[1])).to.eventually.equal(this.gym.address);

            await Promise.all(lists.chefs.map(async chef => {
                const traits = await this.character.getTokenTraits(chef.id);
                expect(traits.tolerance).to.be.a.bignumber.eq((chef.tolerance - 6).toString());
            }));
        });
        it('claims from rats', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id];
            const { logs } = await claimManyAndFulfill.call(this, this.gym, rats, false);
            const claimEvents = logs.filter(item => item.event === 'RatClaimed');
            expect(claimEvents).to.have.length(2);
            claimEvents.forEach((log, i) => {
                expect(log.args.tokenId).to.be.a.bignumber.eq(rats[i].toString());
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.unstaked).to.be.false;
                expect(log.args.fatness).to.be.a.bignumber.eq((lists.rats[i].tolerance - 4).toString()); // half a day in the gym
                expect(log.args.eventName).to.equal('');
            });
            await expect(this.character.ownerOf(rats[0])).to.eventually.equal(this.gym.address);
            await expect(this.character.ownerOf(rats[1])).to.eventually.equal(this.gym.address);

            await Promise.all(lists.rats.map(async rat => {
                const traits = await this.character.getTokenTraits(rat.id);
                expect(traits.tolerance).to.be.a.bignumber.eq((rat.tolerance - 4).toString());
            }));
        });
        it('does nothing when claimed twice', async () => {
            await advanceTimeAndBlock(3600); // Wait an hour
            const rats = [lists.rats[0].id, lists.rats[1].id];
            const { logs } = await claimManyAndFulfill.call(this, this.gym, rats, false);
            const claimEvents = logs.filter(item => item.event === 'RatClaimed');
            expect(claimEvents).to.have.length(2);
            claimEvents.forEach((log, i) => {
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.fatness).to.be.a.bignumber.eq((lists.rats[i].tolerance - 4).toString());
            });
        });
        it('unstakes many chefs', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            const { logs } = await claimManyAndFulfill.call(this, this.gym, chefs, true);
            const claimEvents = logs.filter(item => item.event === 'ChefClaimed');
            expect(claimEvents).to.have.length(2);
            claimEvents.forEach((log, i) => {
                expect(log.args.tokenId).to.be.a.bignumber.eq(chefs[i].toString());
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.unstaked).to.be.true;
                expect(log.args.insanity).to.be.a.bignumber.eq((lists.chefs[i].tolerance - 12).toString()); // full day at the gym
                expect(log.args.eventName).to.equal('');
            });
            await expect(this.character.ownerOf(chefs[0])).to.eventually.equal(owner);
            await expect(this.character.ownerOf(chefs[1])).to.eventually.equal(owner);

            const chef0 = await this.gym.chefs(chefs[0]);
            const chef1 = await this.gym.chefs(chefs[1]);
            await expect(chef0.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(chef1.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(chef0.value.toString()).to.equal('0');
            await expect(chef1.value.toString()).to.equal('0');

            await Promise.all(lists.chefs.map(async chef => {
                const traits = await this.character.getTokenTraits(chef.id);
                expect(traits.tolerance).to.be.a.bignumber.eq((chef.tolerance - 12).toString());
            }));
        });
        it('fails to unstake chefs twice', async () => {
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            await expect(claimManyAndFulfill.call(this, this.gym, chefs, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('unstakes many rats', async () => {
            const rats = lists.rats.map(item => item.id);
            const { logs } = await claimManyAndFulfill.call(this, this.gym, rats, true);
            const claimEvents = logs.filter(item => item.event === 'RatClaimed');
            expect(claimEvents).to.have.length(2);
            claimEvents.forEach((log, i) => {
                expect(log.args.tokenId).to.be.a.bignumber.eq(rats[i].toString());
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.unstaked).to.be.true;
                expect(log.args.fatness).to.be.a.bignumber.eq((lists.rats[i].tolerance - 8).toString()); // half a day in the gym
                expect(log.args.eventName).to.equal('');
            });
            await expect(this.character.ownerOf(rats[0])).to.eventually.equal(owner);
            await expect(this.character.ownerOf(rats[1])).to.eventually.equal(owner);

            const rat0 = await this.gym.rats(rats[0]);
            const rat1 = await this.gym.rats(rats[1]);
            await expect(rat0.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(rat1.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(rat0.value.toString()).to.equal('0');
            await expect(rat1.value.toString()).to.equal('0');

            await Promise.all(lists.rats.map(async rat => {
                const traits = await this.character.getTokenTraits(rat.id);
                expect(traits.tolerance).to.be.a.bignumber.eq((rat.tolerance - 8).toString());
            }));
        });
        it('fails to unstake rats twice', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id];
            await expect(claimManyAndFulfill.call(this, this.gym, rats, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
    });
});
