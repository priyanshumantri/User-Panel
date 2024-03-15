const express = require("express")
const Route = express.Router()
const permissionSchema = require("../../../models/authentication/permissions")
const {activityLogger} = require("../../../custom_modules/activityLogger")



Route.get("/user-management/permissions", (req, res) => {
    const db = req.dbConnection
    const permissions = db.model("permissions", permissionSchema)
    permissions.find({}).populate("roles").then((data) => {
        
        res.render("userManagement/permissions/new", { data: data });
    })
})









Route.post("/user-management/permissions", (req, res) => {
    const db = req.dbConnection
    const permissions = db.model("permissions", permissionSchema)
    permissions.findOne({ permissionName: req.body.permissionName.toUpperCase() }, (err, data) => {

        if (err) {
            activityLogger(req, "Failed to create a permission", "500" )
            res.sendStatus(500)

        } else if (data) {
            activityLogger(req, "Failed to create a permission since permission with that name already existed", "400" )
            res.sendStatus(400)

        } else {
            const DateF = new Date()
            const date = DateF.getDate()
            const month = DateF.getMonth() + 1
            const year = DateF.getFullYear()

            const currentDate = date + "-" + month + "-" + year
            const newPermission = new permissions({
                permissionName: req.body.permissionName.replace(/\s/g, '').toUpperCase(), // Remove spaces and convert to uppercase
                createdAt: currentDate,
                core: req.body.core === 'true'

            })

            newPermission.save().then((data) => {
                activityLogger(req, "New Permission Created That Is:  " + data.permissionName, "200" )
                res.sendStatus(200)
            }).catch((error) => {
                activityLogger(req, "Failed to create a permission", "500" )
                res.sendStatus(500)
            })
        }
    });

})



Route.post("/user-management/permissions/edit", async (req, res) => {
    try {
      const db = req.dbConnection;
      const permissions = db.model("permissions", permissionSchema);
      const permission = await permissions.findById(req.body.permissionId);
  
      if (!permission) {
        return res.sendStatus(404); // Permission not found
      }
  
      if (permission.core) {
        return res.sendStatus(400); // Core permission cannot be edited
      }
  
      const existingPermission = await permissions.findOne({ permissionName: req.body.permissionName.toUpperCase() });
      if (existingPermission) {
        return res.sendStatus(400); // Permission with the same name already exists
      }
  
      const updateCore = req.body.core === true;
      await permissions.findByIdAndUpdate(req.body.permissionId, { permissionName: req.body.permissionName.toUpperCase(), core: updateCore });
  
      // Log success and send a 200 response
      activityLogger(req, "Successfully Edited Permission: " + req.body.permissionName, 200);
      res.sendStatus(200);
    } catch (err) {
      console.error(err);
      activityLogger(req, "Failed to edit a permission", "500");
      res.sendStatus(500);
    }
  });
  


Route.post("/user-management/permissions/delete", (req, res) => {
    const db = req.dbConnection
    const permissions = db.model("permissions", permissionSchema)
    permissions.findById(req.body.id, (err, data) => {
        if (err) {
            activityLogger(req,  "Failed to delete a permission", "500" )
            res.status(400).send({message : "Failed To Delete"})
        } else if (data.roles.length >= 1) {
            activityLogger(req,  "Failed to delete a permission since it had roles", "400" )
            res.status(400).send({message : "Failed To Delete a Permission Since It Has Roles"})
        } else if (data.core === true) {
            activityLogger(req,  "Failed to delete a core permission", "400" )
            rres.status(400).send({message : "Failed To a Core Permission"})
        } else {
            permissions.findByIdAndDelete(req.body.id, (err) => {
                if (err) {
                    activityLogger(req,  "Failed to delete a permission", "500" )
                    res.sendStatus(500)
                } else {
                    activityLogger(req, data.permissionName + "Permission Deleted", "200" )
                    res.sendStatus(200)
                }
            })
        }
    })
})
module.exports = Route