const web3 = require('web3');
const toWei = web3.utils.toWei;

const vrf = ({ vrfCoordinator, linkToken }) => Object.values({
    vrfCoordinator: vrfCoordinator || process.env.VRF_COORDINATOR, // Coordinator contract
    linkToken: linkToken || process.env.LINK_ADDRESS, // LINK token contract
    keyHash: process.env.VRF_KEY_HASH || '0x0', // 30 gwei key hash gas lane
    vrfFee: toWei(process.env.VRF_FEE || '0.0001', 'ether'),
});
const dao = (network, account) => ({
    address: (network === 'development') ? account : process.env.DAO_ADDRESS,
});

module.exports = (network, accounts = []) => ({
    dao: dao(network, accounts[9]),
    mint: options => vrf(options),
    claim: options => vrf(options),
    payWall: Object.values({
        mintPrice: ['live', 'development'].includes(network) ? toWei('0.1', 'ether') : toWei('0.01', 'ether'),
        onlyWhitelist: false,
    }),
    character: Object.values({
        maxTokens: 50000,
    }),
    kitchen: {
        dailyChefEarnings: 250,
        ratTheftPercentage: 20,
        vestingPeriod: ['live', 'development'].includes(network) ? 3600 : 60,
        accrualPeriod: ['live', 'development'].includes(network) ? 86400 : 3600,
        mcStake: {
            foodTokenMaxSupply: 50000000,
            propertyIncrements: Object.values({
                dailySkillRate: 2,
                dailyInsanityRate: 4,
                dailyIntelligenceRate: 2,
                dailyFatnessRate: 8,
            }),
        },
        theStakehouse: {
            foodTokenMaxSupply: 5000000,
            propertyIncrements: Object.values({
                dailySkillRate: 4,
                dailyInsanityRate: 6,
                dailyIntelligenceRate: 4,
                dailyFatnessRate: 6,
            }),
            minEfficiency: ['live', 'development'].includes(network) ? 28 : 2,
        },
        leStake: {
            foodTokenMaxSupply: 500000,
            propertyIncrements: Object.values({
                dailySkillRate: 6,
                dailyInsanityRate: 8,
                dailyIntelligenceRate: 6,
                dailyFatnessRate: 4,
            }),
            minEfficiency: ['live', 'development'].includes(network) ? 72 : 8,
        },
        charactersPerKitchen: 10,
        chefEfficiencyMultiplier: 175,
        ratEfficiencyMultiplier: 90,
        ratEfficiencyOffset: 55,
    },
    gym: Object.values({
        vestingPeriod: ['live', 'development'].includes(network) ? 3600 : 60,
        accrualPeriod: ['live', 'development'].includes(network) ? 86400 : 3600,
        dailyInsanityRate: -12,
        dailyFatnessRate: -8,
    }),
    kitchenShop: Object.values({
        maxTokens: [5000, 500],
        minSkill: [28, 72],
    }),
    properties: Object.values({
        disaster: Object.values({
            disasterEfficiencyMinimumChef: 86,
            disasterEfficiencyMinimumRat: 86,
            disasterEfficiencyLossChef: 0,
            disasterEfficiencyLossRat: 0,
            disasterToleranceLossChef: 0,
            disasterToleranceLossRat: 0,
        }),
        mishap: Object.values({
            mishapEfficiencyMinimumChef: 15,
            mishapEfficiencyMinimumRat: 15,
            mishapEfficiencyLossChef: 10,
            mishapEfficiencyLossRat: 10,
            mishapToleranceLossChef: 25,
            mishapToleranceLossRat: 50,
        }),
    }),
});
