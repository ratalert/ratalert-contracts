const web3 = require('web3');
const toWei = web3.utils.toWei;

const env = (key, def) => { return process.env[key] || def; };
const num = (key, def) => { return Number(env(key, def)); };
const vrf = ({ vrfCoordinator, linkToken }) => Object.values({
    vrfCoordinator: vrfCoordinator || env('VRF_COORDINATOR'), // Coordinator contract
    linkToken: linkToken || env('LINK_ADDRESS'), // LINK token contract
    keyHash: env('VRF_KEY_HASH', '0x0'), // 30 gwei key hash gas lane
    vrfFee: toWei(env('VRF_FEE', '0.0001'), 'ether'),
});

module.exports = (network, accounts = []) => ({
    mint: options => vrf(options),
    claim: options => vrf(options),
    dao: {
        address: env('DAO_ADDRESS', accounts ? accounts[9] : ''),
    },
    payWall: Object.values({
        mintPrice: toWei(env('PAYWALL_MINT_PRICE', '0.1'), 'ether'),
        whitelistBoost: num('PAYWALL_WHITELIST_BOOST', '1'),
        maxMintsPerTx: num('PAYWALL_MAX_MINTS_PER_TX', '10'),
        gen1Prices: Object.values({
            gen1PriceTier0: toWei(env('PAYWALL_GEN1_PRICE_TIER0', '1000'), 'ether'),
            gen1PriceTier1: toWei(env('PAYWALL_GEN1_PRICE_TIER1', '1500'), 'ether'),
            gen1PriceTier2: toWei(env('PAYWALL_GEN1_PRICE_TIER2', '2000'), 'ether'),
            gen1PriceTier3: toWei(env('PAYWALL_GEN1_PRICE_TIER3', '3000'), 'ether'),
        }),
    }),
    character: Object.values({
        maxTokens: num('CHARACTER_MAX_TOKENS', '50000'),
    }),
    kitchen: {
        dailyChefEarnings: num('KITCHEN_DAILY_CHEF_EARNINGS', '250'),
        ratTheftPercentage: num('KITCHEN_RAT_THEFT_PERCENTAGE', '20'),
        vestingPeriod: num('KITCHEN_VESTING_PERIOD', '3600'),
        accrualPeriod: num('KITCHEN_ACCRUAL_PERIOD', '86400'),
        mcStake: {
            foodTokenMaxSupply: num('KITCHEN_MCSTAKE_FOOD_TOKEN_MAX_SUPPLY', '50000000'),
            propertyIncrements: Object.values({
                dailySkillRate: num('KITCHEN_MCSTAKE_PROPERTY_INCREMENTS_DAILY_SKILL_RATE', '2'),
                dailyFreakRate: num('KITCHEN_MCSTAKE_PROPERTY_INCREMENTS_DAILY_FREAK_RATE', '4'),
                dailyIntelligenceRate: num('KITCHEN_MCSTAKE_PROPERTY_INCREMENTS_DAILY_INTELLIGENCE_RATE', '2'),
                dailyBodyMassRate: num('KITCHEN_MCSTAKE_PROPERTY_INCREMENTS_DAILY_BODYMASS_RATE', '8'),
            }),
        },
        theStakehouse: {
            foodTokenMaxSupply: num('KITCHEN_THESTAKEHOUSE_FOOD_TOKEN_MAX_SUPPLY', '5000000'),
            propertyIncrements: Object.values({
                dailySkillRate: num('KITCHEN_THESTAKEHOUSE_PROPERTY_INCREMENTS_DAILY_SKILL_RATE', '4'),
                dailyFreakRate: num('KITCHEN_THESTAKEHOUSE_PROPERTY_INCREMENTS_DAILY_FREAK_RATE', '6'),
                dailyIntelligenceRate: num('KITCHEN_THESTAKEHOUSE_PROPERTY_INCREMENTS_DAILY_INTELLIGENCE_RATE', '4'),
                dailyBodyMassRate: num('KITCHEN_THESTAKEHOUSE_PROPERTY_INCREMENTS_DAILY_BODYMASS_RATE', '6'),
            }),
            minEfficiency: num('KITCHEN_THESTAKEHOUSE_MIN_EFFICIENCY', '28'),
        },
        leStake: {
            foodTokenMaxSupply: num('KITCHEN_LESTAKE_FOOD_TOKEN_MAX_SUPPLY', '500000'),
            propertyIncrements: Object.values({
                dailySkillRate: num('KITCHEN_LESTAKE_PROPERTY_INCREMENTS_DAILY_SKILL_RATE', '6'),
                dailyFreakRate: num('KITCHEN_LESTAKE_PROPERTY_INCREMENTS_DAILY_FREAK_RATE', '8'),
                dailyIntelligenceRate: num('KITCHEN_LESTAKE_PROPERTY_INCREMENTS_DAILY_INTELLIGENCE_RATE', '6'),
                dailyBodyMassRate: num('KITCHEN_LESTAKE_PROPERTY_INCREMENTS_DAILY_BODYMASS_RATE', '4'),
            }),
            minEfficiency: num('KITCHEN_LESTAKE_MIN_EFFICIENCY', '72'),
        },
        chefsPerKitchen: num('KITCHEN_CHEFS_PER_KITCHEN', '10'),
        chefEfficiencyMultiplier: num('CHEF_EFFICIENCY_MULTIPLIER', '175'),
        ratEfficiencyMultiplier: num('KITCHEN_RAT_EFFICIENCY_MULTIPLIER', '90'),
        ratEfficiencyOffset: num('KITCHEN_RAT_EFFICIENCY_OFFSET', '55'),
        maxClaimsPerTx: num('KITCHEN_MAX_CLAIMS_PER_TX', '10'),
    },
    gym: Object.values({
        vestingPeriod: num('GYM_VESTING_PERIOD', '3600'),
        accrualPeriod: num('GYM_ACCRUAL_PERIOD', '86400'),
        dailyFreakRate: num('GYM_DAILY_FREAK_RATE', '-12'),
        dailyBodyMassRate: num('GYM_DAILY_BODYMASS_RATE', '-8'),
        maxClaimsPerTx: num('GYM_MAX_CLAIMS_PER_TX', '10'),
    }),
    kitchenShop: Object.values({
        maxTokens: [num('KITCHENSHOP_MAX_TOKENS_THESTAKEHOUSE', '5000'), num('KITCHENSHOP_MAX_TOKENS_LESTAKE', '500')],
        maxMintsPerTx: num('KITCHENSHOP_MAX_MINTS_PER_TX', '10'),
        minSkill: [num('KITCHENSHOP_MIN_SKILL_THESTAKEHOUSE', '28'), num('KITCHENSHOP_MIN_SKILL_LESTAKE', '72')],
        prices: Object.values({
            priceTier0: toWei(env('KITCHENSHOP_PRICE_TIER0', '2000'), 'ether'),
            priceTier1: toWei(env('KITCHENSHOP_PRICE_TIER1', '3000'), 'ether'),
            priceTier2: toWei(env('KITCHENSHOP_PRICE_TIER2', '4000'), 'ether'),
            priceTier3: toWei(env('KITCHENSHOP_PRICE_TIER3', '5000'), 'ether'),
            priceTier4: toWei(env('KITCHENSHOP_PRICE_TIER4', '6000'), 'ether'),
        }),
    }),
    properties: Object.values({
        disaster: Object.values({
            disasterEfficiencyMinimumChef: num('PROPERTIES_DISASTER_EFFICIENCY_MINIMUM_CHEF', '86'),
            disasterEfficiencyMinimumRat: num('PROPERTIES_DISASTER_EFFICIENCY_MINIMUM_RAT', '86'),
            disasterEfficiencyLossChef: num('PROPERTIES_DISASTER_EFFICIENCY_LOSS_CHEF', '0'),
            disasterEfficiencyLossRat: num('PROPERTIES_DISASTER_EFFICIENCY_LOSS_RAT', '0'),
            disasterToleranceLossChef: num('PROPERTIES_DISASTER_TOLERANCE_LOSS_CHEF', '0'),
            disasterToleranceLossRat: num('PROPERTIES_DISASTER_TOLERANCE_LOSS_RAT', '0'),
        }),
        mishap: Object.values({
            mishapEfficiencyMinimumChef: num('PROPERTIES_MISHAP_EFFICIENCY_MINIMUM_CHEF', '15'),
            mishapEfficiencyMinimumRat: num('PROPERTIES_MISHAP_EFFICIENCY_MINIMUM_RAT', '15'),
            mishapEfficiencyLossChef: num('PROPERTIES_MISHAP_EFFICIENCY_LOSS_CHEF', '10'),
            mishapEfficiencyLossRat: num('PROPERTIES_MISHAP_EFFICIENCY_LOSS_RAT', '10'),
            mishapToleranceLossChef: num('PROPERTIES_MISHAP_TOLERANCE_LOSS_CHEF', '25'),
            mishapToleranceLossRat: num('PROPERTIES_MISHAP_TOLERANCE_LOSS_RAT', '50'),
        }),
    }),
});
