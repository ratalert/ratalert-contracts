const { readdir, readFile } = require('fs/promises');

module.exports = {
    toWei: (ether) => web3.utils.toWei(ether.toString(), 'ether'),
    advanceTime: (time) => {
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
    },
    advanceBlock: () => {
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
    },
    advanceTimeAndBlock: async (time) => {
        await module.exports.advanceTime(time);
        await module.exports.advanceBlock();
        return Promise.resolve(web3.eth.getBlock('latest'));
    },
    uploadTraits: async (traits) => {
        const data = { chef: {}, rat: {} };
        const path = `${__dirname}/../images/dummy`;
        const files = (await readdir(path)).sort();
        const abc = ['Body', 'Head', 'A', 'B', 'C', 'D', 'E', 'F'];
        await files.reduce(async (previousPromise, file) => {
            await previousPromise;
            if (!file.includes('.png')) {
                return;
            }
            const [type, trait, value] = file.substr(0, file.indexOf('.')).split('_')
            const png = (await readFile(`${path}/${file}`)).toString('base64');
            if (!data[type][trait]) {
                data[type][trait] = [];
            }
            data[type][trait].push({ name: `${type}${abc[trait]} ${value}`, png });
        }, Promise.resolve());
        const res1 = await Promise.all(Object.values(data.chef).map((trait, i) => traits.uploadTraits(i, trait)));
        const res2 = await Promise.all(Object.values(data.rat).map((trait, i) => traits.uploadTraits(i + 10, trait)));
        return res1.concat(res2);
    }
}
