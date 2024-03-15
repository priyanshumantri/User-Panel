const express = require("express")
const Route = express.Router()
const branchSchema = require("../../../models/masters/locations/branch")
const godownSchema = require("../../../models/masters/locations/godowns")
const zoneSchema = require("../../../models/masters/locations/zones")
const stateSchema = require("../../../models/masters/locations/states")
const lrSchema = require("../../../models/transactions/bookings/lorry-reciept")
const citySchema = require("../../../models/masters/locations/cities")
const userSchema = require("../../../models/authentication/user")
const getLedgers = require("../../../custom_modules/accounts/getLedgers")
const moment = require('moment');
const mongoose = require("mongoose")
const rangeSplitter = require("../../../custom_modules/dates/rangeSplitter")

Route.get("/reports/booking/booking-register", async (req, res) => {
    const db = req.dbConnection
    const branch = db.model("branches", branchSchema)
    const godown = db.model("godowns", godownSchema)
    const zone = db.model("zones", zoneSchema)
    const states = db.model("states", stateSchema)
    const city = db.model("cities", citySchema)
    const user = db.model("users", userSchema)
    const branchData = await branch.find({}).populate("state")
    const godownData = await godown.find({}).populate("branch").populate("state")
    const zoneData = await zone.find({})
    const cityData = await city.find({}).populate("state")
    const sundryDebtors = await getLedgers(db, "sundrydebtors")
    const userDataNew = await user.find({})
    const userData = await userDataNew.map(data => {
        return {
            id: data.id,
            name: data.firstName + " " + data.lastName
        }
    })
    res.render("reports/booking/bookingRegister", { branchData, godownData, zoneData, cityData, sundryDebtors, userData })
})


Route.post("/reports/booking/booking-register", async (req, res) => {



})

//Route for getting branch from selected


module.exports = Route