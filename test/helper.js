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
            }, (err, result) => {
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
}