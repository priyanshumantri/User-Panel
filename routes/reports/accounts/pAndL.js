const express = require('express');
const Route = express.Router();
const moment = require("moment")
const ledgerSchema = require("../../../models/masters/ledgers");
const splitDateRange = require("../../../custom_modules/dates/rangeSplitter");
const getOpeningBalance = require("../../../custom_modules/accounts/getOpeningBalance");
const getLedgers = require("../../../custom_modules/accounts/getLedgers");
Route.get("/reports/accounts/profit-and-loss", (req, res) => {
    res.render("reports/accounts/pAndL");
})

Route.post("/reports/accounts/profit-and-loss", async (req, res) => {
    const db = req.dbConnection;
    const ledgers = db.model("ledgers", ledgerSchema);
    const {date, viewMode} = req.body;
    const {startDate, endDate} = splitDateRange(date);
    const startDateMoment = moment(startDate, 'DD/MM/YYYY');
    const endDateMoment = moment(endDate, 'DD/MM/YYYY');
    const indirectExpenses = await getLedgers(db, "indirectexpenses");
    const directExpenses = await getLedgers(db, "directexpenses");
    const sales = await getLedgers(db, "salesaccount");
    const indirectincome = await getLedgers(db, "indirectincome");
    const directincome = await getLedgers(db, "directincome");
    const purchase = await getLedgers(db, "purchaseaccount");
    let constructedData = {
        indirectExpenses : 0,
        directExpenses : 0,
        sales : 0,
        indirectIncome : 0,
        directIncome : 0,
        purchase : 0,
        openingBalance : 0,
    }
    //positive balance means dr balance and negative balance means cr balance
    for(i = 0; i < indirectExpenses.length; i++) {
        const balance = await getOpeningBalance(db, indirectExpenses[i], date, startDateMoment, endDateMoment);
        constructedData.openingBalance += balance;
        const duringTransactions = indirectExpenses[i].transactions.filter(transaction => {
            const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
            return transactionDate.isBetween(startDateMoment, endDateMoment, null, '[]');
        });
        
        let currentBalance = 0
        for(const info of duringTransactions) {
            if (info.type === "dr") {
                currentBalance += info.amount;
            } else {
                currentBalance -= info.amount;
            }
        }
        constructedData.indirectExpenses += currentBalance;
    }

    for(i = 0; i < directExpenses.length; i++) {
        const balance = await getOpeningBalance(db, directExpenses[i], date, startDateMoment, endDateMoment);
        constructedData.openingBalance += balance;
        const duringTransactions = directExpenses[i].transactions.filter(transaction => {
            const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
            return transactionDate.isBetween(startDateMoment, endDateMoment, null, '[]');
        });
        
        let currentBalance = 0
        for(const info of duringTransactions) {
            if (info.type === "dr") {
                currentBalance += info.amount;
            } else {
                currentBalance -= info.amount;
            }
            constructedData.directExpenses += currentBalance;
        }
    }

    for(i = 0; i < sales.length; i++) {
        const balance = await getOpeningBalance(db, sales[i], date, startDateMoment, endDateMoment);
        constructedData.openingBalance += balance;
        const duringTransactions = sales[i].transactions.filter(transaction => {
            const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
            return transactionDate.isBetween(startDateMoment, endDateMoment, null, '[]');
        });
        
        let currentBalance = 0
        for(const info of duringTransactions) {
            if (info.type === "dr") {
                currentBalance -= info.amount;
            } else {
                currentBalance += info.amount;
            }
            constructedData.sales += currentBalance;
        }
    }

    for(i = 0; i < indirectincome.length; i++) {
        const balance = await getOpeningBalance(db, indirectincome[i], date, startDateMoment, endDateMoment);
        constructedData.openingBalance += balance;
        const duringTransactions = indirectincome[i].transactions.filter(transaction => {
            const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
            return transactionDate.isBetween(startDateMoment, endDateMoment, null, '[]');
        });
        
        let currentBalance = 0
        for(const info of duringTransactions) {
            if (info.type === "dr") {
                currentBalance -= info.amount;
            } else {
                currentBalance += info.amount;
            }
            constructedData.indirectIncome += currentBalance;
        }
    }

    for(i = 0; i < directincome.length; i++) {
        const balance = await getOpeningBalance(db, directincome[i], date, startDateMoment, endDateMoment);
        constructedData.openingBalance += balance;
        const duringTransactions = directincome[i].transactions.filter(transaction => {
            const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
            return transactionDate.isBetween(startDateMoment, endDateMoment, null, '[]');
        });
        
        let currentBalance = 0
        for(const info of duringTransactions) {
            if (info.type === "dr") {
                currentBalance -= info.amount;
            } else {
                currentBalance += info.amount;
            }
            constructedData.directIncome += currentBalance;
        }
    }

    for(i = 0; i < purchase.length; i++) {
        const balance = await getOpeningBalance(db, purchase[i], date, startDateMoment, endDateMoment);
        constructedData.openingBalance += balance;
        const duringTransactions = purchase[i].transactions.filter(transaction => {
            const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
            return transactionDate.isBetween(startDateMoment, endDateMoment, null, '[]');
        });
        
        let currentBalance = 0
        for(const info of duringTransactions) {
            if (info.type === "dr") {
                currentBalance += info.amount;
            } else {
                currentBalance -= info.amount;
            }
            constructedData.purchase += currentBalance;
        }
    }

    console.log(constructedData)

    return res.status(200).send(constructedData);

})

module.exports = Route;