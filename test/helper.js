module.exports = {
    toWei: (ether) => web3.utils.toWei(ether.toString(), 'ether'),
}