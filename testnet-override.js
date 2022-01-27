const { readFileSync, writeFileSync } = require('fs');
module.exports = {
    handlers: {
        "compile:start": [
            function () {
                const jobs = [
                    {
                        inFile: 'ChefRat.sol',
                        outFile: 'ChefRatTest.sol',
                        func: str => str
                            .replace(/contract ChefRat/g, 'contract ChefRatTest')
                            .replace(/MINT_PRICE = .1 ether/g, 'MINT_PRICE = .01 ether')
                    },
                    {
                        inFile: 'KitchenPack.sol',
                        outFile: 'KitchenPackTest.sol',
                        func: str => str
                            .replace(/contract KitchenPack/g, 'contract KitchenPackTest')
                            .replace(/1 days/g, '1 hours')
                    },
                ];
                console.log(`> Creating ${jobs.map(job => job.outFile).join(', ')}`);
                const contractsDir = `${__dirname}/contracts`;
                jobs.forEach(({ inFile, outFile, func }) => {
                    const origin = readFileSync(`${contractsDir}/${outFile}`, 'utf8');
                    const output = func(readFileSync(`${contractsDir}/${inFile}`, 'utf8'));
                    if (output !== origin) {
                        writeFileSync(`${contractsDir}/${outFile}`, output);
                    }
                })
                console.log('> Created successfully');
            }
        ],
    },
};
