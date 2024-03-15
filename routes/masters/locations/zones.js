const express = require("express")
const Route = express.Router()
const countriesSchema = require("../../../models/masters/locations/country")
const zonesSchema = require("../../../models/masters/locations/zones")


Route.get("/masters/locations/zones", async (req, res)=>{
    const db = req.dbConnection
    const countries = db.model("countries", countriesSchema)
    const zones = db.model("zones", zonesSchema)

    const countryData = await countries.find({})
    const zoneData = await zones.find({}).populate("country")
    res.render("masters/locations/zones", {countryData : countryData, zoneData : zoneData})
})

Route.post("/masters/locations/zones/new", async(req, res)=> {
    const db = req.dbConnection
    const countries = db.model("countries", countriesSchema)
    const zones = db.model("zones", zonesSchema)

    const session = await db.startSession()

    try {
        session.startTransaction();
        const {zone, country} = req.body

    if(!zone || !country) {
        await session.abortTransaction()
       return res.status(400).send({message : "Please Fill All Required Fields"})

    }

    const existingZone = await zones.findOne({name: {$regex : new RegExp(zone, 'i')}}, null, {session})
    if(existingZone) {
        await session.abortTransaction()
       return res.status(400).send({message : "Zone With This Name Already Exists"})
    }

    const newZone = new zones({
        name : zone,
        country : country
    })

   const savedData =  await newZone.save({session})

     const countryToUpdate = await countries.findById(country, null, {session})
     countryToUpdate.zones.push(savedData.id)
     await countryToUpdate.save()
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


Route.post("/masters/locations/zones/edit", async(req, res)=> {
    const db = req.dbConnection
    const zones = db.model("zones", zonesSchema)

    const session = await db.startSession()

   try {
session.startTransaction()
    const{id, zoneName} = req.body

    const existingZone = await zones.findOne({name: {$regex : new RegExp(zoneName, 'i')}}, null, {session})
    if(existingZone && existingZone.id !== id) {
        await session.abortTransaction()
        res.status(400).send({message : "Zone With This Name Already Exists"})
    }


    await zones.findByIdAndUpdate(id, {name : zoneName}, {session}).exec()
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

/** 
    Currently all zones can be deleted, no conditions implemented.
    Later conditions can be introdcued such as zone cant be deleted once it has states or any other condition
 */

Route.post("/masters/locations/zones/delete", async(req, res)=> {
    const db = req.dbConnection
    const zones = db.model("zones", zonesSchema)
    const countries = db.model("countries", countriesSchema)
   try {
    const id = req.body.id
    const data = await zones.findByIdAndDelete(id)
    await countries.findByIdAndUpdate(data.country, {$pull : {zones : data.id}})
    res.sendStatus(200)
   } catch(err) {
    console.log(err)
    res.sendStatus(500)
   }

})

module.exports = Route