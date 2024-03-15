const express = require("express")
const Route = express.Router()
const stateSchema = require("../../../models/masters/locations/states")
const zonesSchema = require("../../../models/masters/locations/zones")
Route.get("/masters/locations/get-states", async (req, res)=> {
    const db = req.dbConnection
    const state = db.model("states", stateSchema)
    const zones = db.model("zones", zonesSchema)
    const id = req.query.id
    const stateData = await state.find({country : id})
    if(stateData.length < 1) {
        res.status(400).send({message : "No States Added For This Country"})
    } else {
        const newData = stateData.map((element)=>({
            name : element.name,
            id : element.id
        }))

        res.status(200).send(newData)
    }
})


Route.get("/masters/locations/get-zones", async (req, res)=> {
    const db = req.dbConnection
    const state = db.model("states", stateSchema)
    const zones = db.model("zones", zonesSchema)
    const id = req.query.id
    const zoneData = await zones.find({country : id})

    if(zoneData.length < 1) {
        res.status(400).send({message : "No Zones Added For This Country"})
    } else {
        const newData = zoneData.map((element)=>({
            name : element.name,
            id : element.id
        }))

        res.status(200).send(newData)
    }
})
module.exports = Route