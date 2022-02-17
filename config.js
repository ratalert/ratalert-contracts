const web3 = require('web3');
const toWei = web3.utils.toWei;

module.exports = (network) => ({
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
