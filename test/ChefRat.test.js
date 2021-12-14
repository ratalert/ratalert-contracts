const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const { toWei, uploadTraits } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const Traits = artifacts.require('Traits');
const ChefRat = artifacts.require('ChefRat');

contract('ChefRat (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.traits = await deployProxy(Traits, { from: owner });
        this.chefRat = await deployProxy(ChefRat, [this.traits.address, 50000], { from: owner });
        await this.traits.setChefRat(this.chefRat.address);
        await uploadTraits(this.traits);
        await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('0');
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
            Promise.all(IDs.map(async id => {
                const traits = await this.chefRat.getTokenTraits(id);
                const tokenUri = await this.chefRat.tokenURI(id);
                const json = JSON.parse(Buffer.from(tokenUri.split(',')[1], 'base64').toString());
                const svg = Buffer.from(json.image.split(',')[1], 'base64').toString();
                expect(json.image.length).to.be.above(2500); // Contains images
                expect(svg.length).to.be.above(2500); // Contains images
                for (let i = 0; i <= 8; i++) {
                    if (i === 0) {
                        expect(json.attributes[i].value === 'Chef').to.equal(traits[i]);
                    } else {
                        expect(json.attributes[i].value.split(' ')[1]).to.equal(traits[i]);
                    }
                }
            }));
        });

        it('allows anonymous to mint', async () => {
            const res = await this.chefRat.mint(5, { from: anon, value: toWei(0.5) });
            await expect(web3.eth.getBalance(this.chefRat.address)).to.eventually.be.a.bignumber.that.equals(toWei(1.5));
            await expect(res.receipt.status).to.be.true;
            await expect(this.chefRat.minted()).to.eventually.be.a.bignumber.that.equals('15');
            await expect(this.chefRat.balanceOf(anon)).to.eventually.be.a.bignumber.that.equals('5');
            await expect(this.chefRat.ownerOf(11)).to.eventually.equal(anon);
            await expect(this.chefRat.ownerOf(15)).to.eventually.equal(anon);
        });
    });
});
