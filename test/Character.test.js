const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { toWei, loadTraits, mintUntilWeHave, advanceTimeAndBlock, setupVRF, mintAndFulfill, fulfill, claimManyAndFulfill} = require('./helper');
require('@openzeppelin/test-helpers');
const { deployProxy } = require("@openzeppelin/truffle-upgrades");

chai.use(chaiAsPromised);

const expect = chai.expect;
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const FastFood = artifacts.require('FastFood');
const Mint = artifacts.require('Mint');
const Claim = artifacts.require('Claim');
const Traits = artifacts.require('Traits');
const Properties = artifacts.require('Properties');
const Character = artifacts.require('Character');
const McStake = artifacts.require('McStake');

contract('Character (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
    const stats = { numChefs : 0, numRats: 0 };
    let lists;
    let characterSandbox;

    before(async () => {
        this.vrfCoordinator = await VRFCoordinator.deployed();
        this.linkToken = await LinkToken.deployed();
        this.fastFood = await FastFood.deployed();
        this.mint = await Mint.deployed();
        this.claim = await Claim.deployed();
        this.traits = await Traits.deployed();
        this.properties = await Properties.deployed();
        this.traitList = await loadTraits();
        this.character = await Character.deployed();
        this.kitchen = await McStake.deployed();
        await setupVRF(this.linkToken, this.mint);
        await setupVRF(this.linkToken, this.claim);
        characterSandbox = await deployProxy(Character, [[this.fastFood.address, this.mint.address, this.traits.address, this.properties.address], 5, toWei('0.1', 'ether')]);
        await this.fastFood.addController(characterSandbox.address);
        await this.fastFood.addController(owner);
        await this.mint.addController(characterSandbox.address);
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
            await expect(this.character.mint(0, false, { from: owner, value: toWei(0) })).to.eventually.be.rejectedWith('Invalid mint amount');
            await expect(this.character.mint(11, false, { from: owner, value: toWei(1.1) })).to.eventually.be.rejectedWith('Invalid mint amount');
        });

        it('rejects invalid payments', async () => {
            await expect(this.character.mint(1, false, { from: owner })).to.eventually.be.rejectedWith('Invalid payment amount');
            await expect(this.character.mint(2, false, { from: owner, value: toWei(0.1) })).to.eventually.be.rejectedWith('Invalid payment amount');
            await expect(this.character.mint(3, false, { from: owner, value: toWei(0.4) })).to.eventually.be.rejectedWith('Invalid payment amount');
        });

        it('denies anyone but the Mint to fulfill', async () => {
            await expect(this.character.fulfillMint({ requestId: '0x0000000000000000000000000000000000000000000000000000000000000000', sender: owner, amount: 1, stake: false }, [])).to.eventually.be.rejectedWith('Only the Mint can fulfill');
        });
        it('fails with an invalid mint request', async () => {
            const sandbox = await deployProxy(Character, [[this.fastFood.address, owner, this.traits.address, this.properties.address], 5, toWei('0.1', 'ether')]);
            await expect(sandbox.fulfillMint({ requestId: '0x0000000000000000000000000000000000000000000000000000000000000000', sender: owner, amount: 1, stake: false }, [])).to.eventually.be.rejectedWith('Mint request not found');
        });
        it('fails if all characters have been minted', async () => {
            await expect(characterSandbox.mint(6, false)).to.eventually.be.rejectedWith('All tokens minted');
        });
        it('rejects Gen0 exceeding mints', async () => {
            await expect(characterSandbox.mint(2, false, { value: toWei(0.2) })).to.eventually.be.rejectedWith('Not enough Gen 0 tokens left, reduce amount');
        });
        it('rejects ETH for Gen1 payments', async () => {
            await this.mint.setCharacter(characterSandbox.address);
            const res = await mintAndFulfill.call(this, 1, false, { character: characterSandbox });
            this.mintRequestId = res.requestId;
            await expect(characterSandbox.minted()).to.eventually.be.a.bignumber.eq('1');
            await expect(characterSandbox.mint(2, false, { value: toWei(0.2) })).to.eventually.be.rejectedWith('Invalid payment type, accepting food tokens only');
            await this.mint.setCharacter(this.character.address);
        });
        it('deletes mint requests', async () => {
            await expect(characterSandbox.mintRequests(this.mintRequestId, 0)).to.eventually.be.rejectedWith('VM Exception');
        });
        it('fails if out of $FFOOD', async () => {
            await expect(characterSandbox.mint(4, false)).to.eventually.be.rejectedWith('burn amount exceeds balance');
        });
        it('calculates mint price correctly', async () => {
            const price = 1000 + 1500 + 2000 + 3000; // each character has a new price break
            await this.fastFood.mint(owner, toWei(price));
            const balance = await this.fastFood.balanceOf(owner);
            expect(balance).to.be.a.bignumber.eq(toWei(7500));
            const res = await mintAndFulfill.call(this, 4, false, { character: characterSandbox, args: { value: 0, from: owner } });
            await expect(res.receipt.status).to.be.true;
            const newBalance = await this.fastFood.balanceOf(owner);
            expect(newBalance).to.be.a.bignumber.eq('0');
            await expect(characterSandbox.minted()).to.eventually.be.a.bignumber.eq('5');
        });
        it('fails if the max supply is reached', async () => {
            await expect(characterSandbox.mint(1, false)).to.eventually.be.rejectedWith('All tokens minted');
        });

        it('allows owner to mint', async () => {
            lists = await mintUntilWeHave.call(this, 8, 2);
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
                expect(json.name).to.equal(`${traits.isChef ? 'Chef' : 'Rat'} #${id}`);
                expect(json.description).to.include('https://ratalert.com');
                expect(json.external_url).to.equal(`https://ratalert.com/characters/${id}`);
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
            const res = await mintAndFulfill.call(this, 5, false, { args: { from: anon } });
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
            const res = await mintAndFulfill.call(this, 5, true, { args: { from: anon } });
            const IDs = res.logs.map(it => Number(it.args.tokenId.toString()));
            await expect(res.receipt.status).to.be.true;
            await expect(web3.eth.getBalance(this.character.address)).to.eventually.be.a.bignumber.that.equals(toWei(totalMints * 0.1));
            await expect(this.character.minted()).to.eventually.be.a.bignumber.that.equals(totalMints.toString());
            await expect(this.character.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('5'); // Because they are staked!
            await Promise.all(IDs.map(async id => {
                await expect(this.character.ownerOf(id)).to.eventually.equal(this.kitchen.address);
            }));

            await advanceTimeAndBlock(3600); // Wait an hour so we can unstake
            const { logs } = await claimManyAndFulfill.call(this, this.kitchen, IDs, true, { args: { from: anon } });
            logs.forEach((log, i) => {
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
            res2b.logs.forEach((log, i) => expect(Number(log.args.tokenId)).to.equal(minted + i + 1));
            res3b.logs.forEach((log, i) => expect(Number(log.args.tokenId)).to.equal(minted + i + 3));
            res4b.logs.forEach((log, i) => expect(Number(log.args.tokenId)).to.equal(minted + i + 6));
        });
    });
});
