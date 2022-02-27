const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { setupVRF } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const VRFCoordinator = artifacts.require('VRFCoordinatorMock');
const Mint = artifacts.require('Mint');
const Character = artifacts.require('Character');

contract('Mint (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];
    let requestResponse;

    before(async () => {
        this.vrfCoordinator = await VRFCoordinator.deployed();
        await setupVRF(this.vrfCoordinator);
        this.mint = await Mint.deployed();
        this.character = await Character.deployed();
        await this.mint.addController(owner);
    });

    describe('requestRandomness()', () => {
        it('only allows controllers to call', async () => {
            await expect(this.mint.requestRandomness(owner, 5, false, { from: anon })).to.eventually.be.rejectedWith('Only controllers can request randomness');
        });
        it('creates a mint request', async () => {
            requestResponse = await this.mint.requestRandomness(owner, 5, true);
            const randomWordsRequestedAbi = this.vrfCoordinator.abi.find(item => item.name === 'RandomWordsRequested');
            const randomWordsRequestedEvent = requestResponse.receipt.rawLogs.find(item => item.topics[0] === randomWordsRequestedAbi.signature);
            const requestId = web3.eth.abi.decodeLog(randomWordsRequestedAbi.inputs, randomWordsRequestedEvent.data, randomWordsRequestedEvent.topics).requestId;
            expect(requestId).to.equal('1');
            const res = await this.mint.vrfRequests(1);
            expect(res.requestId).to.be.a.bignumber.eq('1');
            expect(res.sender).to.equal(owner);
            expect(res.amount).to.be.a.bignumber.eq('5')
            expect(res.stake).to.be.true;
        });
    });
});
