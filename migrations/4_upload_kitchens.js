const { uploadKitchens } = require("../test/helper");

const KitchenShop = artifacts.require('KitchenShop');

module.exports = async (deployer) => {
  const kitchenShop = await KitchenShop.deployed();
  await uploadKitchens(kitchenShop);
};
