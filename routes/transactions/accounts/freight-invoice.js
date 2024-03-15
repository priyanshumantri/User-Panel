const express = require("express");
const Route = express.Router();
const ledgerSchema = require("../../../models/masters/ledgers");
const groupSchema = require("../../../models/masters/groups");
const lrSchema = require("../../../models/transactions/bookings/lorry-reciept");
const freightInvoiceSchema = require("../../../models/transactions/accounts/freight-invoice")
const citySchema = require("../../../models/masters/locations/cities");
const puppetteer = require("puppeteer");
const fs = require("fs");
const ejs = require("ejs");
const userSchema = require("../../../models/authentication/user");
const companySchema = require("../../../models/settings/company");
const branchSchema = require("../../../models/masters/locations/branch");
const getLedgers = require("../../../custom_modules/accounts/getLedgers")
const { getPrintNumber, updatePrintNumber } = require("../../../custom_modules/serialCalculator")
const financialYearsSchema = require("../../../models/financialYear");
const newEntry = require("../../../custom_modules/accounts/newEntry");


Route.get("/transactions/accounts/freight-invoice", async (req, res) => {
    const db = req.dbConnection
    const clientDATA = await getLedgers(db, "sundrydebtors")
    const freightInvoice = db.model("freight-invoices", freightInvoiceSchema);
    const data = await freightInvoice.find({ createdAt : req.user.branch._id, fy : req.user.financialYear }).populate("ledger")
    const fy = db.model("financial-years", financialYearsSchema)
    const billNumber = await getPrintNumber(db, req.user, "billNumberCALC")

    res.render("transactions/accounts/freight-invoice", { billNumber, clientDATA: clientDATA, data: data })
})

Route.get("/transactions/accounts/freight-invoice/get-lr", async (req, res) => {

    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema);
    const ledger = db.model("ledgers", ledgerSchema);
    const billingLR = req.user.branch.billingLR
    const lrToSend = [];

    async function fetchData() {
        for (const i in billingLR) {
            try {
                const data = await lr.findById(billingLR[i]).populate("billedTo")
                if (data && data.billedTo.id == req.query.id && !data.billNumber) {
                    const constructedData = {
                        id: data._id,
                        lrNumber: data.lrNumber,
                        gst: data.billedTo.taxation.GST
                    }
                    lrToSend.push(constructedData);
                }

            } catch (err) {
                console.log(err);
            }
        }

        return res.status(200).send(lrToSend)
    }

    fetchData();

})

Route.get("/transactions/accounts/freight-invoice/get-lr-billing", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema);
    const city = db.model("cities", citySchema);
    const data = await lr.findById(req.query.id).populate("from").populate("to")

    res.status(200).send(data)
})

Route.post("/transactions/accounts/freight-invoice/new", async (req, res) => {
    const db = req.dbConnection
    const freightInvoice = db.model("freight-invoices", freightInvoiceSchema);
    const lrModel = db.model("lorry-reciepts", lrSchema);
    const ledger = db.model("ledgers", ledgerSchema);
    const { billNumber, invoiceDate, billingParty, lrNumber, freight, collectionCharges, deliveryCharges, labourCharges, rebookingCharges, loadingDetention, unloadingDetention, demmurage, unloadingCharges, exWeight, exHeight, stCharges, others, CGST, SGST, IGST } = req.body;

    const session = await db.startSession();
    try {

        session.startTransaction();

        if (!billNumber || !invoiceDate || !billingParty) {
            return res.status(400).send({ message: "Please fill all the required fields" })
        } else if (!lrNumber || !freight) {
            return res.status(400).send({ message: "Please add atleast one lr" })
        }
        const lrNumberArray = Array.isArray(lrNumber) ? lrNumber : [lrNumber]
        const freightArray = Array.isArray(freight) ? freight : [freight]
        const collectionChargesArray = Array.isArray(collectionCharges) ? collectionCharges : [collectionCharges]
        const deliveryChargesArray = Array.isArray(deliveryCharges) ? deliveryCharges : [deliveryCharges]
        const labourChargesArray = Array.isArray(labourCharges) ? labourCharges : [labourCharges]
        const rebookingChargesArray = Array.isArray(rebookingCharges) ? rebookingCharges : [rebookingCharges]
        const loadingDetentionArray = Array.isArray(loadingDetention) ? loadingDetention : [loadingDetention]
        const unloadingDetentionArray = Array.isArray(unloadingDetention) ? unloadingDetention : [unloadingDetention]
        const demmurageArray = Array.isArray(demmurage) ? demmurage : [demmurage]
        const unloadingChargesArray = Array.isArray(unloadingCharges) ? unloadingCharges : [unloadingCharges]
        const exWeightArray = Array.isArray(exWeight) ? exWeight : [exWeight]
        const exHeightArray = Array.isArray(exHeight) ? exHeight : [exHeight]
        const stChargesArray = Array.isArray(stCharges) ? stCharges : [stCharges]
        const othersArray = Array.isArray(others) ? others : [others]
        const CGSTArray = Array.isArray(CGST) ? CGST : [CGST]
        const SGSTArray = Array.isArray(SGST) ? SGST : [SGST]
        const IGSTArray = Array.isArray(IGST) ? IGST : [IGST]
        let lrArray = []
        //construction of lr array
        for (let i = 0; i < lrNumberArray.length; i++) {
            const lr = {
                lrNumber: lrNumberArray[i],
                freight: freightArray[i],
                collectionCharges: collectionChargesArray[i],
                delivery: deliveryChargesArray[i],
                labour: labourChargesArray[i],
                rebooking: rebookingChargesArray[i],
                loadingDetention: loadingDetentionArray[i],
                unloadingDetention: unloadingDetentionArray[i],
                demmurage: demmurageArray[i],
                unloading: unloadingChargesArray[i],
                exWeight: exWeightArray[i],
                exHeight: exHeightArray[i],
                st: stChargesArray[i],
                others: othersArray[i],
                cgst: CGSTArray[i],
                sgst: SGSTArray[i],
                igst: IGSTArray[i]

            }
            lrArray.push(lr);
        }

        const newBillNumber = await updatePrintNumber(db, session, req.user, "billNumberCALC", billNumber)


        const newFreightInvoice = new freightInvoice({
            ledger: billingParty,
            branch: req.user.branch._id,
            godown: req.user.branch.godown,
            billNumber: newBillNumber,
            date: invoiceDate,
            fy: req.user.financialYear,
            lr: lrArray,
            createdAt : req.user.branch._id,
            createdBy : req.user._id
        })

        await newFreightInvoice.save({ session: session });

        //updating bill number in each lr
        for (let i = 0; i < lrNumberArray.length; i++) {
            const lr = await lrModel.findById(lrNumberArray[i])
            lr.billNumber = newFreightInvoice._id;
            await lr.save({ session: session })
        }

        //updating ledgers and cnverting arrays to number
        const totalFreight = freightArray.reduce((a, b) => a + parseFloat(b), 0) + collectionChargesArray.reduce((a, b) => a + parseFloat(b), 0) + deliveryChargesArray.reduce((a, b) => a + parseFloat(b), 0) + labourChargesArray.reduce((a, b) => a + parseFloat(b), 0) + rebookingChargesArray.reduce((a, b) => a + parseFloat(b), 0) + loadingDetentionArray.reduce((a, b) => a + parseFloat(b), 0) + unloadingDetentionArray.reduce((a, b) => a + parseFloat(b), 0) + demmurageArray.reduce((a, b) => a + parseFloat(b), 0) + unloadingChargesArray.reduce((a, b) => a + parseFloat(b), 0) + exWeightArray.reduce((a, b) => a + parseFloat(b), 0) + exHeightArray.reduce((a, b) => a + parseFloat(b), 0) + stChargesArray.reduce((a, b) => a + parseFloat(b), 0) + othersArray.reduce((a, b) => a + parseFloat(b), 0)

        //calculating total GST individually before that converting CGSTArray to float
        const totalCGST = CGSTArray.reduce((a, b) => a + parseFloat(b), 0)
        const totalSGST = SGSTArray.reduce((a, b) => a + parseFloat(b), 0)
        const totalIGST = IGSTArray.reduce((a, b) => a + parseFloat(b), 0)

        const transactionID = await newEntry(db, session, billingParty, invoiceDate, req.user.financialYear, "dr", totalFreight + totalCGST + totalSGST + totalIGST, `Freight Invoice ${newBillNumber}`, "freightInvoice", newFreightInvoice._id, [], "freightInvoice", newFreightInvoice._id)


        //updating CGST ledger if CGST is present
        let ledgersImpacted = []
        if (totalCGST > 0) {
            let against = [{ ledger: billingParty, transactionID: transactionID }]
            const id = await newEntry(db, session, req.user.branch.CGST, invoiceDate, req.user.financialYear, "cr", totalCGST, `Freight Invoice ${newBillNumber}`, "freightInvoice", newFreightInvoice._id, against, "freightInvoice", newFreightInvoice._id)
            ledgersImpacted.push({ ledger: req.user.branch.CGST, transactionID: id })
        }

        //updating SGST ledger if SGST is present
        if (totalSGST > 0) {
            let against = [{ ledger: billingParty, transactionID: transactionID }]
            const id = await newEntry(db, session, req.user.branch.SGST, invoiceDate, req.user.financialYear, "cr", totalSGST, `Freight Invoice ${newBillNumber}`, "freightInvoice", newFreightInvoice._id, against, "freightInvoice", newFreightInvoice._id)
            ledgersImpacted.push({ ledger: req.user.branch.SGST, transactionID: id })
        }

        //updating IGST ledger if IGST is present
        if (totalIGST > 0) {
            let against = [{ ledger: billingParty, transactionID: transactionID }]
            const id = await newEntry(db, session, req.user.branch.IGST, invoiceDate, req.user.financialYear, "cr", totalIGST, `Freight Invoice ${newBillNumber}`, "freightInvoice", newFreightInvoice._id, against, "freightInvoice", newFreightInvoice._id)
            ledgersImpacted.push({ ledger: req.user.branch.IGST, transactionID: id })
        }

        //updating branch booking ledger and first checking booking type in each lr indiviudally
        for (let i = 0; i < lrNumberArray.length; i++) {
            const lr = await lrModel.findById(lrNumberArray[i])
            if (lr.bookingBranch.toString() == lr.billedAt.toString()) {
                //it implies to pay booking
                let against = [{ ledger: billingParty, transactionID: transactionID }]
                const totalLRFreight = parseFloat(freightArray[i]) + parseFloat(collectionChargesArray[i]) + parseFloat(deliveryChargesArray[i]) + parseFloat(labourChargesArray[i]) + parseFloat(rebookingChargesArray[i]) + parseFloat(loadingDetentionArray[i]) + parseFloat(unloadingDetentionArray[i]) + parseFloat(demmurageArray[i]) + parseFloat(unloadingChargesArray[i]) + parseFloat(exWeightArray[i]) + parseFloat(exHeightArray[i]) + parseFloat(stChargesArray[i]) + parseFloat(othersArray[i])
                const id = await newEntry(db, session, req.user.branch.bookingToPay, invoiceDate, req.user.financialYear, "cr", totalLRFreight, `Freight Invoice ${newBillNumber}`, "freightInvoice", newFreightInvoice._id, against, "freightInvoice", newFreightInvoice._id)
                ledgersImpacted.push({ ledger: req.user.branch.bookingToPay, transactionID: id })
            } else {
                //it implies tbb booking
                const totalLRFreight = parseFloat(freightArray[i]) + parseFloat(collectionChargesArray[i]) + parseFloat(deliveryChargesArray[i]) + parseFloat(labourChargesArray[i]) + parseFloat(rebookingChargesArray[i]) + parseFloat(loadingDetentionArray[i]) + parseFloat(unloadingDetentionArray[i]) + parseFloat(demmurageArray[i]) + parseFloat(unloadingChargesArray[i]) + parseFloat(exWeightArray[i]) + parseFloat(exHeightArray[i]) + parseFloat(stChargesArray[i]) + parseFloat(othersArray[i])
                let against = [{ ledger: billingParty, transactionID: transactionID }]
                const id = await newEntry(db, session, req.user.branch.bookingTBB, invoiceDate, req.user.financialYear, "cr", totalLRFreight, `Freight Invoice ${newBillNumber}`, "freightInvoice", newFreightInvoice._id, against, "freightInvoice", newFreightInvoice._id)
                ledgersImpacted.push({ ledger: req.user.branch.bookingTBB, transactionID: id })

            }
        }

        const billingPartyLedger = await ledger.findById(billingParty).session(session)
        const filteredTransaction = billingPartyLedger.transactions.find(element => element._id.toString() == transactionID.toString())
        filteredTransaction.against = ledgersImpacted
        await billingPartyLedger.save()

        await session.commitTransaction();
        return res.sendStatus(200);


    } catch (err) {
        console.log(err)
    } finally {
        session.endSession();
    }

})

Route.get("/transactions/accounts/freight-invoice/edit", async (req, res) => {
    const db = req.dbConnection
    const freightInvoice = db.model("freight-invoices", freightInvoiceSchema);
    const lorryReciepts = db.model("lorry-reciepts", lrSchema);
    const cities = db.model("cities", citySchema);
    const data = await freightInvoice
        .findById(req.query.id)
        .populate("ledger")
        .populate({
            path: "lr",
            populate: {
                path: "lrNumber",
                populate: {
                    path: "from to",
                },
            },
        }); res.status(200).send(data)
})

Route.post("/transactions/accounts/freight-invoice/edit", async (req, res) => {
    const db = req.dbConnection
    const freightInvoice = db.model("freight-invoices", freightInvoiceSchema);
    const lrModel = db.model("lorry-reciepts", lrSchema);
    const ledger = db.model("ledgers", ledgerSchema);
    const { billNumber, invoiceDate, billingParty, lrNumber, freight, collectionCharges, deliveryCharges, labourCharges, rebookingCharges, loadingDetention, unloadingDetention, demmurage, unloadingCharges, exWeight, exHeight, stCharges, others, CGST, SGST, IGST } = req.body;

    const session = await db.startSession();
    try {

        //converting all to array
        const lrNumberArray = Array.isArray(lrNumber) ? lrNumber : [lrNumber]
        const freightArray = Array.isArray(freight) ? freight : [freight]
        const collectionChargesArray = Array.isArray(collectionCharges) ? collectionCharges : [collectionCharges]
        const deliveryChargesArray = Array.isArray(deliveryCharges) ? deliveryCharges : [deliveryCharges]
        const labourChargesArray = Array.isArray(labourCharges) ? labourCharges : [labourCharges]
        const rebookingChargesArray = Array.isArray(rebookingCharges) ? rebookingCharges : [rebookingCharges]
        const loadingDetentionArray = Array.isArray(loadingDetention) ? loadingDetention : [loadingDetention]
        const unloadingDetentionArray = Array.isArray(unloadingDetention) ? unloadingDetention : [unloadingDetention]
        const demmurageArray = Array.isArray(demmurage) ? demmurage : [demmurage]
        const unloadingChargesArray = Array.isArray(unloadingCharges) ? unloadingCharges : [unloadingCharges]
        const exWeightArray = Array.isArray(exWeight) ? exWeight : [exWeight]
        const exHeightArray = Array.isArray(exHeight) ? exHeight : [exHeight]
        const stChargesArray = Array.isArray(stCharges) ? stCharges : [stCharges]
        const othersArray = Array.isArray(others) ? others : [others]
        const CGSTArray = Array.isArray(CGST) ? CGST : [CGST]
        const SGSTArray = Array.isArray(SGST) ? SGST : [SGST]
        const IGSTArray = Array.isArray(IGST) ? IGST : [IGST]


        session.startTransaction();

        //reverse the bill number from each lr
        const oldFreightInvoice = await freightInvoice.findById(req.body.editID)
        for (let i = 0; i < oldFreightInvoice.lr.length; i++) {
            const lr = await lrModel.findById(oldFreightInvoice.lr[i].lrNumber)
            lr.billNumber = null;
            await lr.save({ session: session })
        }

        // reverse the ledger entries
        const billingPartyLedger = await ledger.findById(oldFreightInvoice.ledger)
        for (let i = 0; i < billingPartyLedger.transactions.length; i++) {
            if (billingPartyLedger.transactions[i].reference.rel == req.body.editID) {
                billingPartyLedger.transactions.splice(i, 1)
            }
        }
        await billingPartyLedger.save({ session: session })

        //reverse CGST, SGST, IGST ledger if CGST is present
        let oldCGST = oldFreightInvoice.lr.reduce((a, b) => a + parseFloat(b.cgst), 0)
        let oldSGST = oldFreightInvoice.lr.reduce((a, b) => a + parseFloat(b.sgst), 0)
        let oldIGST = oldFreightInvoice.lr.reduce((a, b) => a + parseFloat(b.igst), 0)

        if (oldCGST > 0) {
            const CGSTLedger = await ledger.findById(req.user.branch.CGST)
            const info = await CGSTLedger.transactions.find(element => element.reference.rel == req.body.editID);
            CGSTLedger.transactions.pull(info)
            await CGSTLedger.save({ session: session })
        }

        if (oldSGST > 0) {
            const SGSTLedger = await ledger.findById(req.user.branch.SGST)
            const info = await SGSTLedger.transactions.find(element => element.reference.rel == req.body.editID);
            SGSTLedger.transactions.pull(info)
            await SGSTLedger.save({ session: session })
        }

        if (oldIGST > 0) {
            const IGSTLedger = await ledger.findById(req.user.branch.IGST)
            const info = await IGSTLedger.transactions.find(element => element.reference.rel == req.body.editID);
            IGSTLedger.transactions.pull(info)
            await IGSTLedger.save({ session: session })
        }
        const bookingToPayLedger = await ledger.findById(req.user.branch.bookingToPay).session(session)
        const bookingTBBLedger = await ledger.findById(req.user.branch.bookingTBB)
        //reverse the branch booking ledger
        for (let i = 0; i < oldFreightInvoice.lr.length; i++) {
            const lr = await lrModel.findById(oldFreightInvoice.lr[i].lrNumber)

            if (lr.bookingBranch.toString() == lr.billedAt.toString()) {
                //it implies to pay booking

                const info = await bookingToPayLedger.transactions.find(element => element.reference.rel.toString() == req.body.editID.toString());

                bookingToPayLedger.transactions.pull(info)
                await bookingToPayLedger.save()
            } else {
                //it implies tbb booking


                const info = await bookingTBBLedger.transactions.find(element => element.reference.rel.toString() == req.body.editID.toString());
                bookingTBBLedger.transactions.pull(info)
                await bookingTBBLedger.save()

            }
        }

        //empty the lr array
        oldFreightInvoice.lr = []
        await oldFreightInvoice.save({ session: session })
        //checking if all are reversed

        //construction of lr array
        for (let i = 0; i < lrNumberArray.length; i++) {
            const lr = {
                lrNumber: lrNumberArray[i],
                freight: freightArray[i],
                collectionCharges: collectionChargesArray[i],
                delivery: deliveryChargesArray[i],
                labour: labourChargesArray[i],
                rebooking: rebookingChargesArray[i],
                loadingDetention: loadingDetentionArray[i],
                unloadingDetention: unloadingDetentionArray[i],
                demmurage: demmurageArray[i],
                unloading: unloadingChargesArray[i],
                exWeight: exWeightArray[i],
                exHeight: exHeightArray[i],
                st: stChargesArray[i],
                others: othersArray[i],
                cgst: CGSTArray[i],
                sgst: SGSTArray[i],
                igst: IGSTArray[i]

            }
            oldFreightInvoice.lr.push(lr);
        }

        oldFreightInvoice.billNumber = billNumber;
        oldFreightInvoice.date = invoiceDate;
        oldFreightInvoice.fy = req.user.financialYear;
        oldFreightInvoice.ledger = billingParty;
        await oldFreightInvoice.save({ session: session });

        //updating bill number in each lr
        for (let i = 0; i < lrNumberArray.length; i++) {
            const lr = await lrModel.findById(lrNumberArray[i]).session(session)
            lr.billNumber = oldFreightInvoice._id;
            await lr.save()
        }

        //updating ledgers and converting arrays to number
        const totalFreight = freightArray.reduce((a, b) => a + parseFloat(b), 0) + collectionChargesArray.reduce((a, b) => a + parseFloat(b), 0) + deliveryChargesArray.reduce((a, b) => a + parseFloat(b), 0) + labourChargesArray.reduce((a, b) => a + parseFloat(b), 0) + rebookingChargesArray.reduce((a, b) => a + parseFloat(b), 0) + loadingDetentionArray.reduce((a, b) => a + parseFloat(b), 0) + unloadingDetentionArray.reduce((a, b) => a + parseFloat(b), 0) + demmurageArray.reduce((a, b) => a + parseFloat(b), 0) + unloadingChargesArray.reduce((a, b) => a + parseFloat(b), 0) + exWeightArray.reduce((a, b) => a + parseFloat(b), 0) + exHeightArray.reduce((a, b) => a + parseFloat(b), 0) + stChargesArray.reduce((a, b) => a + parseFloat(b), 0) + othersArray.reduce((a, b) => a + parseFloat(b), 0)

        //calculating total GST individually before that converting CGSTArray to float
        const totalCGST = CGSTArray.reduce((a, b) => a + parseFloat(b), 0)
        const totalSGST = SGSTArray.reduce((a, b) => a + parseFloat(b), 0)
        const totalIGST = IGSTArray.reduce((a, b) => a + parseFloat(b), 0)


        const newTransaction = {
            date: invoiceDate,
            fy: req.user.financialYear,
            type: "dr",
            amount: totalFreight + totalCGST + totalSGST + totalIGST,
            narration: `Freight Invoice ${billNumber}`,
            reference: {
                type: "freightInvoice",
                rel: oldFreightInvoice._id,
                at : "freightInvoice",
                atRel : oldFreightInvoice._id
            }
        }

        billingPartyLedger.transactions.push(newTransaction);
        await billingPartyLedger.save({ session: session });

        //updating CGST ledger if CGST is present
        if (totalCGST > 0) {
            const CGSTLedger = await ledger.findById(req.user.branch.CGST)
            const newTransaction = {
                date: invoiceDate,
                fy: req.user.financialYear,
                type: "cr",
                amount: totalCGST,
                narration: `Freight Invoice ${billNumber}`,
                reference: {
                    type: "freightInvoice",
                    rel: oldFreightInvoice._id,
                    at : "freightInvoice",
                    atRel : oldFreightInvoice._id
                }
            }
            CGSTLedger.transactions.push(newTransaction);
            await CGSTLedger.save({ session: session });
        }

        //updating SGST ledger if SGST is present
        if (totalSGST > 0) {
            const SGSTLedger = await ledger.findById(req.user.branch.SGST)
            const newTransaction = {
                date: invoiceDate,
                fy: req.user.financialYear,
                type: "cr",
                amount: totalSGST,
                narration: `Freight Invoice ${billNumber}`,
                reference: {
                    type: "freightInvoice",
                    rel: oldFreightInvoice._id,
                    at : "freightInvoice",
                    atRel : oldFreightInvoice._id
                }
            }
            SGSTLedger.transactions.push(newTransaction);
            await SGSTLedger.save({ session: session });
        }

        //updating IGST ledger if IGST is present

        if (totalIGST > 0) {
            const IGSTLedger = await ledger.findById(req.user.branch.IGST)
            const newTransaction = {
                date: invoiceDate,
                fy: req.user.financialYear,
                type: "cr",
                amount: totalIGST,
                narration: `Freight Invoice ${billNumber}`,
                reference: {
                    type: "freightInvoice",
                    rel: oldFreightInvoice._id,
                    at : "freightInvoice",
                    atRel : oldFreightInvoice._id
                }
            }
            IGSTLedger.transactions.push(newTransaction);
            await IGSTLedger.save({ session: session });
        }

        //updating branch booking ledger and first checking booking type in each lr indiviudally

        for (let i = 0; i < lrNumberArray.length; i++) {
            const lr = await lrModel.findById(lrNumberArray[i])
            if (lr.bookingBranch.toString() == lr.billedAt.toString()) {
                //it implies to pay booking

                const totalLRFreight = parseFloat(freightArray[i]) + parseFloat(collectionChargesArray[i]) + parseFloat(deliveryChargesArray[i]) + parseFloat(labourChargesArray[i]) + parseFloat(rebookingChargesArray[i]) + parseFloat(loadingDetentionArray[i]) + parseFloat(unloadingDetentionArray[i]) + parseFloat(demmurageArray[i]) + parseFloat(unloadingChargesArray[i]) + parseFloat(exWeightArray[i]) + parseFloat(exHeightArray[i]) + parseFloat(stChargesArray[i]) + parseFloat(othersArray[i])
                const newTransaction = {
                    date: invoiceDate,
                    fy: req.user.financialYear,
                    type: "cr",
                    amount: totalLRFreight,
                    narration: `Freight Invoice ${billNumber}`,
                    reference: {
                        type: "freightInvoice",
                        rel: oldFreightInvoice._id,
                        at : "freightInvoice",
                        atRel : oldFreightInvoice._id
                    }
                }
                bookingToPayLedger.transactions.push(newTransaction);
                await bookingToPayLedger.save({ session: session });
            } else {
                //it implies tbb booking

                const totalLRFreight = parseFloat(freightArray[i]) + parseFloat(collectionChargesArray[i]) + parseFloat(deliveryChargesArray[i]) + parseFloat(labourChargesArray[i]) + parseFloat(rebookingChargesArray[i]) + parseFloat(loadingDetentionArray[i]) + parseFloat(unloadingDetentionArray[i]) + parseFloat(demmurageArray[i]) + parseFloat(unloadingChargesArray[i]) + parseFloat(exWeightArray[i]) + parseFloat(exHeightArray[i]) + parseFloat(stChargesArray[i]) + parseFloat(othersArray[i])
                const newTransaction = {
                    date: invoiceDate,
                    fy: req.user.financialYear,
                    type: "cr",
                    amount: totalLRFreight,
                    narration: `Freight Invoice ${billNumber}`,
                    reference: {
                        type: "freightInvoice",
                        rel: oldFreightInvoice._id,
                        at : "freightInvoice",
                        atRel : oldFreightInvoice._id
                        
                    }

                }

                bookingTBBLedger.transactions.push(newTransaction)
                await bookingTBBLedger.save({ session: session })

            }
        }

        await session.commitTransaction();
        return res.sendStatus(200);

    } catch (err) {
        console.log(err)
        await session.abortTransaction();
    } finally {
        session.endSession();
    }
})

Route.get("/transactions/accounts/freight-invoice/delete", async (req, res) => {

    const db = req.dbConnection
    const freightInvoice = db.model("freight-invoices", freightInvoiceSchema);
    const lrModel = db.model("lorry-reciepts", lrSchema);
    const ledger = db.model("ledgers", ledgerSchema);
    const session = await db.startSession();
    try {
        session.startTransaction();

        const oldFreightInvoice = await freightInvoice.findById(req.query.id).session(session)

        //reverse the bill number from each lr
        for (let i = 0; i < oldFreightInvoice.lr.length; i++) {
            const lr = await lrModel.findById(oldFreightInvoice.lr[i].lrNumber).session(session)
            lr.billNumber = null;
            await lr.save()
        }

        // reverse the ledger entries
        const billingPartyLedger = await ledger.findById(oldFreightInvoice.ledger).session(session)
        for (let i = 0; i < billingPartyLedger.transactions.length; i++) {
            if (billingPartyLedger.transactions[i].reference.rel == req.query.id) {
                billingPartyLedger.transactions.splice(i, 1)
            }
        }

        await billingPartyLedger.save()

        //reverse CGST, SGST, IGST ledger if CGST is present
        let oldCGST = oldFreightInvoice.lr.reduce((a, b) => a + parseFloat(b.cgst), 0)
        let oldSGST = oldFreightInvoice.lr.reduce((a, b) => a + parseFloat(b.sgst), 0)
        let oldIGST = oldFreightInvoice.lr.reduce((a, b) => a + parseFloat(b.igst), 0)

        if (oldCGST > 0) {
            const CGSTLedger = await ledger.findById(req.user.branch.CGST)
            const info = await CGSTLedger.transactions.find(element => element.reference.rel == req.query.id);
            CGSTLedger.transactions.pull(info)
            await CGSTLedger.save()
        }

        if (oldSGST > 0) {
            const SGSTLedger = await ledger.findById(req.user.branch.SGST)
            const info = await SGSTLedger.transactions.find(element => element.reference.rel == req.query.id);
            SGSTLedger.transactions.pull(info)
            await SGSTLedger.save()
        }

        if (oldIGST > 0) {
            const IGSTLedger = await ledger.findById(req.user.branch.IGST)
            const info = await IGSTLedger.transactions.find(element => element.reference.rel == req.query.id);
            IGSTLedger.transactions.pull(info)
            await IGSTLedger.save()
        }

        const bookingToPayLedger = await ledger.findById(req.user.branch.bookingToPay).session(session)
        const bookingTBBLedger = await ledger.findById(req.user.branch.bookingTBB).session(session)
        //reverse the branch booking ledger


        for (let i = 0; i < oldFreightInvoice.lr.length; i++) {
            const lr = await lrModel.findById(oldFreightInvoice.lr[i].lrNumber).session(session)
            if (lr.bookingBranch.toString() == lr.billedAt.toString()) {
                //it implies to pay booking

                const info = await bookingToPayLedger.transactions.find(element => element.reference.rel.toString() == req.query.id.toString());
                bookingToPayLedger.transactions.pull(info)
                await bookingToPayLedger.save()
            } else {
                //it implies tbb booking

                const info = await bookingTBBLedger.transactions.find(element => element.reference.rel.toString() == req.query.id.toString());
                bookingTBBLedger.transactions.pull(info)
                await bookingTBBLedger.save()

            }
        }


        await oldFreightInvoice.remove()
        await session.commitTransaction();
        return res.sendStatus(200);

    } catch (err) {
        console.log(err)
        await session.abortTransaction();
    } finally {
        session.endSession();
    }

})

Route.get("/transactions/accounts/freight-invoice/download", async (req, res) => {
    const db = req.dbConnection
    const freightInvoice = db.model("freight-invoices", freightInvoiceSchema);
    const ledger = db.model("ledgers", ledgerSchema);
    const city = db.model("cities", citySchema);
    const lorryReciepts = db.model("lorry-reciepts", lrSchema);
    const user = db.model("users", userSchema);
    const userData = await user.findById(req.user._id).populate("branch")
    const branches = db.model("branches", branchSchema);
    const company = db.model("companies", companySchema);
    const companyData = await company.find({})
    const data = await freightInvoice
        .findById(req.query.id)
        .populate({
            path: 'lr',
            populate: {
                path: 'lrNumber',
                populate: [
                    { path: 'from' },
                    { path: 'to' }
                ]
            }
        }).populate("ledger")

    const templatePath = "./views/templates/freight-invoice.ejs";
    const template = fs.readFileSync(templatePath, "utf-8");
    const html = ejs.render(template, { data: data, user: userData, company: companyData[0] });
    const browser = await puppetteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setContent(html);
    await page.emulateMediaType("screen");


    // Set the page size based on the content size
    await page.pdf({
        path: `${data.billNumber}.pdf`,
        format: 'A4',
        scale: 0.7,
        margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
        landscape: true
    });
    await browser.close();
    res.download(`${data.billNumber}.pdf`)

    //  res.render("templates/freight-invoice", { data: data, user : userData, company : companyData[0] });


})


module.exports = Route