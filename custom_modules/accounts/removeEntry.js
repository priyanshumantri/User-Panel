const ledgerSchema = require("../../models/masters/ledgers");
async function removeEntry(db, session, ledger, transactionID) {
    const ledgerM = db.model("ledgers", ledgerSchema);
    const ledgerData = await ledgerM.findById(ledger).session(session);
    const transactionIndex = ledgerData.transactions.findIndex(transaction => transaction._id.toString() == transactionID.toString());
    ledgerData.transactions[transactionIndex].remove();
    await ledgerData.save();
}


module.exports = removeEntry 