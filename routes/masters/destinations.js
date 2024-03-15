const express = require("express")
const Route = express.Router()
const destinations = require("../../models/masters/destination")
const states = require("../../models/masters/locations/states")



Route.get("/masters/destinations", (req, res)=> {
    destinations.find({}).then((destinationData)=> {
        states.find({}).then((stateData)=> {
            res.render("masters/destinations", {destinationData : destinationData, stateData : stateData})
        })
    })
})

module.exports =  Route
