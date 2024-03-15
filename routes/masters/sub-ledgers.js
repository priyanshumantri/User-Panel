const express = require("express")
const Route = express.Router()
const ledgerSchema = require("../../models/masters/ledgers")
const groupSchema = require("../../models/masters/groups")


Route.get("/masters/sub-ledgers", async (req, res)=> {
    const db = req.dbConnection
    const ledger = db.model("ledgers", ledgerSchema)
    const group = db.model("groups", groupSchema)
    const ledgerData = await ledger.find({subLedger : false}).populate("group")
    const subLedgerData = await ledger.find({subLedger : true}).populate("under")
    res.render("masters/sub-ledgers", {data : ledgerData, subLedgerData : subLedgerData})
})

Route.post("/masters/sub-ledgers/new", async (req, res)=> {
    const db = req.dbConnection
    const {subLedger, under, openingBalance, openingBalanceType} = req.body
    //check if all fields are filled
    if(!subLedger || !under || !openingBalance || !openingBalanceType) {
        return res.status(400).json({message: "All fields are required"})
    }

    const ledger = db.model("ledgers", ledgerSchema)
    const ledgerData = await ledger.findById(under)
    if(!ledgerData) {
        return res.status(400).json({message : "Invalid Ledger"})
    }

    //create new sub-ledger
    const newLedger = new ledger({
        name : subLedger,
        group : ledgerData.group,
        openingBalance : {
            amount : openingBalance,
            type : openingBalanceType,
            fy : req.user.financialYear._id
        },
        under : under,
        subLedger : true,
        address : ledgerData.address
    })
    //save new sub-ledger
    const savedData = await newLedger.save()
    ledgerData.subLedgers.push(savedData._id)
    await ledgerData.save()
    res.sendStatus(200)
})

Route.post("/masters/sub-ledgers/delete", async (req, res)=> {
    const db = req.dbConnection
    const {id} = req.body
    const ledger = db.model("ledgers", ledgerSchema)
    //check if id is provided
    if(!id) {
        return res.sendStatus(500)
    }
    //check if there are existing transactions
    const subLedgerData = await ledger.findById(id)
    if(subLedgerData.transactions.length > 0) {
        return res.status(400).json({message : "Sub Ledger With Existing Transactions Cannot Be Deleted"})
    }
    //delete sub-ledger
    await ledger.findByIdAndDelete(id)
    return res.sendStatus(200)

})

Route.post("/masters/sub-ledgers/edit", async (req, res)=> {
    const db = req.dbConnection
    const ledger = db.model("ledgers", ledgerSchema)
    const {id, subLedger, under, openingBalance, openingBalanceType} = req.body
    //check if id is provided
    if(!id || !subLedger || !under || !openingBalance || !openingBalanceType) {
        return res.sendStatus(500)
    }
    //get sub-ledger data
    const ledgerData = await ledger.findById(id)
    ledgerData.name = subLedger
    ledgerData.openingBalance.amount = openingBalance
    ledgerData.openingBalance.type = openingBalanceType
    if(ledgerData.under.toString() !== under.toString()) {
        const newUnder = await ledger.findById(under)
        if(!newUnder) {
            return res.status(400).json({message : "Invalid Ledger"})
        }
        ledgerData.under = under
        ledgerData.group = newUnder.group
        ledgerData.address = newUnder.address
        ledgerData.subLedgers.pull(id)
        await ledgerData.save()
        newUnder.subLedgers.push(id)
        await newUnder.save()
    } 

    //save sub-ledger
    await ledgerData.save()
    res.sendStatus(200)
})


module.exports = Route