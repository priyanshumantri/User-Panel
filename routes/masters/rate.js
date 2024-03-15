const express = require("express")
const Route = express.Router()

Route.get("/masters/rate", (req, res)=> {
    res.render("masters/rate")
})

module.exports = Route