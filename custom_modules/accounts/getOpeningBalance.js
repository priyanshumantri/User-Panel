const ledgerSchema = require("../../models/masters/ledgers");
const splitDateRange = require("../dates/rangeSplitter");
const moment = require("moment");
async function getOpeningBalance(db, ledgerData, date, startDateMoment, endDateMoment) {

    const { startDate, endDate } = splitDateRange(date);





    //first we will get all transactions before the start date
    const beforeTransactions = ledgerData.transactions.filter(transaction => {
        const transactionDate = moment(transaction.date, 'DD/MM/YYYY');
        return (transactionDate.isBefore(startDateMoment) && transaction.reference.at !== "openingBalance")
    });




    // now we will calculate the balance before the start date

    let beforeDebit = 0;
    let beforeCredit = 0;
    for (const info of beforeTransactions) {
        if (info.type === "dr") {
            beforeDebit += info.amount;
        } else {
            beforeCredit += info.amount;
        }
    }

    let closingBalance = beforeDebit - beforeCredit;

    if (ledgerData.openingBalance.type === "dr") {
        closingBalance += ledgerData.openingBalance.amount;
    } else {
        closingBalance -= ledgerData.openingBalance.amount;
    }

    return closingBalance;
}

module.exports = getOpeningBalance;