const { writeFile } = require('fs/promises');
const mri = require('mri');

module.exports = async (callback) => {
  const argv = mri(process.argv.slice(4));
  const time = new Date().toISOString().substr(0, 16).replace(':', '-');
  const network = argv.network || 'development';
  const character = await artifacts.require('Character').deployed();
  const minted = Number((await character.minted()).toString());

  for (let i = 1; i <= minted; i++) {
    const res = await character.tokenURI(i);
    const str = Buffer.from(res.split(',')[1], 'base64').toString('ascii');
    const json = JSON.parse(str);
    const svg = Buffer.from(json.image.split(',')[1], 'base64').toString('ascii');
    const isChef = json.attributes.find(attr => attr.trait_type === 'Type').value === 'Chef';
    const props = {
      isChef,
      type: isChef ? 'chef' : 'rat',
      name: json.name,
      efficiency: json.attributes.find(attr => attr.trait_type === (isChef ? 'Skill percentage' : 'Intelligence quotient')).value,
      tolerance: json.attributes.find(attr => attr.trait_type === (isChef ? 'Freak percentage' : 'Body mass percentage')).value,
      efficiencyTitle: json.attributes.find(attr => attr.trait_type === (isChef ? 'Skill' : 'Intelligence')).value,
      toleranceTitle: json.attributes.find(attr => attr.trait_type === (isChef ? 'Freak' : 'Body mass')).value,
    }
    console.log(`${props.name}: ${props.efficiency} / ${props.tolerance} (${props.efficiencyTitle} / ${props.toleranceTitle})`);
    try {
      await writeFile(`./images/test/${network}_${time}_${i}_${props.type}_e${props.efficiency}_t${props.tolerance}.svg`, svg);
    } catch (e) {
      console.error(e);
    }

  }
  callback();
};
