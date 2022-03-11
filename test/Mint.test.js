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
        it('allows only controllers to execute', async () => {
            await expect(this.mint.requestRandomNumber(owner, 5, false, { from: anon })).to.eventually.be.rejectedWith('Only controllers can execute');
        });
        it('fails if LINK balance is insufficient', async () => {
            await expect(this.mint.requestRandomNumber(owner, 5, false)).to.eventually.be.rejectedWith('Insufficient LINK');
        });
        it('creates a mint request', async () => {
            await setupVRF(this.linkToken, this.mint);
            const { logs } = await this.mint.requestRandomNumber(owner, 5, true);
            const requestId = logs[0].args.requestId;
            expect(requestId).to.have.length(66);
            expect(logs[0].args.sender).to.equal(owner);
            const res = await this.mint.vrfRequests(requestId);
            expect(res.requestId).to.be.a.bignumber.eq(requestId);
            expect(res.sender).to.equal(owner);
            expect(res.amount).to.be.a.bignumber.eq('5')
            expect(res.stake).to.be.true;
        });
    });
    describe('withdrawLink()', () => {
        it('denies anyone else but the owner to withdraw', async () => {
            await expect(this.mint.withdrawLink(1, { from: anon })).to.eventually.be.rejectedWith('Ownable: caller is not the owner');
        });
        it('allows owner to withdraw', async () => {
            const balance = await this.linkToken.balanceOf(this.mint.address);
            await this.mint.withdrawLink(111);
            const newBalance = await this.linkToken.balanceOf(this.mint.address);
            expect(balance.sub(newBalance)).to.be.a.bignumber.eq('111');
            const ownerBalance = await this.linkToken.balanceOf(owner);
            expect(ownerBalance).to.be.a.bignumber.eq('111');
        });
    });
});
