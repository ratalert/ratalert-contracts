const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { toWei, loadTraits, uploadTraits } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const Traits = artifacts.require('Traits');
const ChefRat = artifacts.require('ChefRat');

contract('ChefRat (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
    const stats = { numChefs : 0, numRats: 0 };

    before(async () => {
        this.traitList = await loadTraits();
        this.traits = await deployProxy(Traits, { from: owner });
        this.chefRat = await deployProxy(ChefRat, [this.traits.address, 50000], { from: owner });
        await this.traits.setChefRat(this.chefRat.address);
        await uploadTraits(this.traits);
        await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.chefRat.numChefs()).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.chefRat.numRats()).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.chefRat.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals('0');
        await expect(this.chefRat.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('0');
    });

    describe.skip('random', () => {
        it('creates the expected population', async () => {
            const population = {};
            for (let i = 1; i <= 10000; i++) {
                const rand = Number((await this.chefRat.testSelectTrait(Math.round(Math.random() * 65535), 4)).toString());
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
            await expect(this.chefRat.mint(0, { from: owner, value: toWei(0) })).to.eventually.be.rejected;
            await expect(this.chefRat.mint(11, { from: owner, value: toWei(1.1) })).to.eventually.be.rejected;
        });

        it('rejects invalid payments', async () => {
            await expect(this.chefRat.mint(1, { from: owner })).to.eventually.be.rejected;
            await expect(this.chefRat.mint(2, { from: owner, value: toWei(0.1) })).to.eventually.be.rejected;
            await expect(this.chefRat.mint(3, { from: owner, value: toWei(0.4) })).to.eventually.be.rejected;
        });

        it('allows owner to mint', async () => {
            const res = await this.chefRat.mint(10, { from: owner, value: toWei(1) });
            await expect(web3.eth.getBalance(this.chefRat.address)).to.eventually.be.a.bignumber.that.equals(toWei(1));
            await expect(res.receipt.status).to.be.true;
            await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('10');
            await expect(this.chefRat.balanceOf(owner)).to.eventually.be.a.bignumber.that.equals('10');
            await expect(this.chefRat.ownerOf(1)).to.eventually.equal(owner);
            await expect(this.chefRat.ownerOf(10)).to.eventually.equal(owner);
            const IDs = res.logs.map(it => Number(it.args.tokenId.toString()));
            const checks = {
                isChef: { traitType: 'type', name: 'Type' },
                hat: { traitType: 'trait', name: 'Hat' },
                eyes: { traitType: 'trait', name: 'Eyes' },
                piercing: { traitType: 'trait', name: 'Piercing' },
                mouth: { traitType: 'trait', name: 'Mouth' },
                neck: { traitType: 'trait', name: 'Neck' },
                hand: { traitType: 'trait', name: 'Hand' },
                tail: { traitType: 'trait', name: 'Tail' },
                insanity: { traitType: 'dynamic', name: 'Insanity', value: 'Bored', additional: 'Insanity percentage' },
                skill: { traitType: 'dynamic', name: 'Skill', value: 'Kitchen Scullion', additional: 'Skill percentage' },
                intelligence: { traitType: 'dynamic', name: 'Intelligence', value: 'Braindead', additional: 'Intelligence quotient' },
                fatness: { traitType: 'dynamic', name: 'Fatness', value: 'Anorexic', additional: 'Fatness percentage' },
            }
            const traitMap = {
                chef: { Body: 0, Head: 1, Eyes: 2, Hat: 3, Neck: 4, Mouth: 5, Hand: 6 },
                rat: { Body: 0, Tail: 1, Head: 2, Piercing: 3, Eyes: 4, Hat: 5, Neck: 6 },
            }
            await Promise.all(IDs.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                const tokenUri = await this.chefRat.tokenURI(id);
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
                    if (val.traitType === 'trait' && traits[key] === '0') {
                        expect(attr).to.be.undefined; // No attribute for missing trait
                    }
                    if (val.traitType === 'trait' && attr) {
                        const traitName = this.traitList[type][traitMap[type][attr.trait_type]][traits[key]].name;
                        expect(val.name).to.equal(attr.trait_type);
                        expect(attr.value).to.equal(traitName);
                    }
                    if (val.traitType === 'dynamic' && attr) {
                        expect(val.name).to.equal(attr.trait_type);
                        expect(attr.value).to.equal(val.value);
                        expect(traits[key]).to.equal('0');
                        const additionalAttr = json.attributes.find(v => v.trait_type === val.additional);
                        expect(additionalAttr.value).to.equal(0);
                        expect(additionalAttr.max_value).to.equal(100);
                    }
                });
            }));
            await expect(this.chefRat.numChefs()).to.eventually.be.a.bignumber.that.equals(stats.numChefs.toString());
            await expect(this.chefRat.numRats()).to.eventually.be.a.bignumber.that.equals(stats.numRats.toString());
        });

        it('allows anonymous to mint', async () => {
            const res = await this.chefRat.mint(5, { from: anon, value: toWei(0.5) });
            await expect(web3.eth.getBalance(this.chefRat.address)).to.eventually.be.a.bignumber.that.equals(toWei(1.5));
            await expect(res.receipt.status).to.be.true;
            await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('15');
            await expect(this.chefRat.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('5');
            await expect(this.chefRat.ownerOf(11)).to.eventually.equal(anon);
            await expect(this.chefRat.ownerOf(15)).to.eventually.equal(anon);
            const IDs = res.logs.map(it => Number(it.args.tokenId.toString()));
            await Promise.all(IDs.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                traits.isChef ? stats.numChefs += 1 : stats.numRats += 1;
            }));
            await expect(this.chefRat.numChefs()).to.eventually.be.a.bignumber.that.equals(stats.numChefs.toString());
            await expect(this.chefRat.numRats()).to.eventually.be.a.bignumber.that.equals(stats.numRats.toString());
        });
    });
});
