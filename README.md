RatAlert Game
==============

## Rinkeby Gnosis Safe

- [0xf0B3Ee1FA257E0E7816DA1A6E13A0A0bC0c585fD](https://gnosis-safe.io/app/rin:0xf0B3Ee1FA257E0E7816DA1A6E13A0A0bC0c585fD/)


## Testing

    $ truffle develop

## Rinkeby Deployment

1. Deploy the contracts

        truffle migrate --network rinkeby --skip-dry-run

2. Create a [Chainlink VRF subscription](https://vrf.chain.link/)
3. Fund it with LINK
4. Add the Mint address as consumer (from `truffle network`) 


## TODO

- [Setup using Simple Multisig](https://github.com/paxosglobal/simple-multisig/)
- [Use ChainLink VRF](https://docs.chain.link/docs/get-a-random-number/)

## Testnet Faucets

- [Social Rinkeby Faucet](https://faucet.rinkeby.io/)
- [MyCrypto](https://app.mycrypto.com/faucet)
- [ChainLink (Ropsten, Rinkeby, Kovan)](https://faucets.chain.link/rinkeby)

## Wolf Game Clones

- [Galaxy Conquest](https://www.galacticconquestgame.net/wp)
- [Wizards And Dragons](https://wnd.game/game)

## Good reads

- [Simple Multisig by Paxos](https://paxos.com/2021/03/23/simple-multisig-how-it-works-and-why-its-awesome/)
- [Elastic DAO Protocol](https://docs.elasticdao.org/)
- [Learn about Ethereum](https://ethereum.org/en/learn/)
- [Solidity Official Documentation](https://docs.soliditylang.org/en/latest/introduction-to-smart-contracts.html)
- [Solidity Security Considerations](https://docs.soliditylang.org/en/latest/security-considerations.html)
- [Consensys Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [Wolf Game Randomizer Exploit](https://gist.github.com/alcibiadeseth)
