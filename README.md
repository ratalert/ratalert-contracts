RatAlert Game
==============

**The NFT game that lets you #train2earn higher rewards from your characters!**
**Powered by the [Polygon](https://polygon.technology/) l2 blockchain.**

This repository contains the Solidity smart [contracts](./contracts/) of the game.


## Resources

- [Website](https://ratalert.com/)
- [Whitepaper](https://ratalert.com/whitepaper)
- [Infographic](https://ratalert.com/infographic)
- [Roadmap](https://ratalert.com/roadmap)
- [Twitter](https://twitter.com/RatAlertNFT)
- [Discord](https://discord.gg/T6THfqh37A)
- [Telegram](https://t.me/ratalert_chat)
- [Medium](https://ratalert.medium.com/)
- [GitHub](https://github.com/ratalert)


## Development

### Initial Setup

- Make sure you have Truffle installed globally: `npm install -g truffle`.
- Optional: Create a `.env` file in the **project root** directory, run `npx mnemonics` and add the seed phrase in a new line:

      MNEMONIC="your twelve word seed phrase"

- Run `npm install`


### Repository Structure

- [bin/](./bin/) contains a Truffle CLI to interact with contracts
- [contracts/](./contracts/) contains all Solidity smart contract game logic
- [images/](./images/) contains all Characters & Kitchen PNGs that are being composed by the contracts
- [test/](./test/) contains the Mocha test suite
- [config.js](./config.js) contains the contract configuration


### Run The Tests

1. Run a local development blockchain in a separate tab: `truffle develop`
2. Run the test suite: `truffle test`


### Local Development

1. Run a local development blockchain in a separate tab: `truffle develop`
2. Optional: Compile the contracts `truffle compile`
3. Deploy the contracts locally: `truffle migrate`
4. Interact with them using the console: `truffle console`

#### Local VRF Coordinator

Both [Mint](./contracts/Mint.sol) & [Claim](./contracts/Claim.sol) use ChainLink VRF to fulfill requests.
In order to simulate VRF locally, we use a truffle external script that listens for `RandomNumberRequested`
events and triggers the respective rawFulfillRandomness() callback function.

By default, the VRF coordinator is not enabled. To enable, add the following line to your .env file:

    LOCAL_VRF="true"

Then run a deployment using `truffle migrate` and start the VRF coordinator using `truffle exec bin/vrf.js`.


### Configuration

Each environment uses its own .env file:

- `.env` for development & tests
- `.env.test` for private integration testing
- `.env.beta` for public beta testing
- `.env.main` for the public live game

All contract configuration is in [config.js](./config.js) but references the env variables from the respective .env file. This is where you make overrides.


### Deployment

1. Choose an environment to deploy
2. Optional: Create new mnemonics `npx mnemonics` and add them to the respective .env file
3. Get the first account address. In the console, run `web3.eth.getAccounts()` and copy the first address
4. Fund this address with 0.5 MATIC using the [faucet](https://faucet.polygon.technology/) in Mumbai testnet
5. Deploy the contracts: `truffle migrate --network <network>`
6. Get the contract addresses: `truffle network`
7. Fund the Claim & Mint contracts with LINK using the [faucet](https://faucets.chain.link/mumbai) in Mumbai testnet


## RatAlert DAO

All contracts that carry game mechanics are [upgradeable](https://docs.openzeppelin.com/contracts/4.x/upgradeable).
The idea behind this is to enable the RatAlert DAO to agree upon and change parameters of the game if required.


## Testnet Faucets

### Rinkeby

- [faucet.rinkeby.io](https://faucet.rinkeby.io/)
- [app.mycrypto.com](https://app.mycrypto.com/faucet)
- [chain.link](https://faucets.chain.link/mumbai)

### Mumbai

- [polygon.technology](https://faucet.polygon.technology/)
- [vercel.app](https://testmatic.vercel.app/)
- [chain.link](https://faucets.chain.link/mumbai)


## TODO

- [Setup using Simple Multisig](https://github.com/paxosglobal/simple-multisig/)
