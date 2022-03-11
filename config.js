const web3 = require('web3');
const toWei = web3.utils.toWei;

const vrf = ({ vrfCoordinator, linkToken }) => Object.values({
    vrfCoordinator: vrfCoordinator || '0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B', // Rinkeby coordinator
    linkToken: linkToken || '0x01BE23585060835E02B77ef475b0Cc51aA1e0709', // Rinkeby LINK token contract
    keyHash: '0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311', // Rinkeby 30 gwei Key Hash gas lane
    fee: toWei('0.1', 'ether'),
});

module.exports = (network) => ({
    mint: options => vrf(options),
    claim: options => vrf(options),
    payWall: {
        mintPrice: ['live', 'development'].includes(network) ? toWei('0.1', 'ether') : toWei('0.01', 'ether'),
    },
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
