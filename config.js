const web3 = require('web3');
const toWei = web3.utils.toWei;

module.exports = (network) => ({
    mint: ({ vrfCoordinator }) => Object.values({
        vrfCoordinator: vrfCoordinator || '0x6168499c0cFfCaCD319c818142124B7A15E857ab', // Rinkeby coordinator
        link: '0x01BE23585060835E02B77ef475b0Cc51aA1e0709', // Rinkeby LINK token contract
        keyHash: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc', // Rinkeby 30 gwei Key Hash gas lane
        subscriptionId: network === 'development' ? 1 : 714,
        minConfirmations: 3, // Rinkeby mininum is 3
        callbackGasLimit: 2000000, // Rinkeby limit is 2500000
    }),
    character: Object.values({
        maxTokens: 50000,
        mintPrice: ['live', 'development'].includes(network) ? toWei('0.1', 'ether') : toWei('0.01', 'ether'),
    }),
    kitchen: {
        foodTokenMaxSupply: 50000000,
        dailyChefEarnings: 250,
        ratTheftPercentage: 20,
        vestingPeriod: ['live', 'development'].includes(network) ? 3600 : 60,
        accrualPeriod: ['live', 'development'].includes(network) ? 86400 : 3600,
        mcStake: {
            propertyIncrements: Object.values({
                dailySkillRate: 2,
                dailyInsanityRate: 4,
                dailyIntelligenceRate: 2,
                dailyFatnessRate: 8,
            }),
        },
        theStakehouse: {
            propertyIncrements: Object.values({
                dailySkillRate: 4,
                dailyInsanityRate: 6,
                dailyIntelligenceRate: 4,
                dailyFatnessRate: 6,
            }),
            minEfficiency: ['live', 'development'].includes(network) ? 28 : 2,
        },
        leStake: {
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
