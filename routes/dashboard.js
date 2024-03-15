const express = require("express")
const Route = express.Router()
const {activityLogger} = require("../custom_modules/activityLogger")


Route.get("/dashboard",(req, res) =>{

  res.render("dashboard")
})



module.exports = Route