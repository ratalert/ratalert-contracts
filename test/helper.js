const { readdir, readFile } = require('fs/promises');

exports.toWei = (ether) => web3.utils.toWei(ether.toString(), 'ether');
exports.advanceTime = (time) => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_increaseTime',
            params: [time],
            id: Date.now(),
        }, (err, result) => {
            if (err) { return reject(err); }
            return resolve(result);
        });
    });
};
exports.advanceBlock = () => {
    return new Promise((resolve, reject) => {
        web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_mine',
            id: Date.now(),
        }, (err) => {
            if (err) { return reject(err); }
            const newBlockHash = web3.eth.getBlock('latest').hash;
            return resolve(newBlockHash)
        });
    });
};
exports.advanceTimeAndBlock = async (time) => {
    await module.exports.advanceTime(time);
    await module.exports.advanceBlock();
    return Promise.resolve(web3.eth.getBlock('latest'));
};
exports.loadTraits = async () => {
    const data = { chef: {}, rat: {} };
    const path = `${__dirname}/../images/final`;
    const files = (await readdir(path)).sort();
    await files.reduce(async (previousPromise, file) => {
        await previousPromise;
        if (!file.includes('.png')) {
            return;
        }
        const [type, trait, , traitName, name] = file.substr(0, file.indexOf('.')).split('_')
        const png = (await readFile(`${path}/${file}`)).toString('base64');
        if (!data[type][trait]) {
            data[type][trait] = ['body', 'head'].includes(traitName) ? [] : [{ name: '', png: '' }];
        }
        data[type][trait].push({ name, png });
    }, Promise.resolve());
    return data;
};
exports.uploadTraits = async (traits) => {
    const data = await module.exports.loadTraits();
    const res1 = await Promise.all(Object.values(data.chef).map((trait, i) => traits.uploadTraits(i, trait)));
    const res2 = await Promise.all(Object.values(data.rat).map((trait, i) => traits.uploadTraits(i + 10, trait)));
    return res1.concat(res2);
};
exports.mintUntilWeHave = async function (numChefs, numRats, options = {}, lists = { all: [], chefs: [], rats: [] }) {
    const { logs } = await this.chefRat.mint(10, { ...options, value: exports.toWei(1) });
    const ids = logs.map(ev => Number(ev.args.tokenId.toString()));
    await Promise.all(ids.map(async id => {
        const traits = await this.chefRat.getTokenTraits(id);
        const copy = { id, ...traits }; // traits is frozen!
        lists.all.push(copy);
        copy.isChef ? lists.chefs.push(copy) : lists.rats.push(copy);
    }));
    if (lists.chefs.length < numChefs || lists.rats.length < numRats) {
        return exports.mintUntilWeHave.call(this, numChefs, numRats, options, lists);
    }
    return lists;
};
