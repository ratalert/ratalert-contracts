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
const ChefRat = artifacts.require('ChefRat');
const McStake = artifacts.require('McStake');

let totalFastFoodEarned = 0;

function expectChefEarnings(earned, period, efficiency) {
    const nominal = period * 1000 / 86400;
    const factor = 100 + (efficiency * 1.75);
    const gross = nominal * factor / 100;
    const net = gross * 0.8;
    expect(earned).to.be.a.bignumber.gte(toWei(net)).lt(toWei(net * 1.0001));
}

function expectRatEarnings(earned, pot, numRats, tolerance) {
    const factor = tolerance <= 50 ? (tolerance * 0.9) + 55 : (tolerance * -0.9) + 145;
    const net = pot * factor / 100 / numRats;
    expect(earned).to.be.a.bignumber.gte(toWei(net * 0.9999)).lt(toWei(net * 1.0001));
}

function expectTotalFastFoodEarnings() {
    return expect(this.kitchen.totalFastFoodEarned()).to.eventually.be.a.bignumber.gte(toWei(totalFastFoodEarned)).lt(toWei(totalFastFoodEarned * 1.0001));
}

contract('McStake (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
    let lists;
    let ownerBalance;

    before(async () => {
        this.fastFood = await FastFood.new({ from: owner });
        this.traits = await deployProxy(Traits, { from: owner });
        this.properties = await deployProxy(Properties, [[86, 86, 0, 0, 0, 0], [15, 15, 10, 10, 25, 50]], { from: owner });
        this.chefRat = await deployProxy(ChefRat, [this.traits.address, this.properties.address, 50000, toWei(0.1)], { from: owner });
        await this.traits.setChefRat(this.chefRat.address);
        await uploadTraits(this.traits);
        this.kitchen = await deployProxy(McStake, [this.chefRat.address, this.fastFood.address, 86400, 2, 4, 2, 8, 175, 90, 55], { from: owner });
        await this.fastFood.addController(this.kitchen.address, { from: owner });
        await this.chefRat.addController(this.kitchen.address, { from: owner });
        await this.chefRat.setKitchen(this.kitchen.address, { from: owner });
    });

    describe('stake()', () => {
        it('fails to stake non-existent tokens', async () => {
            await expect(this.kitchen.stakeMany(owner, [99], { from: owner })).to.eventually.be.rejectedWith('owner query for nonexistent token');
        });
        it('fails to stake someone else\'s tokens', async () => {
            await this.chefRat.mint(1, false, { from: anon, value: toWei(0.1) });
            await expect(this.kitchen.stakeMany(owner, [1], { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('stakes many tokens', async () => {
            lists = await mintUntilWeHave.call(this, 8, 3, { from: owner });
            lists.chefs = [lists.chefs[0], lists.chefs[1]];
            lists.rats = [lists.rats[0], lists.rats[1]];
            lists.all = lists.chefs.concat(lists.rats);
            await this.chefRat.setApprovalForAll(this.kitchen.address, true, { from: owner });
            await this.kitchen.stakeMany(owner, lists.all.map(item => item.id), { from: owner });
            const block = await web3.eth.getBlock('latest');
            await expect(this.chefRat.ownerOf(lists.chefs[0].id)).to.eventually.equal(this.kitchen.address);
            await expect(this.chefRat.ownerOf(lists.rats[1].id)).to.eventually.equal(this.kitchen.address);
            const chef0 = await this.kitchen.chefs(lists.chefs[0].id);
            const rat0 = await this.kitchen.rats(lists.rats[0].id);
            await expect(chef0.owner).to.equal(owner);
            await expect(rat0.owner).to.equal(owner);
            await expect(chef0.value.toString()).to.equal(block.timestamp.toString());
            await expect(rat0.value.toString()).to.equal('0');
        });
    });
    describe('unstake()', () => {
        it('fails to unstake someone else\'s tokens', async () => {
            const ids = [lists.chefs[0].id, lists.rats[0].id];
            await expect(this.kitchen.claimMany(ids, true, { from: anon })).to.eventually.be.rejectedWith('Not your token');
        });
        it('claims from chefs', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            const { logs } = await this.kitchen.claimMany(chefs, false);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('ChefClaimed');
                expect(log.args.tokenId).to.be.a.bignumber.eq(chefs[i].toString());
                expectChefEarnings(log.args.earned, 86400 / 2, 0);
                expect(log.args.unstaked).to.be.false;
                expect(log.args.skill).to.be.a.bignumber.eq('1');
                expect(log.args.insanity).to.be.a.bignumber.eq('2');
                expect(log.args.eventName).to.equal('');
            });
            totalFastFoodEarned += 2 * 400; // 2 chefs for half a day at skill 0
            await expect(this.chefRat.ownerOf(chefs[0])).to.eventually.equal(this.kitchen.address);
            await expect(this.chefRat.ownerOf(chefs[1])).to.eventually.equal(this.kitchen.address);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.gte(toWei(800)).lt(toWei(801)); // 2 chefs staked for half a day = 5000^18 each
            await expectTotalFastFoodEarnings.call(this);
            await expect(this.kitchen.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(200 / lists.rats.length)).lt(toWei(201 / lists.rats.length));
            const ts = (await web3.eth.getBlock('latest')).timestamp;
            await expect(this.kitchen.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());

            await Promise.all(chefs.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                expect(traits.efficiency).to.be.a.bignumber.eq('1');
                expect(traits.tolerance).to.be.a.bignumber.eq('2');
            }));
        });
        it('claims from rats', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id];
            ownerBalance = BN(await this.fastFood.balanceOf(owner));
            const { logs } = await this.kitchen.claimMany(rats, false);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('RatClaimed');
                expect(log.args.tokenId).to.be.a.bignumber.eq(rats[i].toString());
                expectRatEarnings(log.args.earned, 200, lists.rats.length, 0);
                expect(log.args.unstaked).to.be.false;
                expect(log.args.intelligence).to.be.a.bignumber.eq('1');
                expect(log.args.fatness).to.be.a.bignumber.eq('4');
                expect(log.args.eventName).to.equal('');
                ownerBalance.iadd(log.args.earned);
            });
            totalFastFoodEarned += 2 * 100 * 0.55; // 2 rats for half a day at fatness 0
            await expect(this.chefRat.ownerOf(rats[0])).to.eventually.equal(this.kitchen.address);
            await expect(this.chefRat.ownerOf(rats[1])).to.eventually.equal(this.kitchen.address);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
            await expectTotalFastFoodEarnings.call(this);
            await expect(this.kitchen.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(200 / lists.rats.length )).lt(toWei(201 / lists.rats.length ));
            const ts = (await web3.eth.getBlock('latest')).timestamp;
            await expect(this.kitchen.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());

            await Promise.all(rats.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                expect(traits.efficiency).to.be.a.bignumber.eq('1');
                expect(traits.tolerance).to.be.a.bignumber.eq('4');
            }));
        });
        it('distributes nothing when claimed twice', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id];
            ownerBalance = BN(await this.fastFood.balanceOf(owner));
            const { logs } = await this.kitchen.claimMany(rats, false);
            logs.forEach((log, i) => {
                expect(log.args.earned).to.be.a.bignumber.eq('0');
                expect(log.args.intelligence).to.be.a.bignumber.eq('1');
                expect(log.args.fatness).to.be.a.bignumber.eq('4');
            });
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // Nothing added
            await expect(this.kitchen.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(200 / lists.rats.length )).lt(toWei(201 / lists.rats.length ));
        });
        it('unstakes many chefs', async () => {
            await advanceTimeAndBlock(86400 / 2); // Wait half a day
            const chefs = [lists.chefs[0].id, lists.chefs[1].id];
            ownerBalance = BN(await this.fastFood.balanceOf(owner));
            const { logs } = await this.kitchen.claimMany(chefs, true);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('ChefClaimed');
                expect(log.args.tokenId).to.be.a.bignumber.eq(chefs[i].toString());
                expectChefEarnings(log.args.earned, 86400 / 2, 1);
                expect(log.args.unstaked).to.be.true;
                expect(log.args.skill).to.be.a.bignumber.eq('2');
                expect(log.args.insanity).to.be.a.bignumber.eq('4');
                expect(log.args.eventName).to.equal('');
                ownerBalance.iadd(log.args.earned);
            });
            totalFastFoodEarned += 2 * 400 * 1.0175; // 2 chefs for half a day at skill 1
            await expect(this.chefRat.ownerOf(chefs[0])).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(chefs[1])).to.eventually.equal(owner);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
            await expectTotalFastFoodEarnings.call(this);
            await expect(this.kitchen.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(403.5 / lists.rats.length )).lt(toWei(404 / lists.rats.length ));
            const ts = (await web3.eth.getBlock('latest')).timestamp;
            await expect(this.kitchen.lastClaimTimestamp()).to.eventually.be.a.bignumber.that.equals(ts.toString());

            const chef0 = await this.kitchen.chefs(chefs[0]);
            const chef1 = await this.kitchen.chefs(chefs[1]);
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
            await expect(this.kitchen.claimMany(chefs, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('unstakes many rats', async () => {
            const rats = lists.rats.map(item => item.id);
            ownerBalance = BN(await this.fastFood.balanceOf(owner));
            const { logs } = await this.kitchen.claimMany(rats, true);
            logs.forEach((log, i) => {
                expect(log.event).to.equal('RatClaimed');
                expect(log.args.tokenId).to.be.a.bignumber.eq(rats[i].toString());
                expectRatEarnings(log.args.earned, 203.5, lists.rats.length, 4);
                expect(log.args.unstaked).to.be.true;
                expect(log.args.intelligence).to.be.a.bignumber.eq('2');
                expect(log.args.fatness).to.be.a.bignumber.eq('8');
                expect(log.args.eventName).to.equal('');
                ownerBalance.iadd(log.args.earned);
            });
            totalFastFoodEarned += 2 * 100 * 1.0175 * 0.586; // FFOOD from 2 skill 1 chefs for 2 rats for half a day at fatness 4
            await expect(this.chefRat.ownerOf(rats[0])).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(rats[1])).to.eventually.equal(owner);
            await expect(this.fastFood.balanceOf(owner)).to.eventually.be.a.bignumber.eq(ownerBalance); // 2 chefs staked for half a day = 5000^18 each
            await expectTotalFastFoodEarnings.call(this);
            await expect(this.kitchen.fastFoodPerRat()).to.eventually.be.a.bignumber.gte(toWei(403.5 / lists.rats.length )).lt(toWei(404 / lists.rats.length ));

            const rat0 = await this.kitchen.rats(rats[0]);
            const rat1 = await this.kitchen.rats(rats[1]);
            await expect(rat0.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(rat1.owner).to.equal('0x0000000000000000000000000000000000000000');
            await expect(rat0.value.toString()).to.equal('0');
            await expect(rat1.value.toString()).to.equal('0');

            await Promise.all(rats.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                expect(traits.efficiency).to.be.a.bignumber.eq('2');
                expect(traits.tolerance).to.be.a.bignumber.eq('8');
            }));
        });
        it('fails to unstake rats twice', async () => {
            const rats = [lists.rats[0].id, lists.rats[1].id];
            await expect(this.kitchen.claimMany(rats, true, { from: owner })).to.eventually.be.rejectedWith('Not your token');
        });
        it('handles level upgrades', async () => {
            const list = { chef: { id: lists.chefs[0].id }, rat: { id: lists.rats[0].id } };
            await this.kitchen.stakeMany(owner, Object.values(list).map(item => item.id), { from: owner });
            await Promise.all(Object.values(list).map(async item => {
                const traits = await this.chefRat.getTokenTraits(item.id);
                item.efficiency = Number(traits.efficiency.toString());
                item.tolerance = Number(traits.tolerance.toString());
            }));
            process.stdout.write('        Running 100 claims');
            const events = { foodInspector: 0, burnout: 0, ratTrap: 0, cat: 0 };
            for (let i = 0; i <= 100; i += 1) {
                await advanceTimeAndBlock(86400); // Wait a day
                const { logs } = await this.kitchen.claimMany(Object.values(list).map(item => item.id), false, { from: owner });
                logs.forEach(({ event, args }) => {
                    const efficiency = Number((event === 'ChefClaimed' ? args.skill : args.intelligence).toString());
                    const tolerance = Number((event === 'ChefClaimed' ? args.insanity : args.fatness).toString());
                    if (event === 'ChefClaimed') {
                        expectChefEarnings(args.earned, 86400, list.chef.efficiency);
                        list.chef.earned = args.earned;
                        if (args.eventName === 'foodInspector') {
                            const newEfficiency = (10 > list.chef.efficiency) ? 0 : list.chef.efficiency - 10;
                            const newTolerance = (25 > list.chef.tolerance) ? 0 : list.chef.tolerance - 25;
                            expect(efficiency).to.equal(newEfficiency);
                            expect(tolerance).to.equal(newTolerance);
                            list.chef.efficiency = newEfficiency;
                            list.chef.tolerance = newTolerance;
                        } else if (args.eventName === 'burnout') {
                            expect(efficiency).to.equal(0);
                            expect(tolerance).to.equal(0);
                            list.chef.efficiency = 0;
                            list.chef.tolerance = 0;
                        } else {
                            const newEfficiency = (list.chef.efficiency + 2 > 100) ? 100 : list.chef.efficiency + 2;
                            const newTolerance = (list.chef.tolerance + 4 > 100) ? 100 : list.chef.tolerance + 4;
                            expect(efficiency).to.equal(newEfficiency);
                            expect(tolerance).to.equal(newTolerance);
                            list.chef.efficiency = newEfficiency;
                            list.chef.tolerance = newTolerance;
                        }
                    } else {
                        expectRatEarnings(args.earned, fromWei(list.chef.earned) / 8 * 2, 1, list.rat.tolerance);
                        if (args.eventName === 'ratTrap') {
                            const newEfficiency = (10 > list.rat.efficiency) ? 0 : list.rat.efficiency - 10;
                            const newTolerance = (50 > list.rat.tolerance) ? 0 : list.rat.tolerance - 50;
                            expect(efficiency).to.equal(newEfficiency);
                            expect(tolerance).to.equal(newTolerance);
                            list.rat.efficiency = newEfficiency;
                            list.rat.tolerance = newTolerance;
                        } else if (args.eventName === 'cat') {
                            expect(efficiency).to.equal(0);
                            expect(tolerance).to.equal(0);
                            list.rat.efficiency = 0;
                            list.rat.tolerance = 0;
                        } else {
                            const newEfficiency = (list.rat.efficiency + 2 > 100) ? 100 : list.rat.efficiency + 2;
                            const newTolerance = (list.rat.tolerance + 8 > 100) ? 100 : list.rat.tolerance + 8;
                            expect(efficiency).to.equal(newEfficiency);
                            expect(tolerance).to.equal(newTolerance);
                            list.rat.efficiency = newEfficiency;
                            list.rat.tolerance = newTolerance;
                        }
                    }
                    if (args.eventName) {
                        events[args.eventName] += 1;
                    }
                });
                process.stdout.write('.');
            }
            process.stdout.write(`\n        Events: ${Object.entries(events).map(([k, v]) => `${v} ${k}s`).join(', ')}\n`);
        });
    });
});
