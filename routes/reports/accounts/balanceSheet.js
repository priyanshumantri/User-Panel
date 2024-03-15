const express = require('express');
const Route = express.Router();
const groupSchema = require('../../../models/masters/groups');
const ledgerSchema = require('../../../models/masters/ledgers');
const getLedgers = require('../../../custom_modules/accounts/getLedgers');
Route.get('/reports/accounts/balance-sheet', async(req, res) => {
    const db = req.dbConnection;
    const groups = db.model('groups', groupSchema);
    const ledgers = db.model('ledgers', ledgerSchema);
    
    // Define a function to process a batch of ledgers
    async function processLedgers(ledgerBatch) {
        const total = await Promise.all(ledgerBatch.map(async (data) => {
            const balance = await ledgers.aggregate([
                {
                    $match: {
                        _id: data._id
                    }
                },
                {
                    $unwind: '$transactions'
                },
                {
                    $group: {
                        _id: null,
                        drTotal: {
                            $sum: {
                                $cond: [
                                    { $and: [
                                        { $eq: ['$transactions.type', 'dr'] },
                                        { $ne: ['$transactions.reference.at', 'openingBalanc'] }
                                    ] },
                                    '$transactions.amount',
                                    0
                                ]
                            }
                        },
                        crTotal: {
                            $sum: {
                                $cond: [{ $eq: ['$transactions.type', 'cr'] }, '$transactions.amount', 0]
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        balance: { $subtract: ['$drTotal', '$crTotal'] }
                    }
                }
            ]);
            
    
            return balance.length > 0 ? balance[0].balance : 0;
        }));
    
        return total.reduce((acc, curr) => acc + curr, 0);
    }
    
    // Define a function to process all the ledgers in parallel
    async function processAllLedgers(ledgerData) {
        const batchSize = 10; // Adjust the batch size as needed
        let total = 0;
    
        for (let i = 0; i < ledgerData.length; i += batchSize) {
            const batch = ledgerData.slice(i, i + batchSize);
            const batchTotal = await processLedgers(batch);
            total += batchTotal;
        }
    
        return total;
    }
    
    // Get all the ledger data in parallel
    const [capitalAccount, loansAndLiabilities, currentLiability, fixedAssets, investments, currentAssets] = await Promise.all([
        getLedgers(db, "capitalaccount"),
        getLedgers(db, "loans&liabilities"),
        getLedgers(db, "currentliability"),
        getLedgers(db, "fixedassets"),
        getLedgers(db, "investments"),
        getLedgers(db, "currentassets")
    ]);
    
    // Process all the ledgers in parallel
    const [totalCapitalAccount, totalLoansAndLiabilities, totalCurrentLiability, totalFixedAssets, totalInvestments, totalCurrentAssets] = await Promise.all([
        processAllLedgers(capitalAccount),
        processAllLedgers(loansAndLiabilities),
        processAllLedgers(currentLiability),
        processAllLedgers(fixedAssets),
        processAllLedgers(investments),
        processAllLedgers(currentAssets)
    ]);
    
    // Calculate the asset and liability totals
    let assetSideTotal = 0;
    let liabilitySideTotal = 0;
    
    if (totalCapitalAccount < 0) {
        liabilitySideTotal += Math.abs(totalCapitalAccount);
    } else {
        assetSideTotal += totalCapitalAccount;
    }
    
    if (totalLoansAndLiabilities < 0) {
        liabilitySideTotal += Math.abs(totalLoansAndLiabilities);
    } else {
        assetSideTotal += totalLoansAndLiabilities;
    }
    
    if (totalCurrentLiability < 0) {
        liabilitySideTotal += Math.abs(totalCurrentLiability);
    } else {
        assetSideTotal += totalCurrentLiability;
    }
    
    if (totalFixedAssets < 0) {
        liabilitySideTotal += Math.abs(totalFixedAssets);
    } else {
        assetSideTotal += totalFixedAssets;
    }
    
    if (totalInvestments < 0) {
        liabilitySideTotal += Math.abs(totalInvestments);
    } else {
        assetSideTotal += totalInvestments;
    }
    
    if (totalCurrentAssets < 0) {
        liabilitySideTotal += Math.abs(totalCurrentAssets);
    } else {
        assetSideTotal += totalCurrentAssets;
    }
    
    // Calculate the net profit or net loss
    let netProfit = 0;
    let netLoss = 0;
    let total = 0;
    
    if (assetSideTotal > liabilitySideTotal) {
        netProfit = assetSideTotal - liabilitySideTotal;
        total = liabilitySideTotal + netProfit;
    } else {
        netLoss = liabilitySideTotal - assetSideTotal;
        total = assetSideTotal + netLoss;
    }
    
    // Construct the balance sheet object
    const constructedBalanceSheet = {
        totalCapitalAccount,
        totalLoansAndLiabilities,
        totalCurrentLiability,
        totalFixedAssets,
        totalInvestments,
        totalCurrentAssets,
        netProfit,
        netLoss,
        total
    };
    
    // Render the balance sheet
    res.render('reports/accounts/balanceSheet', { constructedBalanceSheet });
    


  

 

})

async function calculateBalance(transactions) {

    let totalDebit = 0;
    let totalCredit = 0;
    for(const data of transactions) {
        if(data.type === "dr") {
            totalDebit += data.amount
        } else {
            totalCredit += data.amount
        }
    }

    return totalDebit - totalCredit
}
Route.get('/reports/accounts/balance-sheet/export', (req, res) => {
    const db = req.dbConnection;
    if(req.query.type === "pdf") {

    }
   
})
module.exports = Route;
