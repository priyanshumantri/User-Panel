const express = require("express")
const Route = express.Router()
const permissionSchema = require("../../../models/authentication/permissions")
const rolesSchema = require("../../../models/authentication/roles")
const {activityLogger} = require("../../../custom_modules/activityLogger")
Route.get("/user-management/roles", (req, res)=> {
    const db = req.dbConnection
    const roles = db.model("roles", rolesSchema)
    const permissions = db.model("permissions", permissionSchema)
    permissions.find({}, (err, data)=> {
        if(err) {
            
            console.log(err)
        } else {
            roles.find({}).populate("permissions.permissionID").then((roleData)=> {
                
                res.render("userManagement/roles/roles", {permissions : data, roles : roleData})
            })
            
        }
    })

})








module.exports = Route
