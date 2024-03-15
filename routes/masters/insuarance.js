const express = require("express")
const Route = express.Router()

Route.get("/masters/insuarance", (req, res)=> {
    res.render("masters/insuarance")
})

module.exports = Route