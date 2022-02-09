const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { toWei, loadTraits, uploadTraits, mintUntilWeHave, advanceTimeAndBlock } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const FastFood = artifacts.require('FastFood');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');

contract('Character (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
    const stats = { numChefs : 0, numRats: 0 };
    let lists;

    before(async () => {
        this.traitList = await loadTraits();
        this.foodToken = await FastFood.new({ from: owner });
        this.traits = await deployProxy(Traits, { from: owner });
        this.properties = await deployProxy(Properties, [[86, 86, 0, 0, 0, 0], [15, 15, 10, 10, 25, 50]], { from: owner });
        this.character = await deployProxy(Character, [this.traits.address, this.properties.address, 50000, toWei(0.1)], { from: owner });
        await this.traits.setCharacter(this.character.address);
        await uploadTraits(this.traits);
        this.kitchen = await deployProxy(McStake, [this.character.address, this.foodToken.address, 1000000000, [1000, 20, 3600, 86400], [2, 4, 2, 8], 175, 90, 55], { from: owner });
        await this.foodToken.addController(this.kitchen.address, { from: owner });
        await this.character.addController(this.kitchen.address, { from: owner });
        await this.character.setKitchen(this.kitchen.address, { from: owner });
        await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.character.numChefs()).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.character.numRats()).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.character.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.character.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('0');
    });

    describe.skip('random', () => {
        it('creates the expected population', async () => {
            const population = {};
            for (let i = 1; i <= 10000; i++) {
                const rand = Number((await this.character.testSelectTrait(Math.round(Math.random() * 65535), 4)).toString());
                if (!population[rand]) {
                    population[rand] = 1;
                } else {
                    population[rand] += 1;
                }
            }
            console.log(population);
        });
    });

    describe('mint()', () => {
        it('only allows to mint 1-10 tokens', async () => {
            await expect(this.character.mint(0, false, { from: owner, value: toWei(0) })).to.eventually.be.rejected;
            await expect(this.character.mint(11, false, { from: owner, value: toWei(1.1) })).to.eventually.be.rejected;
        });

        it('rejects invalid payments', async () => {
            await expect(this.character.mint(1, false, { from: owner })).to.eventually.be.rejected;
            await expect(this.character.mint(2, false, { from: owner, value: toWei(0.1) })).to.eventually.be.rejected;
            await expect(this.character.mint(3, false, { from: owner, value: toWei(0.4) })).to.eventually.be.rejected;
        });

        it('allows owner to mint', async () => {
            lists = await mintUntilWeHave.call(this, 8, 2, { from: owner });
            await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals(toWei(lists.all.length * 0.1));
            await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals(lists.all.length.toString());
            await expect(this.character.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals(lists.all.length.toString());
            await expect(this.character.ownerOf(1)).to.eventually.equal(owner);
            await expect(this.character.ownerOf(lists.all.length)).to.eventually.equal(owner);
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
                insanity: { traitType: 'dynamic', name: 'Insanity', character: 'chef', category: 'tolerance', value: 'Bored', additional: 'Insanity percentage' },
                intelligence: { traitType: 'dynamic', name: 'Intelligence', character: 'rat', category: 'efficiency', value: 'Braindead', additional: 'Intelligence quotient' },
                fatness: { traitType: 'dynamic', name: 'Fatness', character: 'rat', category: 'tolerance', value: 'Anorexic', additional: 'Fatness percentage' },
            }
            const traitMap = {
                chef: { Body: 0, Head: 1, Eyes: 2, Hat: 3, Neck: 4, Mouth: 5, Hand: 6 },
                rat: { Body: 0, Tail: 1, Head: 2, Piercing: 3, Eyes: 4, Hat: 5, Neck: 6 },
            }
            await Promise.all(IDs.map(async id => {
                const traits = await this.character.getTokenTraits(id);
                const tokenUri = await this.character.tokenURI(id);
                const json = JSON.parse(Buffer.from(tokenUri.split(',')[1], 'base64').toString());
                const type = json.attributes.find(attr => attr.trait_type === 'Type').value.toLowerCase();
                const svg = Buffer.from(json.image.split(',')[1], 'base64').toString();
                expect(json.image.length).to.be.above(2500); // Contains images
                expect(svg.length).to.be.above(2500); // Contains images
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
                });
            }));
            await expect(this.character.numChefs()).to.eventually.be.a.bignumber.that.equals(stats.numChefs.toString());
            await expect(this.character.numRats()).to.eventually.be.a.bignumber.that.equals(stats.numRats.toString());
        });

        it('allows anonymous to mint', async () => {
            const totalMints = lists.all.length + 5;
            const res = await this.character.mint(5, false, { from: anon, value: toWei(0.5) });
            const IDs = res.logs.map(it => Number(it.args.tokenId.toString()));
            await expect(res.receipt.status).to.be.true;
            await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals(toWei(totalMints * 0.1));
            await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals(totalMints.toString());
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
            const totalMints = lists.all.length + 10;
            const res = await this.character.mint(5, true, { from: anon, value: toWei(0.5) });
            const IDs = res.logs.map(it => Number(it.args.tokenId.toString()));
            await expect(res.receipt.status).to.be.true;
            await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals(toWei(totalMints * 0.1));
            await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals(totalMints.toString());
            await expect(this.character.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('5'); // Because they are staked!
            await Promise.all(IDs.map(async id => {
                await expect(this.character.ownerOf(id)).to.eventually.equal(this.kitchen.address);
            }));

            await advanceTimeAndBlock(3600); // Wait an hour so we can unstake
            const { logs } = await this.kitchen.claimMany(IDs, true, { from: anon });
            logs.forEach((log, i) => {
                expect(log.args.tokenId).to.be.a.bignumber.eq(IDs[i].toString());
                expect(log.args.unstaked).to.be.true;
            });
            await expect(this.character.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('10');
            await Promise.all(IDs.map(async id => {
                await expect(this.character.ownerOf(id)).to.eventually.equal(anon);
            }));
        });
    });
});
