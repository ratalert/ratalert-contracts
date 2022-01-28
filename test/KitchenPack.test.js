const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { BN } = require('@openzeppelin/test-helpers');
const { toWei, advanceTimeAndBlock, uploadTraits, mintUntilWeHave } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const FastFood = artifacts.require('FastFood');
const Traits = artifacts.require('Traits');
const ChefRat = artifacts.require('ChefRat');
const KitchenPack = artifacts.require('KitchenPack');

contract('KitchenPack (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
    let lists;
    let ownerBalance;

    before(async () => {
        this.fastFood = await FastFood.new({ from: owner });
        this.traits = await deployProxy(Traits, { from: owner });
        this.chefRat = await deployProxy(ChefRat, [this.traits.address, 50000], { from: owner });
        await this.traits.setChefRat(this.chefRat.address);
        await uploadTraits(this.traits);
        this.kitchenPack = await deployProxy(KitchenPack, [this.chefRat.address, this.fastFood.address], { from: owner });
        await this.fastFood.addController(this.kitchenPack.address, { from: owner });
        await this.chefRat.addController(this.kitchenPack.address, { from: owner });
        await this.chefRat.setKitchenPack(this.kitchenPack.address, { from: owner });
    });

    describe('stake()', () => {
        it('fails to stake non-existent tokens', async () => {
            await expect(this.kitchenPack.stakeMany(owner, [99], { from: owner })).to.eventually.be.rejectedWith('owner query for nonexistent token');
        });
        it('fails to stake someone else\'s tokens', async () => {
            await this.chefRat.mint(1, false, { from: anon, value: toWei(0.1) });
            await expect(this.kitchenPack.stakeMany(owner, [1], { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('stakes many tokens', async () => {
            lists = await mintUntilWeHave.call(this, 8, 3, { from: owner });
            await this.chefRat.setApprovalForAll(this.kitchenPack.address, true, { from: owner });
            await this.kitchenPack.stakeMany(owner, lists.all.map(item => item.id), { from: owner });
            const block = await web3.eth.getBlock('latest');
            await expect(this.chefRat.ownerOf(lists.chefs[0].id)).to.eventually.equal(this.kitchenPack.address);
            await expect(this.chefRat.ownerOf(lists.rats[1].id)).to.eventually.equal(this.kitchenPack.address);
            const chef0 = await this.kitchenPack.kitchen(lists.chefs[0].id);
            const rat0 = await this.kitchenPack.pack(lists.rats[0].id);
            await expect(chef0.owner).to.equal(owner);
            await expect(rat0.owner).to.equal(owner);
            await expect(chef0.value.toString()).to.equal(block.timestamp.toString());
            await expect(rat0.value.toString()).to.equal('0');
        });
    });
    describe('unstake()', () => {
        it('fails to unstake someone else\'s tokens', async () => {
            const ids = [lists.chefs[0].id, lists.rats[0].id];
            await expect(this.kitchenPack.claimMany(ids, true, { from: anon })).to.eventually.be.rejectedWith('Not your token');
        });
        it('claims from chefs', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            const { logs } = await this.kitchenPack.claimMany(chefs, false);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('ChefClaimed');
                expect(log.args.tokenId).to.be.a.bignumber.eq(chefs[i].toString());
                expect(log.args.earned).to.be.a.bignumber.gte(toWei(400)).lt(toWei(401));
                expect(log.args.unstaked).to.be.false;
                expect(log.args.skill).to.be.a.bignumber.eq('1');
                expect(log.args.insanity).to.be.a.bignumber.eq('2');
            });
            await expect(this.chefRat.ownerOf(chefs[0])).to.eventually.equal(this.kitchenPack.address);
            await expect(this.chefRat.ownerOf(chefs[1])).to.eventually.equal(this.kitchenPack.address);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.gte(toWei(800)).lt(toWei(801)); // 2 chefs staked for half a day = 5000^18 each
            await expect(this.kitchenPack.totalFastFoodEarned()).to.eventually.be.a.bignumber.gte(toWei(1000)).lt(toWei(1001));
            await expect(this.kitchenPack.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(199 / lists.rats.length)).lt(toWei(201 / lists.rats.length));
            const ts = (await web3.eth.getBlock('latest')).timestamp;
            await expect(this.kitchenPack.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());

            await Promise.all(chefs.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                expect(traits.efficiency).to.be.a.bignumber.eq('1');
                expect(traits.tolerance).to.be.a.bignumber.eq('2');
            }));
        });
        it('claims from rats', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id];
            ownerBalance = BN(await this.fastFood.balanceOf(owner));
            const { logs } = await this.kitchenPack.claimMany(rats, false);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('RatClaimed');
                expect(log.args.tokenId).to.be.a.bignumber.eq(rats[i].toString());
                expect(log.args.earned).to.be.a.bignumber.gte(toWei(199 / lists.rats.length)).lt(toWei(201 / lists.rats.length));
                expect(log.args.unstaked).to.be.false;
                expect(log.args.intelligence).to.be.a.bignumber.eq('1');
                expect(log.args.fatness).to.be.a.bignumber.eq('4');
                ownerBalance.iadd(log.args.earned);
            });
            await expect(this.chefRat.ownerOf(rats[0])).to.eventually.equal(this.kitchenPack.address);
            await expect(this.chefRat.ownerOf(rats[1])).to.eventually.equal(this.kitchenPack.address);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
            await expect(this.kitchenPack.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(199 / lists.rats.length )).lt(toWei(201 / lists.rats.length ));

            await Promise.all(rats.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                expect(traits.efficiency).to.be.a.bignumber.eq('1');
                expect(traits.tolerance).to.be.a.bignumber.eq('4');
            }));
        });
        it('distributes nothing when claimed twice', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id];
            ownerBalance = BN(await this.fastFood.balanceOf(owner));
            const { logs } = await this.kitchenPack.claimMany(rats, false);
            logs.forEach((log, i) => {
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.intelligence).to.be.a.bignumber.eq('1');
                expect(log.args.fatness).to.be.a.bignumber.eq('4');
            });
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // Nothing added
            await expect(this.kitchenPack.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(199 / lists.rats.length )).lt(toWei(201 / lists.rats.length ));
        });
        it('unstakes many chefs', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            ownerBalance = BN(await this.fastFood.balanceOf(owner));
            const { logs } = await this.kitchenPack.claimMany(chefs, true);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('ChefClaimed');
                expect(log.args.tokenId).to.be.a.bignumber.eq(chefs[i].toString());
                expect(log.args.earned).to.be.a.bignumber.gte(toWei(400)).lt(toWei(401));
                expect(log.args.unstaked).to.be.true;
                expect(log.args.skill).to.be.a.bignumber.eq('2');
                expect(log.args.insanity).to.be.a.bignumber.eq('4');
                ownerBalance.iadd(log.args.earned);
            });
            await expect(this.chefRat.ownerOf(chefs[0])).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(chefs[1])).to.eventually.equal(owner);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
            await expect(this.kitchenPack.totalFastFoodEarned()).to.eventually.be.a.bignumber.gte(toWei(2000)).lt(toWei(2001));
            await expect(this.kitchenPack.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(399 / lists.rats.length )).lt(toWei(401 / lists.rats.length ));
            const ts = (await web3.eth.getBlock('latest')).timestamp;
            await expect(this.kitchenPack.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());

            const chef0 = await this.kitchenPack.kitchen(chefs[0]);
            const chef1 = await this.kitchenPack.kitchen(chefs[1]);
            await expect(chef0.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(chef1.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(chef0.value.toString()).to.equal('0');
            await expect(chef1.value.toString()).to.equal('0');

            await Promise.all(chefs.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                expect(traits.efficiency).to.be.a.bignumber.eq('2');
                expect(traits.tolerance).to.be.a.bignumber.eq('4');
            }));
        });
        it('fails to unstake chefs twice', async () => {
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            await expect(this.kitchenPack.claimMany(chefs, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('unstakes many rats', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id, lists.rats[2].id];
            ownerBalance = BN(await this.fastFood.balanceOf(owner));
            const { logs } = await this.kitchenPack.claimMany(rats, true);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('RatClaimed');
                expect(log.args.tokenId).to.be.a.bignumber.eq(rats[i].toString());
                if (i < 2) {
                    expect(log.args.earned).to.be.a.bignumber.gte(toWei(199 / lists.rats.length)).lt(toWei(201 / lists.rats.length));
                } else {
                    expect(log.args.earned).to.be.a.bignumber.gte(toWei(399 / lists.rats.length)).lt(toWei(401 / lists.rats.length)); // has not claimed yet
                }
                expect(log.args.unstaked).to.be.true;
                expect(log.args.intelligence).to.be.a.bignumber.eq('2');
                expect(log.args.fatness).to.be.a.bignumber.eq('8');
                ownerBalance.iadd(log.args.earned);
            });
            await expect(this.chefRat.ownerOf(rats[0])).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(rats[1])).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(rats[2])).to.eventually.equal(owner);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
            await expect(this.kitchenPack.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(399 / lists.rats.length )).lt(toWei(401 / lists.rats.length ));

            await Promise.all(rats.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                expect(traits.efficiency).to.be.a.bignumber.eq('2');
                expect(traits.tolerance).to.be.a.bignumber.eq('8');
            }));
        });
        it('fails to unstake rats twice', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id];
            await expect(this.kitchenPack.claimMany(rats, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
    });
});
