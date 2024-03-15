const express = require("express")
const Route = express.Router()
const challanSchema = require("../../../models/transactions/bookings/challan")
const godownSchema = require("../../../models/masters/locations/godowns")
const branchSchema = require("../../../models/masters/locations/branch")
const vehicleSchema = require("../../../models/masters/vehicles/vehicles")
const ownerSchema = require("../../../models/masters/vehicles/owners")
const brokerSchema = require("../../../models/masters/vehicles/brokers")
const ledgerSchema = require("../../../models/masters/ledgers")
const groupSchema = require("../../../models/masters/groups")
const fmSchema = require("../../../models/transactions/accounts/freight-memo")
const getLedgers = require("../../../custom_modules/accounts/getLedgers")
const newEntry = require("../../../custom_modules/accounts/newEntry")
const removeEntry = require("../../../custom_modules/accounts/removeEntry")
const { getPrintNumber, updatePrintNumber } = require("../../../custom_modules/serialCalculator")

Route.get("/transactions/accounts/freight-memo",async (req, res) => {
    const db = req.dbConnection
    const challan = db.model("challans", challanSchema)
    const challanData = await challan.find({fm : null, from : req.user.godown})
    const ledger = db.model("ledgers", ledgerSchema)
    const group = db.model("groups", groupSchema)
    const branch = db.model("branches", branchSchema)
    const ledgerData = await ledger.find({}).populate("group")
    const bankAccountLedgers = await getLedgers(db, "bankaccount")
    const cashAccountLedgers = await getLedgers(db, "cashinhand")
    const sundryCreditors = await getLedgers(db, "sundrycreditor")
    const directExpenses = await getLedgers(db, "directexpenses")
    const godownData = await branch.find({})
    const fmNumber = await getPrintNumber(db, req.user, "fmCALC")
    const fm = db.model("freight-memos", fmSchema)
    const fmData = await fm.find({createdAt : req.user.branch._id, fy : req.user.financialYear}).populate("challan").populate("payableAt")
    res.render("transactions/accounts/freight-memo", {fmData, fmNumber : fmNumber, directExpenses : directExpenses, sundryCreditors : sundryCreditors, challanData : challanData,  bankLedger : bankAccountLedgers, cashLedger : cashAccountLedgers, godownData : godownData})
})

Route.post("/transactions/accounts/freight-memo/get-challan-details",async (req, res) => {
    const {id} = req.body
    const db = req.dbConnection
    const challan = db.model("challans", challanSchema)
    const godown = db.model("godowns", godownSchema)
    const branch = db.model("branches", branchSchema)
    const vehicle = db.model("vehicles", vehicleSchema)
    const owners = db.model("owners", ownerSchema)
    const brokers = db.model("brokers", brokerSchema)
    const challanData = await challan.findById(id).populate("from").populate("to").populate("vehicle").populate({path: 'vehicle', populate: { path: 'broker' }}).populate({path: 'vehicle', populate: { path: 'owner' }})
    
    res.status(200).send({data : challanData})
})

Route.post("/transactions/accounts/freight-memo/new", async (req, res) => {
    const db = req.dbConnection
    const challanM = db.model("challans", challanSchema)
    const ledger = db.model("ledgers", ledgerSchema)
    const group = db.model("groups", groupSchema)
    const fm = db.model("freight-memos", fmSchema)
    const vehicle = db.model("vehicles", vehicleSchema)
    const broker = db.model("brokers", brokerSchema)
    const owner = db.model("owners", ownerSchema)
    const branch = db.model("branches", branchSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        let {fmNumber, fmDate, challan, accountTO, rateON, rate, freight, hamali, mamul, unloading, tdsP, tds, netFreight, advance, balance, payableAt, othersAddLedger, othersAddAmt, othersSubLedger, othersSubAmt, cashAmount, cashLedger, cashStatus, cashDate, bankAmount, bankLedger, bankStatus, bankDate, dieselAmount, dieselStatus, dieselDate, dieselLedger} = req.body

        //converting non array fields to array
        const othersAddLedgerArray = Array.isArray(othersAddLedger) ? othersAddLedger : [othersAddLedger]
        const othersAddAmtArray = Array.isArray(othersAddAmt) ? othersAddAmt : [othersAddAmt]
        const othersSubLedgerArray = Array.isArray(othersSubLedger) ? othersSubLedger : [othersSubLedger]
        const othersSubAmtArray = Array.isArray(othersSubAmt) ? othersSubAmt : [othersSubAmt]
        const challanData = await challanM.findById(challan).populate("from").populate("to").populate("vehicle").populate({path: 'vehicle', populate: { path: 'broker' }}).populate({path: 'vehicle', populate: { path: 'owner' }})
        //form validation
        if(!fmNumber || !fmDate || !challan || !accountTO || !rateON || !rate || !freight ||  !tdsP || !tds || !netFreight || !advance || !balance || !payableAt  ) {
       
            await session.abortTransaction()
            return res.status(400).send("Please fill all the fields")
        }
        const printNumber = await updatePrintNumber(db, session, req.user, "fmCALC", fmNumber)

        let constructedOthersAdd = []
        if(othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
            for(let i = 0; i < othersAddLedgerArray.length; i++) {
                constructedOthersAdd.push({ledger : othersAddLedgerArray[i], amount : othersAddAmtArray[i]})
            }
         }
            let constructedOthersSub = []
            if(othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                for(let i = 0; i < othersSubLedgerArray.length; i++) {
                    constructedOthersSub.push({ledger : othersSubLedgerArray[i], amount : othersSubAmtArray[i]})
                }
            }

        const newFreightMemo = new fm({
            number : printNumber,
            fy : req.user.financialYear,
            date : fmDate,
            challan : challan,
            accountTo : accountTO,
            accountToLedger : accountTO === "broker" ? challanData.vehicle.broker.ledger : challanData.vehicle.owner.ledger,
            rateON : rateON,
            rate : rate,
            freight : {
                amount : freight
            },
            hamali : {
                amount : hamali
            },
            mamul : {
                amount : mamul
            },
            unloading : {
                amount : unloading
            },
            tdsP : tdsP,
            tds : {
                amount : tds
            },
            netFreight : netFreight,
            advance : advance,
            balance : {
                amount : balance
            },
            payableAt : payableAt,
            othersAdd : constructedOthersAdd,
            othersSub : constructedOthersSub,
            cashAdvance : {
                cashAmount : cashAmount ? cashAmount : 0,
                cashLedger : cashLedger ? cashLedger : null,
                cashStatus : cashStatus,
                cashDate : cashDate ? cashDate : null
            },
            bankAdvance : {
                bankAmount : bankAmount ? bankAmount : 0,
                bankLedger : bankLedger ? bankLedger : null,
                bankStatus : bankStatus,
                bankDate : bankDate ? bankDate : null
            },
            dieselAdvance : {
                dieselAmount : dieselAmount ? dieselAmount : 0,
                dieselLedger : dieselLedger ? dieselLedger : null,
                dieselStatus : dieselStatus,
                dieselDate : dieselDate ? dieselDate : null
            },
            createdBy : req.user._id,
            createdAt : req.user.branch._id
            
        })

        //saving the freight memo
       const fmData = await newFreightMemo.save({session})
     
          let vehicleLedgerID 
        if(accountTO === "broker") {
            vehicleLedgerID = challanData.vehicle.broker.ledger
         } else {
            vehicleLedgerID = challanData.vehicle.owner.ledger
         }



         /* Journal Entry
            Lorry Hire a/c dr
            other Expenses (+) a/c dr
            Hamali a/c dr
                To Balance Lorry Hire (Branch)
                To Advance Lorry Hire (Branch)                
                To TDS Lorry Hire (Branch)
                To Other Expenses (-)
                To Mamul (-)
                To Unloading (-)
        */

         let drAgainst = [] //used in credit entries
         
         //Journal entry for lorry hire (direct expenses) dr
         if(parseFloat(freight) > 0) {
            const lorryHireTransactionID = await newEntry(db, session, req.user.branch.lorryHireExpenses, fmDate, req.user.financialYear, "dr", freight, "narration", "freightMemo", fmData._id, [], "freightMemo", fmData._id )
            drAgainst.push({ledger : req.user.branch.lorryHireExpenses, transactionID : lorryHireTransactionID})
            fmData.freight.transactionID = lorryHireTransactionID
            await fmData.save({session})    
        }
     
         //Journal entry for other expenses (+) dr
            if(othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") { 
                for(let i = 0; i < othersAddLedgerArray.length; i++) {
                    const transactionID = await newEntry(db, session, othersAddLedgerArray[i], fmDate, req.user.financialYear, "dr", othersAddAmtArray[i], "narration", "freightMemo", fmData._id, [], "freightMemo", fmData._id )
                    drAgainst.push({ledger : othersAddLedgerArray[i], transactionID : transactionID})
                    fmData.othersAdd[i].transactionID = transactionID
                    await fmData.save({session})
                }
            }

         //Journal entry for hamali dr
         if(parseFloat(hamali) > 0) {
            const hamaliTransactionID = await newEntry(db, session, req.user.branch.labourExpenses, fmDate, req.user.financialYear, "dr", hamali, "narration", "freightMemo", fmData._id, [], "freightMemo", fmData._id )
            drAgainst.push({ledger : req.user.branch.labourExpenses, transactionID : hamaliTransactionID})
            fmData.hamali.transactionID = hamaliTransactionID
            await fmData.save({session})   
        }


        
        
        
            let crAgainst = [] //used in debit entries
        //Journal entry for mamul cr
       if(parseFloat(mamul) > 0) {
        const mamulTransactionID = await newEntry(db, session, req.user.branch.mamulTapalAdvance, fmDate, req.user.financialYear, "cr", mamul, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
        crAgainst.push({ledger : req.user.branch.mamulTapalAdvance, transactionID : mamulTransactionID})
        fmData.mamul.transactionID = mamulTransactionID
        await fmData.save({session})     
    }

        //Journal entry for unloading cr.
         if(parseFloat(unloading) > 0) {
            const unloadingTransactionID = await newEntry(db, session, req.user.branch.unloadingLorry, fmDate, req.user.financialYear, "cr", unloading, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : req.user.branch.unloadingLorry, transactionID : unloadingTransactionID})
            fmData.unloading.transactionID = unloadingTransactionID
            await fmData.save({session})
        }

        //Journal entry for TDS cr
         if(parseFloat(tds) > 0) {
            const tdsTransactionID = await newEntry(db, session, req.user.branch.tdsOnLorryHire, fmDate, req.user.financialYear, "cr", tds, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : req.user.branch.tdsOnLorryHire, transactionID : tdsTransactionID})
            fmData.tds.transactionID = tdsTransactionID
            await fmData.save({session})
        }

        //Journal Entry for other expenses (-) cr
        for(let i = 0; i < othersSubLedgerArray.length; i++) {
          if(othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
            const transactionID = await newEntry(db, session, othersSubLedgerArray[i], fmDate, req.user.financialYear, "cr", othersSubAmtArray[i], "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : othersSubLedgerArray[i], transactionID : transactionID})
            fmData.othersSub[i].transactionID = transactionID
            await fmData.save({session})
        }
         }

        //Journal Entry for balance lorry hire (branch) cr
         if(parseFloat(balance) > 0) {
            const branchData = await branch.findById(payableAt)
            const balanceTransactionID = await newEntry(db, session, branchData.balanceLorryHire, fmDate, req.user.financialYear, "cr", balance, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : branchData.balanceLorryHire, transactionID : balanceTransactionID})
            fmData.balance.transactionID = balanceTransactionID
            await fmData.save({session})
        }

        //Journal Entry for advance lorry hire (branch) cr //ledger, status, date, amount
        if(cashStatus == "paid") {
            const cashTransactionID = await newEntry(db, session, cashLedger, cashDate, req.user.financialYear, "cr", cashAmount, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : cashLedger, transactionID : cashTransactionID})
            fmData.cashAdvance.transactionID = cashTransactionID
            await fmData.save({session})
        }
        if(bankStatus == "paid") {
            const bankTransactionID = await newEntry(db, session, bankLedger, bankDate, req.user.financialYear, "cr", bankAmount, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : bankLedger, transactionID : bankTransactionID})
            fmData.bankAdvance.transactionID = bankTransactionID
            await fmData.save({session})
        }
        if(dieselStatus == "paid") {
            const dieselTransactionID = await newEntry(db, session, dieselLedger, dieselDate, req.user.financialYear, "cr", dieselAmount, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : dieselLedger, transactionID : dieselTransactionID})
            fmData.dieselAdvance.transactionID = dieselTransactionID
            await fmData.save({session})
        }
        if(cashStatus == "due" && parseFloat(cashAmount) > 0) {
            const cashTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, fmDate, req.user.financialYear, "cr", cashAmount, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : req.user.branch.advanceLorryHire, transactionID : cashTransactionID})
            fmData.cashAdvance.transactionID = cashTransactionID
            await fmData.save({session})
        }
        if(bankStatus == "due" && parseFloat(bankAmount) > 0) {
            const bankTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, fmDate, req.user.financialYear, "cr", bankAmount, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : req.user.branch.advanceLorryHire, transactionID : bankTransactionID})
            fmData.bankAdvance.transactionID = bankTransactionID
            await fmData.save({session})

        }
        if(dieselStatus == "due" && parseFloat(dieselAmount) > 0) {
            const dieselTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, fmDate, req.user.financialYear, "cr", dieselAmount, "narration", "freightMemo", fmData._id, drAgainst, "freightMemo", fmData._id )
            crAgainst.push({ledger : req.user.branch.advanceLorryHire, transactionID : dieselTransactionID})
            fmData.dieselAdvance.transactionID = dieselTransactionID
            await fmData.save({session})
        }

        //now we will update crAgainst in dr entries
        for(let i = 0; i < drAgainst.length; i++) {
            await ledger.updateOne({_id : drAgainst[i].ledger, "transactions._id" : drAgainst[i].transactionID}, {$push : {"transactions.$.against" : crAgainst}}).session()
        }
        challanData.fm = fmData._id
        await challanData.save({session})
        await session.commitTransaction()
        return res.sendStatus(200)
    } catch(err) {
        console.log(err)
        await session.abortTransaction()
        return res.sendStatus(500)
    } finally {
        session.endSession()
    }
})

Route.get("/transactions/accounts/freight-memo/edit", async (req, res) => {
    const db = req.dbConnection
    const fm = db.model("freight-memos", fmSchema)
    const challan = db.model("challans", challanSchema)
    const vehicle = db.model("vehicles", vehicleSchema)
    const broker = db.model("brokers", brokerSchema)
    const branch = db.model("branches", branchSchema)
    const owner = db.model("owners", ownerSchema)
    const fmData = await fm.findById(req.query.id)
    const challanData = await challan.findById(fmData.challan).populate("from").populate("to").populate("vehicle").populate({path: 'vehicle', populate: { path: 'broker' }}).populate({path: 'vehicle', populate: { path: 'owner' }})
    fmData.challan = challanData
    return res.status(200).send(fmData)
})

Route.post("/transactions/accounts/freight-memo/edit", async (req, res) => {
    const db = req.dbConnection
    const challanM = db.model("challans", challanSchema)
    const ledger = db.model("ledgers", ledgerSchema)
    const group = db.model("groups", groupSchema)
    const fm = db.model("freight-memos", fmSchema)
    const branch = db.model("branches", branchSchema)
    const vehicle = db.model("vehicles", vehicleSchema)
    const broker = db.model("brokers", brokerSchema)
    const owner = db.model("owners", ownerSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        let {fmNumber, fmDate, editID, displayChallan, accountTO, rateON, rate, freight, hamali, mamul, unloading, tdsP, tds, netFreight, advance, balance, payableAt, othersAddLedger, othersAddAmt, othersSubLedger, othersSubAmt, cashAmount, cashLedger, cashStatus, cashDate, bankAmount, bankLedger, bankStatus, bankDate, dieselAmount, dieselStatus, dieselDate, dieselLedger} = req.body

        //converting non array fields to array
        const othersAddLedgerArray = Array.isArray(othersAddLedger) ? othersAddLedger : [othersAddLedger]
        const othersAddAmtArray = Array.isArray(othersAddAmt) ? othersAddAmt : [othersAddAmt]
        const othersSubLedgerArray = Array.isArray(othersSubLedger) ? othersSubLedger : [othersSubLedger]
        const othersSubAmtArray = Array.isArray(othersSubAmt) ? othersSubAmt : [othersSubAmt]

        //form validation
        if(!fmNumber || !fmDate || !displayChallan || !accountTO || !rateON || !rate || !freight ||  !tdsP || !tds || !netFreight || !advance || !balance || !payableAt  ) {
    
            await session.abortTransaction()
            return res.status(400).send("Please fill all the fields")
        }

        //reversing all the transactions
        const oldFMData = await fm.findById(editID)
        const oldAccountToLedger = await ledgers.findById(oldFMData.accountToLedger).session(session)
        if(oldFMData.accountTO !== req.body.accountTO) {
            
            const filtered = oldAccountToLedger.transactions.filter((element) => element.reference.rel == oldFMData.id)
            if(filtered && filtered.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Cannot Change Account To Ledger As Already a payment is made against this delivery challan"})
            }
         }

         const filteredBalance = oldAccountToLedger.transactions.filter((element) => element.reference.forV == "balanceLorryHire" && element.reference.rel == oldFMData.id)
         const totalBalance = filteredBalance.reduce((acc, curr) => acc + curr.amount, 0)

            if(parseFloat(balance) < totalBalance) {
                await session.abortTransaction()
                return res.status(400).send({message : "Balance Cannot Be Less Than Already Paid Balance"})
            }

            const filteredAdvance = oldAccountToLedger.transactions.filter((element) => element.reference.forV == "advanceLorryHire" && element.reference.rel == oldFMData.id)
            const totalAdvance = filteredAdvance.reduce((acc, curr) => acc + curr.amount, 0)

            const newTotalAdvance = cashStatus == "due" ? parseFloat(cashAmount) : 0 + bankStatus == "due" ? parseFloat(bankAmount) : 0 + dieselStatus == "due" ? parseFloat(dieselAmount) : 0
            if(newTotalAdvance < totalAdvance) {
                await session.abortTransaction()
                return res.status(400).send({message : "Due Advance Cannot Be Less Than Already Paid Advance"})
            }
        if(oldFMData.accountTO !== accountTO) {
            const oldLedgerData = await ledger.findById(oldFMData.accountToLedger)
            const filtered = oldLedgerData.transactions.filter(item => item.reference.rel == oldFMData.id)
            if(filtered && filtered.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Account To Cannot be changed since payment is already made against this freight memo."})
             }
         }
        const challanData = await challanM.findById(displayChallan).populate("from").populate("to").populate("vehicle").populate({path: 'vehicle', populate: { path: 'broker' }}).populate({path: 'vehicle', populate: { path: 'owner' }})
        //removing freight transaction
        if(oldFMData.freight.transactionID) {
            await removeEntry(db, session, req.user.branch.lorryHireExpenses , oldFMData.freight.transactionID)
        }
        //removing hamali transaction
        if(oldFMData.hamali.transactionID) {
            await removeEntry(db, session, req.user.branch.labourExpenses , oldFMData.hamali.transactionID)
        }
        //removing mamul transaction
        if(oldFMData.mamul.transactionID) {
            await removeEntry(db, session, req.user.branch.mamulTapalAdvance , oldFMData.mamul.transactionID)
        }
        //removing unloading transaction
        if(oldFMData.unloading.transactionID) {
            await removeEntry(db, session, req.user.branch.unloadingLorry , oldFMData.unloading.transactionID)
        }
        //removing tds transaction
        if(oldFMData.tds.transactionID) {
            await removeEntry(db, session, req.user.branch.tdsOnLorryHire , oldFMData.tds.transactionID)
        }
        //removing balance transaction
        if(oldFMData.balance.transactionID) {
            const branchData = await branch.findById(oldFMData.payableAt)
            await removeEntry(db, session, branchData.balanceLorryHire , oldFMData.balance.transactionID)
        }
        //removing others add transactions
        for(let i = 0; i < oldFMData.othersAdd.length; i++) {
            if(oldFMData.othersAdd[i].transactionID) {
                await removeEntry(db, session, oldFMData.othersAdd[i].ledger , oldFMData.othersAdd[i].transactionID)
            }
        }
        //removing others sub transactions
        for(let i = 0; i < oldFMData.othersSub.length; i++) {
            if(oldFMData.othersSub[i].transactionID) {
                await removeEntry(db, session, oldFMData.othersSub[i].ledger , oldFMData.othersSub[i].transactionID)
            }
        }
        //removing cash transaction
        if(oldFMData.cashAdvance.transactionID) {
            await removeEntry(db, session, oldFMData.cashAdvance.cashLedger , oldFMData.cashAdvance.transactionID)
        }
        //removing bank transaction
        if(oldFMData.bankAdvance.transactionID) {
            await removeEntry(db, session, oldFMData.bankAdvance.bankLedger , oldFMData.bankAdvance.transactionID)
        }
        //removing diesel transaction
        if(oldFMData.dieselAdvance.transactionID) {
            await removeEntry(db, session, oldFMData.dieselAdvance.dieselLedger , oldFMData.dieselAdvance.transactionID)
        }
        
        oldFMData.othersAdd = []
        oldFMData.othersSub = []
        await oldFMData.save({session})

        //constructing others add
        let constructedOthersAdd = []
        if(othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") {
            for(let i = 0; i < othersAddLedgerArray.length; i++) {
                constructedOthersAdd.push({ledger : othersAddLedgerArray[i], amount : othersAddAmtArray[i], transactionID : null})
            }
         }
           
         //constructing others sub
        let constructedOthersSub = []
            if(othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
                for(let i = 0; i < othersSubLedgerArray.length; i++) {
                    constructedOthersSub.push({ledger : othersSubLedgerArray[i], amount : othersSubAmtArray[i], transactionID : null})
                }
            }

        //updating the freight memo
        oldFMData.otherAdd = constructedOthersAdd
        oldFMData.otherSub = constructedOthersSub
        await oldFMData.save({session})
        oldFMData.date = fmDate
        oldFMData.accountTo = accountTO
        oldFMData.accountToLedger = accountTO === "broker" ? challanData.vehicle.broker.ledger : challanData.vehicle.owner.ledger
        oldFMData.rateON = rateON
        oldFMData.rate = rate
        oldFMData.freight.amount = freight
        oldFMData.hamali.amount = hamali
        oldFMData.mamul.amount = mamul
        oldFMData.unloading.amount = unloading
        oldFMData.tdsP = tdsP
        oldFMData.tds.amount = tds
        oldFMData.netFreight = netFreight
        oldFMData.advance = advance
        oldFMData.balance.amount = balance
        oldFMData.payableAt = payableAt
        oldFMData.cashAdvance = {
            cashAmount : cashAmount ? cashAmount : 0,
            cashLedger : cashLedger ? cashLedger : null,
            cashStatus : cashStatus,
            cashDate : cashDate ? cashDate : null
        }
        oldFMData.bankAdvance = {
            bankAmount : bankAmount ? bankAmount : 0,
            bankLedger : bankLedger ? bankLedger : null,
            bankStatus : bankStatus,
            bankDate : bankDate ? bankDate : null
        }
        oldFMData.dieselAdvance = {
            dieselAmount : dieselAmount ? dieselAmount : 0,
            dieselLedger : dieselLedger ? dieselLedger : null,
            dieselStatus : dieselStatus,
            dieselDate : dieselDate ? dieselDate : null
        }

        await oldFMData.save({session})
        let drAgainst = [] //used in credit entries
         
        //Journal entry for lorry hire (direct expenses) dr
        if(parseFloat(freight) > 0) {
           const lorryHireTransactionID = await newEntry(db, session, req.user.branch.lorryHireExpenses, fmDate, req.user.financialYear, "dr", freight, "narration", "freightMemo", oldFMData._id, [], "freightMemo", oldFMData._id )
           drAgainst.push({ledger : req.user.branch.lorryHireExpenses, transactionID : lorryHireTransactionID})
           oldFMData.freight.transactionID = lorryHireTransactionID
           await oldFMData.save({session})    
       }
    
        //Journal entry for other expenses (+) dr
           if(othersAddLedgerArray.length > 0 && typeof othersAddLedgerArray[0] !== "undefined") { 
               for(let i = 0; i < othersAddLedgerArray.length; i++) {
                   const transactionID = await newEntry(db, session, othersAddLedgerArray[i], fmDate, req.user.financialYear, "dr", othersAddAmtArray[i], "narration", "freightMemo", oldFMData._id, [], "freightMemo", oldFMData._id )
                   drAgainst.push({ledger : othersAddLedgerArray[i], transactionID : transactionID})
                   constructedOthersAdd[i].transactionID = transactionID
                   oldFMData.othersAdd = constructedOthersAdd
                   await oldFMData.save({session})
               }
           }

        //Journal entry for hamali dr
        if(parseFloat(hamali) > 0) {
           const hamaliTransactionID = await newEntry(db, session, req.user.branch.labourExpenses, fmDate, req.user.financialYear, "dr", hamali, "narration", "freightMemo", oldFMData._id, [], "freightMemo", oldFMData._id )
           drAgainst.push({ledger : req.user.branch.labourExpenses, transactionID : hamaliTransactionID})
           oldFMData.hamali.transactionID = hamaliTransactionID
           await oldFMData.save({session})   
       }


       
       
       
           let crAgainst = [] //used in debit entries
       //Journal entry for mamul cr
      if(parseFloat(mamul) > 0) {
       const mamulTransactionID = await newEntry(db, session, req.user.branch.mamulTapalAdvance, fmDate, req.user.financialYear, "cr", mamul, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
       crAgainst.push({ledger : req.user.branch.mamulTapalAdvance, transactionID : mamulTransactionID})
       oldFMData.mamul.transactionID = mamulTransactionID
       await oldFMData.save({session})     
   }

       //Journal entry for unloading cr.// note unloading ledger to be updated. currently using mamul ledger
        if(parseFloat(unloading) > 0) {
           const unloadingTransactionID = await newEntry(db, session, req.user.branch.unloadingLorry, fmDate, req.user.financialYear, "cr", unloading, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : req.user.branch.unloadingLorry, transactionID : unloadingTransactionID})
           oldFMData.unloading.transactionID = unloadingTransactionID
           await oldFMData.save({session})
       }

       //Journal entry for TDS cr
        if(parseFloat(tds) > 0) {
           const tdsTransactionID = await newEntry(db, session, req.user.branch.tdsOnLorryHire, fmDate, req.user.financialYear, "cr", tds, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : req.user.branch.tdsOnLorryHire, transactionID : tdsTransactionID})
           oldFMData.tds.transactionID = tdsTransactionID
           await oldFMData.save({session})
       }

       //Journal Entry for other expenses (-) cr
       for(let i = 0; i < othersSubLedgerArray.length; i++) {
         if(othersSubLedgerArray.length > 0 && typeof othersSubLedgerArray[0] !== "undefined") {
           const transactionID = await newEntry(db, session, othersSubLedgerArray[i], fmDate, req.user.financialYear, "cr", othersSubAmtArray[i], "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : othersSubLedgerArray[i], transactionID : transactionID})
           constructedOthersSub[i].transactionID = transactionID
              oldFMData.othersSub = constructedOthersSub
           await oldFMData.save({session})
       }
        }

       //Journal Entry for balance lorry hire (branch) cr
        if(parseFloat(balance) > 0) {
           const branchData = await branch.findById(payableAt)
           const balanceTransactionID = await newEntry(db, session, branchData.balanceLorryHire, fmDate, req.user.financialYear, "cr", balance, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : branchData.balanceLorryHire, transactionID : balanceTransactionID})
           oldFMData.balance.transactionID = balanceTransactionID
           await oldFMData.save({session})
       }

       //Journal Entry for advance lorry hire (branch) cr //ledger, status, date, amount
       if(cashStatus == "paid"  && cashAmount > 0) {
           const cashTransactionID = await newEntry(db, session, cashLedger, cashDate, req.user.financialYear, "cr", cashAmount, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : cashLedger, transactionID : cashTransactionID})
           oldFMData.cashAdvance.transactionID = cashTransactionID
           await oldFMData.save({session})
       }
       if(bankStatus == "paid" && bankAmount > 0) {
           const bankTransactionID = await newEntry(db, session, bankLedger, bankDate, req.user.financialYear, "cr", bankAmount, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : bankLedger, transactionID : bankTransactionID})
           oldFMData.bankAdvance.transactionID = bankTransactionID
           await oldFMData.save({session})
       }
       if(dieselStatus == "paid" && dieselAmount > 0) {
           const dieselTransactionID = await newEntry(db, session, dieselLedger, dieselDate, req.user.financialYear, "cr", dieselAmount, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : dieselLedger, transactionID : dieselTransactionID})
           oldFMData.dieselAdvance.transactionID = dieselTransactionID
           await oldFMData.save({session})
       }
       if(cashStatus == "due" && parseFloat(cashAmount) > 0) {
           const cashTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, fmDate, req.user.financialYear, "cr", cashAmount, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : req.user.branch.advanceLorryHire, transactionID : cashTransactionID})
           oldFMData.cashAdvance.transactionID = cashTransactionID
           await oldFMData.save({session})
       }
       if(bankStatus == "due" && parseFloat(bankAmount) > 0) {
           const bankTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, fmDate, req.user.financialYear, "cr", bankAmount, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : req.user.branch.advanceLorryHire, transactionID : bankTransactionID})
           oldFMData.bankAdvance.transactionID = bankTransactionID
           await oldFMData.save({session})

       }
       if(dieselStatus == "due" && parseFloat(dieselAmount) > 0) {
           const dieselTransactionID = await newEntry(db, session, req.user.branch.advanceLorryHire, fmDate, req.user.financialYear, "cr", dieselAmount, "narration", "freightMemo", oldFMData._id, drAgainst, "freightMemo", oldFMData._id )
           crAgainst.push({ledger : req.user.branch.advanceLorryHire, transactionID : dieselTransactionID})
           oldFMData.dieselAdvance.transactionID = dieselTransactionID
           await oldFMData.save({session})
       }

       //now we will update crAgainst in dr entries
       for(let i = 0; i < drAgainst.length; i++) {
           const ledgerData = await ledger.findById(drAgainst[i].ledger).session(session)
           const found = ledgerData.transactions.find(element => element._id.toString() == drAgainst[i].transactionID.toString())
              found.against = crAgainst
              await ledgerData.save({session})
           
       }
       await session.commitTransaction()
         return res.sendStatus(200)
       

    }
    catch(err) {
        console.log(err)
        await session.abortTransaction()
        return res.sendStatus(500)
    } finally {
        session.endSession()
    }
})

Route.get("/transactions/accounts/freight-memo/delete", async (req, res) => {
    const db = req.dbConnection
    const fm = db.model("freight-memos", fmSchema)
    const ledger = db.model("ledgers", ledgerSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const fmData = await fm.findById(req.query.id)
        const ledgerData = await ledger.findById(fmData.accountToLedger).session(session)
        const filtered = ledgerData.transactions.filter(element => element.reference.rel == fmData._id)
        if(filtered.length > 0) {
            await session.abortTransaction()
            return res.status(400).send({message : "Receipt created for this freight memo. Please delete the receipt first."})
        }

        //removing freight transaction
        if(fmData.freight.transactionID) {
            await removeEntry(db, session, req.user.branch.lorryHireExpenses , fmData.freight.transactionID)
        }
        //removing hamali transaction
        if(fmData.hamali.transactionID) {
            await removeEntry(db, session, req.user.branch.labourExpenses , fmData.hamali.transactionID)
        }
        //removing mamul transaction
        if(fmData.mamul.transactionID) {
            await removeEntry(db, session, req.user.branch.mamulTapalAdvance , fmData.mamul.transactionID)
        }
        //removing unloading transaction
        if(fmData.unloading.transactionID) {
            await removeEntry(db, session, req.user.branch.unloadingLorry , fmData.unloading.transactionID)
        }
        //removing tds transaction
        if(fmData.tds.transactionID) {
            await removeEntry(db, session, req.user.branch.tdsOnLorryHire , fmData.tds.transactionID)
        }
        //removing balance transaction
        if(fmData.balance.transactionID) {
            const branchData = await branch.findById(fmData.payableAt)
            await removeEntry(db, session, branchData.balanceLorryHire , fmData.balance.transactionID)
        }
        //removing others add transactions
        for(let i = 0; i < fmData.othersAdd.length; i++) {
            if(fmData.othersAdd[i].transactionID) {
                await removeEntry(db, session, fmData.othersAdd[i].ledger , fmData.othersAdd[i].transactionID)
            }
        }
        //removing others sub transactions
        for(let i = 0; i < fmData.othersSub.length; i++) {
            if(fmData.othersSub[i].transactionID) {
                await removeEntry(db, session, fmData.othersSub[i].ledger , fmData.othersSub[i].transactionID)
            }
        }
        //removing cash transaction
        if(fmData.cashAdvance.transactionID) {
            await removeEntry(db, session, fmData.cashAdvance.cashLedger , fmData.cashAdvance.transactionID)
        }
        //removing bank transaction
        if(fmData.bankAdvance.transactionID) {
            await removeEntry(db, session, fmData.bankAdvance.bankLedger , fmData.bankAdvance.transactionID)
        }
        //removing diesel transaction
        if(fmData.dieselAdvance.transactionID) {
            await removeEntry(db, session, fmData.dieselAdvance.dieselLedger , fmData.dieselAdvance.transactionID)
        }
        await fmData.remove({session})
        await session.commitTransaction()
        return res.sendStatus(200)


    } catch(err) {
        await session.abortTransaction()
        console.log(err)
        return res.sendStatus(500)
    } finally {
        session.endSession()
    }
})

module.exports = Route