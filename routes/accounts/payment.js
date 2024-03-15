const express = require('express');
const Route = express.Router();
const { getPrintNumber, updatePrintNumber } = require("../../custom_modules/serialCalculator");
const getLedgers = require("../../custom_modules/accounts/getLedgers");
const ledgerSchema = require("../../models/masters/ledgers");
const fiSchema = require("../../models/transactions/accounts/freight-invoice")
const fmSchema = require("../../models/transactions/accounts/freight-memo");
const receiptSchema = require("../../models/accounts/reciepts");
const paymentSchema = require("../../models/accounts/payments");
const contraSchema = require("../../models/accounts/contra");
const journalSchema = require("../../models/accounts/journal");
const branchSchema = require("../../models/masters/locations/branch");
const newSchema = require("../../models/accounts/new");
const newEntry = require("../../custom_modules/accounts/newEntry");
const removeEntry = require("../../custom_modules/accounts/removeEntry");
const mongoose = require("mongoose");
const findByIdOrNull = require("../../custom_modules/findByIdOrNull")
const dcSchema = require("../../models/transactions/delivery/delivery-challan");
const ccSchema = require("../../models/transactions/delivery/crossing-challan")
const lcSchema = require("../../models/transactions/bookings/local-collection-challan")
Route.get("/accounts/payments", async (req, res) => {
    const db = req.dbConnection;
    const printNumber = await getPrintNumber(db, req.user, "paymentCALC");
    const ledger = db.model("ledgers", ledgerSchema);
    const branch = db.model("branches", branchSchema);
    const payment = db.model("payment-vouchers", paymentSchema);
    let ledgerData = await ledger.find({});
    const cashinhand = await getLedgers(db, "cashinhand");
    const bankAccounts = await getLedgers(db, "bankaccount");
    const lorryHireCreditors = await getLedgers(db, "lorryhire(creditors)");
    const indirectExpenses = await getLedgers(db, "indirectexpenses");
    const branchData = await branch.find({});
    let lorryHireDataID = []
    for (const data of branchData) {
        if (data.balanceLorryHire) {
            lorryHireDataID.push(data.balanceLorryHire)
        }
        if (data.advanceLorryHire) {
            lorryHireDataID.push(data.advanceLorryHire)
        }
    }

    let lorryHireData = []
    //finding ledgers in lorryHireData
    for (const data of lorryHireDataID) {
        const info = await ledger.findById(data);
        lorryHireData.push(info);
    }
    //removing cashinhand, bank account, lorry hire creditors from ledgerData
    for (const data of cashinhand) {
        const found = ledgerData.find(ledger => ledger.id === data.id);
        ledgerData.splice(ledgerData.indexOf(found), 1);
    }
    for (const data of bankAccounts) {
        const found = ledgerData.find(ledger => ledger.id === data.id);
        ledgerData.splice(ledgerData.indexOf(found), 1);
    }
    for (const data of lorryHireCreditors) {
        const found = ledgerData.find(ledger => ledger.id === data.id);
        ledgerData.splice(ledgerData.indexOf(found), 1);
    }
    for (const data of indirectExpenses) {
        const found = ledgerData.find(ledger => ledger.id === data.id);
        ledgerData.splice(ledgerData.indexOf(found), 1);
    }



    let constructedLedgerData = ledgerData.map(data => {
        return {
            _id: data.id,
            name: data.name,
            type: "null"
        }
    })
    let constructedCashinhand = cashinhand.map(data => {
        return {
            _id: data.id,
            name: data.name,
            type: "cashinhand"
        }
    })
    let constructedBankAccounts = bankAccounts.map(data => {
        return {
            _id: data.id,
            name: data.name,
            type: "bankaccount"
        }
    }
    )
    let constructedLorryHireData = lorryHireData.map(data => {
        return {
            _id: data.id,
            name: data.name,
            type: "lorryhire"
        }
    }
    )

    let constructedIndirectExpenses = indirectExpenses.map(data => {
        return {
            _id: data.id,
            name: data.name,
            type: "indirectexpenses"
        }
    })

    ledgerData = constructedLedgerData.concat(constructedLorryHireData, constructedIndirectExpenses);


    // merging cashinhand and bankaccounts in paymentData
    let paymentData = constructedCashinhand.concat(constructedBankAccounts);
    const paymentVoucherData = await payment.find({ fy: req.user.financialYear }).populate({
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
    res.render("accounts/payment", { printNumber, ledgerData, paymentData, paymentVoucherData })
})

Route.get("/accounts/payments/get-details", async (req, res) => {
    const db = req.dbConnection;
    const fm = db.model("freight-memos", fmSchema);
    const dc = db.model("delivery-challans", dcSchema);
    const cc = db.model("crossing-challans", ccSchema)
    const lc = db.model("local-collection-challans", lcSchema)
    const ledger = db.model("ledgers", ledgerSchema);
    if (req.query.type == "lorryhire") {
        const subLedgers = await ledger.find({ brokerLedger: true })
        const data = subLedgers.map(data => {
            return {
                _id: data.id,
                name: data.name
            }
        })
        res.status(200).send(data);

    } else if (req.query.type === "indirectexpenses") {
        const ledgerData = await ledger.findById(req.query.id);
        const subLedgerData = await ledger.find({ _id: { $in: ledgerData.subLedgers } })
        const data = subLedgerData.map(data => {
            return {
                _id: data.id,
                name: data.name
            }
        })
        res.status(200).send(data);
    } else {
        const ledgerData = await ledger.findById(req.query.id);
        let refDone = []
        let referenceData = []
        let netBalance = 0
        for (const data of ledgerData.transactions) {
            const done = refDone.includes(data.reference.rel);
            if (!done && data.reference.type !== "onAccount") {
                const filtered = await ledgerData.transactions.filter(transaction => transaction.reference.rel == data.reference.rel);
                let totalDr = 0;
                let totalCr = 0;
                for (const data of filtered) {
                    if (data.type == "dr") {
                        totalDr += data.amount;
                    } else {
                        totalCr += data.amount;
                    }
                }

                if (totalCr > totalDr) {
                    if (data.reference.type == "freightMemo") {
                        const fmData = await fm.findById(data.reference.rel);
                        referenceData.push({
                            _id: data.reference.rel,
                            name: fmData.number,
                            balance: totalCr - totalDr
                        })
                    } else if(data.reference.type == "deliveryChallan") {
                        const dcData = await dc.findById(data.reference.rel);
                        referenceData.push({
                            _id: data.reference.rel,
                            name: dcData.number,
                            balance: totalCr - totalDr
                        })
                    
                    } else if(data.reference.type == "crossingChallan")  {
                        const ccData = await cc.findById(data.reference.rel)
                        referenceData.push({
                            _id: data.reference.rel,
                            name: ccData.number,
                            balance: totalCr - totalDr
                        })
                    } else if(data.reference.type == "localCollectionChallan") { 
                        const lcData = await lc.findById(data.reference.rel)
                        referenceData.push({
                            _id: data.reference.rel,
                            name: lcData.number,
                            balance: totalCr - totalDr
                        })
                    } else {
                        const newM = db.model("new-references", newSchema);
                        const data1 = await newM.findById(data.reference.rel);
                        console.log(data1);
                        referenceData.push({
                            rel: data.reference.rel,
                            display: data1.number,
                            netBalance: totalCr - totalDr
                        })
                    }
                }
                refDone.push(data.reference.rel);
                netBalance = totalDr - totalCr;
            }
        }
        return res.status(200).send({ netBalance, referenceData });
    }
})
Route.get("/accounts/payments/get-sub-ledger-details", async (req, res) => {
    const db = req.dbConnection;
    const ledger = db.model("ledgers", ledgerSchema);
    const fm = db.model("freight-memos", fmSchema);
    const branch = db.model("branches", branchSchema);
    const dc = db.model("delivery-challans", dcSchema);
    const cc= db.model("crossing-challans", ccSchema)
    const lc = db.model("local-collection-challans", lcSchema)
    const { id, main } = req.query;
    const mainLedger = await ledger.findById(main);
    const subLedger = await ledger.findById(id);
    if (req.query.forV === "lorryhire") {
        const branchData1 = await branch.find({ advanceLorryHire: main });
        const branchData2 = await branch.find({ balanceLorryHire: main });
        let type = null;
        if (branchData1.length > 0) {
            type = "advanceLorryHire";
        } else if (branchData2.length > 0) {
            type = "balanceLorryHire";
        }

        const filtered = mainLedger.transactions.filter(data => data.reference.at === "freightMemo" || data.reference.at === "deliveryChallan" || data.reference.at === "localCollectionChallan" || data.reference.at === "crossingChallan");
        
        let subLedgerTransactions = []
        for (const data of filtered) {
            const fmData = await fm.findById(data.reference.rel);
            const dcData = await dc.findById(data.reference.rel);
            const ccData = await cc.findById(data.reference.rel);
            const lcData = await lc.findById(data.reference.rel);
            console.log(lcData)
            if (fmData && fmData.accountToLedger == id) {
                subLedgerTransactions.push(data);
            }
            if (dcData && dcData.accountToLedger == id) {
                subLedgerTransactions.push(data);
            }
            if(ccData && ccData.transporterLedger == id) {
                subLedgerTransactions.push(data)
            }
            if(lcData && lcData.accountToLedger == id) {
                subLedgerTransactions.push(data)
            }
        }

        let referenceData = []
        let totalBalance = await subLedgerTransactions.reduce((acc, data) => {
            return acc + data.amount;
        }
            , 0);

        for (const data of subLedgerTransactions) {
            let netRefBalance = data.amount;
            const filtered1 = subLedger.transactions.filter(transaction => transaction.reference.rel == data.reference.rel);
            for (const data of filtered1) {
                for (i = 0; i < data.against.length; i++) {
                    const branchData11 = await branch.findOne({ advanceLorryHire: data.against[i].ledger });
                    const branchData22 = await branch.findOne({ balanceLorryHire: data.against[i].ledger });
                    if (branchData11 && branchData11.length > 0) {
                        type = "advanceLorryHire";

                    } else if (branchData22 && branchData22.length > 0) {
                        type = "balanceLorryHire";
                    }
                }
                if (type === data.reference.forV) {
                    if (data.type == "dr") {
                        netRefBalance -= data.amount;
                        totalBalance -= data.amount;
                    } else {
                        netRefBalance += data.amount;
                        totalBalance += data.amount;
                    }
                }
            }
            const fmData = await fm.findById(data.reference.rel);
            const dcData = await dc.findById(data.reference.rel);
            const lcData = await lc.findById(data.reference.rel);
            const ccData = await cc.findById(data.reference.rel);
            let display = null
            if(fmData) {
                display = fmData.number
            }
            if(ccData) {
                display = ccData.number
            }
            if(lcData) {
                display = lcData.number
            }
            if(dcData) {
                display = dcData.number
            }
            if (netRefBalance > 0) {
                referenceData.push({
                    value: data.reference.rel,
                    display: display,
                    netBalance: netRefBalance
                })
            }


        }
        return res.status(200).send({ totalBalance, referenceData });
    } else if (req.query.forV === "indirectexpenses") {
        const filtered = mainLedger.transactions.filter(data => data.reference.at === "indirectExpenses");
        let subLedgerTransactions = []
        for (const data of filtered) {
            if (data.reference.atRel == id) {
                subLedgerTransactions.push(data);
            }
        }

        let referenceData = []
        let totalBalance = subLedgerTransactions.reduce((acc, data) => {
            return acc + data.amount;
        }
            , 0);

        for (const data of subLedgerTransactions) {
            let netRefBalance = data.amount;
            const filtered1 = subLedger.transactions.filter(transaction => transaction.reference.rel == data.reference.rel);
            for (const data of filtered1) {
                if (data.type == "dr") {
                    netRefBalance -= data.amount;
                    totalBalance -= data.amount;
                } else {
                    netRefBalance += data.amount;
                    totalBalance += data.amount;
                }
            }
            const fmData = await fm.findById(data.reference.rel);
            if (netRefBalance > 0) {
                referenceData.push({
                    value: data.reference.rel,
                    display: fmData.number,
                    netBalance: netRefBalance
                })
            }


        }
        return res.status(200).send({ totalBalance, referenceData });
    }

})

Route.post("/accounts/payments/new", async (req, res) => {
    const db = req.dbConnection;
    const ledger = db.model("ledgers", ledgerSchema);
    const fi = db.model("freight-invoices", fiSchema);
    const fm = db.model("freight-memos", fmSchema);
    const reciept = db.model("reciept-vouchers", receiptSchema);
    const payment = db.model("payment-vouchers", paymentSchema);
    const journal = db.model("journal-vouchers", journalSchema);
    const contra = db.model("contras", contraSchema);
    const newM = db.model("new-references", newSchema);
    const branch = db.model("branches", branchSchema);
    const dc = db.model("delivery-challans", dcSchema);
    const cc = db.mode("crossing-challans", ccSchema);
    const lc = db.model("local-collection-challans", lcSchema)
    const session = await db.startSession();
    try {
        session.startTransaction();
        const { voucherNumber, date, primaryLedger, chNumber } = req.body
        const ledgerDR = req.body.ledgerCR;
        const referenceTypeDR = req.body.referenceTypeCr;
        const referenceNumberDR = req.body.referenceNumberCR;
        const amountDR = req.body.amountCr;
        const recievedAmtDR = req.body.recievedAmtCr;
        const ledgerCR = req.body.ledgerDR;
        const referenceTypeCR = req.body.referenceTypeDr;
        const referenceNumberCR = req.body.referenceNumberDR;
        const amountCR = req.body.amountDr;
        const recievedAmtCR = req.body.recievedAmtDr;

        //converting all non array fields to array
        const ledgerDRArray = Array.isArray(ledgerDR) ? ledgerDR : [ledgerDR];
        const referenceTypeDRArray = Array.isArray(referenceTypeDR) ? referenceTypeDR : [referenceTypeDR];
        const referenceNumberDRArray = Array.isArray(referenceNumberDR) ? referenceNumberDR : [referenceNumberDR];
        const amountDRArray = Array.isArray(amountDR) ? amountDR : [amountDR];
        const recievedAmtDRArray = Array.isArray(recievedAmtDR) ? recievedAmtDR : [recievedAmtDR];
        const ledgerCRArray = Array.isArray(ledgerCR) ? ledgerCR : [ledgerCR];
        const referenceTypeCRArray = Array.isArray(referenceTypeCR) ? referenceTypeCR : [referenceTypeCR];
        const referenceNumberCRArray = Array.isArray(referenceNumberCR) ? referenceNumberCR : [referenceNumberCR];
        const amountCRArray = Array.isArray(amountCR) ? amountCR : [amountCR];
        const recievedAmtCRArray = Array.isArray(recievedAmtCR) ? recievedAmtCR : [recievedAmtCR];
        const chNumberArray = Array.isArray(chNumber) ? chNumber : [chNumber];
        const primaryLedgerArray = Array.isArray(primaryLedger) ? primaryLedger : [primaryLedger];

        //construction of drArray
        let drArray = []
        for (let i = 0; i < ledgerDRArray.length; i++) {
            drArray.push({
                primaryLedger: primaryLedgerArray[i],
                chNumber: null,
                ledger: ledgerDRArray[i],
                referenceType: referenceTypeDRArray[i],
                referenceNumber: referenceNumberDRArray[i],
                amount: recievedAmtDRArray[i],
            })
        }

        //construction of crArray
        let crArray = []
        for (let i = 0; i < ledgerCRArray.length; i++) {
            crArray.push({
                primaryLedger: primaryLedgerArray[i],
                chNumber: chNumberArray[i],
                ledger: ledgerCRArray[i],
                referenceType: referenceTypeCRArray[i],
                referenceNumber: referenceNumberCRArray[i],
                amount: recievedAmtCRArray[i],
            })
        }

        const newVoucherNumber = await updatePrintNumber(db, session, req.user, "paymentCALC", voucherNumber);
        //creating new payment voucher
        const newPayment = new payment({
            voucherNumber: newVoucherNumber,
            fy: req.user.financialYear,
            date,
            drEntry: drArray,
            crEntry: crArray
        })

        const paymentVoucherData = await newPayment.save({ session });

        // dr transactions
        let drAgainst = [] // used in cr transactions
        let refNumberArray = []
        for (i = 0; i < ledgerDRArray.length; i++) {
            let refToLink = null;

            if (referenceTypeDRArray[i] == "against") {
                const fiData = await fi.findById(referenceNumberDRArray[i]);
                const fmData = await fm.findById(referenceNumberDRArray[i]);
                const recieptData = await reciept.findById(referenceNumberDRArray[i]);
                const paymentData = await payment.findById(referenceNumberDRArray[i]);
                const contraData = await contra.findById(referenceNumberDRArray[i]);
                const journalData = await journal.findById(referenceNumberDRArray[i]);
                const newM = db.model("new-references", newSchema);
                const newData = await newM.findById(referenceNumberDRArray[i]);
                const dcData = await dc.findById(referenceNumberDRArray[i]);
                const ccData = await cc.findById(referenceNumberDRArray[i]);
                const lcData = await lc.findById(referenceNumberDRArray[i]);
                if (fiData) {
                    refToLink = "freightInvoice";
                }
                if (fmData) {
                    refToLink = "freightMemo";
                }
                if (dcData) {
                    refToLink = "deliveryChallan";
                }
                if (ccData) {
                    refToLink = "crossingChallan";
                }
                if (lcData) {
                    refToLink = "localCollectionChallan";
                }
                if (recieptData) {
                    refToLink = "reciept";
                }
                if (paymentData) {
                    refToLink = "payment";
                }
                if (contraData) {
                    refToLink = "contra";
                }
                if (journalData) {
                    refToLink = "journal";
                }
                if (newData) {
                    refToLink = "new";
                }

            } else if (referenceTypeDRArray[i] == "new") {
                refToLink = "new";
            } else if (referenceTypeDRArray[i] == "onAccount") {
                refToLink = "onAccount";
            } else if (referenceTypeDRArray[i] == "payment") {
                refToLink = "payment";
            }
            let forV = null;
            if (primaryLedgerArray[i] !== ledgerDRArray[i]) {
                const branchData1 = await branch.findOne({ advanceLorryHire: primaryLedgerArray[i] });
                const branchData2 = await branch.findOne({ balanceLorryHire: primaryLedgerArray[i] });
                if (branchData1) {
                    forV = "advanceLorryHire";
                } else if (branchData2) {
                    forV = "balanceLorryHire";
                }
            }


            if (referenceTypeDRArray[i] == "new") {
                const newRef = new newM({
                    date: date,
                    ledger: ledgerDRArray[i],
                    primaryLedger: primaryLedgerArray[i],
                    number: referenceNumberDRArray[i],
                    amount: amountDRArray[i],
                    reference: {
                        type: "payment",
                        rel: paymentVoucherData._id
                    }
                })
                const newRefData = await newRef.save({ session });
                const id = await newEntry(db, session, ledgerDRArray[i], date, req.user.financialYear, "dr", recievedAmtDRArray[i], `narration`, "new", newRefData._id, [], "payment", paymentVoucherData._id, primaryLedgerArray[i], forV);
                drAgainst.push({ ledger: ledgerDRArray[i], transactionID: id });
                refNumberArray.push(newRefData._id);
            } else {
                const id = await newEntry(db, session, ledgerDRArray[i], date, req.user.financialYear, "dr", recievedAmtDRArray[i], `narration`, refToLink, referenceNumberDRArray[i], [], "payment", paymentVoucherData._id, primaryLedgerArray[i], forV);
                drAgainst.push({ ledger: ledgerDRArray[i], transactionID: id });
                refNumberArray.push(referenceNumberDRArray[i]);

            }
        }

        // cr transactions
        let crAgainst = [] // used in dr transactions
        let refNumberArrayCR = []
        for (i = 0; i < ledgerCRArray.length; i++) {
            let refToLink = null;
            if (referenceTypeDRArray[i] == "against") {
                const fiData = await fi.findById(referenceNumberDRArray[i]);
                const fmData = await fm.findById(referenceNumberDRArray[i]);
                const recieptData = await reciept.findById(referenceNumberDRArray[i]);
                const paymentData = await payment.findById(referenceNumberDRArray[i]);
                const contraData = await contra.findById(referenceNumberDRArray[i]);
                const journalData = await journal.findById(referenceNumberDRArray[i]);
                const newM = db.model("new-references", newSchema);
                const newData = await newM.findById(referenceNumberDRArray[i]);
                const dcData = await dc.findById(referenceNumberDRArray[i]);
                const ccData = await cc.findById(referenceNumberDRArray[i]);
                const lcData = await lc.findById(referenceNumberDRArray[i]);
                if (fiData) {
                    refToLink = "freightInvoice";
                }
                if (fmData) {
                    refToLink = "freightMemo";
                }
                if (dcData) {
                    refToLink = "deliveryChallan";
                }
                if (ccData) {
                    refToLink = "crossingChallan";
                }
                if (lcData) {
                    refToLink = "localCollectionChallan";
                }

                if (recieptData) {
                    refToLink = "reciept";
                }
                if (paymentData) {
                    refToLink = "payment";
                }
                if (contraData) {
                    refToLink = "contra";
                }
                if (journalData) {
                    refToLink = "journal";
                }
                if (newData) {
                    refToLink = "new";
                }
            } else if (referenceTypeDRArray[i] == "new") {
                refToLink = "new";
            } else if (referenceTypeDRArray[i] == "onAccount") {
                refToLink = "onAccount";
            } else if (referenceTypeDRArray[i] == "payment") {
                refToLink = "payment";
            }

            if (referenceTypeCRArray[i] == "new") {
                const newRef = new newM({
                    date: date,
                    ledger: ledgerCRArray[i],
                    primaryLedger: primaryLedgerArray[i],
                    number: referenceNumberCRArray[i],
                    amount: amountCRArray[i],
                    reference: {
                        type: "payment",
                        rel: paymentVoucherData._id
                    }
                })
                const newRefData = await newRef.save({ session });
                const id = await newEntry(db, session, ledgerCRArray[i], date, req.user.financialYear, "cr", recievedAmtCRArray[i], `narration`, "new", newRefData._id, drAgainst, "payment", paymentVoucherData._id, primaryLedgerArray[i]);
                crAgainst.push({ ledger: ledgerCRArray[i], transactionID: id });
                refNumberArrayCR.push(newRefData._id);
            } else {
                const id = await newEntry(db, session, ledgerCRArray[i], date, req.user.financialYear, "cr", recievedAmtCRArray[i], `narration`, refToLink, referenceNumberCRArray[i], drAgainst, "payment", paymentVoucherData._id, primaryLedgerArray[i]);
                crAgainst.push({ ledger: ledgerCRArray[i], transactionID: id });
                refNumberArrayCR.push(referenceNumberCRArray[i]);
            }
        }

        //updating dr transactions with cr transactions
        for (const data of drAgainst) {
            const ledgerData = await ledger.findById(data.ledger).session(session);
            const transaction = ledgerData.transactions.id(data.transactionID);
            transaction.against = crAgainst;
            await ledgerData.save();
        }

        //updating chNumber in cr transactions
        for (const data of crAgainst) {
            const ledgerData = await ledger.findById(data.ledger).session(session);
            const transaction = ledgerData.transactions.id(data.transactionID);
            transaction.chNumber = chNumberArray[crAgainst.indexOf(data)];
            await ledgerData.save();
        }

        //updating dr transaction ID in payment voucher
        for (i = 0; i < drAgainst.length; i++) {
            paymentVoucherData.drEntry[i].transactionID = drAgainst[i].transactionID;
            paymentVoucherData.drEntry[i].referenceNumber = refNumberArray[i];
            await paymentVoucherData.save();
        }
        //updating cr transaction ID in payment voucher
        for (i = 0; i < crAgainst.length; i++) {
            paymentVoucherData.crEntry[i].transactionID = crAgainst[i].transactionID;
            paymentVoucherData.crEntry[i].referenceNumber = refNumberArrayCR[i];
            await paymentVoucherData.save();
        }
        await session.commitTransaction();
        return res.sendStatus(200);


    } catch (err) {
        console.log(err);
        await session.abortTransaction();
        res.sendStatus(500);
    } finally {
        session.endSession();
    }
})

Route.get("/accounts/payments/edit", async (req, res) => {
    const db = req.dbConnection
    const ledger = db.model("ledgers", ledgerSchema)
    const paymentVoucherM = db.model("payment-vouchers", paymentSchema)
    const newRef = db.model("new-references", newSchema)
    const fm = db.model("freight-memos", fmSchema)
    const dc = db.model("delivery-challans", dcSchema)
    let data = await paymentVoucherM.findById(req.query.id).populate({
        path: "drEntry",
        populate: {
            path: "ledger"
        }
    }).populate({
        path: "crEntry",
        populate: {
            path: "ledger"
        }
    }).populate({
        path: "drEntry",
        populate: {
            path: "primaryLedger"
        }
    }).populate({
        path: "crEntry",
        populate: {
            path: "primaryLedger"
        }
    })
    //finding balance of each transactions reference
    let drEntryArray = []
    for (const info of data.drEntry) {
        if (info.referenceType == "against") {
            if (info.referenceNumber) {
                const fmData = await fm.findById(info.referenceNumber);
                const dcData = await dc.findById(info.referenceNumber);
                if (fmData || dcData) {
                    const ledgerData = await ledger.findById(info.ledger);
                    const found = ledgerData.transactions.find(transaction => transaction._id == info.transactionID);
                    const balance = await getFMReferenceBalance(db, info.ledger, info.referenceNumber, found.reference.forV);
                    const newObject = {
                        primaryLedger: info.primaryLedger._id,
                        primaryLedgerDisplay: info.primaryLedger.name,
                        ledger: info.ledger._id,
                        ledgerDisplay: info.ledger.name,
                        referenceType: info.referenceType,
                        referenceNumber: info.referenceNumber,
                        referenceNumberDisplay: fmData ? fmData.number : dcData.number,
                        balance: Math.abs(balance),
                        amount: info.amount,
                        chNumber: null
                    }
                    drEntryArray.push(newObject);
                } else {
                    const ledgerData = await ledger.findById(info.ledger)
                    const newData = await newRef.findById(info.referenceNumber);
                    const balance = await getReferenceBalance(ledgerData, info.referenceNumber);

                    const newObject = {
                        primaryLedger: info.primaryLedger._id,
                        primaryLedgerDisplay: info.primaryLedger.name,
                        ledger: info.ledger._id,
                        ledgerDisplay: info.ledger.name,
                        referenceType: info.referenceType,
                        referenceNumber: info.referenceNumber,
                        referenceNumberDisplay: newData.number,
                        balance: Math.abs(balance),
                        amount: info.amount,
                        chNumber: info.chNumber
                    }
                    drEntryArray.push(newObject);

                }
            }
        } else if (info.referenceType == "new") {
            const ledgerData = await ledger.findById(info.ledger);
            const newRefData = await newRef.findById(info.referenceNumber);
            const balance = await getReferenceBalance(ledgerData, info.referenceNumber);
            const newObject = {
                primaryLedger: info.primaryLedger._id,
                primaryLedgerDisplay: info.primaryLedger.name,
                ledger: info.ledger._id,
                ledgerDisplay: info.ledger.name,
                referenceType: info.referenceType,
                referenceNumber: info.referenceNumber,
                referenceNumberDisplay: newRefData.number,
                balance: Math.abs(balance),
                amount: info.amount,
                chNumber: info.chNumber
            }
            drEntryArray.push(newObject)

        } else if(info.referenceType == "onAccount") {
            const newObject = {
                
                primaryLedger: info.primaryLedger._id,
                primaryLedgerDisplay: info.primaryLedger.name,
                ledger: info.ledger._id,
                ledgerDisplay: info.ledger.name,
                referenceType: info.referenceType,
                referenceNumber: "N/A",
                referenceNumberDisplay: "N/A",
                balance: info.amount,
                amount: info.amount,
                chNumber: info.chNumber
            }
            drEntryArray.push(newObject)
        } else {
            const newObject = {
                
                primaryLedger: info.primaryLedger._id,
                primaryLedgerDisplay: info.primaryLedger.name,
                ledger: info.ledger._id,
                ledgerDisplay: info.ledger.name,
                referenceType: "N/A",
                referenceNumber: "N/A",
                referenceNumberDisplay: "N/A",
                balance: info.amount,
                amount: info.amount,
                chNumber: info.chNumber
            }
            drEntryArray.push(newObject)
        }
    }
    
    let crEntryArray = []
    //finding cr entry balance
    for (const info of data.crEntry) {
        info.balance = 0;
        if (info.referenceType === "new") {
          const ledgerData = await ledger.findById(info.ledger);
          const newRefData = await newRef.findById(info.referenceNumber);
          const balance = await getReferenceBalance(ledgerData, info.referenceNumber);
          const newObject = {
            primaryLedger: info.primaryLedger._id,
            primaryLedgerDisplay: info.primaryLedger.name,
            ledger: info.ledger._id,
            ledgerDisplay: info.ledger.name,
            referenceType: info.referenceType,
            referenceNumber: info.referenceNumber,
            referenceNumberDisplay: newRefData.number,
            balance: Math.abs(balance),
            amount: info.amount,
            chNumber : null
          }
          crEntryArray.push(newObject)
        } else if (info.referenceType === "against") {
          const ledgerData = await ledger.findById(info.ledger);
          const freightMemoData = await fm.findById(info.referenceNumber);
          const dcData = await dc.findById(info.referenceNumber);
          const balance = await getReferenceBalance(ledgerData, info.referenceNumber);
          let billNumber
          if (freightMemoData) {
            const newRefData = await newRef.findById(info.referenceNumber);
            billNumber = newRefData.number
          } else if(dcData) {
            billNumber = dcData.number
          
          } else {
            let billNumber = freightMemoData.number
          }
          const newObject = {
            primaryLedger: info.primaryLedger._id,
            primaryLedgerDisplay: info.primaryLedger.name,
            ledger: info.ledger._id,
            ledgerDisplay: info.ledger.name,
            referenceType: info.referenceType,
            referenceNumber: info.referenceNumber,
            referenceNumberDisplay: billNumber,
            balance: Math.abs(balance),
            amount: info.amount,
            chNumber : null
          }
          crEntryArray.push(newObject)
        } else if(info.referenceType === "onAccount") {
          const newObject = {
            primaryLedger: info.primaryLedger._id,
            primaryLedgerDisplay: info.primaryLedger.name,
            ledger: info.ledger._id,
            ledgerDisplay: info.ledger.name,
            referenceType: info.referenceType,
            referenceNumber: "N/A",
            referenceNumberDisplay: "N/A",
            balance: info.amount,
            amount: info.amount,
            chNumber : info.chNumber
          }
          crEntryArray.push(newObject)

        } else {
          const newObject = {
            primaryLedger: info.primaryLedger._id,
            primaryLedgerDisplay: info.primaryLedger.name,
            ledger: info.ledger._id,
            ledgerDisplay: info.ledger.name,
            referenceType: "N/A",
            referenceNumber: "N/A",
            referenceNumberDisplay: "N/A",
            balance: info.amount,
            amount: info.amount,
            chNumber : null
          }
          crEntryArray.push(newObject)
        }
      }
      return res.status(200).send({ data1: data, drEntry: crEntryArray, crEntry: drEntryArray })
})
async function getFMReferenceBalance(db, ledgerID, referenceID, forV) {
    const ledger = db.model("ledgers", ledgerSchema);
    const fm = db.model("freight-memos", fmSchema);
    const dc = db.model("delivery-challans", dcSchema);
    const cc = db.model("crossing-challans", dcSchema);
    const lc = db.model("local-collection-challans", dcSchema);

    const fmData = await fm.findById(referenceID)
    const dcData = await dc.findById(referenceID);
    const ccData = await cc.findById(referenceID);
    const lcData = await lc.findById(referenceID);

    let id = null
    if(fmData) {
        id = fmData.accountToLedger
    }
    if(dcData) {
        id = dcData.accountToLedger
    }
    if(ccData) {
        id = ccData.transporterLedger
    }
    if(lcData) {
        id = lcata.accountToLedger
    }


    const brokerLedgerData = await ledger.findById(id);
    const filtered = brokerLedgerData.transactions.filter(data => data.reference.rel == referenceID && data.reference.forV == forV);
    let totalFiltered = filtered.reduce((acc, data) => {
        return acc + parseFloat(data.amount);
    }, 0)
    const balance = fmData ? fmData.balance.amount : dcData.balance.amount; 
  return balance - totalFiltered
}

async function getReferenceBalance(ledgerData, referenceID) {



    try {
        let currentRefDr = 0
        let currentRefCr = 0
        for (j = 0; j < ledgerData.transactions.length; j++) {
            if (ledgerData.transactions[j].reference.rel == referenceID) {
                if (ledgerData.transactions[j].type == "dr") {
                    currentRefDr += ledgerData.transactions[j].amount
                } else {
                    currentRefCr += ledgerData.transactions[j].amount
                }
            }
        }
        let currrentRefNetBalance = currentRefDr - currentRefCr
        return currrentRefNetBalance

    } catch (err) {
        console.log(err)
        return false
    }


}

Route.post("/accounts/payments/edit", async (req, res) => {
    const db = req.dbConnection;
    const ledger = db.model("ledgers", ledgerSchema);
    const fi = db.model("freight-invoices", fiSchema);
    const fm = db.model("freight-memos", fmSchema);
    const reciept = db.model("reciept-vouchers", receiptSchema);
    const payment = db.model("payment-vouchers", paymentSchema);
    const journal = db.model("journal-vouchers", journalSchema);
    const contra = db.model("contras", contraSchema);
    const newM = db.model("new-references", newSchema);
    const branch = db.model("branches", branchSchema);
    const dc = db.model("delivery-challans", dcSchema);
    const session = await db.startSession();
    try {
        session.startTransaction();
        const { voucherNumber, date, primaryLedger, chNumber } = req.body
        const ledgerDR = req.body.ledgerCR;
        const referenceTypeDR = req.body.referenceTypeCr;
        const referenceNumberDR = req.body.referenceNumberCR;
        const amountDR = req.body.amountCr;
        const recievedAmtDR = req.body.recievedAmtCr;
        const ledgerCR = req.body.ledgerDR;
        const referenceTypeCR = req.body.referenceTypeDr;
        const referenceNumberCR = req.body.referenceNumberDR;
        const amountCR = req.body.amountDr;
        const recievedAmtCR = req.body.recievedAmtDr;

        //converting all non array fields to array
        const ledgerDRArray = Array.isArray(ledgerDR) ? ledgerDR : [ledgerDR];
        const referenceTypeDRArray = Array.isArray(referenceTypeDR) ? referenceTypeDR : [referenceTypeDR];
        const referenceNumberDRArray = Array.isArray(referenceNumberDR) ? referenceNumberDR : [referenceNumberDR];
        const amountDRArray = Array.isArray(amountDR) ? amountDR : [amountDR];
        const recievedAmtDRArray = Array.isArray(recievedAmtDR) ? recievedAmtDR : [recievedAmtDR];
        const ledgerCRArray = Array.isArray(ledgerCR) ? ledgerCR : [ledgerCR];
        const referenceTypeCRArray = Array.isArray(referenceTypeCR) ? referenceTypeCR : [referenceTypeCR];
        const referenceNumberCRArray = Array.isArray(referenceNumberCR) ? referenceNumberCR : [referenceNumberCR];
        const amountCRArray = Array.isArray(amountCR) ? amountCR : [amountCR];
        const recievedAmtCRArray = Array.isArray(recievedAmtCR) ? recievedAmtCR : [recievedAmtCR];
        const chNumberArray = Array.isArray(chNumber) ? chNumber : [chNumber];
        const primaryLedgerArray = Array.isArray(primaryLedger) ? primaryLedger : [primaryLedger];

        const oldPaymentVoucherData = await payment.findById(req.body.editID).session(session);
        //removing all transactions of the old payment voucher
        for (const data of oldPaymentVoucherData.drEntry) {
            await removeEntry(db, session, data.ledger, data.transactionID);
         }
        for (const data of oldPaymentVoucherData.crEntry) {
            await removeEntry(db, session, data.ledger, data.transactionID);
        }
        await oldPaymentVoucherData.save()

         oldPaymentVoucherData.drEntry = []
         oldPaymentVoucherData.crEntry = []
         await oldPaymentVoucherData.save()

          


        //construction of drArray
        let drArray = []
        for (let i = 0; i < ledgerDRArray.length; i++) {
            drArray.push({
                primaryLedger: primaryLedgerArray[i],
                chNumber: null,
                ledger: ledgerDRArray[i],
                referenceType: referenceTypeDRArray[i],
                referenceNumber: referenceNumberDRArray[i],
                amount: recievedAmtDRArray[i],
            })
        }

        //construction of crArray
        let crArray = []
        for (let i = 0; i < ledgerCRArray.length; i++) {
            crArray.push({
                primaryLedger: primaryLedgerArray[i],
                chNumber: chNumberArray[i],
                ledger: ledgerCRArray[i],
                referenceType: referenceTypeCRArray[i],
                referenceNumber: referenceNumberCRArray[i],
                amount: recievedAmtCRArray[i],
            })
        }



        // dr transactions
        let drAgainst = [] // used in cr transactions
        let refNumberArray = []
        for (i = 0; i < ledgerDRArray.length; i++) {
            let refToLink = null;

            if (referenceTypeDRArray[i] == "against") {
                const fiData = await fi.findById(referenceNumberDRArray[i]);
                const fmData = await fm.findById(referenceNumberDRArray[i]);
                const recieptData = await reciept.findById(referenceNumberDRArray[i]);
                const paymentData = await payment.findById(referenceNumberDRArray[i]);
                const contraData = await contra.findById(referenceNumberDRArray[i]);
                const journalData = await journal.findById(referenceNumberDRArray[i]);
                const newM = db.model("new-references", newSchema);
                const newData = await newM.findById(referenceNumberDRArray[i]);
                const dcData = await dc.findById(referenceNumberDRArray[i]);
                const ccData = await cc.findById(referenceNumberDRArray[i]);
                const lcData = await lc.findById(referenceNumberDRArray[i]);
                if (fiData) {
                    refToLink = "freightInvoice";
                }
                if (fmData) {
                    refToLink = "freightMemo";
                }
                if (dcData) {
                    refToLink = "deliveryChallan";
                }
                if (ccData) {
                    refToLink = "crossingChallan";
                }
                if (lcData) {
                    refToLink = "localCollectionChallan";
                }

                if (recieptData) {
                    refToLink = "reciept";
                }
                if (paymentData) {
                    refToLink = "payment";
                }
                if (contraData) {
                    refToLink = "contra";
                }
                if (journalData) {
                    refToLink = "journal";
                }
                if (newData) {
                    refToLink = "new";
                }

            } else if (referenceTypeDRArray[i] == "new") {
                refToLink = "new";
            } else if (referenceTypeDRArray[i] == "onAccount") {
                refToLink = "onAccount";
            } else if (referenceTypeDRArray[i] == "payment") {
                refToLink = "payment";
            }
            let forV = null;
            if (primaryLedgerArray[i] !== ledgerDRArray[i]) {
                const branchData1 = await branch.findOne({ advanceLorryHire: primaryLedgerArray[i] });
                const branchData2 = await branch.findOne({ balanceLorryHire: primaryLedgerArray[i] });
                if (branchData1) {
                    forV = "advanceLorryHire";
                } else if (branchData2) {
                    forV = "balanceLorryHire";
                }
            }


            if (referenceTypeDRArray[i] == "new") {
                let refData = await findByIdOrNull(newM, referenceNumberCRArray[i]);
                if(!refData) {
                    const newRef = new newM({
                        date: date,
                        ledger: ledgerDRArray[i],
                        primaryLedger: primaryLedgerArray[i],
                        number:  refData ? refData.number : referenceNumberDRArray[i],
                        amount: recievedAmtDRArray[i],
                        reference: {
                            type: "payment",
                            rel: oldPaymentVoucherData._id
                        }
                    })
                    refData = await newRef.save({ session });
                 }
                const id = await newEntry(db, session, ledgerDRArray[i], date, req.user.financialYear, "dr", recievedAmtDRArray[i], `narration`, "new", refData._id, [], "payment", oldPaymentVoucherData._id, primaryLedgerArray[i], forV);
                drAgainst.push({ ledger: ledgerDRArray[i], transactionID: id });
                refNumberArray.push(newRefData._id);
                 drArray[i].referenceNumber = refData._id;
            } else {
                const id = await newEntry(db, session, ledgerDRArray[i], date, req.user.financialYear, "dr", recievedAmtDRArray[i], `narration`, refToLink, referenceNumberDRArray[i], [], "payment", oldPaymentVoucherData._id, primaryLedgerArray[i], forV);
                drAgainst.push({ ledger: ledgerDRArray[i], transactionID: id });
                refNumberArray.push(referenceNumberDRArray[i]);

            }
        }

        // cr transactions
        let crAgainst = [] // used in dr transactions
        for (i = 0; i < ledgerCRArray.length; i++) {
            let refToLink = null;
            if (referenceTypeDRArray[i] == "against") {
                const fiData = await fi.findById(referenceNumberDRArray[i]);
                const fmData = await fm.findById(referenceNumberDRArray[i]);
                const recieptData = await reciept.findById(referenceNumberDRArray[i]);
                const paymentData = await payment.findById(referenceNumberDRArray[i]);
                const contraData = await contra.findById(referenceNumberDRArray[i]);
                const journalData = await journal.findById(referenceNumberDRArray[i]);
                const newM = db.model("new-references", newSchema);
                const newData = await newM.findById(referenceNumberDRArray[i]);
                const dcData = await dc.findById(referenceNumberDRArray[i]);
                const ccData = await cc.findById(referenceNumberDRArray[i]);
                const lcData = await lc.findById(referenceNumberDRArray[i]);
                if (fiData) {
                    refToLink = "freightInvoice";
                }
                if (fmData) {
                    refToLink = "freightMemo";
                }
                if (dcData) {
                    refToLink = "deliveryChallan";
                }
                if (ccData) {
                    refToLink = "crossingChallan";
                }
                if (lcData) {
                    refToLink = "localCollectionChallan";
                }
                
                if (recieptData) {
                    refToLink = "reciept";
                }
                if (paymentData) {
                    refToLink = "payment";
                }
                if (contraData) {
                    refToLink = "contra";
                }
                if (journalData) {
                    refToLink = "journal";
                }
                if (newData) {
                    refToLink = "new";
                }
            } else if (referenceTypeDRArray[i] == "new") {
                refToLink = "new";
            } else if (referenceTypeDRArray[i] == "onAccount") {
                refToLink = "onAccount";
            } else if (referenceTypeDRArray[i] == "payment") {
                refToLink = "payment";
            }

            if (referenceTypeCRArray[i] == "new") {
               let refData = await findByIdOrNull(newM, referenceNumberCRArray[i]);
                if(!refData) {
                    const newRef = new newM({
                        date: date,
                        ledger: ledgerCRArray[i],
                        primaryLedger: primaryLedgerArray[i],
                        number:  refData ? refData.number : referenceNumberCRArray[i],
                        amount: recievedAmtCRArray[i],
                        reference: {
                            type: "payment",
                            rel: oldPaymentVoucherData._id
                        }
                    })
                    refData = await newRef.save({ session });
                 }
                const id = await newEntry(db, session, ledgerCRArray[i], date, req.user.financialYear, "cr", recievedAmtCRArray[i], `narration`, "new", refData._id, drAgainst, "payment", oldPaymentVoucherData._id, primaryLedgerArray[i]);
                crAgainst.push({ ledger: ledgerCRArray[i], transactionID: id });
                 crArray[i].referenceNumber = refData._id;
            } else {
                const id = await newEntry(db, session, ledgerCRArray[i], date, req.user.financialYear, "cr", recievedAmtCRArray[i], `narration`, refToLink, referenceNumberCRArray[i], drAgainst, "payment", oldPaymentVoucherData._id, primaryLedgerArray[i]);
                crAgainst.push({ ledger: ledgerCRArray[i], transactionID: id });
            }
        }

        //updating dr transactions with cr transactions
        for (const data of drAgainst) {
            const ledgerData = await ledger.findById(data.ledger).session(session);
            const transaction = ledgerData.transactions.id(data.transactionID);
            transaction.against = crAgainst;
            await ledgerData.save();
        }

        //updating chNumber in cr transactions
        for (const data of crAgainst) {
            const ledgerData = await ledger.findById(data.ledger).session(session);
            const transaction = ledgerData.transactions.id(data.transactionID);
            transaction.chNumber = chNumberArray[crAgainst.indexOf(data)];
            await ledgerData.save();
        }

        //updating dr transaction ID in payment voucher
        for (i = 0; i < drAgainst.length; i++) {
            oldPaymentVoucherData.drEntry[i].transactionID = drAgainst[i].transactionID;
            oldPaymentVoucherData.drEntry[i].referenceNumber = refNumberArray[i];
            await oldPaymentVoucherData.save();
        }
        //updating cr transaction ID in payment voucher
        for (i = 0; i < crAgainst.length; i++) {
            oldPaymentVoucherData.crEntry[i].transactionID = crAgainst[i].transactionID;
            await oldPaymentVoucherData.save();
        }
        

        oldPaymentVoucherData.drEntry = drArray
        oldPaymentVoucherData.crEntry = crArray
        await oldPaymentVoucherData.save();
        
        await session.commitTransaction();
        return res.sendStatus(200);


    } catch (err) {
        console.log(err);
        await session.abortTransaction();
        res.sendStatus(500);
    } finally {
        session.endSession();
    }
})

Route.get("/accounts/payments/delete", async(req, res)=> {
    const db = req.dbConnection
    const payment = db.model("payment-vouchers", paymentSchema)
    const ledger = db.model("ledgers", ledgerSchema)
    const session = await db.startSession();
    try {
        session.startTransaction();
        const paymentData = await payment
        .findById(req.query.id)
        .populate({
            path: "drEntry",
            populate: {
                path: "ledger"
            }
        })
        .populate({
            path: "crEntry",
            populate: {
                path: "ledger"
            }
        })

        for (const data of paymentData.drEntry) {
            await removeEntry(db, session, data.ledger._id, data.transactionID)
        }
        for (const data of paymentData.crEntry) {
            await removeEntry(db, session, data.ledger._id, data.transactionID)
        }
        await paymentData.remove({ session });
        await session.commitTransaction();
        return res.sendStatus(200);
    } catch (err) {
        console.log(err);
        await session.abortTransaction();
        return res.sendStatus(500);
    } finally {
        session.endSession();
    }
})


module.exports = Route;