const express = require("express")
const Route = express.Router()
const ledgersSchema = require("../../../models/masters/ledgers")
const roSchema = require("../../../models/masters/rates/rate-on")
const citiesSchema = require("../../../models/masters/locations/cities")
const cdrSchema = require("../../../models/masters/rates/rate-master")
const groupSchema = require("../../../models/masters/groups")
const getLedgers = require("../../../custom_modules/accounts/getLedgers")
Route.get("/masters/rates/rate-master", async(req,res)=> {

    const db = req.dbConnection
    const ledgers = db.model("ledgers", ledgersSchema)
    const ro = db.model("rate-on", roSchema)
    const city = db.model("cities", citiesSchema)
    const cdr = db.model("client-default-rates", cdrSchema)
    const groups = db.model("groups", groupSchema)
    const clientDATA = await getLedgers(db, "sundrydebtors")
    const rateONDATA = await ro.find({})
    const cityDATA = await city.find({})
    const cdrDATA = await cdr.find({}).populate("from").populate("to").populate("client").populate("rateON")
    res.render("masters/rates/rate-master", {clientDATA, rateONDATA, cityDATA, cdrDATA})
})



function checkForConflicts(fromValueArray, toValueArray, chargeArray, basicArray) {
    const conflictIndex = []
    // first we check for conflict in multiple basic added for same charge Type
    for(i=0; i < chargeArray.length; i++) {
        for(j=0; j< chargeArray.length; j++) {
            if(parseInt(basicArray[i]) > 0 && chargeArray[i] === chargeArray[j] && i !== j) {
                let error = `Conflict In Index ${i} & ${j}`
                conflictIndex.push(error)
            }
        }
    }


    const filteredIndices = basicArray.map((value, index) => value <= 5 ? index : -1).filter(index => index !== -1);
    //checking for range conflict

    for(i=0; i<filteredIndices.length; i++) {
      for(j=0; j<filteredIndices.length; j++) {
        if((parseFloat(fromValueArray[filteredIndices[i]]) <= parseFloat(toValueArray[filteredIndices[j]]) && parseFloat(toValueArray[filteredIndices[i]] )>= parseFloat(fromValueArray[filteredIndices[j]]) || 
            parseFloat(fromValueArray[filteredIndices[j]]) <= parseFloat(toValueArray[filteredIndices[i]]) && parseFloat(toValueArray[filteredIndices[j]]) >= parseFloat(fromValueArray[filteredIndices[i]])) && chargeArray[i] === chargeArray[j]
            && i !== j) {
            let error = `Conflict In Index ${i} & ${j}`
                conflictIndex.push(error)
        }
      }
    }


    return conflictIndex
  }
  
  

Route.post("/masters/rates/rate-master", async(req, res)=> {
    const db = req.dbConnection
    const cdr = db.model("client-default-rates", cdrSchema)
    const ro = db.model("rate-on", roSchema)
    const session = await db.startSession()
    try { 
        session.startTransaction()
        const {forValue, client, rateON, effectiveDate, from, to, charge, chargeType,  basic, fromValue, toValue, amount} = req.body
        const chargeArray = Array.isArray(charge) ? charge : [charge];
        const chargeTypeArray = Array.isArray(chargeType) ? chargeType : [chargeType];
        const basicArray = Array.isArray(basic) ? basic : [basic];
        const fromValueArray = Array.isArray(fromValue) ? fromValue : [fromValue];
        const toValueArray = Array.isArray(toValue) ? toValue : [toValue];
        const amountArray = Array.isArray(amount) ? amount : [amount];
        const fromArray = Array.isArray(from) ? from : [from];
        const toArray = Array.isArray(to) ? to : [to];
    
        let cdrData = null
        if(forValue === "client") { 
            cdrData = await cdr.findOne({from: { $in: fromArray },to: { $in: toArray },rateON: rateON, client : client, for : "client"}).session(session)
        } else {
             cdrDATA = await cdr.findOne({from: { $in: fromArray },to: { $in: toArray },rateON: rateON, for : "city"}).session(session)
        }
          
            if(typeof cdrData !== "undefined" && cdrData !== null) {
               
                await session.abortTransaction()
                return res.status(400).send({message : "Rate For Same From & To Cities With same rate ON Already Exists"})
            }


            const conflicts = checkForConflicts(fromValueArray, toValueArray, chargeArray, basicArray);
            if(conflicts.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Conflicting Ranges Recieved"})
            }
            

            let defaultRateArray = []
            let freightCount = 0
          for(i=0; i < chargeArray.length; i++) {
            if(chargeArray[i] === "freight") {
                freightCount++
             }
            const defaultRate =  {
                charge : chargeArray[i],
                chargeType : chargeTypeArray[i],
                basic : basicArray[i],
                from : fromValueArray[i],
                to : toValueArray[i],
                amount : amountArray[i]   
            }
            defaultRateArray.push(defaultRate)
          }

          if(freightCount === 0) {
            await session.abortTransaction()
            return res.status(400).send({message : "Freight Charge Is Mandatory"})
           }

          let clientDATA = null
            if(forValue === "client") { 
                clientDATA = client
            }

          const newDefaultRate = new cdr ({
            for : forValue,
            client  : clientDATA,
            rateON : rateON,
            effectiveDate : effectiveDate,
            from : fromArray,
            to : toArray,
            defaultRate : defaultRateArray
          })

          await newDefaultRate.save({session})

          await ro.findByIdAndUpdate(rateON, {lock : true})
          await session.commitTransaction()
          res.sendStatus(200)

  
    } catch(err) {
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)
    } finally { 
        session.endSession()
    }
})

Route.get("/masters/rates/rate-master/edit", async(req, res)=> {
    const db = req.dbConnection
    const cdr = db.model("client-default-rates", cdrSchema)

    const data = await cdr.findById(req.query.id)
    res.status(200).send(data)
})

Route.post("/masters/rates/rate-master/edit", async(req, res)=> {
    const db = req.dbConnection
    const cdr = db.model("client-default-rates", cdrSchema)
    const ro = db.model("rate-on", roSchema)
    const session = await db.startSession()
    try { 
        session.startTransaction()
        const {id, client, rateON, effectiveDate, from, to, charge, chargeType,  basic, fromValue, toValue, amount} = req.body
        const chargeArray = Array.isArray(charge) ? charge : [charge];
        const chargeTypeArray = Array.isArray(chargeType) ? chargeType : [chargeType];
        const basicArray = Array.isArray(basic) ? basic : [basic];
        const fromValueArray = Array.isArray(fromValue) ? fromValue : [fromValue];
        const toValueArray = Array.isArray(toValue) ? toValue : [toValue];
        const amountArray = Array.isArray(amount) ? amount : [amount];
        const fromCity =Array.isArray(from) ? from : [from];
        const toCity = Array.isArray(to) ? to : [to];
        const cdrDATA = await cdr.findOne({from: { $in: fromCity },to: { $in: toCity },rateON: rateON}).session(session)
          
            if(cdrDATA && cdrDATA.id !== id) {
               
                await session.abortTransaction()
                return res.status(400).send({message : "Rate For Some From & To Cities With same rate ON Already Exists"})
            }


            const conflicts = checkForConflicts(fromValueArray, toValueArray, chargeArray, basicArray);
            if(conflicts.length > 0) {
                await session.abortTransaction()
                return res.status(400).send({message : "Conflicting Ranges Recieved"})
            }

            const rateToUpdate = await cdr.findById(id)
            rateToUpdate.defaultRate = []
            rateToUpdate.client = client
            rateToUpdate.effectiveDate = effectiveDate
            rateToUpdate.from = fromCity
            rateToUpdate.to = toCity
           
            let defaultRateArray = []
          for(i=0; i < chargeArray.length; i++) {
            const defaultRate =  {
                charge : chargeArray[i],
                chargeType : chargeTypeArray[i],
                basic : basicArray[i],
                from : fromValueArray[i],
                to : toValueArray[i],
                amount : amountArray[i]   
            }
            defaultRateArray.push(defaultRate)
          }

          rateToUpdate.defaultRate = defaultRateArray
          await ro.findByIdAndUpdate(rateON, {lock : true})
          await rateToUpdate.save()
          await session.commitTransaction()
          res.sendStatus(200)

  
    } catch(err) {
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)
    } finally { 
        session.endSession()
    }
})

Route.post("/masters/rates/rate-master/delete", async(req, res)=> {

    const db = req.dbConnection
    const cdr = db.model("client-default-rate", cdrSchema)
    await cdr.findByIdAndDelete(req.query.id)
    res.sendStatus(200)

})

module.exports = Route