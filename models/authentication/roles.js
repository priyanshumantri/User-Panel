const mongoose = require("mongoose")
const roleSchema = new mongoose.Schema ({

    roleType :{
        required : true,
        type : String
    },
    permissions: [
        {
            permissionID: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "permissions"
            },
            canRead: {
                type: Boolean,
                default: false
            },
            canWrite: {
                type: Boolean,
                default: false
            },
            canDelete: {
                type: Boolean,
                default: false
            },
            canCreate : {
                type : Boolean,
                default : false
            },
            canExport : {
                type : Boolean,
                default : false
            }
        }
    ],
    users: [{

        type: mongoose.Schema.Types.ObjectId,
        ref: "users"


    }],
})



module.exports = roleSchema
