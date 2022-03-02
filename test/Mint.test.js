const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { setupVRF } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const LinkToken = artifacts.require('LinkTokenMock');
const Mint = artifacts.require('Mint');

contract('Mint (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.vrfCoordinator = await VRFCoordinator.deployed();
        this.linkToken = await LinkToken.deployed();
        this.mint = await Mint.deployed();
        await this.mint.addController(owner);
    });

    describe('requestRandomNumber()', () => {
        it('only allows controllers to call', async () => {
            await expect(this.mint.requestRandomNumber(owner, 5, false, { from: anon })).to.eventually.be.rejectedWith('Only controllers can request randomness');
        });
        it('fails if LINK balance is insufficient', async () => {
            await expect(this.mint.requestRandomNumber(owner, 5, false)).to.eventually.be.rejectedWith('Insufficient LINK');
        });
        it('creates a mint request', async () => {
            await setupVRF(this.linkToken, this.mint);
            const { logs } = await this.mint.requestRandomNumber(owner, 5, true);
            const requestId = logs[0].args.requestId;
            expect(requestId).to.have.length(66);
            const res = await this.mint.vrfRequests(requestId);
            expect(res.requestId).to.be.a.bignumber.eq(requestId);
            expect(res.sender).to.equal(owner);
            expect(res.amount).to.be.a.bignumber.eq('5')
            expect(res.stake).to.be.true;
        });
    });
});
