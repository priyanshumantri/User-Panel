const express = require("express")
const Route = express.Router()
const validator = require("validator")
const communication = require("../../models/settings/communication")
const {activityLogger} = require("../../custom_modules/activityLogger")


Route.get("/settings/communication", (req, res)=> {
    communication.findOne({}, (err, data)=> {
        if(err) {
            
            console.log(err)
        } else {
            
            res.render("companySettings/communication", {emailData : data})
        }
    })
})

Route.post("/settings/communication", (req, res)=> {
    if(!req.body.authProcess) {
        activityLogger(req, "Failed to update communication emails since required fields were missing", "500" )
        req.flash("error", "All fields are required")
        res.redirect("/settings/communication")
    } else if(validator.isEmail(req.body.authProcess)) {

        communication.findOneAndUpdate({}, {authProcess : req.body.authProcess }, (err, data)=> {
            if(err) {
                activityLogger(req, "Failed to update communications email"  + "500" )
                console.log(err)
            } else {
                activityLogger(req, "Successfully updated communications email", "200" )
               res.sendStatus(200)
            }
        })

    } else {
        activityLogger(req, "Failed to update communications email due to invalid email address", "400" )
        res.sendStatus(400)
    }
})

module.exports = Route