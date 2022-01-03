const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const Traits = artifacts.require('Traits');
const { uploadTraits } = require('./helper');

contract('Traits (proxy)', (accounts) => {
    const owner = accounts[0];
    const data = [
        [
            { name: 'Single', png: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUik7wECIkqAAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==' },
        ],
        [
            { name: 'Multi1', png: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAABlBMVEUAAAAik7wGFQ0/AAAAAXRSTlMAQObYZgAAAAxJREFUCNdjaGBgAAABhACBKN161wAAAABJRU5ErkJggg==' },
            { name: 'Multi2', png: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAABlBMVEUAAAAik7wGFQ0/AAAAAXRSTlMAQObYZgAAAAxJREFUCNdjcGBgAAAAxABBbIeyqwAAAABJRU5ErkJggg==' },
            { name: 'Multi3', png: 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAABlBMVEUAAAAik7wGFQ0/AAAAAXRSTlMAQObYZgAAAAxJREFUCNdjYGBoAAAAhACBGFbxzQAAAABJRU5ErkJggg==' },
        ],
    ];

    before(async () => {
        this.traits = await deployProxy(Traits, { from: owner });
    });

    describe('uploadTraits()', () => {
        it('uploads data', async () => {
            const res = await uploadTraits(this.traits);
            expect (res.length).to.equal(14); // 7 chef traits + 7 rat traits
            res.forEach(item => expect (item.receipt.status).to.be.true);
        });
        it('replaces with test data', async () => {
            await Promise.all(data.map(async (traits, i) => {
                const res = await this.traits.uploadTraits(i, traits);
                await expect(res.receipt.status).to.be.true;
            }));
        });
    });

    describe('traitData()', () => {
        it('returns test data', async () => {
            await Promise.all(data.map(async (traits, i) => {
                await Promise.all(traits.map(async (trait, j) => {
                    const res = await this.traits.traitData(i, j);
                    expect(res.name).to.equal(trait.name);
                    expect(res.png).to.equal(trait.png);
                }));
            }));
        });
    });
});
