module.exports = async (callback) => {
  if (process.env.LOCAL_VRF !== 'true') {
    console.error('Please add this line to your local .env file and redeploy:\nLOCAL_VRF="true"');
    return callback();
  }
  this.mint = await artifacts.require('Mint').deployed();
  this.claim = await artifacts.require('Claim').deployed();
  const mint = new web3.eth.Contract(this.mint.abi, this.mint.address);
  const claim = new web3.eth.Contract(this.claim.abi, this.claim.address);
  const from = (await web3.eth.getAccounts())[8]; // Account 8 is our VRFCoordinator

  const onData = async (contract, event) => {
    const rand = Math.floor(Math.random() * 1000000000);
    try {
      await this[contract.toLowerCase()].rawFulfillRandomness(event.returnValues.requestId, rand, { from });
    } catch (e) {
      return console.error(e);
    }
    console.info(`Fulfilled ${contract} request ${event.returnValues.requestId} by ${event.returnValues.sender} with ${rand}.`);
  };

  mint.events.RandomNumberRequested()
    .on('error', err => console.error(err))
    .on('connected', str => console.debug(`Connected Mint subscription ${str}.`))
    .on('data', (ev) => onData('Mint', ev));
  claim.events.RandomNumberRequested()
    .on('error', err => console.error('Error', err))
    .on('connected', str => console.debug(`Connected Claim subscription ${str}.`))
    .on('data', (ev) => onData('Claim', ev));
};
