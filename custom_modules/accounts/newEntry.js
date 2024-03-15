const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const ledgerSchema = require("../../models/masters/ledgers");
async function newEntry(db, session, ledgerID, date, fy, type, amount, narration, referenceType, referenceRel, against, at, atRel, primaryLedger, forV, due) {
    const ledger = db.model("ledgers", ledgerSchema);
    const ledgerData = await ledger.findById(ledgerID).session(session);

    const newTransaction = {
        _id: new ObjectId(), // Create a new ObjectId for the transaction
        primaryLedger : primaryLedger ? primaryLedger : null, 
        date: date,
        fy: fy,
        type: type.toLowerCase(),
        amount: parseFloat(amount),
        narration: narration,
        reference: {
            type: referenceType,
            rel: referenceRel,
            at : at,
            atRel : atRel,
            forV : forV ? forV : null
        }, 
        against: against,
        due : parseFloat(due)
    };

    ledgerData.transactions.push(newTransaction);
    await ledgerData.save();

    // Return the ObjectId of the newly pushed transaction
    return newTransaction._id;
}


module.exports = newEntry  