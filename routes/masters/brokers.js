const express = require("express")
const Route = express.Router()
const stateSchema = require("../../models/masters/locations/states")
const citySchema = require("../../models/masters/locations/cities")
const brokerSchema = require("../../models/masters/vehicles/brokers")
const ledgerSchema = require("../../models/masters/ledgers")
const groupSchema = require("../../models/masters/groups")
const { verifyEmail, updateEmail, updateEmailUsedFalse } = require("../../custom_modules/validations/email")
const { validateMobile, updateMobile, updateMobileUsedFalse } = require("../../custom_modules/validations/mobile")
const validatePANNumber = require("../../custom_modules/validations/pan")
const freightMemoSchema = require("../../models/transactions/accounts/freight-memo")
const crossingChallanSchema = require("../../models/transactions/delivery/crossing-challan")
const deliveryChallanSchema = require("../../models/transactions/delivery/delivery-challan")
const localCollectionSchema = require("../../models/transactions/bookings/local-collection-challan")
Route.get("/masters/brokers", async(req, res)=> {
    const db = req.dbConnection
    const state = db.model("states", stateSchema)
    const city = db.model("cities", citySchema)
    const broker = db.model("brokers", brokerSchema)
    const data = await broker.find({})
    const stateData = await state.find({})
    const cityData = await city.find({})
    res.render("masters/vehicles/brokers", {data, stateData, cityData})
})

Route.post("/masters/brokers/new", async(req, res)=> {
    const db = req.dbConnection
    const broker = db.model("brokers", brokerSchema)
    const ledger = db.model("ledgers", ledgerSchema)
    const group = db.model("groups", groupSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const {name, contactPerson, number, email, address, city, state, panCard, openingBalance, openingBalanceType} = req.body

        if(!name || !contactPerson || !address || !city || !state  ) {
            await session.abortTransaction()
            return res.status(400).send({message : "Please Fill All Required Fields"})
        }
        const mobileValidation = await validateMobile(req.company,db, session, number, "brokers")
        const emailValidation = await verifyEmail(req.company, db, session, email, "brokers")
        if(mobileValidation.status === false) {
            await session.abortTransaction()
            return res.status(400).send({message : mobileValidation.message})
        }
        if(emailValidation.status === false) {
            await session.abortTransaction()
            return res.status(400).send({message : emailValidation.message})
        }
        const validPAN = await validatePANNumber(req.company, panCard, "brokers")
        if(validPAN.status === false) {
            await session.abortTransaction()
            return res.status(400).send({message : validPAN.message})
        }


        const newBroker = new broker({
            name : name,
            email : email,
            mobile : number, 
            address : address,
            contactPerson : contactPerson,
            state : state,
            city : city,
            PAN : panCard,
            
        })



          const newBrokerID = await newBroker.save({session})

       const data = await group.findOne({name : 'Lorry Hire (Creditors)'}).session(session)

        const newLedger = new ledger({
            name : name,
            email : email,
            mobile : number,
            address : address,
            state : state,
            city : city,
            contactPerson : contactPerson,
            openingBalance : {
                amount : openingBalance,
                type : openingBalanceType
            },
            taxation : {
                PAN : panCard,
            },
            group : data._id,
            brokerLedger : true,
        })

        await newLedger.save({session})
        newBroker.ledger = newLedger._id
        await newBroker.save({session})

        if(number) {
            await updateMobile(db, session, number)
        }
        if(email) {
            await updateEmail(db, session, email)
        }


        await session.commitTransaction()
        return res.sendStatus(200)
    } catch(err){
        
        console.log(err)
        await session.abortTransaction()
       return res.sendStatus(500)
    } finally{
        session.endSession()
    }
})

Route.get("/masters/brokers/edit", async(req, res)=> {
    const db = req.dbConnection
    const broker = db.model("brokers", brokerSchema)
    const data = await broker.findById(req.query.id)

    if(data) {
        return res.status(200).send(data)
    } else {
        return res.status(400).send({message : "Broker Details Not Found"})
    }
})

Route.post("/masters/brokers/edit", async(req, res)=> {
    const db = req.dbConnection
    const broker = db.model("brokers", brokerSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const {id, name, contactPerson, number, email, address, city, state, panCard} = req.body

        if(!name || !contactPerson || !address || !city || !state ) {
            await session.abortTransaction()
            return res.status(400).send({message : "Please Fill All Required Fields"})
        }

        //updating email and mobile used as false
         const brokerToUpdate = await broker.findById(id).session(session)
         if(brokerToUpdate.mobile) {
            await updateMobileUsedFalse(db, session, brokerToUpdate.mobile)
            }
        if(brokerToUpdate.email) {
            await updateEmailUsedFalse(db, session, brokerToUpdate.email)
        }
        const mobileValidation = await validateMobile(req.company, db, session, number, "brokers", id)
        const emailValidation = await verifyEmail(req.company, db, session, email, "brokers", id)
        if(mobileValidation.status === false) {
            await session.abortTransaction()
            return res.status(400).send({message : mobileValidation.message})
        }
        if(emailValidation.status === false) {
            await session.abortTransaction()
            return res.status(400).send({message : emailValidation.message})
        }
        const validPAN = await validatePANNumber(req.company, panCard, "brokers")
        if(validPAN.status === false) {
            await session.abortTransaction()
            return res.status(400).send({message : validPAN.message})
        }
       brokerToUpdate.name = name
       brokerToUpdate.email = email
       brokerToUpdate.mobile = number
       brokerToUpdate.address = address
       brokerToUpdate.contactPerson = contactPerson
       brokerToUpdate.state = state
       brokerToUpdate.city = city
       brokerToUpdate.PAN = panCard


        await brokerToUpdate.save()
        await session.commitTransaction()
        return res.sendStatus(200)
    } catch(err){
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)
    } finally{
        session.endSession()
    }
})

Route.post("/masters/brokers/delete", async(req, res)=> {
    const db = req.dbConnection
    const broker = db.model("brokers", brokerSchema)
    const id = req.body.id
    const fm = db.model("freight-memos", freightMemoSchema)
    const cc = db.model("crossing-challans", crossingChallanSchema)
    const dc = db.model("delivery-challans", deliveryChallanSchema)
    const lc = db.model("local-collection-challans", localCollectionSchema)
    const session = await db.startSession()
    try {
        session.startTransaction()
        const idArray = Array.isArray(id) ? id : [id]
        const brokerToDelete = await broker.find({_id : {$in : idArray}}).session(session)
      
        for(let i = 0; i < brokerToDelete.length; i++) {
            const fmCheck = await fm.find({accountToLedger : brokerToDelete[i].ledger}).session(session)
            const ccCheck = await cc.find({accountToLedger : brokerToDelete[i].ledger}).session(session)
            const dcCheck = await dc.find({accountToLedger : brokerToDelete[i].ledger}).session(session)
            const lcCheck = await lc.find({accountToLedger : brokerToDelete[i].ledger}).session(session)
            if(fmCheck.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Broker is being used in Freight Memo, cannot delete"})
            }
            if(ccCheck.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Broker is being used in Crossing Challan, cannot delete"})
            }
            if(dcCheck.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Broker is being used in Delivery Challan, cannot delete"})
            }
            if(lcCheck.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Broker is being used in Local Collection Challan, cannot delete"})
            }

            if(brokerToDelete[i].vehicles.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Broker is being used in Vehicles, cannot delete"})
            }



            if(brokerToDelete[i].ledger) {
                await ledger.deleteOne({_id : brokerToDelete[i].ledger}).session(session)
            }

            if(brokerToDelete[i].mobile) {
                await updateMobileUsedFalse(db, session, brokerToDelete[i].mobile)
            }
            if(brokerToDelete[i].email) {
                await updateEmailUsedFalse(db, session, brokerToDelete[i].email)
            }
        }

        await broker.deleteMany({_id : {$in : idArray}}).session(session)
        console.log("done")

    } catch(err) {
        console.log(err)
        await session.abortTransaction()
        return res.sendStatus(500)
    } finally {
        session.endSession()
    }



    return res.sendStatus(200)
})
module.exports = Route