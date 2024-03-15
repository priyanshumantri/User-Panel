const express = require('express');
const Route = express.Router();
const ledgerSchema = require("../../../models/masters/ledgers");

const freightInvoiceSchema = require("../../../models/transactions/accounts/freight-invoice");
const fmSchema = require("../../../models/transactions/accounts/freight-memo");
const newSchema = require("../../../models/accounts/new");
const rvSchema = require("../../../models/accounts/reciepts")
const paymentSchema = require("../../../models/accounts/payments");
const journalSchema = require("../../../models/accounts/journal");
const contraSchema = require("../../../models/accounts/contra");
const crossingChallanSchema = require("../../../models/transactions/delivery/crossing-challan");
const localCollectionSchema = require("../../../models/transactions/bookings/local-collection-challan");
const moment = require("moment");
const getOpeningBalance = require("../../../custom_modules/accounts/getOpeningBalance");
const splitDateRange = require("../../../custom_modules/dates/rangeSplitter");
Route.get("/reports/accounts/ledgers", async (req, res) => {
    const db = req.dbConnection;
    const ledgers = db.model("ledgers", ledgerSchema);
    const data = await ledgers.find();
    let ledgerData = [];
    for (const info of data) {
        const newData = {
            name: info.name,
            id: info._id,
        }
        ledgerData.push(newData);
    }
    res.render("reports/accounts/ledgers", { ledgerData });
});

Route.post("/reports/accounts/ledgers", async (req, res) => {
    const db = req.dbConnection;
    const ledgers = db.model("ledgers", ledgerSchema)
    const fi = db.model("freight-invoices", freightInvoiceSchema);
    const fm = db.model("freight-memos", fmSchema);
    const rv = db.model("reciept-vouchers", rvSchema);
    const newM = db.model("new-references", newSchema);
    const payment = db.model("payment-vouchers", paymentSchema);
    const journal = db.model("journal-vouchers", journalSchema);
    const contra = db.model("contra-vouchers", contraSchema);
    const crossingChallan = db.model("crossing-challans", crossingChallanSchema);
    const localCollection = db.model("local-collection-challans", localCollectionSchema);
    try {
        const ledgers = db.model("ledgers", ledgerSchema);
        const { date, ledgerName, narration } = req.body;
        const { startDate, endDate } = splitDateRange(date);
        const ledgerData = await ledgers.findById(ledgerName).populate("transactions.against.ledger")
        const startDateMoment = moment(startDate, 'DD/MM/YYYY');
        const endDateMoment = moment(endDate, 'DD/MM/YYYY');
        const closingBalance = await getOpeningBalance(db, ledgerData, date, startDateMoment, endDateMoment);
        // now we will get all transactions between the start and end date
        const duringTransactionsDate = ledgerData.transactions.filter(transaction => {
            const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
            return transactionDate.isBetween(startDateMoment, endDateMoment, null, '[]');
        });
        let finalTransactions = [];
        const newTransaction = {
            date: startDate,
            particulars: "Opening Balance",
            vchType: "N/A",
            vchNumber: "N/A",
            debit: closingBalance > 0 ? closingBalance : 0,
            credit: closingBalance < 0 ? closingBalance * -1 : 0,
            balance: closingBalance,
            narration: `To recognize the opening balance as of ${startDate}, representing the initial amounts brought forward from the previous accounting period`
        }
        finalTransactions.push(newTransaction);

        // now we will insert all the transactions between the start and end date
        let currentBalance = closingBalance;

        const duringTransactions = await duringTransactionsDate.filter((element)=> element.reference.at !== "openingBalance")

        for (const info of duringTransactions) {
            //we have to also calculate the balance
            if (info.type === "dr") {
                currentBalance += info.amount;
            } else {
                currentBalance -= info.amount;
            }

            let type = "Dr"
            if (currentBalance < 0) {
                type = "Cr"
            }

            let voucherType = ""
            let voucherNumber = ""
            if (info.reference.at === "freightInvoice") {
                const fiData = await fi.findById(info.reference.atRel);
                voucherType = "SALES";
                voucherNumber = fiData.billNumber;
            } else if (info.reference.at === "freightMemo") {
                const fmData = await fm.findById(info.reference.atRel);
                voucherType = "PURCHASE";
                voucherNumber = fmData.number
            } else if (info.reference.at === "reciept") {
                const rvData = await rv.findById(info.reference.atRel);
                voucherType = "RECEIPT";
                voucherNumber = rvData.voucherNumber
            } else if (info.reference.at === "new") {
                const z = await newM.findById(info.reference.atRel);
                voucherType = "NEW";
                voucherNumber = z.number
            } else if (info.reference.at === "payment") {
                const z = await payment.findById(info.reference.atRel);
                voucherType = "PAYMENT";
                voucherNumber = z.voucherNumber
            } else if (info.reference.at === "journal") {
                const z = await journal.findById(info.reference.atRel);
                voucherType = "JOURNAL";
                voucherNumber = z.voucherNumber
            }
            else if (info.reference.at === "contra") {
                const z = await contra.findById(info.reference.atRel);
                voucherType = "CONTRA";
                voucherNumber = z.voucherNumber
            }
            else if (info.reference.at === "crossingChallan") {
                const z = await crossingChallan.findById(info.reference.atRel);
                voucherType = "PURCHASE";
                voucherNumber = z.number
            }
            else if (info.reference.at === "localCollectionChallan") {
                const z = await localCollection.findById(info.reference.atRel);
                voucherType = "PURCHASE";
                voucherNumber = z.number
            }  else if(info.reference.at === "onAccount") {
                const z = await newM.findById(info.reference.atRel);
                voucherType = "ON ACCOUNT";
                voucherNumber = z.number
             }

            const newTransaction = {
                date: info.date,
                particulars: info.against.length > 0 ? joinWithCommas(info.against.map(item => item.ledger.name)) : "Opening Balance",
                vchType: voucherType,
                vchNumber: voucherNumber,
                debit: info.type === "dr" ? info.amount : 0,
                credit: info.type === "cr" ? info.amount : 0,
                balance: `${Math.abs(currentBalance)} ${type}`,
                narration: info.narration
            };
            finalTransactions.push(newTransaction);
        }

        // now the same way we will calculate dr balance, cr balance and closing balance fo subledgers
        const subLedgers = ledgerData.subLedgers;
        let subLedgerData = [];
        if (subLedgers.length > 0) {
            for (const info of subLedgers) {
                const subLedger = await ledgers.findById(info);
                let subLedgerTransactions = [];
                if (subLedger && subLedger.transactions && subLedger.transactions.length > 0) {
                    for (const transaction of subLedger.transactions) {
                        const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
                        if (transactionDate.isBefore(startDateMoment)) {
                            subLedgerTransactions.push(transaction);
                        } else if (transactionDate.isBetween(startDateMoment, endDateMoment, null, '[]')) {
                            subLedgerTransactions.push(transaction);
                        }
                    }
                    let subLedgerDebit = 0;
                    let subLedgerCredit = 0;
                    for (const transaction of subLedgerTransactions) {
                        if (transaction.type === "dr") {
                            subLedgerDebit += transaction.amount;
                        } else {
                            subLedgerCredit += transaction.amount;
                        }
                    }
                    let subLedgerClosingBalance = subLedgerDebit - subLedgerCredit;
                    let totalDebit = finalTransactions.reduce((acc, item) => {
                        return acc + item.debit;
                    }, 0);

                    let totalCredit = finalTransactions.reduce((acc, item) => {
                        return acc + item.credit;
                    }, 0);

                    if (totalDebit > totalCredit) {
                        subLedgerClosingBalance += totalDebit - totalCredit;
                    } else {
                        subLedgerClosingBalance -= totalDebit - totalCredit;
                    }
                    let type = "Dr"
                    if (subLedgerClosingBalance < 0) {
                        type = "Cr"
                    }
                    const newSubLedger = {
                        date: "",
                        particulars: subLedger.name,
                        vchType: "",
                        vchNumber: "",
                        debit: subLedgerDebit - subLedgerCredit > 0 ? subLedgerDebit - subLedgerCredit : 0,
                        credit: subLedgerDebit - subLedgerCredit < 0 ? subLedgerDebit - subLedgerCredit * -1 : 0,
                        balance: `${Math.abs(subLedgerClosingBalance)} ${type}`,
                        narration: `To display the sub ledger balance as of ${startDate},  reflecting the cumulative transactions and balances recorded within the sub ledger.`

                    }
                    subLedgerData.push(newSubLedger);
                }
            }
        }
        return res.status(200).json({ finalTransactions, subLedgerData });


    } catch (err) {
        console.log(err);
    }
})

function joinWithCommas(data) {
    if (data.length === 1) {
        return data[0];
    } else {
        let finalData = "";
        for (const info of data) {
            finalData += info + ", ";
        }
        return finalData;
    }
}
module.exports = Route;