const express = require('express');
const Route = express.Router();
const getLedger = require('../../custom_modules/accounts/getLedgers');
const {getPrintNumber, updatePrintNumber} = require('../../custom_modules/serialCalculator');
const ledgerSchema = require('../../models/masters/ledgers');
const contraSchema = require('../../models/accounts/contra');
const newEntry = require('../../custom_modules/accounts/newEntry');
const removeEntry = require('../../custom_modules/accounts/removeEntry');

Route.get("/accounts/contra", async(req, res) => {
    const db = req.dbConnection;
    const bankLedger = await getLedger(db, "bankaccount");
    const cashLedger = await getLedger(db, "cashinhand");
    const ledgerData = bankLedger.concat(cashLedger);
    const printNumber = await getPrintNumber(db,  req.user, "contraCALC");
    const contra = db.model('contras', contraSchema);
    const contraData = await contra.find({}).sort({voucherNumber: -1}).populate({
        path: "drEntry",
        populate: {
          path: "ledger"
        }
      }).populate({
        path: "crEntry",
        populate: {
          path: "ledger"
        }
      })
    res.render("accounts/contra", {ledgerData , printNumber, contraData});
})

Route.post("/accounts/contra/new", async(req, res) => { 
    const db = req.dbConnection;
    const ledgers = db.model('ledgers', ledgerSchema);
    const contra = db.model('contras', contraSchema);
    const session = await db.startSession();
    try {
    session.startTransaction();
    const {voucherNumber, date, ledgerCR, chNumberCR, amountCR, ledgerDR, chNumberDR, amountDR} = req.body;
    //converting non array to array
    const ledgerCRArray = Array.isArray(ledgerCR) ? ledgerCR : [ledgerCR];
    const chNumberCRArray = Array.isArray(chNumberCR) ? chNumberCR : [chNumberCR];
    const amountCRArray = Array.isArray(amountCR) ? amountCR : [amountCR];
    const ledgerDRArray = Array.isArray(ledgerDR) ? ledgerDR : [ledgerDR];
    const chNumberDRArray = Array.isArray(chNumberDR) ? chNumberDR : [chNumberDR];
    const amountDRArray = Array.isArray(amountDR) ? amountDR : [amountDR];

    //form validation
    if(ledgerCRArray.length !== chNumberCRArray.length || ledgerCRArray.length !== amountCRArray.length || ledgerDRArray.length !== chNumberDRArray.length || ledgerDRArray.length !== amountDRArray.length) {
        await session.abortTransaction();
        return res.status(400).send({message: "Invalid form data"});
    }
    let totalAmountCR = 0;
    let totalAmountDR = 0;
    for(let i = 0; i < ledgerCRArray.length; i++) {
        totalAmountCR += parseFloat(amountCRArray[i]);
    }
    for(let i = 0; i < ledgerDRArray.length; i++) {
        totalAmountDR += parseFloat(amountDRArray[i]);
    }
    if(totalAmountCR !== totalAmountDR) {
        await session.abortTransaction();
        return res.status(400).send({message: "Debit and Credit amount are not equal"});
    }

    // form validations done... creating the contra voucher
    const newVoucherNumber = await updatePrintNumber(db, session, req.user, "contraCALC", voucherNumber);

    //constructing drArray
    const drEntry = [];
    for(let i = 0; i < ledgerDRArray.length; i++) {
        drEntry.push({
            chNumber : chNumberDRArray[i],
            ledger : ledgerDRArray[i],
            amount : amountDRArray[i],
            transactionID : null
        })
    }
    //constructing crArray
    const crEntry = [];
    for(let i = 0; i < ledgerCRArray.length; i++) {
        crEntry.push({
            chNumber : chNumberCRArray[i],
            ledger : ledgerCRArray[i],
            amount : amountCRArray[i],
            transactionID : null
        })
    }

    const newContra = new contra({
        voucherNumber : newVoucherNumber,
        fy : req.user.financialYear,
        date,
        drEntry,
        crEntry
    })

   const contraData = await newContra.save({session});
    
    //creating new dr entries
    let drTransactionID = [];
    let drAgainst = []; //used in cr entries
    for(let i = 0; i < drEntry.length; i++) {
       const id = await newEntry(db, session, ledgerDRArray[i], date, req.user.fy, "dr", drEntry[i].amount, "narration", "contra", contraData._id, [], "contra", contraData._id);
         drTransactionID.push(id);
            drAgainst.push({
                ledger : ledgerDRArray[i],
                transactionID : id
            })

    }
    //creating new cr entries
    let crTransactionID = [];
    let crAgainst = []; //used in dr entries
    for(let i = 0; i < crEntry.length; i++) {
        const id = await newEntry(db, session, ledgerCRArray[i], date, req.user.fy, "cr", crEntry[i].amount, "narration", "contra", contraData._id, drAgainst, "contra", contraData._id);
        crTransactionID.push(id);
        crAgainst.push({
            ledger : ledgerCRArray[i],
            transactionID : id
        })
    }

    //finding dr transactions and updating the against field
    for(let i = 0; i < drTransactionID.length; i++) {
        const ledgerData = await ledgers.findById(ledgerDRArray[i]).session(session);
        const transactionIndex = ledgerData.transactions.findIndex(transaction => transaction._id.toString() === drTransactionID[i].toString());
        ledgerData.transactions[transactionIndex].against = crAgainst;
        await ledgerData.save();
    }

    //updating transactionID in contra
    for(let i = 0; i < drTransactionID.length; i++) {
        contraData.drEntry[i].transactionID = drTransactionID[i];
    }
    for(let i = 0; i < crTransactionID.length; i++) {
        contraData.crEntry[i].transactionID = crTransactionID[i];
    }
    await contraData.save({session});
    await session.commitTransaction();
    return res.status(200).send({message: "Contra Voucher Created"});
    } catch(err) {
        console.log(err);
        await session.abortTransaction();
        return res.sendStatus(500);
    } finally {
        session.endSession()
    }
})

Route.get("/accounts/contra/edit", async(req, res) => {
    const db = req.dbConnection;
    const contra = db.model('contras', contraSchema);

    const data = await contra.findById(req.query.id).populate({
        path: "drEntry",
        populate: {
          path: "ledger"
        }
      }).populate({
        path: "crEntry",
        populate: {
          path: "ledger"
        }
      })
    res.status(200).send(data);
 })

 Route.post("/accounts/contra/edit", async(req, res) => {
    const db = req.dbConnection;
    const ledgers = db.model('ledgers', ledgerSchema);
    const contra = db.model('contras', contraSchema);
    const session = await db.startSession();
    try {
    session.startTransaction();
    const {editID, voucherNumber, date, ledgerCR, chNumberCR, amountCR, ledgerDR, chNumberDR, amountDR} = req.body;
    //converting non array to array
    const ledgerCRArray = Array.isArray(ledgerCR) ? ledgerCR : [ledgerCR];
    const chNumberCRArray = Array.isArray(chNumberCR) ? chNumberCR : [chNumberCR];
    const amountCRArray = Array.isArray(amountCR) ? amountCR : [amountCR];
    const ledgerDRArray = Array.isArray(ledgerDR) ? ledgerDR : [ledgerDR];
    const chNumberDRArray = Array.isArray(chNumberDR) ? chNumberDR : [chNumberDR];
    const amountDRArray = Array.isArray(amountDR) ? amountDR : [amountDR];

    //form validation
    if(ledgerCRArray.length !== chNumberCRArray.length || ledgerCRArray.length !== amountCRArray.length || ledgerDRArray.length !== chNumberDRArray.length || ledgerDRArray.length !== amountDRArray.length) {
        await session.abortTransaction();
        return res.status(400).send({message: "Invalid form data"});
    }
    let totalAmountCR = 0;
    let totalAmountDR = 0;
    for(let i = 0; i < ledgerCRArray.length; i++) {
        totalAmountCR += parseFloat(amountCRArray[i]);
    }
    for(let i = 0; i < ledgerDRArray.length; i++) {
        totalAmountDR += parseFloat(amountDRArray[i]);
    }
    if(totalAmountCR !== totalAmountDR) {
        await session.abortTransaction();
        return res.status(400).send({message: "Debit and Credit amount are not equal"});
    }

    // reversing all old transactions
    const oldContra = await contra.findById(editID).session(session);
    //removing dr transactions
    for(let i = 0; i < oldContra.drEntry.length; i++) {
        await removeEntry(db, session, oldContra.drEntry[i].ledger, oldContra.drEntry[i].transactionID);
    }

    //removing cr transactions
    for(let i = 0; i < oldContra.crEntry.length; i++) {
        await removeEntry(db, session, oldContra.crEntry[i].ledger, oldContra.crEntry[i].transactionID);
    }

    //removing contra transactions
    oldContra.drEntry = [];
    oldContra.crEntry = [];
    await oldContra.save({session});
    //updating date in contra entry
    oldContra.date = date;
    await oldContra.save({session});
    //constructing drArray
    const drEntry = [];
    for(let i = 0; i < ledgerDRArray.length; i++) {
        drEntry.push({
            chNumber : chNumberDRArray[i],
            ledger : ledgerDRArray[i],
            amount : amountDRArray[i],
            transactionID : null
        })
    }
    //constructing crArray
    const crEntry = [];
    for(let i = 0; i < ledgerCRArray.length; i++) {
        crEntry.push({
            chNumber : chNumberCRArray[i],
            ledger : ledgerCRArray[i],
            amount : amountCRArray[i],
            transactionID : null
        })
    }
     
    //updating constructed dr and cr arrays in contra
    oldContra.drEntry = drEntry;
    oldContra.crEntry = crEntry;
    await oldContra.save({session});
    // dr transactions
    let drTransactionID = [];
    let drAgainst = []; //used in cr entries
    for(let i = 0; i < drEntry.length; i++) {
       const id = await newEntry(db, session, ledgerDRArray[i], date, req.user.fy, "dr", drEntry[i].amount, "narration", "contra", oldContra._id, [], "contra", oldContra._id);
         drTransactionID.push(id);
            drAgainst.push({
                ledger : ledgerDRArray[i],
                transactionID : id
            })

    }
    //creating new cr entries
    let crTransactionID = [];
    let crAgainst = []; //used in dr entries
    for(let i = 0; i < crEntry.length; i++) {
        const id = await newEntry(db, session, ledgerCRArray[i], date, req.user.fy, "cr", crEntry[i].amount, "narration", "contra", oldContra._id, drAgainst, "contra", oldContra._id);
        crTransactionID.push(id);
        crAgainst.push({
            ledger : ledgerCRArray[i],
            transactionID : id
        })
    }
    //finding dr transactions and updating the against field
    for(let i = 0; i < drTransactionID.length; i++) {
        const ledgerData = await ledgers.findById(ledgerDRArray[i]).session(session);
        const transactionIndex = ledgerData.transactions.findIndex(transaction => transaction._id.toString() === drTransactionID[i].toString());
        ledgerData.transactions[transactionIndex].against = crAgainst;
        await ledgerData.save();
    }

    //updating transactionID in contra
    for(let i = 0; i < drTransactionID.length; i++) {
        oldContra.drEntry[i].transactionID = drTransactionID[i];
    }
    for(let i = 0; i < crTransactionID.length; i++) {
        oldContra.crEntry[i].transactionID = crTransactionID[i];
    }

    await oldContra.save({session});
    await session.commitTransaction();
    return res.status(200).send({message: "Contra Voucher Updated"});


} catch(err) {
    console.log(err);
    await session.abortTransaction();
    return res.sendStatus(500);
}
finally {
    session.endSession()
}

 })

 Route.get("/accounts/contra/delete", async(req, res) => {
    const db = req.dbConnection;
    const contra = db.model('contras', contraSchema);
    const session = await db.startSession();
    try {
    session.startTransaction();
    const data = await contra.findById(req.query.id).session(session);
    //removing dr transactions
    for(let i = 0; i < data.drEntry.length; i++) {
        await removeEntry(db, session, data.drEntry[i].ledger, data.drEntry[i].transactionID);
    }
    //removing cr transactions
    for(let i = 0; i < data.crEntry.length; i++) {
        await removeEntry(db, session, data.crEntry[i].ledger, data.crEntry[i].transactionID);
    }
    //removing contra transactions
    await data.remove({session});
    await session.commitTransaction();
    return res.status(200).send({message: "Contra Voucher Deleted"});
    } catch(err) {
        console.log(err);
        await session.abortTransaction();
        return res.sendStatus(500);
    }
    finally {
        session.endSession()
    }
    
  })
module.exports = Route;