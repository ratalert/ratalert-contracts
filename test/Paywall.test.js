const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { toWei } = require('./helper');
require('@openzeppelin/test-helpers');

chai.use(chaiAsPromised);

const expect = chai.expect;
const Paywall = artifacts.require('Paywall');

contract('Paywall (proxy)', (accounts) => {
    const owner = accounts[0];
    const anon = accounts[1];

    before(async () => {
        this.paywall = await Paywall.deployed();
        await this.paywall.addController([owner]);
    });

    describe('handle()', () => {});

    describe('toggleWhitelist()', () => {
        it('turns it on', async () => {
            await expect(this.paywall.onlyWhitelist()).to.eventually.be.false;
            await this.paywall.toggleWhitelist(true);
            await expect(this.paywall.onlyWhitelist()).to.eventually.be.true;
        });

        it('turns it off', async () => {
            await this.paywall.toggleWhitelist(false);
            await expect(this.paywall.onlyWhitelist()).to.eventually.be.false;
        });
    });

    describe('addToWhitelist()', () => {
        it('adds addresses', async () => {
            await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq('0');
            for (let i = 1; i <= 5; i++) {
                const { logs } = await this.paywall.addToWhitelist([owner, anon]);
                expect(logs).to.have.length(2);
                expect(logs[0].event).to.equal('UpdateWhitelist');
                expect(logs[1].event).to.equal('UpdateWhitelist');
                expect(logs[0].args.amount).to.be.a.bignumber.eq(i.toString());
                expect(logs[1].args.amount).to.be.a.bignumber.eq(i.toString());
                await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq(i.toString());
                await expect(this.paywall.whitelist(anon)).to.eventually.be.a.bignumber.eq(i.toString());
            }
        });
    });

    describe('removeFromWhitelist()', () => {
        it('removes addresses', async () => {
            for (let i = 4; i >= 0; i--) {
                const { logs } = await this.paywall.removeFromWhitelist([owner, anon]);
                expect(logs).to.have.length(2);
                expect(logs[0].event).to.equal('UpdateWhitelist');
                expect(logs[1].event).to.equal('UpdateWhitelist');
                expect(logs[0].args.amount).to.be.a.bignumber.eq(i.toString());
                expect(logs[1].args.amount).to.be.a.bignumber.eq(i.toString());
                await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq(i.toString());
                await expect(this.paywall.whitelist(anon)).to.eventually.be.a.bignumber.eq(i.toString());
            }
        });
        it('does not overflow', async () => {
            const { logs } = await this.paywall.removeFromWhitelist([owner]);
            expect(logs).to.have.length(1);
            expect(logs).to.have.length(1);
            expect(logs[0].event).to.equal('UpdateWhitelist');
            expect(logs[0].args.amount).to.be.a.bignumber.eq('0');
            await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq('0');
        });
    });

    describe('addToFreeMints()', () => {
        it('adds addresses', async () => {
            await expect(this.paywall.freeMints(owner)).to.eventually.be.a.bignumber.eq('0');
            for (let i = 1; i <= 5; i++) {
                const { logs } = await this.paywall.addToFreeMints([owner, anon]);
                expect(logs).to.have.length(2);
                expect(logs[0].event).to.equal('UpdateFreeMints');
                expect(logs[1].event).to.equal('UpdateFreeMints');
                expect(logs[0].args.amount).to.be.a.bignumber.eq(i.toString());
                expect(logs[1].args.amount).to.be.a.bignumber.eq(i.toString());
                await expect(this.paywall.freeMints(owner)).to.eventually.be.a.bignumber.eq(i.toString());
                await expect(this.paywall.freeMints(anon)).to.eventually.be.a.bignumber.eq(i.toString());
            }
        });
    });

    describe('removeFromFreeMints()', () => {
        it('removes addresses', async () => {
            for (let i = 4; i >= 0; i--) {
                const { logs } = await this.paywall.removeFromFreeMints([owner, anon]);
                expect(logs).to.have.length(2);
                expect(logs[0].event).to.equal('UpdateFreeMints');
                expect(logs[1].event).to.equal('UpdateFreeMints');
                expect(logs[0].args.amount).to.be.a.bignumber.eq(i.toString());
                expect(logs[1].args.amount).to.be.a.bignumber.eq(i.toString());
                await expect(this.paywall.freeMints(owner)).to.eventually.be.a.bignumber.eq(i.toString());
                await expect(this.paywall.freeMints(anon)).to.eventually.be.a.bignumber.eq(i.toString());
            }
        });
        it('does not overflow', async () => {
            const { logs } = await this.paywall.removeFromFreeMints([owner]);
            expect(logs).to.have.length(1);
            expect(logs[0].event).to.equal('UpdateFreeMints');
            expect(logs[0].args.amount).to.be.a.bignumber.eq('0');
            await expect(this.paywall.freeMints(owner)).to.eventually.be.a.bignumber.eq('0');
        });
    });

    describe('handle()', () => {
        it('fails without sufficient whitelist spots', async () => {
            await this.paywall.toggleWhitelist(true);
            await this.paywall.addToWhitelist([owner, owner]);
            await expect(this.paywall.handle(owner, 3, toWei(0.3), 0, 100, 10)).to.eventually.be.rejectedWith('Not whitelisted');
        });
        it('succeeds with sufficient whitelist spots', async () => {
            await this.paywall.addToWhitelist([owner]);
            const { logs } = await this.paywall.handle(owner, 3, toWei(0.27), 0, 100, 10);
            expect(logs).to.have.length(1);
            expect(logs[0].event).to.equal('UpdateWhitelist');
            expect(logs[0].args.amount).to.be.a.bignumber.eq('0');
            await expect(this.paywall.whitelist(owner)).to.eventually.be.a.bignumber.eq('0');
        });
        it('succeeds with whitelisting disabled', async () => {
            await this.paywall.toggleWhitelist(false);
            const { logs } = await this.paywall.handle(anon, 2, toWei(0.2), 0, 100, 10);
            expect(logs).to.have.length(0);
        });
        it('still gets a discount', async () => {
            await this.paywall.addToWhitelist([anon]);
            await expect(this.paywall.whitelist(anon)).to.eventually.be.a.bignumber.eq('1');
            await expect(this.paywall.handle(anon, 1, toWei(0.09), 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true); // discounted
            await expect(this.paywall.handle(anon, 1, toWei(0.1), 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true); // regular
        });
        it('succeeds with sufficient free mint spots', async () => {
            await this.paywall.toggleWhitelist(true);
            await this.paywall.addToFreeMints([anon, anon, anon]);
            const { logs } = await this.paywall.handle(anon, 2, 0, 0, 100, 10);
            expect(logs).to.have.length(1);
            expect(logs[0].event).to.equal('UpdateFreeMints');
            expect(logs[0].args.amount).to.be.a.bignumber.eq('1');
        });
        it('still gets the free mint', async () => {
            await this.paywall.toggleWhitelist(false);
            const { logs } = await this.paywall.handle(anon, 1, 0, 0, 100, 10);
            expect(logs).to.have.length(1);
            expect(logs[0].event).to.equal('UpdateFreeMints');
            expect(logs[0].args.amount).to.be.a.bignumber.eq('0');
            await expect(this.paywall.handle(anon, 1, 0, 0, 100, 10)).to.eventually.be.rejectedWith('Invalid payment amount'); // Next one costs
        });
        it('uses free mints before whitelist spots', async () => {
            await this.paywall.addToFreeMints([anon]);
            await this.paywall.addToWhitelist([anon]);
            await expect(this.paywall.handle(anon, 1, 0, 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true);
            await expect(this.paywall.handle(anon, 1, toWei(0.09), 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true);
            await expect(this.paywall.handle(anon, 1, toWei(0.1), 0, 100, 10)).to.eventually.have.nested.property('receipt.status', true);
        });
    });
});
