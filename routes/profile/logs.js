const express = require("express")
const Route = express.Router()



Route.get("/profile/logs", (req, res)=>{
    res.render("profile/logs", {sessionToken : req.session.sessionToken})
})

module.exports = Route