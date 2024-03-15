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
const crossingChallanSchema = require("../../../models/transactions/delivery/crossing-challan")
const branchSchema = require("../../../models/masters/locations/branch")
const godownSchema = require("../../../models/masters/locations/godowns")
const brokerSchema = require("../../../models/masters/vehicles/brokers")
const fySchema = require("../../../models/financialYear")
const { getPrintNumber, updatePrintNumber } = require("../../../custom_modules/serialCalculator")
const ledgerSchema = require("../../../models/masters/ledgers")
Route.get("/transactions/delivery/crossing-challan", async (req, res) => {
    const db = req.dbConnection
    const vehicles = db.model("vehicles", vehiclesSchema)
    const cities = db.model("cities", citiesSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const branch = db.model("branches", branchSchema)
    const godown = db.model("godowns", godownSchema)
    const cc = db.model("crossing-challans", crossingChallanSchema)
    const broker = db.model("brokers", brokerSchema)
    const owner = db.model("owners", ownersSchema)
    const fy = db.model("financial-years", fySchema)
    const directExpenses = await getLedgers(db, "directexpenses")
    const bankAccounts = await getLedgers(db, "bankaccount")
    const cashinhand = await getLedgers(db, "cashinhand")
    const sundrycreditors = await getLedgers(db, "sundrycreditors")
    const ccData = await cc.find({ createdAt: req.user.godown.id }).populate("vehicle").populate("to").populate({ path: "vehicle", populate: { path: "broker" } }).sort({ timestamp: -1 })
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
    const brokerData = await broker.find({})
    const fyData = await fy.findOne({ _id: req.user.financialYear })
    const dcNumber = await getPrintNumber(db, req.user, "crossingCALC")

    res.render("transactions/delivery/crossing-challan", { brokerData, bankAccounts, cashinhand, sundrycreditors, directExpenses, dcNumber, vehicleData: vehicleData, cityData: cityData, branchData, ccData })
})



Route.get("/transactions/delivery/crossing-challan/get-broker-details", async (req, res) => {
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



Route.get("/transactions/delivery/crossing-challan/get-package-details", async (req, res) => {
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


Route.post("/transactions/delivery/crossing-challan/new", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const crossingChallan = db.model("crossing-challans", crossingChallanSchema)
    const godown = db.model("godowns", godownSchema)
    const fy = db.model("financial-years", fySchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const brokers = db.model("brokers", brokerSchema)
    const owners = db.model("owners", ownersSchema)
    const branch = db.model("branches", branchSchema)
    const ledgers = db.model("ledgers", ledgerSchema)
    const {
        crossingChallanNumber,
        crossingChallanDate,
        transporter,
        rateON,
        rate, 
        crossingAmt,
        doorDelivery,
        lrCharges,
        ewayBillCharges,
        deliveryCommission,
        vehicleNumber,
        ownerName,
        to,
        lrNumber,
        NOP,
        actualWeight,
        chargedWeight,
        accountTO,
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
        addCount,
        subCount

    } = req.body
    const session = await db.startSession()

    try {
        session.startTransaction()

        if (!crossingChallanDate) {
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
            const rateONArray = Array.isArray(rateON) ? rateON : [rateON];
            const rateArray = Array.isArray(rate) ? rate : [rate];
            const crossingAmtArray = Array.isArray(crossingAmt) ? crossingAmt : [crossingAmt];
            const doorDeliveryArray = Array.isArray(doorDelivery) ? doorDelivery : [doorDelivery];
            const lrChargesArray = Array.isArray(lrCharges) ? lrCharges : [lrCharges];
            const ewayBillChargesArray = Array.isArray(ewayBillCharges) ? ewayBillCharges : [ewayBillCharges];
            const deliveryCommissionArray = Array.isArray(deliveryCommission) ? deliveryCommission : [deliveryCommission];
            const subCountArray = Array.isArray(subCount) ? subCount : [subCount];
            const addCountArray = Array.isArray(addCount) ? addCount : [addCount];
            for(i=0; i<crossingAmtArray.length; i++) {
                if(crossingAmtArray[i] == "" || crossingAmtArray[i] == null || parseFloat(crossingAmtArray[i]) === 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Please Enter Valid Crossing Amount"})
                }
            }



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

            
           
            let startIndex1 = 0
            let startIndex2 = 0
            for (let i = 0; i < NOPArray.length; i++) {
                    let constructedOthersAdd = []
                    let constructedOthersSub = []

                    // now we will slice othersAddAmt and othersAddLedger to match the count of addCountArray
                    const othersAddAmtArraySliced = othersAddAmtArray.slice(startIndex1, startIndex1 + parseFloat(addCountArray[i]))
                    const othersAddLedgerArraySliced = othersAddLedgerArray.slice(startIndex1, startIndex1 + parseFloat(addCountArray[i]))
                    const othersSubAmtArraySliced = othersSubAmtArray.slice(startIndex2, startIndex2 + parseFloat(subCountArray[i]))
                    const othersSubLedgerArraySliced = othersSubLedgerArray.slice(startIndex2, startIndex2 + parseFloat(subCountArray[i]))
                    for (let j = 0; j < parseFloat(addCountArray[i]); j++) {
                        if (parseFloat(othersAddAmtArraySliced[j]) > 0) {
                            constructedOthersAdd.push({
                                amount: parseFloat(othersAddAmtArraySliced[j]),
                                ledger: othersAddLedgerArraySliced[j]
                            })
                        }
                    }
                    for (let j = 0; j < parseFloat(subCountArray[i]); j++) {
                        if (parseFloat(othersSubAmtArraySliced[j]) > 0) {
                            constructedOthersSub.push({
                                amount: parseFloat(othersSubAmtArraySliced[j]),
                                ledger: othersSubLedgerArraySliced[j]
                            })
                        }
                    }
                    startIndex1 += parseFloat(addCountArray[i])
                    startIndex2 += parseFloat(subCountArray[i])
                const newObject = {
                    lrNumber: lrArray[i],
                    numberOfPackages: NOPArray[i],
                    actualWeight: actualWeightArray[i],
                    chargedWeight: chargedWeightArray[i],
                    crossingAmt : {
                        amount : parseFloat(crossingAmtArray[i])
                    },
                    doorDelivery : {
                        amount : parseFloat(doorDeliveryArray[i])
                    },
                    lrCharges : {
                        amount : parseFloat(lrChargesArray[i])
                    },
                    ewayBillCharges : {
                        amount : parseFloat(ewayBillChargesArray[i])
                    },
                    deliveryCommission : {
                        amount : parseFloat(deliveryCommissionArray[i])
                    },

                    rateON : rateONArray[i],
                    rate : parseFloat(rateArray[i]),
                    othersAdd : constructedOthersAdd,
                    othersSub : constructedOthersSub
                };

                material.push(newObject);
            }


            const vehicleData = await vehicles.findById(vehicleNumber).populate("owner").populate("broker").session(session)
            const newDCNumber = await updatePrintNumber(db, session, req.user, "crossingCALC", crossingChallanNumber)
            const transporterData = await brokers.findById(transporter).session(session)
            const newDC = new crossingChallan({
                number: newDCNumber,
                date: crossingChallanDate,
                vehicle: vehicleNumber,
                to: to,
                material: material,
                createdBy: req.user.id,
                createdAt: req.user.godown.id,
                expiry: Date.now() + parseInt(req.company.transactions.crossingChallans.threshold) * 24 * 60 * 60 * 1000,
                accountTO : accountTO,
                accountToLedger : accountTO == "broker" ? vehicleData.broker.ledger : vehicleData.owner.ledger,
                transporter : transporter,
                transporterLedger : transporterData.ledger,
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
            //crossing Amt
            for(i=0; i<crossingAmtArray.length; i++) {
                if (parseFloat(crossingAmtArray[i]) > 0) {
                    const id = await newEntry(db, session, req.user.branch.crossingExpenses, crossingChallanDate, req.user.financialYear, "dr", crossingAmtArray[i], "narration", "crossingChallan", savedDC._id, [], "crossingChallan", savedDC._id)
                    drAgainst.push({ ledger: req.user.branch.crossingExpenses, transactionID: id })
                    savedDC.material[i].crossingAmt.transactionID = id
                    await savedDC.save()
                }
            }

            //door delivery
            for(i=0; i< doorDeliveryArray.length; i++) {
                if (parseFloat(doorDeliveryArray[i]) > 0) {
                        const id = await newEntry(db, session, req.user.branch.doorDeliveryExpenses, crossingChallanDate, req.user.financialYear, "dr", doorDeliveryArray[i], "narration", "crossingChallan", savedDC._id, [], "crossingChallan", savedDC._id)
                        drAgainst.push({ ledger: req.user.branch.doorDeliveryExpenses, transactionID: id })
                        savedDC.material[i].doorDelivery.transactionID =  id
                        await savedDC.save()
                }
            }

            //delivery commission 
            for(i=0; i< deliveryCommissionArray.length; i++) {
                if (parseFloat(deliveryCommissionArray[i]) > 0) {
                        const id = await newEntry(db, session, req.user.branch.crossingCommission, crossingChallanDate, req.user.financialYear, "dr", deliveryCommissionArray[i], "narration", "crossingChallan", savedDC._id, [], "crossingChallan", savedDC._id)
                        drAgainst.push({ ledger: req.user.branch.crossingCommission, transactionID: id })
                        savedDC.material[i].deliveryCommission.transactionID =  id
                        await savedDC.save()
                }
            }





            //Journal entry for other expenses (+) dr
            if (othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
                let startIndex1 = 0
              // we will repeat the same process as above when we were slicing the arrays
                for (let i = 0; i < addCountArray.length; i++) {
                    for(j=0; j< parseFloat(addCountArray[i]); j++) {
                        if (parseFloat(othersAddAmtArray[j]) > 0) {
                        const id = await newEntry(db, session, othersAddLedgerArray[startIndex1 + j], crossingChallanDate, req.user.financialYear, "dr", othersAddAmtArray[startIndex1 + j], "narration", "crossingChallan", savedDC._id, [], "crossingChallan", savedDC._id)
                        drAgainst.push({ ledger: othersAddLedgerArray[startIndex1 + j], transactionID: id })
                        savedDC.material[i].othersAdd[j].transactionID = id
                        await savedDC.save()
                        }
                    }
                    startIndex1 += parseFloat(addCountArray[i])
                }

            }

            let crAgainst = []

            //Journal Entry for other expenses (-) cr
            if (othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                // we will repeat the same process as above when we were slicing the arrays
                let startIndex2 = 0
                for (let i = 0; i < subCountArray.length; i++) {
                    for(j=0; j< parseFloat(subCountArray[i]); j++) {
                        if (parseFloat(othersSubAmtArray[j]) > 0) {
                        const id = await newEntry(db, session, othersSubLedgerArray[startIndex2 + j], crossingChallanDate, req.user.financialYear, "cr", othersSubAmtArray[startIndex2 + j], "narration", "crossingChallan", savedDC._id, drAgainst, "crossingChallan", savedDC._id)
                        crAgainst.push({ ledger: othersSubLedgerArray[startIndex2 + j], transactionID: id })
                        savedDC.material[i].othersSub[j].transactionID = id
                        await savedDC.save()
                        }
                    }
                    startIndex2 += parseFloat(subCountArray[i])
                }
            }



            //Journal Entry for balance lorry hire (branch) cr
            if (parseFloat(balance) > 0) {
                const balanceTransactionID = await newEntry(db, session, req.user.branch.balanceLorryHire, crossingChallanDate, req.user.financialYear, "cr", balance, "narration", "crossingChallan", savedDC._id, drAgainst, "crossingChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.balanceLorryHire, transactionID: balanceTransactionID })
                savedDC.balance.transactionID = balanceTransactionID
                await savedDC.save()
            }

            //Journal Entry for advance lorry hire (branch) cr //ledger, status, date, amount
            if (cashStatus == "paid") {
                const cashTransactionID = await newEntry(db, session, cashLedger, cashDate, req.user.financialYear, "cr", cashAmount, "narration", "crossingChallan", savedDC._id, drAgainst, "crossingChallan", savedDC._id)
                crAgainst.push({ ledger: cashLedger, transactionID: cashTransactionID })
                savedDC.cashAdvance.transactionID = cashTransactionID
                await savedDC.save()
            }
            if (bankStatus == "paid") {
                const bankTransactionID = await newEntry(db, session, bankLedger, bankDate, req.user.financialYear, "cr", bankAmount, "narration", "crossingChallan", savedDC._id, drAgainst, "crossingChallan", savedDC._id)
                crAgainst.push({ ledger: bankLedger, transactionID: bankTransactionID })
                savedDC.bankAdvance.transactionID = bankTransactionID
                await savedDC.save()
            }
            if (dieselStatus == "paid") {
                const dieselTransactionID = await newEntry(db, session, dieselLedger, dieselDate, req.user.financialYear, "cr", dieselAmount, "narration", "crossingChallan", savedDC._id, drAgainst, "crossingChallan", savedDC._id)
                crAgainst.push({ ledger: dieselLedger, transactionID: dieselTransactionID })
                savedDC.dieselAdvance.transactionID = dieselTransactionID
                await savedDC.save()
            }
            if (cashStatus == "due" && parseFloat(cashAmount) > 0) {
                const cashTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, crossingChallanDate, req.user.financialYear, "cr", cashAmount, "narration", "crossingChallan", savedDC._id, drAgainst, "crossingChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: cashTransactionID })
                savedDC.cashAdvance.transactionID = cashTransactionID
                await savedDC.save()
            }
            if (bankStatus == "due" && parseFloat(bankAmount) > 0) {
                const bankTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, crossingChallanDate, req.user.financialYear, "cr", bankAmount, "narration", "crossingChallan", savedDC._id, drAgainst, "crossingChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: bankTransactionID })
                savedDC.bankAdvance.transactionID = bankTransactionID
                await savedDC.save()

            }
            if (dieselStatus == "due" && parseFloat(dieselAmount) > 0) {
                const dieselTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, crossingChallanDate, req.user.financialYear, "cr", dieselAmount, "narration", "crossingChallan", savedDC._id, drAgainst, "crossingChallan", savedDC._id)
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
                    lrData.crossingChallans.push(savedDC.id);
                    await lrData.save();

                    // updating status schema in lr

                    //removing out for delivery material from delivery godown
                    lrData.materialStatus.deliveryGodown.qty = lrData.materialStatus.deliveryGodown.qty - parseInt(NOPArray[index])
                    lrData.materialStatus.deliveryGodown.actualWeight = lrData.materialStatus.deliveryGodown.actualWeight - parseFloat(actualWeightArray[index])
                    lrData.materialStatus.deliveryGodown.chargedWeight = lrData.materialStatus.deliveryGodown.chargedWeight - parseFloat(chargedWeightArray[index])

                    //adding out for delivery material in out for delivery status
                    lrData.materialStatus.transfer.qty = lrData.materialStatus.transfer.qty + parseInt(NOPArray[index])

                    lrData.materialStatus.transfer.actualWeight = lrData.materialStatus.transfer.actualWeight + parseFloat(actualWeightArray[index])

                    lrData.materialStatus.transfer.chargedWeight = lrData.materialStatus.transfer.chargedWeight + parseFloat(chargedWeightArray[index])

                    await lrData.save()

                    const updateGodown = await godown.findById(req.user.godown.id).session(session)
                    // updating stock in branch and pushing dc in branch

                    updateGodown.crossingChallans.push(savedDC.id)

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
            return res.sendStatus(200)

        }
    } catch (err) {
        console.log(err);
        await session.abortTransaction()
        res.sendStatus(500)
    } finally {
        session.endSession()
    }

})

Route.get("/transactions/delivery/crossing-challan/edit", async (req, res) => {
    const db = req.dbConnection
    const dc = db.model("crossing-challans", crossingChallanSchema)
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

Route.get("/transactions/delivery/crossing/get-lr-data", async (req, res) => {
    const db = req.dbConnection
    const godown = db.model("godowns", godownSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const crossing = db.model("crossing-challans", crossingChallanSchema)
    try {
        const crossingData = await crossing.find({ expired: true })
        if (crossingData.length > 0) {
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
                        NOP: filteredGodownData.qty,
                        totalFreight : lrDetail.total.amount
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


Route.post("/transactions/delivery/crossing-challan/edit", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const dc = db.model("crossing-challans", crossingChallanSchema)
    const godown = db.model("godowns", godownSchema)
    const {
        othersSubAmt, 
        othersAddAmt, 
        othersSubLedger, 
        othersAddLedger, 
        crossingChallanDate, 
        vehicleNumber, 
        ownerName, 
        to, 
        lrNumber, 
        NOP, 
        actualWeight, 
        chargedWeight, 
        advance, 
        balance, 
        cashAmount, 
        cashStatus, 
        cashLedger, 
        cashDate,
        bankAmount, 
        bankLedger, 
        bankStatus, 
        bankDate,  
        dieselAmount, 
        dieselDate, 
        dieselLedger, 
        dieselStatus,
        transporter,
        crossingAmt,
        doorDelivery,
        deliveryCommission,
        addCount,
        subCount,
        rateON,
        rate

    } = req.body
    const session = await db.startSession()
    const owners = db.model("owners", ownersSchema)
    const vehicles = db.model("vehicles", vehiclesSchema)
    const branch = db.model("branches", branchSchema)
    const ledgers = db.model("ledgers", ledgerSchema)
    const brokers = db.model("brokers", brokerSchema)
    try {
        session.startTransaction()

        if (!crossingChallanDate) {
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
            const rateONArray = Array.isArray(rateON) ? rateON : [rateON];
            const rateArray = Array.isArray(req.body.rate) ? rate : [rate];
            const crossingAmtArray = Array.isArray(crossingAmt) ? crossingAmt : [crossingAmt];
            const doorDeliveryArray = Array.isArray(doorDelivery) ? doorDelivery : [doorDelivery];
            const deliveryCommissionArray = Array.isArray(deliveryCommission) ? deliveryCommission: [deliveryCommission];
            const subCountArray = Array.isArray(subCount) ? subCount : [subCount];
            const addCountArray = Array.isArray(addCount) ? addCount : [addCount];
            const typeArray = Array.isArray(req.body.type) ? req.body.type : [req.body.type];
            
            const dcData = await dc.findById(req.body.id).session(session)

            const oldAccountToLedger = await ledgers.findById(dcData.transporterLedger).session(session)
            if(dcData.transporter !== transporter) {
                
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

   // removing old material transactions
   for (let i = 0; i < dcData.material.length; i++) {
    //removing crossing amt transaction
    if (dcData.material[i].crossingAmt.transactionID) {
        await removeEntry(db, session, req.user.branch.crossingExpenses, dcData.material[i].crossingAmt.transactionID)
    }
    //removing door delivery transaction
    if (dcData.material[i].doorDelivery.transactionID) {
        await removeEntry(db, session, req.user.branch.doorDeliveryExpenses, dcData.material[i].doorDelivery.transactionID)
    }
    //removing delivery commission transaction
    if (dcData.material[i].deliveryCommission.transactionID) {
        await removeEntry(db, session, req.user.branch.crossingCommission, dcData.material[i].deliveryCommission.transactionID)
    }
    //removing other expenses transaction
    for (let j = 0; j < dcData.material[i].othersAdd.length; j++) {
        if (dcData.material[i].othersAdd[j].transactionID) {
            await removeEntry(db, session, dcData.material[i].othersAdd[j].ledger, dcData.material[i].othersAdd[j].transactionID)
        }
    }
    for (let j = 0; j < dcData.material[i].othersSub.length; j++) {
        if (dcData.material[i].othersSub[j].transactionID) {
            await removeEntry(db, session, dcData.material[i].othersSub[j].ledger, dcData.material[i].othersSub[j].transactionID)
        }
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

                    lrData.materialStatus.transfer.qty -= filteredDC.numberOfPackages
                    lrData.materialStatus.transfer.chargedWeight -= filteredDC.chargedWeight
                    lrData.materialStatus.transfer.actualWeight -= filteredDC.actualWeight
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

                    lrData.materialStatus.transfer.qty += parseInt(NOPArray[i])
                    lrData.materialStatus.transfer.chargedWeight += parseFloat(chargedWeightArray[i])
                    lrData.materialStatus.transfer.actualWeight += parseFloat(actualWeightArray[i])
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
                    lrData.materialStatus.transfer.qty -= filteredDC.numberOfPackages
                    lrData.materialStatus.transfer.chargedWeight -= filteredDC.chargedWeight
                    lrData.materialStatus.transfer.actualWeight -= filteredDC.actualWeight

                    lrData.crossingChallans.pull(dcData.id)
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
                    lrData.materialStatus.transfer.qty += parseInt(NOPArray[i])
                    lrData.materialStatus.transfer.chargedWeight += parseFloat(chargedWeightArray[i])
                    lrData.materialStatus.transfer.actualWeight += parseFloat(actualWeightArray[i])
                    lrData.crossingChallans.push(dcData.id)
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

            //removing old balance transaction
            if(dcData.balance.amount > 0){
                await removeEntry(db, session, req.user.branch.balanceLorryHire, dcData.balance.transactionID)
            }

            dcData.material = []

            await dcData.save()
            
            const constructedMaterial = []
            let startIndex1 = 0
            let startIndex2 = 0
            for (let i = 0; i < lrArray.length; i++) {
                let constructedOthersAdd = []
                let constructedOthersSub = []

                // now we will slice othersAddAmt and othersAddLedger to match the count of addCountArray
                const othersAddAmtArraySliced = othersAddAmtArray.slice(startIndex1, startIndex1 + parseFloat(addCountArray[i]))
                const othersAddLedgerArraySliced = othersAddLedgerArray.slice(startIndex1, startIndex1 + parseFloat(addCountArray[i]))
                const othersSubAmtArraySliced = othersSubAmtArray.slice(startIndex2, startIndex2 + parseFloat(subCountArray[i]))
                const othersSubLedgerArraySliced = othersSubLedgerArray.slice(startIndex2, startIndex2 + parseFloat(subCountArray[i]))
                for (let j = 0; j < parseFloat(addCountArray[i]); j++) {
                    if (parseFloat(othersAddAmtArraySliced[j]) > 0) {
                        constructedOthersAdd.push({
                            amount: parseFloat(othersAddAmtArraySliced[j]),
                            ledger: othersAddLedgerArraySliced[j]
                        })
                    }
                }
                for (let j = 0; j < parseFloat(subCountArray[i]); j++) {
                    if (parseFloat(othersSubAmtArraySliced[j]) > 0) {
                        constructedOthersSub.push({
                            amount: parseFloat(othersSubAmtArraySliced[j]),
                            ledger: othersSubLedgerArraySliced[j]
                        })
                    }
                }
                startIndex1 += parseFloat(addCountArray[i])
                startIndex2 += parseFloat(subCountArray[i])
                
                const newObject = {
                    rateON : rateONArray[i],
                    rate : rateArray[i],
                    lrNumber: lrArray[i],
                    numberOfPackages: parseInt(NOPArray[i]),
                    actualWeight: parseFloat(actualWeightArray[i]),
                    chargedWeight: parseFloat(chargedWeightArray[i]),
                    crossingAmt: {
                        amount: parseFloat(crossingAmtArray[i]),
                    },
                    doorDelivery: {
                        amount: parseFloat(doorDeliveryArray[i]),
                    },
                    deliveryCommission: {
                        amount: parseFloat(deliveryCommissionArray[i]),
                    },
                    othersAdd: constructedOthersAdd,
                    othersSub: constructedOthersSub,
                }
                constructedMaterial.push(newObject)
            }
                        


                dcData.material = constructedMaterial
                await dcData.save()
            const brokerData = await brokers.findById(transporter).session(session)

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
            dcData.transporter = req.body.transporter
            dcData.transporterLedger = brokerData.ledger
            await dcData.save()

            //Journal entry for lorry hire (direct expenses) dr
            let drAgainst = []
            //Journal entry for lorry hire (direct expenses) dr
            //crossing Amt
            for(i=0; i<crossingAmtArray.length; i++) {
                if (parseFloat(crossingAmtArray[i]) > 0) {
                    const id = await newEntry(db, session, req.user.branch.crossingExpenses, crossingChallanDate, req.user.financialYear, "dr", crossingAmtArray[i], "narration", "crossingChallan", dcData._id, [], "crossingChallan", dcData._id)
                    drAgainst.push({ ledger: req.user.branch.crossingExpenses, transactionID: id })
                    dcData.material[i].crossingAmt.transactionID = id
                    await dcData.save()
                }
            }

            //door delivery
            for(i=0; i< doorDeliveryArray.length; i++) {
                if (parseFloat(doorDeliveryArray[i]) > 0) {
                        const id = await newEntry(db, session, req.user.branch.doorDeliveryExpenses, crossingChallanDate, req.user.financialYear, "dr", doorDeliveryArray[i], "narration", "crossingChallan", dcData._id, [], "crossingChallan", dcData._id)
                        drAgainst.push({ ledger: req.user.branch.doorDeliveryExpenses, transactionID: id })
                        dcData.material[i].doorDelivery.transactionID =  id
                        await dcData.save()
                }
            }

            //delivery commission 
            for(i=0; i< deliveryCommissionArray.length; i++) {
                if (parseFloat(deliveryCommissionArray[i]) > 0) {
                        const id = await newEntry(db, session, req.user.branch.crossingCommission, crossingChallanDate, req.user.financialYear, "dr", deliveryCommissionArray[i], "narration", "crossingChallan", dcData._id, [], "crossingChallan", dcData._id)
                        drAgainst.push({ ledger: req.user.branch.crossingCommission, transactionID: id })
                        dcData.material[i].deliveryCommission.transactionID =  id
                        await dcData.save()
                }
            }





            //Journal entry for other expenses (+) dr
            if (othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
                let startIndex1 = 0
              // we will repeat the same process as above when we were slicing the arrays
                for (let i = 0; i < addCountArray.length; i++) {
                    for(j=0; j< parseFloat(addCountArray[i]); j++) {
                        if (parseFloat(othersAddAmtArray[j]) > 0) {
                        const id = await newEntry(db, session, othersAddLedgerArray[startIndex1 + j], crossingChallanDate, req.user.financialYear, "dr", othersAddAmtArray[startIndex1 + j], "narration", "crossingChallan", dcData._id, [], "crossingChallan", dcData._id)
                        drAgainst.push({ ledger: othersAddLedgerArray[startIndex1 + j], transactionID: id })
                        dcData.material[i].othersAdd[j].transactionID = id
                        await dcData.save()
                        }
                    }
                    startIndex1 += parseFloat(addCountArray[i])
                }

            }

            let crAgainst = []

            //Journal Entry for other expenses (-) cr
            if (othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                // we will repeat the same process as above when we were slicing the arrays
                let startIndex2 = 0
                for (let i = 0; i < subCountArray.length; i++) {
                    for(j=0; j< parseFloat(subCountArray[i]); j++) {
                        if (parseFloat(othersSubAmtArray[j]) > 0) {
                        const id = await newEntry(db, session, othersSubLedgerArray[startIndex2 + j], crossingChallanDate, req.user.financialYear, "cr", othersSubAmtArray[startIndex2 + j], "narration", "crossingChallan", dcData._id, drAgainst, "crossingChallan", dcData._id)
                        crAgainst.push({ ledger: othersSubLedgerArray[startIndex2 + j], transactionID: id })
                        dcData.material[i].othersSub[j].transactionID = id
                        await dcData.save()
                        }
                    }
                    startIndex2 += parseFloat(subCountArray[i])
                }
            }


            //Journal Entry for balance lorry hire (branch) cr
            if (parseFloat(balance) > 0) {
                const balanceTransactionID = await newEntry(db, session, req.user.branch.balanceLorryHire, crossingChallanDate, req.user.financialYear, "cr", balance, "narration", "crossingChallan", dcData._id, drAgainst, "crossingChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.balanceLorryHire, transactionID: balanceTransactionID })
                dcData.balance.transactionID = balanceTransactionID
                await dcData.save()
            }

            //Journal Entry for advance lorry hire (branch) cr //ledger, status, date, amount
            if (cashStatus == "paid") {
                const cashTransactionID = await newEntry(db, session, cashLedger, cashDate, req.user.financialYear, "cr", cashAmount, "narration", "crossingChallan", dcData._id, drAgainst, "crossingChallan", dcData._id)
                crAgainst.push({ ledger: cashLedger, transactionID: cashTransactionID })
                dcData.cashAdvance.transactionID = cashTransactionID
                await dcData.save()
            }
            if (bankStatus == "paid") {
                const bankTransactionID = await newEntry(db, session, bankLedger, bankDate, req.user.financialYear, "cr", bankAmount, "narration", "crossingChallan", dcData._id, drAgainst, "crossingChallan", dcData._id)
                crAgainst.push({ ledger: bankLedger, transactionID: bankTransactionID })
                dcData.bankAdvance.transactionID = bankTransactionID
                await dcData.save()
            }
            if (dieselStatus == "paid") {
                const dieselTransactionID = await newEntry(db, session, dieselLedger, dieselDate, req.user.financialYear, "cr", dieselAmount, "narration", "crossingChallan", dcData._id, drAgainst, "crossingChallan", dcData._id)
                crAgainst.push({ ledger: dieselLedger, transactionID: dieselTransactionID })
                dcData.dieselAdvance.transactionID = dieselTransactionID
                await dcData.save()
            }
            if (cashStatus == "due" && parseFloat(cashAmount) > 0) {
                const cashTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, crossingChallanDate, req.user.financialYear, "cr", cashAmount, "narration", "crossingChallan", dcData._id, drAgainst, "crossingChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: cashTransactionID })
                dcData.cashAdvance.transactionID = cashTransactionID
                await dcData.save()
            }
            if (bankStatus == "due" && parseFloat(bankAmount) > 0) {
                const bankTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, crossingChallanDate, req.user.financialYear, "cr", bankAmount, "narration", "crossingChallan", dcData._id, drAgainst, "crossingChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: bankTransactionID })
                dcData.bankAdvance.transactionID = bankTransactionID
                await dcData.save()

            }
            if (dieselStatus == "due" && parseFloat(dieselAmount) > 0) {
                const dieselTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, crossingChallanDate, req.user.financialYear, "cr", dieselAmount, "narration", "crossingChallan", dcData._id, drAgainst, "crossingChallan", dcData._id)
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


Route.post("/transactions/delivery/crossing-challan/delete", async (req, res) => {

    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const dc = db.model("crossing-challans", crossingChallanSchema)
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
        }  else if (dcData.closed === true) {
            await session.abortTransaction()
            return res.status(400).send({ message: "Delivery Challan is Already Closed" })
        } else {
            for (const data of dcData.material) {
                //updating material status in lr
                const lrData = await lr.findById(data.lrNumber).session(session)
                lrData.materialStatus.deliveryGodown.qty += data.numberOfPackages
                lrData.materialStatus.deliveryGodown.chargedWeight += data.chargedWeight
                lrData.materialStatus.deliveryGodown.actualWeight += data.actualWeight

                lrData.materialStatus.transfer.qty -= data.numberOfPackages
                lrData.materialStatus.transfer.chargedWeight -= data.chargedWeight
                lrData.materialStatus.transfer.actualWeight -= data.actualWeight

                //updating stock in godown
                const godownData = await godown.findById(req.user.godown.id).session(session)
                const filteredGodownData = godownData.stock.find((element) => element.lrNumber.toString() === data.lrNumber.toString())
                filteredGodownData.qty += data.numberOfPackages
                filteredGodownData.chargedWeight += data.chargedWeight
                filteredGodownData.actualWeight += data.actualWeight

                lrData.crossingChallans.pull(dcData.id)
                godownData.crossingChallans.pull(dcData.id)
                await lrData.save()
                await godownData.save()
            }

      
            for (const data of dcData.material) {
                      //removing crossing amt transaction
                if (data.crossingAmt.transactionID) {
                    await removeEntry(db, session, req.user.branch.crossingExpenses, data.crossingAmt.transactionID)
                }
                //removing door delivery transaction
                if (data.doorDelivery.transactionID) {
                    await removeEntry(db, session, req.user.branch.doorDeliveryExpenses, data.doorDelivery.transactionID)
                }
                //removing delivery commission transaction
                if (data.deliveryCommission.transactionID) {
                    await removeEntry(db, session, req.user.branch.crossingCommission, data.deliveryCommission.transactionID)
                }
                //removing other expenses transaction
                for (let j = 0; j < data.othersAdd.length; j++) {
                    if (data.othersAdd[j].transactionID) {
                        await removeEntry(db, session, data.othersAdd[j].ledger, data.othersAdd[j].transactionID)
                    }
                }
                for (let j = 0; j < data.othersSub.length; j++) {
                    if (data.othersSub[j].transactionID) {
                        await removeEntry(db, session, data.othersSub[j].ledger, data.othersSub[j].transactionID)
                    }
                }

            }

            //removing balance transaction
            if(dcData.balance.amount > 0){
                await removeEntry(db, session, req.user.branch.balanceLorryHire, dcData.balance.transactionID)
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

Route.get("/transactions/delivery/crossing-challan/close", async (req, res) => {
    const db = req.dbConnection
    const dc = db.model("crossing-challans", crossingChallanSchema)
    const vehicle = db.model("vehicles", vehiclesSchema)

    try {
        //this route is to send all dcs to frontend that are not closed
        const dcData = await dc.find({ createdAt: req.user.godown.id, closed: false }).populate("vehicle")
        if (dcData.length > 0) {
            res.status(200).send(dcData)
        } else {
            return res.status(400).send({ message: "No Crossing Challans Found" })
        }

    } catch (err) {

        console.log(err)
        res.sendStatus(500)
    }
})

Route.post("/transactions/delivery/crossing-challan/extend", async (req, res) => {
    const db = req.dbConnection
    const dc = db.model("crossing-challans", crossingChallanSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const dcArray = Array.isArray(req.body.dcID) ? req.body.dcID : [req.body.dcID];
        for (const dcID of dcArray) {
            const dcData = await dc.findById(dcID).session(session)
            dcData.closed = false
            const newTimestanp = Date.now() + parseInt(req.company.transactions.crossingChallans.threshold) * 24 * 60 * 60 * 1000
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

Route.post("/transactions/delivery/crossing-challan/close", async (req, res) => {

    const db = req.dbConnection
    const dc = db.model("crossing-challans", crossingChallanSchema)
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
                lrData.materialStatus.transfer.qty -= data.numberOfPackages
                lrData.materialStatus.transfer.chargedWeight -= data.chargedWeight
                lrData.materialStatus.transfer.actualWeight -= data.actualWeight

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