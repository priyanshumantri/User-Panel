const express = require("express")
const Route = express.Router()
const roleSchema = require("../../../models/authentication/roles")
const permissionSchema = require("../../../models/authentication/permissions")
const {activityLogger} = require("../../../custom_modules/activityLogger")

Route.get("/user-management/roles/edit", (req, res) => {
    const db = req.dbConnection
    const role = db.model("roles", roleSchema)
    const permission = db.model("permissions", permissionSchema)
    role.findById(req.query.id).then((data) => {
        permission.find({}, (err, permissionData) => {
           
            res.render("userManagement/roles/editRoles", { roleData: data, permissionData: permissionData })
        })
    })

})


Route.post("/user-management/roles/edit", async (req, res) => {
    const permissionsNonArray = req.body.permission;
    const permissions = Array.isArray(permissionsNonArray) ? permissionsNonArray : (permissionsNonArray ? [permissionsNonArray] : []);
    const roleId = req.body.roleID;
    const db = req.dbConnection
    const role = db.model("roles", roleSchema)
    const permission = db.model("permissions", permissionSchema)
    const session = await db.startSession();
    try {
        session.startTransaction();
        // Clear all permissions associated with the role
        await role.updateOne({ _id: roleId }, { $set: { permissions: [] } }).session(session);

        const readPermissions = Array.isArray(req.body.read) ? req.body.read : (req.body.read ? [req.body.read] : []);
        const createPermissions = Array.isArray(req.body.create) ? req.body.create : (req.body.create ? [req.body.create] : []);
        const writePermissions = Array.isArray(req.body.write) ? req.body.write : (req.body.write ? [req.body.write] : []);
        const deletePermissions = Array.isArray(req.body.delete) ? req.body.delete : (req.body.delete ? [req.body.delete] : []);
        const exportPermissions = Array.isArray(req.body.export) ? req.body.export : (req.body.export ? [req.body.export] : []);

        const constructedObject = permissions.map((data) => {
            const canRead = readPermissions.includes(data);
            const canWrite = writePermissions.includes(data);
            const canCreate = createPermissions.includes(data);
            const canDelete = deletePermissions.includes(data);
            const canExport = exportPermissions.includes(data);
            // Check if at least one permission type is true
            const hasPermission = canRead || canWrite || canCreate || canDelete || canExport

            return {
                permissionID: data,
                canRead,
                canWrite,
                canCreate,
                canDelete,
                canExport,
                hasPermission,
            };
        });

        // Update the role with the new permissions
        await role.updateOne({ _id: roleId }, { $push: { permissions: { $each: constructedObject } } }).session(session);

        // Retrieve the current permissions assigned to the role
        const roleData = await role.findById(roleId).session(session);

        // Clear the role from all permissions where hasPermission is false
        const prevPermissionIDs = roleData.permissions
            .filter((p) => !p.hasPermission)
            .map((p) => p.permissionID);

        await permission.updateMany(
            { _id: { $in: prevPermissionIDs } },
            { $pull: { roles: roleId } }
        );

        // Push the role again to all permissions where hasPermission is true
        const newPermissionIDs = constructedObject
            .filter((p) => p.hasPermission)
            .map((p) => p.permissionID);

        await permission.updateMany(
            { _id: { $in: newPermissionIDs } },
            { $push: { roles: roleId } }
        ).session(session);
        await session.commitTransaction();
        activityLogger(req, "Permissions in the role " + roleData.roleType + "edited", "200" )
        res.sendStatus(200);
    } catch (error) {
        await session.abortTransaction();
        console.log(error)
        activityLogger(req, "Failed to edit role", "500" )
        res.sendStatus(500);
    }
});


Route.post("/user-management/roles/delete", async (req, res) => {
    
    const db = req.dbConnection;
    const role = db.model("roles", roleSchema);
    const permission = db.model("permissions", permissionSchema);
    const session = await db.startSession();
    try {
        session.startTransaction();
        const data = await role.findById(req.query.id).session(session);
        if (!data) {
            await session.abortTransaction();
            activityLogger(req, "Failed to delete a role", "500");
            res.sendStatus(500);
            return;
        }
        if (data.users.length >= 1) {
            await session.abortTransaction();
            activityLogger(req, "Failed to delete role " + data.roleType + ", since it had users in it", "500");
            res.sendStatus(400);
            return;
        }
        const permissionsAssigned = [];
        data.permissions.forEach((roleData, index) => {
            if (roleData.canRead || roleData.canDelete || roleData.canCreate || roleData.canWrite) {
                permissionsAssigned.push(roleData.permissionID);
            }
        });
        for (let index = 0; index < permissionsAssigned.length; index++) {
            const permissionID = permissionsAssigned[index];
            await permission.findByIdAndUpdate(permissionID, { $pull: { roles: data.id } }).session(session);
        }
        await role.findByIdAndDelete(data.id).session(session);
       await session.commitTransaction();
        activityLogger(req, "Deleted Role: " + data.roleType, "200");
        res.sendStatus(200);
    } catch (err) {
       await session.abortTransaction();
        console.log(err);
        activityLogger(req, "Failed to delete role", "500");
        res.sendStatus(500);
    } finally {
        session.endSession();
    }
});



module.exports = Route
