const express = require("express")
const Route = express.Router()
const {getPrintNumber, updatePrintNumber} = require("../../../custom_modules/serialCalculator")
const vehicleSchema = require("../../../models/masters/vehicles/vehicles")
const ownerSchema = require("../../../models/masters/vehicles/owners")
const brokerSchema = require("../../../models/masters/vehicles/brokers")
const citySchema = require("../../../models/masters/locations/cities")
const lrSchema = require("../../../models/transactions/bookings/lorry-reciept")
const getLedgers = require("../../../custom_modules/accounts/getLedgers")
const newEntry = require("../../../custom_modules/accounts/newEntry")
const removeEntry = require("../../../custom_modules/accounts/removeEntry")
const branchSchema = require("../../../models/masters/locations/branch")
const ledgerSchema = require("../../../models/masters/ledgers")
const localCollectionSchema = require("../../../models/transactions/bookings/local-collection-challan")

Route.get("/transactions/booking/local-collection-challan", async(req, res)=> {
    const db = req.dbConnection
    const vehicles = db.model("vehicles", vehicleSchema)
    const cities = db.model("cities", citySchema)
    const owners = db.model("owners", ownerSchema)
    const broker = db.model("brokers", brokerSchema)
    const lc = db.model("local-collection-challans", localCollectionSchema)
    const lcNumber = await getPrintNumber(db, req.user, "lcCALC")
    const cityData = await cities.find({})
    const vehicleDataFetched = await vehicles.find({}).populate("broker").populate("owner")
    const vehicleData = vehicleDataFetched.map((data) => {
        return {
            id: data.id,
            number: data.number,
            broker: data.broker ? data.broker.name : null,
            owner: data.owner ? data.owner.name : null
        }
    })
    const cashinhand = await getLedgers(db, "cashinhand")
    const bankAccounts = await getLedgers(db, "bankaccount")
    const sundrycreditors = await getLedgers(db, "sundrycreditors")
    const directExpenses = await getLedgers(db, "directexpenses")
    const lcData = await lc.find({createdAt : req.user.godown._id}).populate("to").populate({path : "vehicle", populate : {path : "broker"}})
    res.render("transactions/booking/local-collection-challan", {lcNumber, vehicleData, cityData, cashinhand, bankAccounts, sundrycreditors, directExpenses, lcData})
})

Route.get("/transactions/booking/local-collection-challan/get-lr-data", async (req, res)=> {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const lrData = await lr.find({bookingGodown : req.user.godown.id, localCollectionChallan: null});
    const lrInfo = await lrData.map((item)=> {
        return {
            actualWeight : item.total.actualWeight,
            chargedWeight : item.total.chargedWeight,
            NOP : item.total.qty,
            lrID : item._id,
            lrNumber : item.lrNumber
        }
    })
    res.status(200).send(lrInfo)
})

Route.post("/transactions/booking/local-collection-challan/new", async (req, res) => {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const localCollectionChallan = db.model("local-collection-challans", localCollectionSchema)
    const vehicles = db.model("vehicles", vehicleSchema)
    const broker = db.model("brokers", brokerSchema)
    const owners = db.model("owners", ownerSchema)
    const branch = db.model("branches", branchSchema)
    const ledgers = db.model("ledgers", ledgerSchema)
    const {
        deliveryChallanNumber,
        deliveryChallanDate,
        vehicleNumber,
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
            const newDC = new localCollectionChallan({
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
                const lorryHireTransactionID = await newEntry(db, session, req.user.branch.lorryHireExpenses, deliveryChallanDate, req.user.financialYear, "dr", freight, "narration", "localCollectionChallan", savedDC._id, [], "localCollectionChallan", savedDC._id)
                drAgainst.push({ ledger: req.user.branch.lorryHireExpenses, transactionID: lorryHireTransactionID })
                savedDC.freight.transactionID = lorryHireTransactionID
                await savedDC.save()
            }

            //Journal entry for other expenses (+) dr
            if (othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
                for (let i = 0; i < othersAddLedgerArray.length; i++) {
                    const transactionID = await newEntry(db, session, othersAddLedgerArray[i], deliveryChallanDate, req.user.financialYear, "dr", othersAddAmtArray[i], "narration", "localCollectionChallan", savedDC._id, [], "localCollectionChallan", savedDC._id)
                    drAgainst.push({ ledger: othersAddLedgerArray[i], transactionID: transactionID })
                    savedDC.othersAdd[i].transactionID = transactionID
                    await savedDC.save()
                }
            }

            let crAgainst = []

            //Journal Entry for other expenses (-) cr
            for (let i = 0; i < othersSubLedgerArray.length; i++) {
                if (othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                    const transactionID = await newEntry(db, session, othersSubLedgerArray[i], deliveryChallanDate, req.user.financialYear, "cr", othersSubAmtArray[i], "narration", "localCollectionChallan", savedDC._id, drAgainst, "localCollectionChallan", savedDC._id)
                    crAgainst.push({ ledger: othersSubLedgerArray[i], transactionID: transactionID })
                    savedDC.othersSub[i].transactionID = transactionID
                    await savedDC.save()
                }
            }


            //Journal Entry for balance lorry hire (branch) cr
            if (parseFloat(balance) > 0) {
                const balanceTransactionID = await newEntry(db, session, req.user.branch.balanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", balance, "narration", "localCollectionChallan", savedDC._id, drAgainst, "localCollectionChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.balanceLorryHire, transactionID: balanceTransactionID })
                savedDC.balance.transactionID = balanceTransactionID
                await savedDC.save()
            }

            //Journal Entry for advance lorry hire (branch) cr //ledger, status, date, amount
            if (cashStatus == "paid") {
                const cashTransactionID = await newEntry(db, session, cashLedger, cashDate, req.user.financialYear, "cr", cashAmount, "narration", "localCollectionChallan", savedDC._id, drAgainst, "localCollectionChallan", savedDC._id)
                crAgainst.push({ ledger: cashLedger, transactionID: cashTransactionID })
                savedDC.cashAdvance.transactionID = cashTransactionID
                await savedDC.save()
            }
            if (bankStatus == "paid") {
                const bankTransactionID = await newEntry(db, session, bankLedger, bankDate, req.user.financialYear, "cr", bankAmount, "narration", "localCollectionChallan", savedDC._id, drAgainst, "localCollectionChallan", savedDC._id)
                crAgainst.push({ ledger: bankLedger, transactionID: bankTransactionID })
                savedDC.bankAdvance.transactionID = bankTransactionID
                await savedDC.save()
            }
            if (dieselStatus == "paid") {
                const dieselTransactionID = await newEntry(db, session, dieselLedger, dieselDate, req.user.financialYear, "cr", dieselAmount, "narration", "localCollectionChallan", savedDC._id, drAgainst, "localCollectionChallan", savedDC._id)
                crAgainst.push({ ledger: dieselLedger, transactionID: dieselTransactionID })
                savedDC.dieselAdvance.transactionID = dieselTransactionID
                await savedDC.save()
            }
            if (cashStatus == "due" && parseFloat(cashAmount) > 0) {
                const cashTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", cashAmount, "narration", "localCollectionChallan", savedDC._id, drAgainst, "localCollectionChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: cashTransactionID })
                savedDC.cashAdvance.transactionID = cashTransactionID
                await savedDC.save()
            }
            if (bankStatus == "due" && parseFloat(bankAmount) > 0) {
                const bankTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", bankAmount, "narration", "localCollectionChallan", savedDC._id, drAgainst, "localCollectionChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: bankTransactionID })
                savedDC.bankAdvance.transactionID = bankTransactionID
                await savedDC.save()

            }
            if (dieselStatus == "due" && parseFloat(dieselAmount) > 0) {
                const dieselTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", dieselAmount, "narration", "localCollectionChallan", savedDC._id, drAgainst, "localCollectionChallan", savedDC._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: dieselTransactionID })
                savedDC.dieselAdvance.transactionID = dieselTransactionID
                await savedDC.save()
            }

            //updating crAgainst in dr transactions
            for (let i = 0; i < drAgainst.length; i++) {
                await ledgers.updateOne({ _id: drAgainst[i].ledger, "transactions._id": drAgainst[i].transactionID }, { $push: { "transactions.$.against": crAgainst } }).session(session)
            }

            //updating localCollectionChallan in each lr
            for(i=0; i<lrArray.length; i++) {
                await lr.findByIdAndUpdate(lrArray[i], {localCollectionChallan : savedDC._id}, {session : session})
            }

            await session.commitTransaction()
            return res.sendStatus(200)

        }
    } catch (err) {
        console.log(err);
        await session.abortTransaction()
    } finally {
        session.endSession()
    }

})

Route.get("/transactions/booking/local-collection-challan/edit",async(req, res)=> {
    const db = req.dbConnection
    const lc = db.model("local-collection-challans", localCollectionSchema)
    const lr = db.model("lorry-reciepts", lrSchema)
    const broker = db.model("brokers", brokerSchema)
    const owner = db.model("owners", ownerSchema)
    const vehicles = db.model("vehicles", vehicleSchema)
    const lcData = await lc.findById(req.query.id).populate("vehicle").populate({ path: "vehicle", populate: { path: "broker" } }).populate({ path: "material", populate: { path: "lrNumber" } }).populate({path : "vehicle", populate : {path : "owner"}})

    let maxData = []

    lcData.material.forEach((data)=> {maxData.push({
            actualWeight: data.lrNumber.total.actualWeight,
            chargedWeight: data.lrNumber.total.chargedWeight,
            NOP: data.lrNumber.total.qty,
            lrNumber: data.lrNumber.lrNumber
        })
    })

    return res.status(200).send({lcData, maxData})
})

Route.post("/transactions/booking/local-collection-challan/edit", async(req, res)=> {
    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const dc = db.model("local-collection-challans", localCollectionSchema)
    const {othersSubAmt, othersAddAmt, othersSubLedger, othersAddLedger, deliveryChallanDate, vehicleNumber, ownerName, to, lrNumber, NOP, actualWeight, chargedWeight, freight, advance, balance, cashAmount, cashStatus, cashLedger, cashDate, bankAmount, bankLedger, bankStatus, bankDate,  dieselAmount, dieselDate, dieselLedger, dieselStatus } = req.body
    const session = await db.startSession()
    const owners = db.model("owners", ownerSchema)
    const vehicles = db.model("vehicles", vehicleSchema)
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




             //removing localCollectionChallan from all old lr's
             for(i=0; i<dcData.material.length; i++) {
                 await lr.findByIdAndUpdate(dcData.material[i].lrNumber, {localCollectionChallan : null}, {session : session})
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
            dcData.material = []

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

            const constructedMaterial = []
            for (let i = 0; i < NOPArray.length; i++) {
                const newObject = {
                    lrNumber: lrArray[i],
                    numberOfPackages: NOPArray[i],
                    actualWeight: actualWeightArray[i],
                    chargedWeight: chargedWeightArray[i]
                };

                constructedMaterial.push(newObject);
            }

            dcData.othersAdd = constructedOthersAdd
            dcData.othersSub = constructedOthersSub
            const vehicleData = await vehicles.findById(vehicleNumber).populate("owner").populate("broker").session(session)
            dcData.material = constructedMaterial
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
                const lorryHireTransactionID = await newEntry(db, session, req.user.branch.lorryHireExpenses, deliveryChallanDate, req.user.financialYear, "dr", freight, "narration", "localCollectionChallan", dcData._id, [], "localCollectionChallan", dcData._id)
                dcData.freight.transactionID = lorryHireTransactionID
                drAgainst.push({ ledger: req.user.branch.lorryHireExpenses, transactionID: lorryHireTransactionID })
                await dcData.save()
            }

            //Journal entry for other expenses (+) dr
            if (othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
                for (let i = 0; i < othersAddLedgerArray.length; i++) {
                    const transactionID = await newEntry(db, session, othersAddLedgerArray[i], deliveryChallanDate, req.user.financialYear, "dr", othersAddAmtArray[i], "narration", "localCollectionChallan", dcData._id, [], "localCollectionChallan", dcData._id)
                    drAgainst.push({ ledger: othersAddLedgerArray[i], transactionID: transactionID })
                    dcData.othersAdd[i].transactionID = transactionID
                    await dcData.save()
                }
            }

            let crAgainst = []

            //Journal Entry for other expenses (-) cr
            for (let i = 0; i < othersSubLedgerArray.length; i++) {
                if (othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                    const transactionID = await newEntry(db, session, othersSubLedgerArray[i], deliveryChallanDate, req.user.financialYear, "cr", othersSubAmtArray[i], "narration", "localCollectionChallan", dcData._id, drAgainst, "localCollectionChallan", dcData._id)
                    crAgainst.push({ ledger: othersSubLedgerArray[i], transactionID: transactionID })
                    dcData.othersSub[i].transactionID = transactionID
                    await dcData.save()
                }
            }

            //Journal Entry for balance lorry hire (branch) cr
            if (parseFloat(balance) > 0) {
                const balanceTransactionID = await newEntry(db, session, req.user.branch.balanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", balance, "narration", "localCollectionChallan", dcData._id, drAgainst, "localCollectionChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.balanceLorryHire, transactionID: balanceTransactionID })
                dcData.balance.transactionID = balanceTransactionID
                await dcData.save()
            }

            //Journal Entry for advance lorry hire (branch) cr //ledger, status, date, amount
            if (cashStatus == "paid") {
                const cashTransactionID = await newEntry(db, session, cashLedger, cashDate, req.user.financialYear, "cr", cashAmount, "narration", "localCollectionChallan", dcData._id, drAgainst, "localCollectionChallan", dcData._id)
                crAgainst.push({ ledger: cashLedger, transactionID: cashTransactionID })
                dcData.cashAdvance.transactionID = cashTransactionID
                await dcData.save()
            }
            if (bankStatus == "paid") {
                const bankTransactionID = await newEntry(db, session, bankLedger, bankDate, req.user.financialYear, "cr", bankAmount, "narration", "localCollectionChallan", dcData._id, drAgainst, "localCollectionChallan", dcData._id)
                crAgainst.push({ ledger: bankLedger, transactionID: bankTransactionID })
                dcData.bankAdvance.transactionID = bankTransactionID
                await dcData.save()
            }
            if (dieselStatus == "paid") {
                const dieselTransactionID = await newEntry(db, session, dieselLedger, dieselDate, req.user.financialYear, "cr", dieselAmount, "narration", "localCollectionChallan", dcData._id, drAgainst, "localCollectionChallan", dcData._id)
                crAgainst.push({ ledger: dieselLedger, transactionID: dieselTransactionID })
                dcData.dieselAdvance.transactionID = dieselTransactionID
                await dcData.save()
            }
            if (cashStatus == "due" && parseFloat(cashAmount) > 0) {
                const cashTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", cashAmount, "narration", "localCollectionChallan", dcData._id, drAgainst, "localCollectionChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: cashTransactionID })
                dcData.cashAdvance.transactionID = cashTransactionID
                await dcData.save()
            }
            if (bankStatus == "due" && parseFloat(bankAmount) > 0) {
                const bankTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", bankAmount, "narration", "localCollectionChallan", dcData._id, drAgainst, "localCollectionChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: bankTransactionID })
                dcData.bankAdvance.transactionID = bankTransactionID
                await dcData.save()

            }
            if (dieselStatus == "due" && parseFloat(dieselAmount) > 0) {
                const dieselTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, deliveryChallanDate, req.user.financialYear, "cr", dieselAmount, "narration", "localCollectionChallan", dcData._id, drAgainst, "localCollectionChallan", dcData._id)
                crAgainst.push({ ledger: req.user.branch.advanceLorryHire, transactionID: dieselTransactionID })
                dcData.dieselAdvance.transactionID = dieselTransactionID
                await dcData.save()
            }

            //updating crAgainst in dr transactions
            for (let i = 0; i < drAgainst.length; i++) {
                await ledgers.updateOne({ _id: drAgainst[i].ledger, "transactions._id": drAgainst[i].transactionID }, { $push: { "transactions.$.against": crAgainst } }).session(session)
            }

          
            //updating localCollectionChallan in lr
            for(i=0; i< lrArray.length; i++) {
                await lr.findByIdAndUpdate(lrArray[i], {localCollectionChallan : dcData._id}, {session : session})
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
Route.post("/transactions/booking/local-collection-challan/delete", async (req, res) => {

    const db = req.dbConnection
    const lr = db.model("lorry-reciepts", lrSchema)
    const dc = db.model("local-collection-challans", localCollectionSchema)
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
            return res.status(400).send({ message: "Cannot Delete Local Collection Challan As payment is made against it" })
        } else {

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

            //updating localCollectionChallan in each lr
            dcData.material.forEach(async (data)=> {
                await lr.findByIdAndUpdate(data.lrNumber, {localCollectionChallan : null}, {sessiion : session})
            })
            



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


module.exports = Route