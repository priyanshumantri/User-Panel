const express = require("express")

const Route = express.Router()
const upload = require("../../configs/multer")
const userSchema = require("../../models/authentication/user")


Route.get("/profile/overview", (req, res) => {
    const db = req.dbConnection
    const userUP = db.model("users", userSchema)
    userUP.findById(req.user.id, (err, data)=> {
        if(err) {
            console.log(err)
        } else {
            res.render("profile/overview", {userData : data})
        }
    })
    
})



module.exports = Route