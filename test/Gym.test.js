const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { BN } = require('@openzeppelin/test-helpers');
const { toWei, fromWei, advanceTimeAndBlock, uploadTraits, mintUntilWeHave } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const FastFood = artifacts.require('FastFood');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');
const Gym = artifacts.require('Gym');

let totalFastFoodEarned = 0;

contract('Gym (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
    let lists;

    before(async () => {
        this.fastFood = await FastFood.new({ from: owner });
        this.traits = await deployProxy(Traits, { from: owner });
        this.properties = await deployProxy(Properties, [[86, 86, 0, 0, 0, 0], [15, 15, 10, 10, 25, 50]], { from: owner });
        this.character = await deployProxy(Character, [this.traits.address, this.properties.address, 50000, toWei(0.1)], { from: owner });
        await this.traits.setCharacter(this.character.address);
        await uploadTraits(this.traits);
        this.kitchen = await deployProxy(McStake, [this.character.address, this.fastFood.address, 86400, 2, 4, 2, 8, 175, 90, 55], { from: owner });
        this.gym = await deployProxy(Gym, [this.character.address, 86400, -12, -8], { from: owner });
        await this.fastFood.addController(this.kitchen.address, { from: owner });
        await this.character.addController(this.kitchen.address, { from: owner });
        await this.character.addController(this.gym.address, { from: owner });
        await this.character.setKitchen(this.kitchen.address, { from: owner });

        lists = await mintUntilWeHave.call(this, 8, 3, { from: owner });
        lists.chefs = [lists.chefs[0], lists.chefs[1]];
        lists.rats = [lists.rats[0], lists.rats[1]];
        lists.all = lists.chefs.concat(lists.rats);
        const allIds = lists.all.map(item => item.id);

        await this.character.setApprovalForAll(this.kitchen.address, true, { from: owner });
        await this.kitchen.stakeMany(owner, allIds, { from: owner });
        let done;
        while (!done) {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const { logs } = await this.kitchen.claimMany(allIds, false);
            const toleranceValues = logs.map(log => Number((log.args.insanity ? log.args.insanity : log.args.fatness).toString()));
            done = toleranceValues.filter(val => val < 20).length === 0;
        }
        await this.kitchen.claimMany(allIds, true);
        await Promise.all(lists.all.map(async (item) => {
            const traits = await this.character.tokenTraits(item.id);
            item.tolerance = Number(traits.tolerance.toString());
        }));
        // console.log('---lists', lists.chefs);
    });

    describe('stake()', () => {
        it('fails to stake non-existent tokens', async () => {
            await expect(this.gym.stakeMany(owner, [99], { from: owner })).to.eventually.be.rejectedWith('owner query for nonexistent token');
        });
        it('fails to stake someone else\'s tokens', async () => {
            const { logs } = await this.character.mint(1, false, { from: anon, value: toWei(0.1) });
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
    describe('unstake()', () => {
        it('fails to unstake someone else\'s tokens', async () => {
            const ids = [lists.chefs[0].id, lists.rats[0].id];
            await expect(this.gym.claimMany(ids, true, { from: anon })).to.eventually.be.rejectedWith('Not your token');
        });
        it('claims from chefs', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            const { logs } = await this.gym.claimMany(chefs, false);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('ChefClaimed');
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
            const { logs } = await this.gym.claimMany(rats, false);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('RatClaimed');
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
            const rats = [lists.rats[0].id, lists.rats[1].id];
            const { logs } = await this.gym.claimMany(rats, false);
            logs.forEach((log, i) => {
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.fatness).to.be.a.bignumber.eq((lists.rats[i].tolerance - 4).toString());
            });
        });
        it('unstakes many chefs', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            const { logs } = await this.gym.claimMany(chefs, true);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('ChefClaimed');
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
            await expect(this.gym.claimMany(chefs, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('unstakes many rats', async () => {
            const rats = lists.rats.map(item => item.id);
            const { logs } = await this.gym.claimMany(rats, true);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('RatClaimed');
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
            await expect(this.gym.claimMany(rats, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
    });
});
