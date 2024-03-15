const express = require ("express")
const Route = express.Router()
const fySchema = require("../../models/financialYear")
const userSchema = require("../../models/authentication/user")
Route.get("/select-session", async (req, res) => { 
 
   if(req.user.financialYear !== null) { 
      res.redirect("/dashboard")
    } else {
      const db = req.dbConnection
      const fy = db.model("financial-years", fySchema)
      const fyData = await fy.find()
      res.render("authentication/select-session", {data : fyData})
    }

 })

 Route.post("/select-session", async (req, res) => { 
const db = req.dbConnection
const user = db.model("users", userSchema)

user.findByIdAndUpdate(req.user.id, {financialYear : req.body.fy}, (err, data) => {
    if(err) {
        console.log(err)
    } else {
        res.redirect("/dashboard")
    }
  })

})

    module.exports = Route