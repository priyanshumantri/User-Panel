
const userSchema = require("../../models/authentication/user")
const permissionSchema = require("../../models/authentication/permissions")
function checkLogin() {
    return async  function (req, res, next) {
        if (req.session && req.session.sessionToken) {
            const token = req.user.loginSessions.find((element) => element.sessionToken === req.session.sessionToken);
            if (token.isActiveSession === true) {
                
                next();
            } else {
                    
                req.session.destroy();
                return res.redirect("/login");
            }
        } else {
       
                req.session.destroy();
                return res.redirect("/login");
       
     
       
        }
    };
}

function canRead(permissionName) {
  
    return function (req, res, next) {
        const db = req.dbConnection
        const user = db.model("users", userSchema)
        const permissions = db.model("permissions", permissionSchema)
        user.findById(req.user.id).populate("role").then((userData) => {
            if(userData.role.roleType === "ADMIN") {
                next()
            } else{
                permissions.findOne({ permissionName: permissionName.toUpperCase() }).then((permissionData) => {
                    const permissionRequired = userData.role.permissions.find((element) => element.permissionID == permissionData.id)
                    if (permissionRequired.canRead === true) {
                        next()
                    } else {
                        res.sendStatus(401)
                    }
    
                })
            }
        })

    };
}


function canWrite(permissionName) {
    
    return function (req, res, next) {
        const db = req.dbConnection
        const user = db.model("users", userSchema)
        const permissions = db.model("permissions", permissionSchema)
        user.findById(req.user.id).populate("role").then((userData) => {
            if(userData.role.roleType === "ADMIN") {
                next()
            } else{
                permissions.findOne({ permissionName: permissionName.toUpperCase() }).then((permissionData) => {
                    const permissionRequired = userData.role.permissions.find((element) => element.permissionID == permissionData.id)
                    if (permissionRequired.canWrite === true) {
                        next()
                    } else {
                        res.sendStatus(401)
                    }
    
                })
            }
        })
    };
}

function canCreate(permissionName) {
    
    return function (req, res, next) {
        const db = req.dbConnection
        const user = db.model("users", userSchema)
        const permissions = db.model("permissions", permissionSchema)
        user.findById(req.user.id).populate("role").then((userData) => {
            if(userData.role.roleType === "ADMIN") {
                next()
            } else{
                permissions.findOne({ permissionName: permissionName.toUpperCase() }).then((permissionData) => {
                    const permissionRequired = userData.role.permissions.find((element) => element.permissionID == permissionData.id)
                    if (permissionRequired.canCreate === true) {
                        next()
                    } else {
                        res.sendStatus(401)
                    }
    
                })
            }
        })

    };
}

function canDelete(permissionName) {
    return function (req, res, next) {
        const db = req.dbConnection
        const user = db.model("users", userSchema)
        const permissions = db.model("permissions", permissionSchema)
        user.findById(req.user.id).populate("role").then((userData) => {
            if(userData.role.roleType === "ADMIN") {
                next()
            } else{
                permissions.findOne({ permissionName: permissionName.toUpperCase() }).then((permissionData) => {
                    const permissionRequired = userData.role.permissions.find((element) => element.permissionID == permissionData.id)
                    if (permissionRequired.canDelete === true) {
                        next()
                    } else {
                        res.sendStatus(401)
                    }
    
                })
            }
        })

    };
}



module.exports = { checkLogin, canRead, canCreate, canDelete, canWrite }