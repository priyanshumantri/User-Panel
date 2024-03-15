const express = require("express")
const Route = express.Router()
const roleSchema = require("../../../models/authentication/roles")
const permissionSchema = require("../../../models/authentication/permissions")
const { activityLogger } = require("../../../custom_modules/activityLogger")




Route.post("/user-management/roles/new",async (req, res) => {
    const db = req.dbConnection
    const role = db.model("roles", roleSchema)
    const permission = db.model("permissions", permissionSchema)
    const session = await db.startSession();
    try {
        session.startTransaction();
        const data = await role.findOne({ roleType: { $regex: new RegExp(req.body.roleName, 'i') } }).session(session);
        if (data) {
            await session.abortTransaction();
            activityLogger(req, "Failed to add a role since role with that name already existed", "400");
            res.sendStatus(400);
            return;
        }

        const roleName = req.body.roleName; // The role name
        const permissions = Array.isArray(req.body.permission) ? req.body.permission : [req.body.permission];
        const readPermissions = Array.isArray(req.body.read) ? req.body.read : [req.body.read];
        const createPermissions = Array.isArray(req.body.create) ? req.body.create : [req.body.create];
        const writePermissions = Array.isArray(req.body.write) ? req.body.write : [req.body.write];
        const deletePermissions = Array.isArray(req.body.delete) ? req.body.delete : [req.body.delete];
        const exportPermissions = Array.isArray(req.body.export) ? req.body.export : [req.body.export];

        var constructedObject = [];

        permissions.forEach((data) => {
            //for read permissions
            if (readPermissions.find((element) => element === data)) {
                const newObject = {
                    permissionID: data,
                    canRead: true,
                    canWrite: false,
                    canCreate: false,
                    canDelete: false,
                    canExport: false
                }
                constructedObject.push(newObject)
            } else {
                const newObject = {
                    permissionID: data,
                    canRead: false,
                    canWrite: false,
                    canCreate: false,
                    canDelete: false,
                    canExport: false
                }

                constructedObject.push(newObject)
            }

            //For Write Permissions
            if (writePermissions.find((element) => element === data)) {
                constructedObject.forEach((constData) => {
                    if (constData.permissionID === data) {
                        constData.canWrite = true
                    }
                })
            }

            //for create permissions
            if (createPermissions.find((element) => element === data)) {
                constructedObject.forEach((constData) => {
                    if (constData.permissionID === data) {
                        constData.canCreate = true
                    }
                })
            }

            //For Delete Permissions
            if (deletePermissions.find((element) => element === data)) {
                constructedObject.forEach((constData) => {
                    if (constData.permissionID === data) {
                        constData.canDelete = true
                    }
                })
            }

            //For Export Permissions
            if (exportPermissions.find((element) => element === data)) {
                constructedObject.forEach((constData) => {
                    if (constData.permissionID === data) {
                        constData.canExport = true
                    }
                })
            }
        })

        const newRole = new role({
            roleType: roleName,
            permissions: constructedObject
        })

        const savedRole = await newRole.save({ session: session})

        const newRolePermissions = [];
        savedRole.permissions.forEach((newD, index) => {
            if (newD.canRead || newD.canWrite || newD.canCreate || newD.canDelete || newD.canExport) {
                newRolePermissions.push(newD.permissionID);
            }
        });

        for (let index = 0; index < newRolePermissions.length; index++) {
            const permissionID = newRolePermissions[index];
            await permission.findByIdAndUpdate(permissionID, { $push: { roles: savedRole.id } }).session(session);
        }
        await session.commitTransaction();

        activityLogger(req, savedRole.roleType + " Role Added", "200");
        res.sendStatus(200);
    } catch (err) {
        console.log(err)
        await session.abortTransaction();
        activityLogger(req, "Failed to add a role", "500");
        res.sendStatus(500);
    } finally {
        session.endSesion()
    }

})

module.exports = Route