const express = require("express")
const Route = express.Router()
const getCurrentFinancialYear = require("../../../custom_modules/financial-year")
const getLedgers = require("../../../custom_modules/accounts/getLedgers")
const newEntry = require("../../../custom_modules/accounts/newEntry")
const removeEntry = require("../../../custom_modules/accounts/removeEntry")
const vehiclesSchema = require("../../../models/masters/vehicles/vehicles")
const ownersSchema = require("../../../models/masters/vehicles/owners")
const citiesSchema = require("../../../models/masters/locations/cities")
const laSchema = require("../../../models/transactions/delivery/lorry-arrival")
const lrSchema = require("../../../models/transactions/bookings/lorry-reciept")
const challanSchema = require("../../../models/transactions/bookings/challan")
const deliveryChallanSchema = require("../../../models/transactions/delivery/delivery-challan")
const branchSchema = require("../../../models/masters/locations/branch")
const godownSchema = require("../../../models/masters/locations/godowns")
const brokerSchema = require("../../../models/masters/vehicles/brokers")
const fySchema = require("../../../models/financialYear")
const { getPrintNumber, updatePrintNumber } = require("../../../custom_modules/serialCalculator")
const ledgerSchema = require("../../../models/masters/ledgers")
Route.get("/transactions/delivery/delivery-challan", async (req, res) => {
    const db = req.dbConnection
    const vehicles = db.model("vehicles", vehiclesSchema)
    const cities = db.model("cities", citiesSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const branch = db.model("branches", branchSchema)
    const godown = db.model("godowns", godownSchema)
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    const broker = db.model("brokers", brokerSchema)
    const owner = db.model("owners", ownersSchema)
    const fy = db.model("financial-years", fySchema)
    const directExpenses = await getLedgers(db, "directexpenses")
    const bankAccounts = await getLedgers(db, "bankaccount")
    const cashinhand = await getLedgers(db, "cashinhand")
    const sundrycreditors = await getLedgers(db, "sundrycreditors")
    const dcData = await dc.find({ createdAt: req.user.godown.id }).populate("vehicle").populate("to").populate({ path: "vehicle", populate: { path: "broker" } }).sort({ timestamp: -1 })
    const vehicleDataFetched = await vehicles.find({}).populate("broker").populate("owner")
    const vehicleData = vehicleDataFetched.map((data) => {
        return {
            id: data.id,
            number: data.number,
            broker: data.broker ? data.broker.name : null,
            owner: data.owner ? data.owner.name : null
        }
    })
    const cityData = await cities.find({})

    const branchData = await branch.find({})


    const fyData = await fy.findOne({ _id: req.user.financialYear })
    const dcNumber = await getPrintNumber(db, req.user, "dcCALC")

    res.render("transactions/delivery/delivery-challan", { bankAccounts, cashinhand, sundrycreditors, directExpenses, dcNumber, vehicleData: vehicleData, cityData: cityData, branchData, dcData })
})



Route.get("/transactions/delivery/delivery-challan/get-broker-details", async (req, res) => {
    try {
        const db = req.dbConnection
        const owners = db.model("owners", ownersSchema)
        const brokers = db.model("brokers", brokerSchema)
        const vehicles = db.model("vehicles", vehiclesSchema)

        const data = await vehicles.findById(req.query.vehicleID).populate("broker").populate("owner")
        return res.status(200).send({ owner: data.owner ? data.owner.name : null, broker: data.broker ? data.broker.name : null })
    } catch (err) {
        console.log(err)
        return res.sendStatus(500)
    }

})



Route.get("/transactions/delivery/delivery-challan/get-package-details", async (req, res) => {
    const db = req.dbConnection
    const godown = db.model("godowns", godownSchema)
    const godownData = await godown.findById(req.user.godown.id)
    const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === req.query.lrID.toString())
    const lrData = {
        actualWeight: filteredGodownData.chargedWeight,
        chargedWeight: filteredGodownData.actualWeight,
        NOP: filteredGodownData.qty,
        lrNumber: filteredGodownData.lrNumber
    }
    res.status(200).send(lrData)

})


Route.post("/transactions/delivery/delivery-challan/new", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const deliveryChallan = db.model("delivery-challans", deliveryChallanSchema)
    const godown = db.model("godowns", godownSchema)
    const fy = db.model("financial-years", fySchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const broker = db.model("brokers", brokerSchema)
    const owners = db.model("owners", ownersSchema)
    const branch = db.model("branches", branchSchema)
    const ledgers = db.model("ledgers", ledgerSchema)
    const {
        deliveryChallanNumber,
        deliveryChallanDate,
        vehicleNumber,
        ownerName,
        to,
        lrNumber,
        NOP,
        actualWeight,
        chargedWeight,
        accountTO,
        freight,
        balance,
        advance,
        othersAddLedger,
        othersAddAmt,
        othersSubLedger,
        othersSubAmt,
        cashAmount,
        cashLedger,
        cashStatus,
        cashDate,
        bankAmount,
        bankLedger,
        bankStatus,
        bankDate,
        dieselAmount,
        dieselLedger,
        dieselStatus,
        dieselDate,

    } = req.body
    const session = await db.startSession()

    try {
        session.startTransaction()

        if (!deliveryChallanDate) {
            await session.abortTransaction()
            return res.status(400).send({ message: " Please Select a Delivery Challan Date" })
        } else if (!vehicleNumber) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select a Vehicle Number" })
        } else if (!ownerName) {
            res.status(400).send({ message: "Please Select a Valid Vehicle Number" })
        } else if (!to) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select a Valid Destination" })
        } else if (!lrNumber || !NOP || !actualWeight || !chargedWeight) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Add Atleast 1 LR Material" })
        } else {



            const NOPArray = Array.isArray(NOP) ? NOP : [NOP];
            const lrArray = Array.isArray(lrNumber) ? lrNumber : [lrNumber];
            const actualWeightArray = Array.isArray(actualWeight) ? actualWeight : [actualWeight];
            const chargedWeightArray = Array.isArray(chargedWeight) ? chargedWeight : [chargedWeight];
            const othersAddLedgerArray = Array.isArray(othersAddLedger) ? othersAddLedger : [othersAddLedger];
            const othersAddAmtArray = Array.isArray(othersAddAmt) ? othersAddAmt : [othersAddAmt];
            const othersSubLedgerArray = Array.isArray(othersSubLedger) ? othersSubLedger : [othersSubLedger];
            const othersSubAmtArray = Array.isArray(othersSubAmt) ? othersSubAmt : [othersSubAmt];
            for (const [index, lrID] of lrArray.entries()) {

                const godownData = await godown.findById(req.user.godown.id).session(session)
                const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === lrArray[index])
                const lrData = {
                    actualWeight: filteredGodownData.chargedWeight,
                    chargedWeight: filteredGodownData.actualWeight,
                    NOP: filteredGodownData.qty,
                    lrNumber: filteredGodownData.lrNumber
                }


                if (parseInt(lrData.NOP) < parseInt(NOPArray[index])) {
                    return res.status(400).send({ message: "Number of Packages Cannot Be Greater Than Available Packages in LR: " + lrData.lrNumber })
                } else if (parseFloat(lrData.actualWeight) < parseFloat(actualWeightArray[index])) {
                    return res.status(400).send({ message: "Actual Weight Cannot Be Greater Than Available Weight in LR: " + lrData.lrNumber })
                } else if (parseFloat(lrData.chargedWeight) < parseFloat(chargedWeightArray[index])) {
                    return res.status(400).send({ message: "Charged Weight Cannot Be Greater Than Available Weight in LR: " + lrData.lrNumber })
                }

            }
            const material = [];

            for (let i = 0; i < NOPArray.length; i++) {
                const newObject = {
                    lrNumber: lrArray[i],
                    numberOfPackages: NOPArray[i],
                    actualWeight: actualWeightArray[i],
                    chargedWeight: chargedWeightArray[i]
                };

                material.push(newObject);
            }
            let constructedOthersAdd = []
            if (othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
                for (let i = 0; i < othersAddLedgerArray.length; i++) {
                    constructedOthersAdd.push({ ledger: othersAddLedgerArray[i], amount: othersAddAmtArray[i] })
                }
            }
            let constructedOthersSub = []
            if (othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                for (let i = 0; i < othersSubLedgerArray.length; i++) {
                    constructedOthersSub.push({ ledger: othersSubLedgerArray[i], amount: othersSubAmtArray[i] })
                }
            }


            const vehicleData = await vehicles.findById(vehicleNumber).populate("owner").populate("broker").session(session)
            const newDCNumber = await updatePrintNumber(db, session, req.user, "dcCALC", deliveryChallanNumber)
            const newDC = new deliveryChallan({
                number: newDCNumber,
                date: deliveryChallanDate,
                vehicle: vehicleNumber,
                to: to,
                material: material,
                createdBy: req.user.id,
                createdAt: req.user.godown.id,
                expiry: Date.now() + parseInt(req.company.transactions.deliveryChallans.threshold) * 24 * 60 * 60 * 1000,
                accountTO : accountTO,
                accountToLedger : accountTO == "broker" ? vehicleData.broker.ledger : vehicleData.owner.ledger,
                othersAdd: constructedOthersAdd,
                othersSub: constructedOthersSub,
                freight: {
                    amount: parseFloat(freight)
                },
                cashAdvance: {
                    cashAmount: cashAmount ? cashAmount : 0,
                    cashLedger: cashLedger ? cashLedger : null,
                    cashStatus: cashStatus,
                    cashDate: cashDate ? cashDate : null
                },
                bankAdvance: {
                    bankAmount: bankAmount ? bankAmount : 0,
                    bankLedger: bankLedger ? bankLedger : null,
                    bankStatus: bankStatus,
                    bankDate: bankDate ? bankDate : null
                },
                dieselAdvance: {
                    dieselAmount: dieselAmount ? dieselAmount : 0,
                    dieselLedger: dieselLedger ? dieselLedger : null,
                    dieselStatus: dieselStatus,
                    dieselDate: dieselDate ? dieselDate : null
                },
                advance : advance ? advance : 0,
                balance: {
                    amount:balance ? balance : 0
                }
            });
            const savedDC = await newDC.save({session});

            let drAgainst = []
            //Journal entry for lorry hire (direct expenses) dr
            if (parseFloat(freight) > 0) {
                const lorryHireTransactionID = await newEntry(db, session, req.user.branch.lorryHireExpenses, deliveryChallanDate, req.user.financialYear, "dr", freight, "narration", "deliveryChallan", savedDC._id, [], "deliveryChallan", savedDC._id)
                drAgainst.push({ ledger: req.user.branch.lorryHireExpenses, transactionID: lorryHireTransactionID })
                savedDC.freight.transactionID = lorryHireTransactionID
                await savedDC.save()
            }

            //Journal entry for other expenses (+) dr
            if (othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
                for (let i = 0; i < othersAddLedgerArray.length; i++) {
                    const transactionID = await newEntry(db, session, othersAddLedgerArray[i], deliveryChallanDate, req.user.financialYear, "dr", othersAddAmtArray[i], "narration", "deliveryChallan", savedDC._id, [], "deliveryChallan", savedDC._id)
                    drAgainst.push({ ledger: othersAddLedgerArray[i], transactionID: transactionID })
                    savedDC.othersAdd[i].transactionID = transactionID
                    await savedDC.save()
                }
            }

            let crAgainst = []

            //Journal Entry for other expenses (-) cr
            for (let i = 0; i < othersSubLedgerArray.length; i++) {
                if (othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                    const transactionID = await newEntry(db, session, othersSubLedgerArray[i], deliveryChallanDate, req.user.financialYear, "cr", othersSubAmtArray[i], "narration", "deliveryChallan", savedDC._id, drAgainst, "deliveryChallan", savedDC._id)
                    crAgainst.push({ ledger: othersSubLedgerArray[i], transactionID: transactionID })
                    savedDC.othersSub[i].transactionID = transactionID
                    await savedDC.save()
                }
            }


            //Journal Entry for balance lorry hire (branch) cr
            if (parseFloat(balance) > 0) {
                const balanceTransactionID = await newEntry(db, session, req.user.branch.balanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", balance, "narration", "deliveryChallan", savedDC._id, drAgainst, "deliveryChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.balanceLorryHire, transactionID: balanceTransactionID })
                savedDC.balance.transactionID = balanceTransactionID
                await savedDC.save()
            }

            //Journal Entry for advance lorry hire (branch) cr //ledger, status, date, amount
            if (cashStatus == "paid") {
                const cashTransactionID = await newEntry(db, session, cashLedger, cashDate, req.user.financialYear, "cr", cashAmount, "narration", "deliveryChallan", savedDC._id, drAgainst, "deliveryChallan", savedDC._id)
                crAgainst.push({ ledger: cashLedger, transactionID: cashTransactionID })
                savedDC.cashAdvance.transactionID = cashTransactionID
                await savedDC.save()
            }
            if (bankStatus == "paid") {
                const bankTransactionID = await newEntry(db, session, bankLedger, bankDate, req.user.financialYear, "cr", bankAmount, "narration", "deliveryChallan", savedDC._id, drAgainst, "deliveryChallan", savedDC._id)
                crAgainst.push({ ledger: bankLedger, transactionID: bankTransactionID })
                savedDC.bankAdvance.transactionID = bankTransactionID
                await savedDC.save()
            }
            if (dieselStatus == "paid") {
                const dieselTransactionID = await newEntry(db, session, dieselLedger, dieselDate, req.user.financialYear, "cr", dieselAmount, "narration", "deliveryChallan", savedDC._id, drAgainst, "deliveryChallan", savedDC._id)
                crAgainst.push({ ledger: dieselLedger, transactionID: dieselTransactionID })
                savedDC.dieselAdvance.transactionID = dieselTransactionID
                await savedDC.save()
            }
            if (cashStatus == "due" && parseFloat(cashAmount) > 0) {
                const cashTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", cashAmount, "narration", "deliveryChallan", savedDC._id, drAgainst, "deliveryChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: cashTransactionID })
                savedDC.cashAdvance.transactionID = cashTransactionID
                await savedDC.save()
            }
            if (bankStatus == "due" && parseFloat(bankAmount) > 0) {
                const bankTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", bankAmount, "narration", "deliveryChallan", savedDC._id, drAgainst, "deliveryChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: bankTransactionID })
                savedDC.bankAdvance.transactionID = bankTransactionID
                await savedDC.save()

            }
            if (dieselStatus == "due" && parseFloat(dieselAmount) > 0) {
                const dieselTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", dieselAmount, "narration", "deliveryChallan", savedDC._id, drAgainst, "deliveryChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: dieselTransactionID })
                savedDC.dieselAdvance.transactionID = dieselTransactionID
                await savedDC.save()
            }

            //updating crAgainst in dr transactions
            for (let i = 0; i < drAgainst.length; i++) {
                await ledgers.updateOne({ _id: drAgainst[i].ledger, "transactions._id": drAgainst[i].transactionID }, { $push: { "transactions.$.against": crAgainst } }).session(session)
            }


            for (const [index, lrID] of lrArray.entries()) {
                try {
                    const lrData = await lr.findById(lrID).session(session)


                    //pushing dc in lr
                    lrData.deliveryChallans.push(savedDC.id);
                    await lrData.save();

                    // updating status schema in lr

                    //removing out for delivery material from delivery godown
                    lrData.materialStatus.deliveryGodown.qty = lrData.materialStatus.deliveryGodown.qty - parseInt(NOPArray[index])
                    lrData.materialStatus.deliveryGodown.actualWeight = lrData.materialStatus.deliveryGodown.actualWeight - parseFloat(actualWeightArray[index])
                    lrData.materialStatus.deliveryGodown.chargedWeight = lrData.materialStatus.deliveryGodown.chargedWeight - parseFloat(chargedWeightArray[index])

                    //adding out for delivery material in out for delivery status
                    lrData.materialStatus.outForDelivery.qty = lrData.materialStatus.outForDelivery.qty + parseInt(NOPArray[index])

                    lrData.materialStatus.outForDelivery.actualWeight = lrData.materialStatus.outForDelivery.actualWeight + parseFloat(actualWeightArray[index])

                    lrData.materialStatus.outForDelivery.chargedWeight = lrData.materialStatus.outForDelivery.chargedWeight + parseFloat(chargedWeightArray[index])

                    await lrData.save()

                    const updateGodown = await godown.findById(req.user.godown.id).session(session)
                    // updating stock in branch and pushing dc in branch

                    updateGodown.deliveryChallans.push(savedDC.id)

                    const filteredStock = updateGodown.stock.find((element) => element.lrNumber.toString() === lrID)
                    filteredStock.qty = filteredStock.qty - parseInt(NOPArray[index])
                    filteredStock.chargedWeight = filteredStock.chargedWeight - parseFloat(chargedWeightArray[index])
                    filteredStock.actualWeight = filteredStock.actualWeight - parseFloat(actualWeightArray[index])
                    await updateGodown.save()





                } catch (err) {
                    await session.abortTransaction()
                    console.error(err);
                    return res.sendStatus(500)
                    // Handle the error here, depending on your requirements
                }
            }
            await session.commitTransaction()
            res.status(200).send({ message: "Delivery Challan Created Successfully" })

        }
    } catch (err) {
        console.log(err);
        await session.abortTransaction()
    } finally {
        session.endSession()
    }

})

Route.get("/transactions/delivery/delivery-challan/edit", async (req, res) => {
    const db = req.dbConnection
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    const broker = db.model("brokers", brokerSchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const owners = db.model("owners", ownersSchema)
    const dcData = await dc.findById(req.query.id).populate("vehicle").populate({ path: "vehicle", populate: { path: "broker" } }).populate({ path: "material", populate: { path: "lrNumber" } }).populate({path : "vehicle", populate : {path : "owner"}})
    const maxData = []
    const godown = db.model("godowns", godownSchema)
    const godownData = await godown.findById(req.user.godown.id)
    for (const data of dcData.material) {
        const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === data.lrNumber.id.toString())
        const lrData = {
            actualWeight: filteredGodownData.chargedWeight + data.chargedWeight,
            chargedWeight: filteredGodownData.actualWeight + data.actualWeight,
            NOP: filteredGodownData.qty + data.numberOfPackages,
            lrNumber: filteredGodownData.lrNumber
        }

        maxData.push(lrData)
    }
    res.status(200).send({ dcData, maxData })
})

Route.get("/transactions/delivery/get-lr-data", async (req, res) => {
    const db = req.dbConnection
    const godown = db.model("godowns", godownSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    try {
        const dcData = await dc.find({ expired: true })
        if (dcData.length > 0) {
            return res.status(400).send({ message: "Close Previous DC's To Create a New One" })
        } else {
            const dispatchInventory = await godown.findById(req.user.godown.id)
            const filteredInventory = dispatchInventory.stock.filter((element) => element.transfer === false && element.qty > 0)
            var lrNumberArray = []
            for (const lrID of filteredInventory) {
                lrNumberArray.push(lrID.lrNumber)
            }
            var constructedLRData = []
            const lrData = await lr.find({ _id: { $in: lrNumberArray } });
            for (const lrDetail of lrData) {
                if (lrDetail.materialHold.atDeliveryGodown === false && lrDetail.deliveryBy === "DOOR") {
                    const filteredGodownData = dispatchInventory.stock.find((element) => element.lrNumber.toString() === lrDetail.id.toString())
                    var newLR = {
                        lrID: lrDetail.id,
                        lrNumber: lrDetail.lrNumber,
                        actualWeight: filteredGodownData.chargedWeight,
                        chargedWeight: filteredGodownData.actualWeight,
                        NOP: filteredGodownData.qty
                    }
                    constructedLRData.push(newLR)
                }
            }

            res.status(200).send(constructedLRData)
        }

    } catch (err) {
        console.log(err)
        res.sendStatus(500)
    }
})


Route.post("/transactions/delivery/delivery-challan/edit", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    const godown = db.model("godowns", godownSchema)
    const {othersSubAmt, othersAddAmt, othersSubLedger, othersAddLedger, deliveryChallanDate, vehicleNumber, ownerName, to, lrNumber, NOP, actualWeight, chargedWeight, freight, advance, balance, cashAmount, cashStatus, cashLedger, cashDate, bankAmount, bankLedger, bankStatus, bankDate,  dieselAmount, dieselDate, dieselLedger, dieselStatus } = req.body
    const session = await db.startSession()
    const owners = db.model("owners", ownersSchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const branch = db.model("branches", branchSchema)
    const ledgers = db.model("ledgers", ledgerSchema)
    const brokers = db.model("brokers", brokerSchema)
    try {
        session.startTransaction()

        if (!deliveryChallanDate) {
            await session.abortTransaction()
            return res.status(400).send({ message: " Please Select a Delivery Challan Date" })
        } else if (!vehicleNumber) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select a Vehicle Number" })
        } else if (!ownerName) {
            res.status(400).send({ message: "Please Select a Valid Vehicle Number" })
        } else if (!to) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Select a Valid Destination" })
        } else if (!lrNumber || !NOP || !actualWeight || !chargedWeight) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Please Add Atleast 1 LR Material" })
        } else {



            const NOPArray = Array.isArray(NOP) ? NOP : [NOP];
            const lrArray = Array.isArray(lrNumber) ? lrNumber : [lrNumber];
            const actualWeightArray = Array.isArray(actualWeight) ? actualWeight : [actualWeight];
            const chargedWeightArray = Array.isArray(chargedWeight) ? chargedWeight : [chargedWeight];
            const typeArray = Array.isArray(req.body.type) ? req.body.type : [req.body.type];
            const dcData = await dc.findById(req.body.id).session(session)
            const othersAddLedgerArray = Array.isArray(othersAddLedger) ? othersAddLedger : [othersAddLedger];
            const othersAddAmtArray = Array.isArray(othersAddAmt) ? othersAddAmt : [othersAddAmt];
            const othersSubLedgerArray = Array.isArray(othersSubLedger) ? othersSubLedger : [othersSubLedger];
            const othersSubAmtArray = Array.isArray(othersSubAmt) ? othersSubAmt : [othersSubAmt];
            const oldAccountToLedger = await ledgers.findById(dcData.accountToLedger).session(session)
            if(dcData.accountTO !== req.body.accountTO) {
                
                const filtered = oldAccountToLedger.transactions.filter((element) => element.reference.rel == dcData.id)
                if(filtered && filtered.length > 0) {
                    await session.abortTransaction()
                    return res.status(400).send({message : "Cannot Change Account To Ledger As Already a payment is made against this delivery challan"})
                }
             }

             const filteredBalance = oldAccountToLedger.transactions.filter((element) => element.reference.forV == "balanceLorryHire" && element.reference.rel == dcData.id)
             const totalBalance = filteredBalance.reduce((acc, curr) => acc + curr.amount, 0)

                if(parseFloat(balance) < totalBalance) {
                    await session.abortTransaction()
                    return res.status(400).send({message : "Balance Cannot Be Less Than Already Paid Balance"})
                }

                const filteredAdvance = oldAccountToLedger.transactions.filter((element) => element.reference.forV == "advanceLorryHire" && element.reference.rel == dcData.id)
                const totalAdvance = filteredAdvance.reduce((acc, curr) => acc + curr.amount, 0)

                const newTotalAdvance = cashStatus == "due" ? parseFloat(cashAmount) : 0 + bankStatus == "due" ? parseFloat(bankAmount) : 0 + dieselStatus == "due" ? parseFloat(dieselAmount) : 0
                if(newTotalAdvance < totalAdvance) {
                    await session.abortTransaction()
                    return res.status(400).send({message : "Due Advance Cannot Be Less Than Already Paid Advance"})
                }


             
             //checking for valid stock entries
            for (const [index, lrID] of lrArray.entries()) {

                const godownData = await godown.findById(req.user.godown.id).session(session)
                const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === lrArray[index])
                const filteredDC = dcData.material.find((element) => element.lrNumber.toString() === lrArray[index])
                let lrData = {}
                if (typeArray[index] === "OLD") {
                    lrData = {
                        actualWeight: filteredGodownData.chargedWeight + filteredDC.chargedWeight,
                        chargedWeight: filteredGodownData.actualWeight + filteredDC.actualWeight,
                        NOP: filteredGodownData.qty + filteredDC.numberOfPackages,
                        lrNumber: filteredGodownData.lrNumber
                    }

                } else {
                    lrData = {
                        actualWeight: filteredGodownData.chargedWeight,
                        chargedWeight: filteredGodownData.actualWeight,
                        NOP: filteredGodownData.qty,
                        lrNumber: filteredGodownData.lrNumber
                    }
                }


                if (parseInt(lrData.NOP) < parseInt(NOPArray[index])) {
                    return res.status(400).send({ message: "Number of Packages Cannot Be Greater Than Available Stock At Godown in LR: " + lrData.lrNumber })
                } else if (parseFloat(lrData.actualWeight) < parseFloat(actualWeightArray[index])) {
                    return res.status(400).send({ message: "Actual Weight Cannot Be Greater Than Available Stock At Godown in LR: " + lrData.lrNumber })
                } else if (parseFloat(lrData.chargedWeight) < parseFloat(chargedWeightArray[index])) {
                    return res.status(400).send({ message: "Charged Weight Cannot Be Greater Than Available Stock At Godown in LR: " + lrData.lrNumber })
                }

            }


            //reverting stock changes in godown and in lr
            const updatedIndex = []
            const godownData = await godown.findById(req.user.godown.id).session(session)
            for (i = 0; i < lrArray.length; i++) {
                if (typeArray[i] === "OLD") {
                    const lrData = await lr.findById(lrArray[i]).session(session)
                    const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === lrArray[i])
                    const filteredDC = dcData.material.find((element) => element.lrNumber.toString() === lrArray[i])
                    //adding material back to godown stock
                    filteredGodownData.qty += filteredDC.numberOfPackages
                    filteredGodownData.chargedWeight += filteredDC.chargedWeight
                    filteredGodownData.actualWeight += filteredDC.actualWeight
                    await godownData.save()
                    //adding material back to delivery godwon and removing from out for delivery
                    lrData.materialStatus.deliveryGodown.qty += filteredDC.numberOfPackages
                    lrData.materialStatus.deliveryGodown.chargedWeight += filteredDC.chargedWeight
                    lrData.materialStatus.deliveryGodown.actualWeight += filteredDC.actualWeight

                    lrData.materialStatus.outForDelivery.qty -= filteredDC.numberOfPackages
                    lrData.materialStatus.outForDelivery.chargedWeight -= filteredDC.chargedWeight
                    lrData.materialStatus.outForDelivery.actualWeight -= filteredDC.actualWeight
                    await lrData.save()

                    //making all stock in dc 0
                    filteredDC.numberOfPackages = 0
                    filteredDC.chargedWeight = 0
                    filteredDC.actualWeight = 0
                    await dcData.save()

                    updatedIndex.push(i)

                }
            }


            //since reversed old material above now we will add data wiith new data received by user
            for (i = 0; i < lrArray.length; i++) {
                if (typeArray[i] === "OLD") {
                    const lrData = await lr.findById(lrArray[i]).session(session)
                    const filteredDC = dcData.material.find((element) => element.lrNumber.toString() === lrArray[i])
                    const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === lrArray[i])
                    //removing material from godown stock
                    filteredGodownData.qty -= parseInt(NOPArray[i])
                    filteredGodownData.chargedWeight -= parseFloat(chargedWeightArray[i])
                    filteredGodownData.actualWeight -= parseFloat(actualWeightArray[i])
                    await godownData.save()
                    //removing material from delivery godwon and adding back to out for delivery
                    lrData.materialStatus.deliveryGodown.qty -= parseInt(NOPArray[i])
                    lrData.materialStatus.deliveryGodown.chargedWeight -= parseFloat(chargedWeightArray[i])
                    lrData.materialStatus.deliveryGodown.actualWeight -= parseFloat(actualWeightArray[i])

                    lrData.materialStatus.outForDelivery.qty += parseInt(NOPArray[i])
                    lrData.materialStatus.outForDelivery.chargedWeight += parseFloat(chargedWeightArray[i])
                    lrData.materialStatus.outForDelivery.actualWeight += parseFloat(actualWeightArray[i])
                    await lrData.save()
                    //making all stock in dc 0
                    filteredDC.numberOfPackages += parseInt(NOPArray[i])
                    filteredDC.chargedWeight += parseFloat(chargedWeightArray[i])
                    filteredDC.actualWeight += parseFloat(actualWeightArray[i])

                    await dcData.save()

                }
            }


            //deleting index which didnt gott updated that means they are deleted by user
            for (i = 0; i < dcData.material.length; i++) {

                if (!updatedIndex.includes(i)) {
                    const filteredDC = dcData.material.find((element) => element.lrNumber.toString() === dcData.material[i].lrNumber.toString())
                    const lrData = await lr.findById(filteredDC.lrNumber).session(session)
                    const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === dcData.material[i].lrNumber.toString())

                    //adding material back to godown stock

                    filteredGodownData.qty += filteredDC.numberOfPackages
                    filteredGodownData.chargedWeight += filteredDC.chargedWeight
                    filteredGodownData.actualWeight += filteredDC.actualWeight
                    await godownData.save()
                    //adidng material back to delivery godwon and removing from out for delivery
                    lrData.materialStatus.deliveryGodown.qty += filteredDC.numberOfPackages
                    lrData.materialStatus.deliveryGodown.chargedWeight += filteredDC.chargedWeight
                    lrData.materialStatus.deliveryGodown.actualWeight += filteredDC.actualWeight
                    lrData.materialStatus.outForDelivery.qty -= filteredDC.numberOfPackages
                    lrData.materialStatus.outForDelivery.chargedWeight -= filteredDC.chargedWeight
                    lrData.materialStatus.outForDelivery.actualWeight -= filteredDC.actualWeight

                    lrData.deliveryChallans.pull(dcData.id)
                    await lrData.save()

                    //removing object from dc
                    dcData.material.splice(i, 1)
                    await dcData.save()

                }

            }


            //adding new lr to dc and updating its status
            for (i = 0; i < lrArray.length; i++) {
                if (typeArray[i] === "NEW") {
                    const lrData = await lr.findById(lrArray[i]).session(session)
                    const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === lrArray[i])
                    //adding material back to godown stock
                    filteredGodownData.qty = filteredGodownData.qty - parseInt(NOPArray[i])
                    filteredGodownData.chargedWeight = filteredGodownData.chargedWeight - parseFloat(chargedWeightArray[i])
                    filteredGodownData.actualWeight = filteredGodownData.actualWeight - parseFloat(actualWeightArray[i])
                    await godownData.save()
                    //adding material back to delivery godwon and removing from out for delivery
                    lrData.materialStatus.deliveryGodown.qty -= parseInt(NOPArray[i])
                    lrData.materialStatus.deliveryGodown.chargedWeight -= parseFloat(chargedWeightArray[i])
                    lrData.materialStatus.deliveryGodown.actualWeight -= parseFloat(actualWeightArray[i])
                    lrData.materialStatus.outForDelivery.qty += parseInt(NOPArray[i])
                    lrData.materialStatus.outForDelivery.chargedWeight += parseFloat(chargedWeightArray[i])
                    lrData.materialStatus.outForDelivery.actualWeight += parseFloat(actualWeightArray[i])
                    lrData.deliveryChallans.push(dcData.id)
                    await lrData.save()


                    //adding new data to dc
                    const newObject = {
                        lrNumber: lrArray[i],
                        numberOfPackages: NOPArray[i],
                        actualWeight: actualWeightArray[i],
                        chargedWeight: chargedWeightArray[i]
                    };
                    dcData.material.push(newObject)
                    await dcData.save()


                }
            }

            // removing old other add and sub transactions
            for (let i = 0; i < dcData.othersAdd.length; i++) {
                await removeEntry(db, session, dcData.othersAdd[i].ledger, dcData.othersAdd[i].transactionID)
            }
            for (let i = 0; i < dcData.othersSub.length; i++) {
                await removeEntry(db, session, dcData.othersSub[i].ledger, dcData.othersSub[i].transactionID)
            }

         

            //removing old cash advance transaction
            if (dcData.cashAdvance.cashStatus === "paid") {
                await removeEntry(db, session, dcData.cashAdvance.cashLedger, dcData.cashAdvance.transactionID)
            } else if (dcData.cashAdvance.cashStatus === "due" && parseFloat(dcData.cashAdvance.cashAmount) > 0){
                await removeEntry(db, session, req.user.branch.advanceLorryHire, dcData.cashAdvance.transactionID)
            }


            //removing old bank advance transaction
            if (dcData.bankAdvance.bankStatus === "paid") {
                await removeEntry(db, session, dcData.bankAdvance.bankLedger, dcData.bankAdvance.transactionID)
            } else if (dcData.bankAdvance.bankStatus === "due" && parseFloat(dcData.bankAdvance.bankAmount) > 0){
                await removeEntry(db, session, req.user.branch.advanceLorryHire, dcData.bankAdvance.transactionID)
            }

            //removing old diesel advance transaction
            if (dcData.dieselAdvance.dieselStatus === "paid") {
                await removeEntry(db, session, dcData.dieselAdvance.dieselLedger, dcData.dieselAdvance.transactionID)
            } else if (dcData.dieselAdvance.dieselStatus === "due" && parseFloat(dcData.dieselAdvance.dieselAmount) > 0) {
                await removeEntry(db, session, req.user.branch.advanceLorryHire, dcData.dieselAdvance.transactionID)
            }

             //removing old freight transaction
             if (dcData.freight.transactionID) {
                await removeEntry(db, session, req.user.branch.lorryHireExpenses, dcData.freight.transactionID)
            }
            //removing old balance transaction
            if(dcData.balance.amount > 0){
                await removeEntry(db, session, req.user.branch.balanceLorryHire, dcData.balance.transactionID)
            }

            dcData.othersAdd = []
            dcData.othersSub = []

            await dcData.save()
            const constructedOthersAdd = []
            
            if (othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {

                for (let i = 0; i < othersAddLedgerArray.length; i++) {
                    constructedOthersAdd.push({ ledger: othersAddLedgerArray[i], amount: othersAddAmtArray[i] })
                }
            }
            const constructedOthersSub = []
            if (othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                for (let i = 0; i < othersSubLedgerArray.length; i++) {
                    constructedOthersSub.push({ ledger: othersSubLedgerArray[i], amount: othersSubAmtArray[i] })
                }
            }

            dcData.othersAdd = constructedOthersAdd
            dcData.othersSub = constructedOthersSub
            const vehicleData = await vehicles.findById(vehicleNumber).populate("owner").populate("broker").session(session)

            dcData.othersAdd = constructedOthersAdd
            dcData.othersSub = constructedOthersSub
            dcData.freight.amount = parseFloat(freight)
            dcData.advance = parseFloat(advance)
            dcData.balance.amount = parseFloat(balance)
            dcData.cashAdvance.cashAmount = parseFloat(cashAmount)
            dcData.cashAdvance.cashLedger = cashLedger ? cashLedger : null
            dcData.cashAdvance.cashStatus = cashStatus
            dcData.cashAdvance.cashDate = cashDate
            dcData.bankAdvance.bankAmount = parseFloat(bankAmount)
            dcData.bankAdvance.bankLedger = bankLedger ? bankLedger : null
            dcData.bankAdvance.bankStatus = bankStatus
            dcData.bankAdvance.bankDate = bankDate
            dcData.dieselAdvance.dieselAmount = parseFloat(dieselAmount)
            dcData.dieselAdvance.dieselLedger = dieselLedger ? dieselLedger : null
            dcData.dieselAdvance.dieselStatus = dieselStatus
            dcData.dieselAdvance.dieselDate = dieselDate
            dcData.accountTO = req.body.accountTO
            dcData.accountToLedger = req.body.accountTO == "broker" ? vehicleData.broker.ledger : vehicleData.owner.ledger
            await dcData.save()

            //Journal entry for lorry hire (direct expenses) dr
            let drAgainst = []
            if (parseFloat(freight) > 0) {
                const lorryHireTransactionID = await newEntry(db, session, req.user.branch.lorryHireExpenses, deliveryChallanDate, req.user.financialYear, "dr", freight, "narration", "deliveryChallan", dcData._id, [], "deliveryChallan", dcData._id)
                dcData.freight.transactionID = lorryHireTransactionID
                drAgainst.push({ ledger: req.user.branch.lorryHireExpenses, transactionID: lorryHireTransactionID })
                await dcData.save()
            }

            //Journal entry for other expenses (+) dr
            if (othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
                for (let i = 0; i < othersAddLedgerArray.length; i++) {
                    const transactionID = await newEntry(db, session, othersAddLedgerArray[i], deliveryChallanDate, req.user.financialYear, "dr", othersAddAmtArray[i], "narration", "deliveryChallan", dcData._id, [], "deliveryChallan", dcData._id)
                    drAgainst.push({ ledger: othersAddLedgerArray[i], transactionID: transactionID })
                    dcData.othersAdd[i].transactionID = transactionID
                    await dcData.save()
                }
            }

            let crAgainst = []

            //Journal Entry for other expenses (-) cr
            for (let i = 0; i < othersSubLedgerArray.length; i++) {
                if (othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                    const transactionID = await newEntry(db, session, othersSubLedgerArray[i], deliveryChallanDate, req.user.financialYear, "cr", othersSubAmtArray[i], "narration", "deliveryChallan", dcData._id, drAgainst, "deliveryChallan", dcData._id)
                    crAgainst.push({ ledger: othersSubLedgerArray[i], transactionID: transactionID })
                    dcData.othersSub[i].transactionID = transactionID
                    await dcData.save()
                }
            }

            //Journal Entry for balance lorry hire (branch) cr
            if (parseFloat(balance) > 0) {
                const balanceTransactionID = await newEntry(db, session, req.user.branch.balanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", balance, "narration", "deliveryChallan", dcData._id, drAgainst, "deliveryChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.balanceLorryHire, transactionID: balanceTransactionID })
                dcData.balance.transactionID = balanceTransactionID
                await dcData.save()
            }

            //Journal Entry for advance lorry hire (branch) cr //ledger, status, date, amount
            if (cashStatus == "paid") {
                const cashTransactionID = await newEntry(db, session, cashLedger, cashDate, req.user.financialYear, "cr", cashAmount, "narration", "deliveryChallan", dcData._id, drAgainst, "deliveryChallan", dcData._id)
                crAgainst.push({ ledger: cashLedger, transactionID: cashTransactionID })
                dcData.cashAdvance.transactionID = cashTransactionID
                await dcData.save()
            }
            if (bankStatus == "paid") {
                const bankTransactionID = await newEntry(db, session, bankLedger, bankDate, req.user.financialYear, "cr", bankAmount, "narration", "deliveryChallan", dcData._id, drAgainst, "deliveryChallan", dcData._id)
                crAgainst.push({ ledger: bankLedger, transactionID: bankTransactionID })
                dcData.bankAdvance.transactionID = bankTransactionID
                await dcData.save()
            }
            if (dieselStatus == "paid") {
                const dieselTransactionID = await newEntry(db, session, dieselLedger, dieselDate, req.user.financialYear, "cr", dieselAmount, "narration", "deliveryChallan", dcData._id, drAgainst, "deliveryChallan", dcData._id)
                crAgainst.push({ ledger: dieselLedger, transactionID: dieselTransactionID })
                dcData.dieselAdvance.transactionID = dieselTransactionID
                await dcData.save()
            }
            if (cashStatus == "due" && parseFloat(cashAmount) > 0) {
                const cashTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", cashAmount, "narration", "deliveryChallan", dcData._id, drAgainst, "deliveryChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: cashTransactionID })
                dcData.cashAdvance.transactionID = cashTransactionID
                await dcData.save()
            }
            if (bankStatus == "due" && parseFloat(bankAmount) > 0) {
                const bankTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", bankAmount, "narration", "deliveryChallan", dcData._id, drAgainst, "deliveryChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: bankTransactionID })
                dcData.bankAdvance.transactionID = bankTransactionID
                await dcData.save()

            }
            if (dieselStatus == "due" && parseFloat(dieselAmount) > 0) {
                const dieselTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", dieselAmount, "narration", "deliveryChallan", dcData._id, drAgainst, "deliveryChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: dieselTransactionID })
                dcData.dieselAdvance.transactionID = dieselTransactionID
                await dcData.save()
            }

            //updating crAgainst in dr transactions
            for (let i = 0; i < drAgainst.length; i++) {
                await ledgers.updateOne({ _id: drAgainst[i].ledger, "transactions._id": drAgainst[i].transactionID }, { $push: { "transactions.$.against": crAgainst } }).session(session)
            }

          





            await session.commitTransaction()
            return res.sendStatus(200)

        }
    } catch (err) {
        await session.abortTransaction()
        console.log(err);
    } finally {
        session.endSession()
    }
})


Route.post("/transactions/delivery/delivery-challan/delete", async (req, res) => {

    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    const godown = db.model("godowns", godownSchema)
    const session = await db.startSession()
    const ledgers = db.model("ledgers", ledgerSchema)
    try {
        const id = req.body.id
        session.startTransaction()
        const dcData = await dc.findById(id).session(session)
        const ledgerData = await ledgers.findById(dcData.accountToLedger).session(session)
        const filtered = ledgerData.transactions.filter((element) => element.reference.rel == id)
        if (filtered.length > 0) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Cannot Delete Delivery Challan As payment is made against it" })
        } else if (dcData.closed === true) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Delivery Challan is Already Closed" })
        } else {
            for (const data of dcData.material) {
                //updating material status in lr
                const lrData = await lr.findById(data.lrNumber).session(session)
                lrData.materialStatus.deliveryGodown.qty += data.numberOfPackages
                lrData.materialStatus.deliveryGodown.chargedWeight += data.chargedWeight
                lrData.materialStatus.deliveryGodown.actualWeight += data.actualWeight

                lrData.materialStatus.outForDelivery.qty -= data.numberOfPackages
                lrData.materialStatus.outForDelivery.chargedWeight -= data.chargedWeight
                lrData.materialStatus.outForDelivery.actualWeight -= data.actualWeight

                //updating stock in godown
                const godownData = await godown.findById(req.user.godown.id).session(session)
                const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === data.lrNumber.toString())
                filteredGodownData.qty += data.numberOfPackages
                filteredGodownData.chargedWeight += data.chargedWeight
                filteredGodownData.actualWeight += data.actualWeight

                lrData.deliveryChallans.pull(dcData.id)
                godownData.deliveryChallans.pull(dcData.id)
                await lrData.save()
                await godownData.save()
            }

            //removing all transactions
            for (let i = 0; i < dcData.othersAdd.length; i++) {
                await removeEntry(db, session, dcData.othersAdd[i].ledger, dcData.othersAdd[i].transactionID)
            }
            for (let i = 0; i < dcData.othersSub.length; i++) {
                await removeEntry(db, session, dcData.othersSub[i].ledger, dcData.othersSub[i].transactionID)
            }
            if (dcData.cashAdvance.cashStatus === "paid") {
                await removeEntry(db, session, dcData.cashAdvance.cashLedger, dcData.cashAdvance.transactionID)
            }
            if (dcData.bankAdvance.bankStatus === "paid") {
                await removeEntry(db, session, dcData.bankAdvance.bankLedger, dcData.bankAdvance.transactionID)
            }
            if (dcData.dieselAdvance.dieselStatus === "paid") {
                await removeEntry(db, session, dcData.dieselAdvance.dieselLedger, dcData.dieselAdvance.transactionID)
            }

            //removing bank, cash, diesel advance when status is due and amt is greater than 0
            if (dcData.cashAdvance.cashStatus === "due" && parseFloat(dcData.cashAdvance.cashAmount) > 0) {
                await removeEntry(db, session, req.user.branch.advanceLorryHire, dcData.cashAdvance.transactionID)
            }
            if (dcData.bankAdvance.bankStatus === "due" && parseFloat(dcData.bankAdvance.bankAmount) > 0) {
                await removeEntry(db, session, req.user.branch.advanceLorryHire, dcData.bankAdvance.transactionID)
            }
            if (dcData.dieselAdvance.dieselStatus === "due" && parseFloat(dcData.dieselAdvance.dieselAmount) > 0) {
                await removeEntry(db, session, req.user.branch.advanceLorryHire, dcData.dieselAdvance.transactionID)
            }


            if (dcData.freight.transactionID) {
                await removeEntry(db, session, req.user.branch.lorryHireExpenses, dcData.freight.transactionID)
            }
            

            if(dcData.balance.amount > 0){
                await removeEntry(db, session, req.user.branch.balanceLorryHire, dcData.balance.transactionID)
            }
            



            await dc.findByIdAndDelete(id).session(session)
            await session.commitTransaction()
            res.sendStatus(200)
        }


    } catch (err) {
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)
    } finally {
        session.endSession()
    }
})

Route.get("/transactions/delivery/delivery-challan/close", async (req, res) => {
    const db = req.dbConnection
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    const vehicle = db.model("vehicles", vehiclesSchema)

    try {
        //this route is to send all dcs to frontend that are not closed
        const dcData = await dc.find({ createdAt: req.user.godown.id, closed: false }).populate("vehicle")
        if (dcData.length > 0) {
            res.status(200).send(dcData)
        } else {
            return res.status(400).send({ message: "No Delivery Challans Found" })
        }

    } catch (err) {

        console.log(err)
        res.sendStatus(500)
    }
})

Route.post("/transactions/delivery/delivery-challan/extend", async (req, res) => {
    const db = req.dbConnection
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const dcArray = Array.isArray(req.body.dcID) ? req.body.dcID : [req.body.dcID];
        console.log(req.body.dcID)
        for (const dcID of dcArray) {
            console.log(dcID)
            const dcData = await dc.findById(dcID).session(session)
            dcData.closed = false
            const newTimestanp = Date.now() + parseInt(req.company.transactions.deliveryChallans.threshold) * 24 * 60 * 60 * 1000
            dcData.expiry = newTimestanp
            await dcData.save()
        }

        await session.commitTransaction()
        res.sendStatus(200)
    } catch (err) {
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)
    } finally {
        session.endSession()
    }
})

Route.post("/transactions/delivery/delivery-challan/close", async (req, res) => {

    const db = req.dbConnection
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const dcArray = Array.isArray(req.body.dcID) ? req.body.dcID : [req.body.dcID];
        for (const dcID of dcArray) {
            const dcData = await dc.findById(dcID).session(session)


            //before closing dc we need to update status in each lr of dc  
            for (const data of dcData.material) {
                const lrData = await lr.findById(data.lrNumber).session(session)
                lrData.materialStatus.outForDelivery.qty -= data.numberOfPackages
                lrData.materialStatus.outForDelivery.chargedWeight -= data.chargedWeight
                lrData.materialStatus.outForDelivery.actualWeight -= data.actualWeight

                lrData.materialStatus.delivered.qty += data.numberOfPackages
                lrData.materialStatus.delivered.chargedWeight += data.chargedWeight
                lrData.materialStatus.delivered.actualWeight += data.actualWeight

                await lrData.save()
            }
            dcData.closed = true
            await dcData.save()


        }

        await session.commitTransaction()
        res.sendStatus(200)
    } catch (err) {
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)
    } finally {
        session.endSession()
    }

})

module.exports = Route