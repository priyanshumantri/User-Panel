const express = require("express")
const Route = express.Router()
const countrySchema = require("../../../models/masters/locations/country")
const mongoose = require("mongoose")


Route.get("/masters/locations/countries",async (req, res)=> {
    const db = req.dbConnection
    const country = db.model("countries", countrySchema)
try {
    const countryData = await country.find({})
    res.render("masters/locations/country", {data : countryData})
} catch(err) {
    console.log(err)
    res.sendStatus(50)
}

})

Route.post("/masters/locations/countries/edit", async(req, res)=> {
    const db = req.dbConnection
    const country = db.model("countries", countrySchema)
    const session = await db.startSession()
    session.startTransaction();
    try {
        const {id, name, code} = req.body

        const existingCode = await country.findOne({code : code}, null, {session})
        if(existingCode && existingCode.id.toString() !== id.toString()) {
        return res.status(400).send({message : "Country with This Code Already Exists"})
        }
    
        const updateCountry = await country.findById(id, null, {session})
        updateCountry.name = name
        updateCountry.code = code
    
        await updateCountry.save()
        await session.commitTransaction()
        return res.sendStatus(200)
    
    } catch(err) {
        await session.abortTransaction()
        console.log(err)
        res.sendStatus(500)
    } finally {
        session.endSession()
    }
})

Route.post("/masters/locations/countries/delete", async(req, res)=> {
    try {
        const db = req.dbConnection
    const country = db.model("countries", countrySchema)
    const countryToDelete = await country.findById(req.body.id)
    if(countryToDelete.states.length > 1) {
        return res.status(400).send({message : "Countries With State Cannot Be Deleted"})
    }

    await country.findByIdAndDelete(req.body.id).exec()
    return res.sendStatus(200)
    } catch(err) {
        console.log(err)
        res.sendStatus(500)
    }

})

module.exports = Route